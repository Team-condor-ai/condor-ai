// condor.ai · Edge Function "telegram-barbara-clientes"
// Webhook de Telegram para el módulo multi-cliente de Bárbara (Agentes IA).
// Escucha las respuestas de CADA cliente en SU propio chat (barbara_clientes.
// telegram_chat_id) y, cuando piden una corrección, dispara un reintento del
// contenido vía el workflow `barbara-clientes.yml` — o los bloquea al llegar
// a 3 intentos y deriva a soporte por WhatsApp.
//
// Distinta de `telegram-barbara` (esa es el "Denuevo barbara" del contenido
// PROPIO de Cóndor, otro repo/otro flujo — no se toca acá).
//
// Secretos: TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN, GITHUB_DISPATCH_TOKEN,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy:  supabase functions deploy telegram-barbara-clientes --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
//          (--no-verify-jwt porque Telegram llama sin sesión de Supabase; la
//          seguridad acá es el X-Telegram-Bot-Api-Secret-Token, no el JWT)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPO = "joaquinmunozs/condor-ai";
const WORKFLOW = "barbara-clientes.yml";
const MAX_INTENTOS = 3;

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const GH_TOKEN = Deno.env.get("GITHUB_DISPATCH_TOKEN") || "";

async function tgSend(chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.error("tgSend error:", e);
  }
}

// Dispara barbara-clientes.yml con RETRY=1 para el cliente correspondiente,
// pidiendo el MISMO tipo de contenido de su última pieza generada (si no hay
// historial todavía, "carrusel" por defecto).
async function dispararReintento(sb: any, barbaraClienteId: string): Promise<boolean> {
  if (!GH_TOKEN) {
    console.error("GITHUB_DISPATCH_TOKEN sin configurar: no se puede disparar el reintento.");
    return false;
  }

  let tipo = "carrusel";
  const { data: memoria } = await sb
    .from("barbara_memoria")
    .select("tipo")
    .eq("barbara_cliente_id", barbaraClienteId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (memoria?.tipo) tipo = memoria.tipo;

  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + GH_TOKEN,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "condor-barbara-clientes",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { cliente_id: barbaraClienteId, retry: "1", tipo },
      }),
    },
  );
  if (!r.ok) {
    console.error("dispatch workflow falló:", r.status, (await r.text()).slice(0, 200));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  // 1) Verificación del secret de Telegram ANTES de tocar la base. Sin esto,
  //    cualquiera que encuentre la URL de la función podría insertar mensajes
  //    falsos como si fueran de un cliente y disparar workflows a voluntad.
  const secretRecibido = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!WEBHOOK_SECRET || secretRecibido !== WEBHOOK_SECRET) {
    console.warn("secret token inválido o sin configurar — se rechaza sin procesar.");
    return new Response("unauthorized", { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 }); // body inválido: no es nuestro, 200 para que no reintente
  }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const texto = (msg?.text || "").trim();
  const telegramMessageId = msg?.message_id != null ? String(msg.message_id) : null;
  if (!chatId || !texto) return new Response("ok", { status: 200 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 2) ¿Este chat es de algún cliente activo de Bárbara? Si no hay match,
  //    puede ser otro chat/grupo random donde está el bot — se ignora, pero
  //    igual se responde 200 (Telegram reintenta si no).
  const { data: cliente, error: errCliente } = await sb
    .from("barbara_clientes")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  if (errCliente) {
    console.error("error consultando barbara_clientes:", errCliente.message);
    return new Response("ok", { status: 200 });
  }
  if (!cliente) return new Response("ok", { status: 200 });

  const barbaraClienteId = cliente.id as string;

  // 3) Idempotencia: si Telegram reintega el mismo update, no lo proceses de
  //    nuevo (no vuelve a contar como intento ni a disparar otro workflow).
  if (telegramMessageId) {
    const { data: yaExiste } = await sb
      .from("barbara_chats")
      .select("id")
      .eq("barbara_cliente_id", barbaraClienteId)
      .eq("telegram_message_id", telegramMessageId)
      .maybeSingle();
    if (yaExiste) return new Response("ok", { status: 200 });
  }

  // 4) Registrar el mensaje del cliente en el espejo del chat.
  const { error: errInsert } = await sb.from("barbara_chats").insert({
    barbara_cliente_id: barbaraClienteId,
    remitente: "cliente",
    mensaje: texto,
    telegram_message_id: telegramMessageId,
  });
  if (errInsert) console.error("error insertando barbara_chats:", errInsert.message);

  // Destilar la corrección en una regla duradera de la marca.
  //
  // SIN ESPERAR RESPUESTA, Y ES A PROPOSITO: si la IA tarda o falla, la
  // corrección ya quedó guardada y el reintento se dispara igual. Aprender
  // es valioso, pero nunca al precio de que el cliente se quede esperando.
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/barbara-destilar-regla`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ barbara_cliente_id: barbaraClienteId, texto }),
  }).catch((e) => console.error("destilar regla:", String(e).slice(0, 120)));

  // 5) Contar el intento de corrección (crea la fila si es la primera vez).
  const { data: correccion } = await sb
    .from("barbara_correcciones")
    .select("id, intentos_usados, bloqueado")
    .eq("barbara_cliente_id", barbaraClienteId)
    .maybeSingle();

  if (correccion?.bloqueado) {
    // Ya estaba bloqueado de antes (staff aún no desbloquea) — no cuenta de
    // nuevo, solo se le recuerda que soporte lo va a contactar.
    await tgSend(
      chatId,
      "Ya usamos las 3 correcciones disponibles para esta pieza. Nuestro equipo te va a contactar por WhatsApp para ayudarte directamente.",
    );
    return new Response("ok", { status: 200 });
  }

  const intentosPrevios = correccion?.intentos_usados ?? 0;
  const intentosUsados = intentosPrevios + 1;
  const seBloquea = intentosUsados >= MAX_INTENTOS;

  if (correccion?.id) {
    await sb
      .from("barbara_correcciones")
      .update({
        intentos_usados: intentosUsados,
        bloqueado: seBloquea,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", correccion.id);
  } else {
    await sb.from("barbara_correcciones").insert({
      barbara_cliente_id: barbaraClienteId,
      intentos_usados: intentosUsados,
      bloqueado: seBloquea,
    });
  }

  // 6) Bloqueado ahora mismo (llegó al 3° intento): avisar y NO regenerar.
  if (seBloquea) {
    await tgSend(
      chatId,
      "Ya usamos las 3 correcciones disponibles para esta pieza. Nuestro equipo te va a contactar por WhatsApp para ayudarte directamente.",
    );
    return new Response("ok", { status: 200 });
  }

  // 7) Intento 1 o 2: disparar el reintento y confirmar al cliente.
  const disparado = await dispararReintento(sb, barbaraClienteId);
  await tgSend(
    chatId,
    disparado
      ? "Recibimos tu corrección. Bárbara está preparando una versión mejorada — en unos minutos te la mandamos para que la revises. 🦅"
      : "Recibimos tu corrección, pero hubo un problema técnico al disparar la regeneración. Nuestro equipo ya fue avisado.",
  );

  return new Response("ok", { status: 200 });
});
