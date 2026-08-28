// Portal de Bárbara: conversación separada de la revisión de entregas.
// Solo `correccion` consume un intento; `chat` jamás dispara una generación.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });
const REPO = "Team-condor-ai/condor-ai";
const WORKFLOW = "barbara-clientes.yml";
const MAX_INTENTOS = 3;
const GH_TOKEN = Deno.env.get("GITHUB_DISPATCH_TOKEN") || Deno.env.get("GH_TOKEN") || "";

async function insertarChat(
  sb: any,
  clienteId: string,
  remitente: "cliente" | "barbara" | "staff",
  mensaje: string,
  piezaId: string | null = null,
  extra: { imagen_path?: string | null } = {},
) {
  const { data } = await sb.from("barbara_chats").insert({
    barbara_cliente_id: clienteId,
    remitente,
    mensaje,
    pieza_id: piezaId,
    // El hilo es uno solo: lo que entra por acá queda marcado como portal para
    // poder distinguirlo de lo que llega por Telegram sin separarlo en dos
    // conversaciones. Ver migración 20260828_barbara_chat_unificado.
    canal: "portal",
    imagen_path: extra.imagen_path ?? null,
  }).select("id").single();
  return data?.id ?? null;
}

const BUCKET_MEDIA = "barbara-media";

/**
 * El bucket es privado: el modelo no puede leer la ruta directa. Se firma por
 * un rato corto, solo para esta llamada. Devuelve null si la ruta no existe,
 * porque una imagen ilegible no debe voltear el chat entero.
 */
async function firmar(sb: any, ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  const { data, error } = await sb.storage.from(BUCKET_MEDIA).createSignedUrl(ruta, 300);
  if (error) { console.error("no se pudo firmar la imagen:", error.message); return null; }
  return data?.signedUrl ?? null;
}

/**
 * El hilo real del cliente, venga del portal o de Telegram.
 *
 * Antes el navegador mandaba el historial de la visita y el servidor le creía.
 * Eso hacía que la conversación se perdiera al recargar, que Telegram y portal
 * parecieran dos personas distintas, y que el cliente pudiera inventar el
 * historial que quisiera. Ahora la fuente es la tabla.
 */
async function historialReal(sb: any, clienteId: string, limite = 20): Promise<MensajeSesion[]> {
  const { data } = await sb
    .from("barbara_chats")
    .select("remitente,mensaje,canal,creado_en")
    .eq("barbara_cliente_id", clienteId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  return (data ?? [])
    .reverse()
    .map((f: any): MensajeSesion => ({
      remitente: f.remitente === "barbara" ? "barbara" : "cliente",
      // De dónde vino importa para que Bárbara no diga "como te decía acá" si
      // en realidad se lo dijeron por Telegram.
      mensaje: f.canal === "telegram" ? `(por Telegram) ${f.mensaje}` : String(f.mensaje || ""),
    }))
    .filter((m: MensajeSesion) => m.mensaje);
}

async function dispararReintento(barbaraClienteId: string, piezaId: string, tipo: string) {
  if (!GH_TOKEN) return false;
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { Authorization: "Bearer " + GH_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "condor-barbara-entregas" },
    body: JSON.stringify({ ref: "main", inputs: { cliente_id: barbaraClienteId, pieza_id: piezaId, retry: "1", tipo } }),
  });
  return r.ok;
}

type MensajeSesion = { remitente: "cliente" | "barbara"; mensaje: string };

async function conversar(
  sb: any,
  barbaraClienteId: string,
  mensaje: string,
  historialSesion: MensajeSesion[],
  imagenUrl: string | null = null,
) {
  const AK = Deno.env.get("ANTHROPIC_API_KEY");
  if (!AK) return "Recibí tu mensaje. El equipo debe habilitar el canal de conversación para responderte desde aquí.";
  // Se suman las REGLAS y la MEMORIA privada: sin esto Bárbara conversaba sin
  // saber nada de lo que la marca ya le había enseñado, y el cliente tenía que
  // repetirle en el chat lo mismo que ya había corregido diez veces.
  const [{ data: ficha }, { data: recientes }, { data: reglas }, { data: nodos }] = await Promise.all([
    sb.from("barbara_clientes").select("rubro,clientes(negocio),barbara_formulario(publico_objetivo,tono,producto_destacar)").eq("id", barbaraClienteId).maybeSingle(),
    sb.from("barbara_memoria").select("tipo,angulo,estado").eq("barbara_cliente_id", barbaraClienteId).order("creado_en", { ascending: false }).limit(5),
    sb.from("barbara_reglas").select("regla,veces_reforzada").eq("barbara_cliente_id", barbaraClienteId).eq("activa", true).order("veces_reforzada", { ascending: false }).limit(12),
    sb.from("barbara_memoria_nodos").select("tipo,titulo,contenido").eq("barbara_cliente_id", barbaraClienteId).eq("activo", true).order("peso", { ascending: false }).limit(12),
  ]);
  const negocio = (ficha as any)?.clientes?.negocio || "la marca";
  const formulario = (ficha as any)?.barbara_formulario?.[0] || (ficha as any)?.barbara_formulario || {};
  const contexto = [
    `Marca: ${negocio}. Rubro: ${(ficha as any)?.rubro || "no especificado"}.`,
    `Público: ${formulario.publico_objetivo || "sin definir"}. Tono: ${formulario.tono || "sin definir"}.`,
    `Piezas recientes: ${(recientes ?? []).map((p: any) => `${p.tipo}: ${p.angulo || "sin ángulo"} (${p.estado || "histórica"})`).join(" | ") || "sin piezas"}.`,
    `Reglas que la marca ya enseñó: ${(reglas ?? []).map((r: any) => r.regla).join(" | ") || "ninguna todavía"}.`,
    `Memoria de la marca: ${(nodos ?? []).map((n: any) => `${n.titulo}: ${n.contenido}`).join(" | ") || "vacía"}.`,
  ].join("\n");
  const mensajesModelo: any[] = historialSesion.slice(-14).map((entrada) => ({
    role: entrada.remitente === "barbara" ? "assistant" : "user",
    content: entrada.mensaje,
  }));
  // Con imagen, el turno del cliente viaja como bloques: la referencia visual
  // primero y su texto después.
  if (imagenUrl) {
    mensajesModelo.push({
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: imagenUrl } },
        { type: "text", text: mensaje || "Te mando esta imagen como referencia." },
      ],
    });
  } else {
    mensajesModelo.push({ role: "user", content: mensaje });
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5", max_tokens: 900,
        system: `Eres Bárbara, directora de contenido de esta marca. Respondes en español natural, profesional, directa y cercana.

CONTEXTO VERIFICADO DE LA MARCA
${contexto}

REGLAS DE CONTENIDO
- Ayuda a idear, ordenar decisiones, explicar entregas y orientar el uso del producto.
- No afirmes que una pieza fue publicada ni que tienes datos en vivo si el contexto no lo confirma.
- No tomes una pregunta como una corrección ni prometas regeneraciones. Para cambiar una entrega, indica brevemente que se hace en Entregas.
- Habla como colaboradora experta. Evita frases genéricas, relleno, repeticiones y encabezados burocráticos.

REGLAS DE ESCRITURA
- Abre con la respuesta o recomendación concreta, no con un resumen del contexto que ya conoces.
- Usa párrafos cortos. Si hay 3 o más elementos comparables, usa una lista.
- Usa pasos numerados solo cuando exista un orden real.
- Puedes usar Markdown simple: títulos breves con ##, listas con -, negrita con ** y citas con >.
- Nunca muestres asteriscos sueltos, JSON, tablas Markdown ni bloques de código salvo que el usuario los pida.
- No repitas etiquetas como Marca, Rubro, Público o Tono a menos que sean necesarias para responder.
- Cierra con una sola pregunta útil solo cuando necesites una decisión para avanzar.`,
        messages: mensajesModelo,
      }),
    });
    if (!r.ok) throw new Error("modelo no disponible");
    const data = await r.json();
    return String((data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("") || "Recibí tu mensaje.").trim();
  } catch {
    return "Recibí tu mensaje, pero no pude responder ahora. Puedes revisar tus piezas en Entregas o volver a intentarlo en un momento.";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const sbUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sbUsuario.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);

  let accion = "chat", barbaraClienteId = "", mensaje = "", piezaId = "", canal = "", imagenPath = "";
  try {
    const body = await req.json();
    accion = String(body?.accion || "chat"); barbaraClienteId = String(body?.barbara_cliente_id || "").trim();
    mensaje = String(body?.mensaje || "").trim().slice(0, 2000); piezaId = String(body?.pieza_id || "").trim(); canal = String(body?.canal || "").trim().slice(0, 80);
    // Referencia visual del cliente: RUTA dentro del bucket privado, no una
    // URL. Así el chat nunca es un cargador de URLs arbitrarias hacia el
    // modelo, y el cliente solo puede apuntar a archivos que ya subió.
    imagenPath = String(body?.imagen_path || "").trim().slice(0, 400);
    if (imagenPath.includes("..") || imagenPath.startsWith("/")) imagenPath = "";
    // `historial` del navegador ya no se lee: el hilo se arma desde la tabla.
    // Se sigue aceptando en el cuerpo para no romper al portal desplegado.
  } catch { return json({ error: "cuerpo inválido" }, 400); }
  if (!barbaraClienteId || !["chat", "correccion", "aprobar", "publicar"].includes(accion)) return json({ error: "solicitud inválida" }, 400);
  // Con imagen, el texto puede venir vacío: la imagen ES el mensaje.
  if (accion === "chat" && !mensaje && !imagenPath) return json({ error: "escribe un mensaje" }, 400);
  if (accion === "correccion" && !mensaje) return json({ error: "escribe un mensaje" }, 400);
  if (["correccion", "aprobar", "publicar"].includes(accion) && !piezaId) return json({ error: "falta la pieza a revisar" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) {
    const { data: fila } = await sb.from("barbara_clientes").select("id,clientes(email)").eq("id", barbaraClienteId).maybeSingle();
    if (!fila || String((fila as any)?.clientes?.email || "").toLowerCase() !== user.email.toLowerCase()) return json({ error: "sin acceso a este cliente de Bárbara" }, 403);
  }

  if (accion === "chat") {
    // 28-ago-2026: la conversación del portal DEJA de ser efímera. Antes no se
    // insertaba nada y el navegador mandaba el historial de la visita, así que
    // al recargar se perdía todo, el mismo cliente parecía dos personas
    // distintas según escribiera por acá o por Telegram, y nada de lo hablado
    // podía alimentar la memoria. Ahora ambos canales escriben el mismo hilo.
    const historial = await historialReal(sb, barbaraClienteId);
    const mensajeId = await insertarChat(sb, barbaraClienteId, admin ? "staff" : "cliente", mensaje || "(imagen)", null, { imagen_path: imagenPath || null });
    // Se firma recién acá, por 5 minutos y solo para esta llamada al modelo.
    const respuesta = await conversar(sb, barbaraClienteId, mensaje, historial, await firmar(sb, imagenPath || null));
    await insertarChat(sb, barbaraClienteId, "barbara", respuesta);
    // Aprender de lo conversado va aparte y sin esperar: si falla, el cliente
    // igual recibió su respuesta. Nunca puede romper el chat.
    // Solo se le manda lo que escribió el CLIENTE, nunca la respuesta de
    // Bárbara: aprender de sí misma convertiría cada invención suya en un
    // "hecho" de la marca y se reforzaría sola en la pieza siguiente.
    if (mensaje) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/barbara-aprender-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ barbara_cliente_id: barbaraClienteId, mensaje, mensaje_id: mensajeId }),
      }).catch(() => {});
    }
    return json({ ok: true, respuesta });
  }

  const { data: pieza } = await sb.from("barbara_memoria").select("id,tipo,estado").eq("id", piezaId).eq("barbara_cliente_id", barbaraClienteId).maybeSingle();
  if (!pieza) return json({ error: "la pieza no existe o no pertenece a esta marca" }, 404);

  if (accion === "aprobar") {
    if (["aprobada", "publicada"].includes(pieza.estado)) return json({ ok: true, respuesta: "Esta pieza ya estaba aprobada." });
    const ahora = new Date().toISOString();
    await sb.from("barbara_memoria").update({ estado: "aprobada", revisada_en: ahora, revisada_por: user.email, revision_comentario: null }).eq("id", piezaId);
    const confirmacion = "Pieza aprobada. La publicación sigue siendo una acción separada y controlada.";
    await insertarChat(sb, barbaraClienteId, admin ? "staff" : "cliente", "Aprobé una pieza.", piezaId);
    await insertarChat(sb, barbaraClienteId, "barbara", confirmacion, piezaId);
    return json({ ok: true, respuesta: confirmacion });
  }

  if (accion === "publicar") {
    if (!admin) return json({ error: "solo el equipo puede registrar una publicación" }, 403);
    if (pieza.estado !== "aprobada") return json({ error: "primero debe aprobarse la pieza" }, 400);
    const confirmacion = "Publicación registrada. El estado de la entrega quedó actualizado.";
    await sb.from("barbara_memoria").update({ estado: "publicada", canal_publicacion: canal || "Canal no especificado", publicada_en: new Date().toISOString(), publicada_por: user.email }).eq("id", piezaId);
    await insertarChat(sb, barbaraClienteId, "staff", `Registré la publicación en ${canal || "un canal"}.`, piezaId);
    await insertarChat(sb, barbaraClienteId, "barbara", confirmacion, piezaId);
    return json({ ok: true, respuesta: confirmacion });
  }

  await insertarChat(sb, barbaraClienteId, admin ? "staff" : "cliente", mensaje, piezaId);
  const { data: correccion } = await sb.from("barbara_correcciones").select("id,intentos_usados,bloqueado").eq("barbara_cliente_id", barbaraClienteId).maybeSingle();
  if (correccion?.bloqueado) return json({ ok: true, bloqueado: true, respuesta: "Esta entrega ya agotó las correcciones disponibles. El equipo te contactará." });
  const intentosUsados = (correccion?.intentos_usados ?? 0) + 1;
  const seBloquea = intentosUsados >= MAX_INTENTOS;
  if (correccion?.id) await sb.from("barbara_correcciones").update({ intentos_usados: intentosUsados, bloqueado: seBloquea, actualizado_en: new Date().toISOString() }).eq("id", correccion.id);
  else await sb.from("barbara_correcciones").insert({ barbara_cliente_id: barbaraClienteId, intentos_usados: intentosUsados, bloqueado: seBloquea });
  const { data: contadorPieza } = await sb.from("barbara_memoria").select("correcciones_pedidas").eq("id", piezaId).maybeSingle();
  await sb.from("barbara_memoria").update({ estado: "requiere_ajuste", revision_comentario: mensaje, revisada_en: new Date().toISOString(), revisada_por: user.email, correcciones_pedidas: (contadorPieza?.correcciones_pedidas ?? 0) + 1 }).eq("id", piezaId);
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/barbara-destilar-regla`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }, body: JSON.stringify({ barbara_cliente_id: barbaraClienteId, texto: mensaje }) }).catch(() => {});
  if (seBloquea) return json({ ok: true, bloqueado: true, respuesta: "Usamos las 3 correcciones disponibles para esta pieza. El equipo te contactará." });
  const disparado = await dispararReintento(barbaraClienteId, piezaId, pieza.tipo);
  const respuesta = disparado ? "Recibí tu ajuste. Bárbara está preparando una nueva versión de esta pieza." : "Guardé tu ajuste, pero hubo un problema al iniciar la nueva versión. El equipo fue avisado.";
  await insertarChat(sb, barbaraClienteId, "barbara", respuesta, piezaId);
  return json({ ok: true, bloqueado: false, disparado, respuesta });
});
