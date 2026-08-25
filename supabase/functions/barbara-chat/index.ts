// Mensaje escrito desde el portal (módulo Agentes IA > Bárbara), NO desde
// Telegram. Mismo mecanismo real que `telegram-barbara-clientes`: registra
// el mensaje, destila la corrección en una regla, cuenta el intento contra
// las 3 correcciones por pieza, y dispara el reintento real en GitHub
// Actions — es el mismo camino, con otra puerta de entrada.
//
// A propósito NO duplica la lógica completa: comparte las mismas tablas y
// el mismo workflow que el webhook de Telegram, así que un cliente que
// escribe por el portal un día y por Telegram al otro sigue viendo la MISMA
// cuenta de intentos, sin dos sistemas que puedan desincronizarse.
//
// Secretos: GITHUB_DISPATCH_TOKEN (o GH_TOKEN), SUPABASE_URL,
//           SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy:  supabase functions deploy barbara-chat --project-ref <REF>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

const REPO = "Team-condor-ai/condor-ai";
const WORKFLOW = "barbara-clientes.yml";
const MAX_INTENTOS = 3;
const GH_TOKEN = Deno.env.get("GITHUB_DISPATCH_TOKEN") || Deno.env.get("GH_TOKEN") || "";

async function responderChat(sb: any, barbaraClienteId: string, mensaje: string): Promise<string> {
  const ak = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ak) return "Guardé tu mensaje en el historial de Bárbara. El chat inteligente se activará cuando configuremos la clave de IA del servicio.";

  const [nodosR, reglasR, chatR] = await Promise.all([
    sb.from("barbara_memoria_nodos").select("tipo,titulo,contenido,peso").eq("barbara_cliente_id", barbaraClienteId).eq("activo", true).order("peso", { ascending: false }).limit(12),
    sb.from("barbara_reglas").select("regla,veces_reforzada").eq("barbara_cliente_id", barbaraClienteId).eq("activa", true).order("veces_reforzada", { ascending: false }).limit(12),
    sb.from("barbara_chats").select("remitente,mensaje").eq("barbara_cliente_id", barbaraClienteId).order("creado_en", { ascending: false }).limit(8),
  ]);
  const memoria = (nodosR.data ?? []).map((n: any) => `- [${n.tipo}] ${n.titulo}: ${n.contenido}`).join("\n") || "(sin notas todavía)";
  const reglas = (reglasR.data ?? []).map((r: any) => `- ${r.regla}`).join("\n") || "(sin reglas todavía)";
  const historial = (chatR.data ?? []).reverse().map((m: any) => `${m.remitente === "barbara" ? "Bárbara" : "Cliente"}: ${m.mensaje}`).join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ak, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5", max_tokens: 450,
        system: "Eres Bárbara, agente de contenido de la marca. Responde en español neutro, breve y útil. Usa sólo el contexto entregado; si falta un dato, dilo y pregunta. No inventes métricas, publicaciones ni resultados. Una conversación normal NO es una corrección ni autoriza a publicar; para corregir una pieza el cliente usa el modo de corrección.",
        messages: [{ role: "user", content: `MEMORIA PRIVADA:\n${memoria}\n\nREGLAS:\n${reglas}\n\nHISTORIAL:\n${historial}\n\nMENSAJE NUEVO:\n${mensaje}` }],
      }),
    });
    if (!r.ok) throw new Error("Claude " + r.status);
    const d = await r.json();
    const texto = (d.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const respuesta = texto || "Recibí tu mensaje. ¿Quieres que lo convierta en una corrección de la pieza actual o que lo tenga en cuenta para próximos contenidos?";
    await sb.from("barbara_chats").insert({ barbara_cliente_id: barbaraClienteId, remitente: "barbara", mensaje: respuesta });
    return respuesta;
  } catch {
    return "Guardé tu mensaje. Ahora no pude generar una respuesta de Bárbara, pero el equipo puede verlo y la conversación no se perdió.";
  }
}

function programarAprendizaje(barbaraClienteId: string, mensaje: string, mensajeId: string) {
  const tarea = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/barbara-aprender-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ barbara_cliente_id: barbaraClienteId, mensaje, mensaje_id: mensajeId }),
  }).then(async (r) => {
    if (!r.ok) console.error("barbara-aprender-chat:", r.status, (await r.text()).slice(0, 180));
  }).catch((e) => console.error("barbara-aprender-chat no disponible:", String(e).slice(0, 180)));

  // Supabase mantiene viva la función hasta terminar la destilación, pero la
  // persona recibe la respuesta del chat sin esperar una segunda llamada de
  // modelo. En un runtime sin waitUntil se deja la promesa iniciada; nunca se
  // convierte una falla de aprendizaje en una falla de conversación.
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(tarea);
}

async function dispararReintento(sb: any, barbaraClienteId: string): Promise<boolean> {
  if (!GH_TOKEN) return false;
  let tipo = "carrusel";
  const { data: memoria } = await sb.from("barbara_memoria").select("tipo")
    .eq("barbara_cliente_id", barbaraClienteId)
    .order("creado_en", { ascending: false }).limit(1).maybeSingle();
  if (memoria?.tipo) tipo = memoria.tipo;

  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + GH_TOKEN,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "condor-barbara-portal-chat",
    },
    body: JSON.stringify({ ref: "main", inputs: { cliente_id: barbaraClienteId, retry: "1", tipo } }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const sbUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await sbUsuario.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);

  let barbaraClienteId = "", mensaje = "", modo = "conversar";
  try {
    const body = await req.json();
    barbaraClienteId = String(body?.barbara_cliente_id || "").trim();
    mensaje = String(body?.mensaje || "").trim();
    modo = body?.modo === "correccion" ? "correccion" : "conversar";
  } catch { /* validación abajo */ }
  if (!barbaraClienteId || !mensaje) return json({ error: "faltan barbara_cliente_id o mensaje" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Permiso: staff (es admin) o el cliente dueño de esta fila.
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) {
    const { data: fila } = await sb
      .from("barbara_clientes").select("id, clientes(email)")
      .eq("id", barbaraClienteId).maybeSingle();
    const email = (fila as any)?.clientes?.email;
    if (!fila || String(email || "").toLowerCase() !== user.email.toLowerCase()) {
      return json({ error: "sin acceso a este cliente de Bárbara" }, 403);
    }
  }

  // 1) Registrar el mensaje en el espejo del chat — mismo remitente que usa
  //    Telegram, para que ChatVisor lo muestre igual sin importar el canal.
  const { data: chatGuardado, error: errorChat } = await sb.from("barbara_chats").insert({
    barbara_cliente_id: barbaraClienteId, remitente: "cliente", mensaje,
  }).select("id").single();
  if (errorChat || !chatGuardado?.id) {
    return json({ error: "no se pudo guardar el mensaje; no se ejecutó ninguna acción" }, 500);
  }

  // Conversar no gasta una corrección ni inicia una regeneración. El chat es
  // el lugar para pensar con Bárbara; el flujo de corrección es explícito.
  if (modo === "conversar") {
    programarAprendizaje(barbaraClienteId, mensaje, chatGuardado.id);
    const respuesta = await responderChat(sb, barbaraClienteId, mensaje);
    return json({ ok: true, bloqueado: false, disparado: false, aprendizaje_programado: true, respuesta });
  }

  // 2) Destilar la corrección en una regla, sin esperar respuesta.
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/barbara-destilar-regla`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({ barbara_cliente_id: barbaraClienteId, texto: mensaje }),
  }).catch(() => {});

  // 3) Contar el intento.
  const { data: correccion } = await sb.from("barbara_correcciones")
    .select("id, intentos_usados, bloqueado").eq("barbara_cliente_id", barbaraClienteId).maybeSingle();

  if (correccion?.bloqueado) {
    return json({
      ok: true, bloqueado: true,
      respuesta: "Ya usamos las 3 correcciones disponibles para esta pieza. Nuestro equipo te va a contactar por WhatsApp.",
    });
  }

  const intentosUsados = (correccion?.intentos_usados ?? 0) + 1;
  const seBloquea = intentosUsados >= MAX_INTENTOS;

  if (correccion?.id) {
    await sb.from("barbara_correcciones").update({
      intentos_usados: intentosUsados, bloqueado: seBloquea, actualizado_en: new Date().toISOString(),
    }).eq("id", correccion.id);
  } else {
    await sb.from("barbara_correcciones").insert({
      barbara_cliente_id: barbaraClienteId, intentos_usados: intentosUsados, bloqueado: seBloquea,
    });
  }

  if (seBloquea) {
    return json({
      ok: true, bloqueado: true,
      respuesta: "Ya usamos las 3 correcciones disponibles para esta pieza. Nuestro equipo te va a contactar por WhatsApp.",
    });
  }

  // 4) Anotar en la pieza actual que hubo que corregirla (mismo criterio que
  //    el webhook de Telegram).
  sb.from("barbara_memoria").select("id, correcciones_pedidas")
    .eq("barbara_cliente_id", barbaraClienteId)
    .order("creado_en", { ascending: false }).limit(1).maybeSingle()
    .then(({ data: pieza }: any) => {
      if (!pieza) return;
      return sb.from("barbara_memoria").update({
        correcciones_pedidas: (pieza.correcciones_pedidas ?? 0) + 1,
        aprobada_sin_cambios: false,
      }).eq("id", pieza.id);
    }).catch(() => {});

  // 5) Disparar el reintento real.
  const disparado = await dispararReintento(sb, barbaraClienteId);
  return json({
    ok: true, bloqueado: false, disparado,
    respuesta: disparado
      ? "Recibimos tu corrección. Bárbara está preparando una versión mejorada — en unos minutos te la mandamos para que la revises. 🦅"
      : "Recibimos tu corrección, pero hubo un problema técnico al disparar la regeneración. Nuestro equipo ya fue avisado.",
  });
});
