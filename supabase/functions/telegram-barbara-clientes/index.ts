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

// El repo pasó a la organización el 21-ago-2026. La API de GitHub redirige
// el nombre viejo, pero un 301 en un POST es frágil: se apunta al nuevo.
const REPO = "Team-condor-ai/condor-ai";
const WORKFLOW = "barbara-clientes.yml";
const MAX_INTENTOS = 3;

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const GH_TOKEN = Deno.env.get("GITHUB_DISPATCH_TOKEN") || "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";

// ── Notas de voz ──────────────────────────────────────────────────────────
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE
// Un cliente que escribe pone "ponle más color". El mismo cliente, en una
// nota de voz de 40 segundos, explica que su público es adulto mayor, que el
// azul le recuerda a la competencia y que la semana pasada le funcionó mejor
// el otro. Es 10x más contexto por menos trabajo de su parte — y para un
// producto cuyo diferencial es aprender, esa es la materia prima más rica que
// hay.
//
// ANTES DE ESTO SE PERDÍAN ENTERAS. El webhook cortaba en `if (!texto)`, y
// una nota de voz no trae `text`: el cliente mandaba su corrección y no
// pasaba absolutamente nada. Ni se registraba, ni contaba como intento, ni
// disparaba reintento. Silencio total.
//
// El costo no es un criterio: US$0,003 por minuto (~3 CLP una nota de voz).
// Se elige `gpt-4o-mini-transcribe` por eso; si el español chileno con jerga
// sale mal, subir a `gpt-4o-transcribe` es cambiar una palabra.
async function transcribir(fileId: string): Promise<string> {
  if (!OPENAI_KEY) {
    console.error("OPENAI_API_KEY sin configurar: la nota de voz se pierde.");
    return "";
  }
  try {
    const meta = await (await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`)).json();
    const ruta = meta?.result?.file_path;
    if (!ruta) { console.error("getFile sin file_path:", JSON.stringify(meta).slice(0, 200)); return ""; }

    const audio = await (await fetch(
      `https://api.telegram.org/file/bot${TG_TOKEN}/${ruta}`)).arrayBuffer();

    const fd = new FormData();
    fd.append("file", new Blob([audio]), ruta.split("/").pop() || "voz.ogg");
    fd.append("model", "gpt-4o-mini-transcribe");
    // Sin esto transcribe en el idioma que le parezca; el cliente habla español.
    fd.append("language", "es");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + OPENAI_KEY },
      body: fd,
    });
    if (!r.ok) { console.error("transcripción falló:", r.status, (await r.text()).slice(0, 200)); return ""; }
    const j = await r.json();
    return String(j.text || "").trim();
  } catch (e) {
    console.error("transcribir error:", e);
    return "";
  }
}


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
  let texto = (msg?.text || "").trim();
  const telegramMessageId = msg?.message_id != null ? String(msg.message_id) : null;
  // Una nota de voz no trae `text`. Antes esta línea la descartaba en
  // silencio: el cliente mandaba su corrección hablada y no pasaba nada.
  const fileVoz = msg?.voice?.file_id || msg?.audio?.file_id || msg?.video_note?.file_id || null;
  if (!chatId || (!texto && !fileVoz)) return new Response("ok", { status: 200 });

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

  // TRANSCRIBIR RECIÉN ACÁ, y no arriba, a propósito: ya sabemos que el chat
  // es de un cliente y que el mensaje no es un reintento de Telegram. Hacerlo
  // antes significaría pagar por transcribir mensajes de chats ajenos y
  // duplicados. Es poca plata, pero es plata que no compra nada.
  if (!texto && fileVoz) {
    texto = await transcribir(fileVoz);
    if (!texto) {
      await tgSend(chatId, "🎤 No pude entender el audio. ¿Me lo escribes?");
      return new Response("ok", { status: 200 });
    }
    // Devolverle lo que se entendió NO es cortesía: si transcribió mal, lo
    // corrige acá mismo en vez de recibir una pieza equivocada y gastar uno
    // de sus 3 intentos en un malentendido.
    await tgSend(chatId, `🎤 Entendí: _${texto}_`);
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

  // 7) Anotar en LA PIEZA que hubo que corregirla.
  //
  //    `barbara_correcciones` cuenta por cliente y se reinicia con cada pieza
  //    nueva, así que ahí el dato se pierde. Acá queda pegado a la pieza para
  //    siempre, y es de lo único que puede aprender la memoria global: qué
  //    tenían en común las que pasaron a la primera y las que no.
  //
  //    Sin `await` a propósito: si esto falla o tarda, la corrección ya quedó
  //    registrada y el reintento se dispara igual. Aprender no puede costarle
  //    al cliente que su corrección se demore.
  sb.from("barbara_memoria")
    .select("id, correcciones_pedidas")
    .eq("barbara_cliente_id", barbaraClienteId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(({ data: pieza }: any) => {
      if (!pieza) return;
      return sb
        .from("barbara_memoria")
        .update({
          correcciones_pedidas: (pieza.correcciones_pedidas ?? 0) + 1,
          // Ya no puede contar como "aprobada sin cambios": el cliente pidió
          // uno. Se cierra acá mismo en vez de esperar a la pieza siguiente.
          aprobada_sin_cambios: false,
        })
        .eq("id", pieza.id);
    })
    .catch((e: unknown) => console.error("marcar pieza:", String(e).slice(0, 120)));

  // 8) Intento 1 o 2: disparar el reintento y confirmar al cliente.
  const disparado = await dispararReintento(sb, barbaraClienteId);
  await tgSend(
    chatId,
    disparado
      ? "Recibimos tu corrección. Bárbara está preparando una versión mejorada — en unos minutos te la mandamos para que la revises. 🦅"
      : "Recibimos tu corrección, pero hubo un problema técnico al disparar la regeneración. Nuestro equipo ya fue avisado.",
  );

  return new Response("ok", { status: 200 });
});
