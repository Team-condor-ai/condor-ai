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

  let barbaraClienteId = "", mensaje = "";
  try {
    const body = await req.json();
    barbaraClienteId = String(body?.barbara_cliente_id || "").trim();
    mensaje = String(body?.mensaje || "").trim();
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
  await sb.from("barbara_chats").insert({
    barbara_cliente_id: barbaraClienteId, remitente: "cliente", mensaje,
  });

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
