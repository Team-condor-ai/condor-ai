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

async function insertarChat(sb: any, clienteId: string, remitente: "cliente" | "barbara" | "staff", mensaje: string, piezaId: string | null = null) {
  await sb.from("barbara_chats").insert({ barbara_cliente_id: clienteId, remitente, mensaje, pieza_id: piezaId });
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

async function conversar(sb: any, barbaraClienteId: string, mensaje: string) {
  const AK = Deno.env.get("ANTHROPIC_API_KEY");
  if (!AK) return "Recibí tu mensaje. El equipo debe habilitar el canal de conversación para responderte desde aquí.";
  const [{ data: ficha }, { data: recientes }, { data: historial }] = await Promise.all([
    sb.from("barbara_clientes").select("rubro,clientes(negocio),barbara_formulario(publico_objetivo,tono,producto_destacar)").eq("id", barbaraClienteId).maybeSingle(),
    sb.from("barbara_memoria").select("tipo,angulo,estado").eq("barbara_cliente_id", barbaraClienteId).order("creado_en", { ascending: false }).limit(5),
    sb.from("barbara_chats").select("remitente,mensaje").eq("barbara_cliente_id", barbaraClienteId).order("creado_en", { ascending: false }).limit(8),
  ]);
  const negocio = (ficha as any)?.clientes?.negocio || "la marca";
  const formulario = (ficha as any)?.barbara_formulario?.[0] || (ficha as any)?.barbara_formulario || {};
  const contexto = [
    `Marca: ${negocio}. Rubro: ${(ficha as any)?.rubro || "no especificado"}.`,
    `Público: ${formulario.publico_objetivo || "sin definir"}. Tono: ${formulario.tono || "sin definir"}.`,
    `Piezas recientes: ${(recientes ?? []).map((p: any) => `${p.tipo}: ${p.angulo || "sin ángulo"} (${p.estado || "histórica"})`).join(" | ") || "sin piezas"}.`,
  ].join("\n");
  const conversacion = (historial ?? []).reverse().map((m: any) => `${m.remitente}: ${m.mensaje}`).join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5", max_tokens: 500,
        system: "Eres Bárbara, directora de contenido de una marca. Respondes en español, breve y concreta. Ayudas a idear, aclarar el estado de entregas y orientar el uso del producto. No dices que una pieza fue publicada si no lo confirma el contexto. No tomes una pregunta como una corrección ni prometas una regeneración. Para cambios a una entrega, recuerda usar Entregas.",
        messages: [{ role: "user", content: `${contexto}\n\nConversación reciente:\n${conversacion || "(primera conversación)"}\n\nMensaje actual: ${mensaje}` }],
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

  let accion = "chat", barbaraClienteId = "", mensaje = "", piezaId = "";
  try {
    const body = await req.json();
    accion = String(body?.accion || "chat"); barbaraClienteId = String(body?.barbara_cliente_id || "").trim();
    mensaje = String(body?.mensaje || "").trim().slice(0, 2000); piezaId = String(body?.pieza_id || "").trim();
  } catch { return json({ error: "cuerpo inválido" }, 400); }
  if (!barbaraClienteId || !["chat", "correccion", "aprobar"].includes(accion)) return json({ error: "solicitud inválida" }, 400);
  if (["chat", "correccion"].includes(accion) && !mensaje) return json({ error: "escribe un mensaje" }, 400);
  if (["correccion", "aprobar"].includes(accion) && !piezaId) return json({ error: "falta la pieza a revisar" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) {
    const { data: fila } = await sb.from("barbara_clientes").select("id,clientes(email)").eq("id", barbaraClienteId).maybeSingle();
    if (!fila || String((fila as any)?.clientes?.email || "").toLowerCase() !== user.email.toLowerCase()) return json({ error: "sin acceso a este cliente de Bárbara" }, 403);
  }

  if (accion === "chat") {
    await insertarChat(sb, barbaraClienteId, admin ? "staff" : "cliente", mensaje);
    const respuesta = await conversar(sb, barbaraClienteId, mensaje);
    await insertarChat(sb, barbaraClienteId, "barbara", respuesta);
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
