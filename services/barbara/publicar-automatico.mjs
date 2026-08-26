// condor.ai · Publica sola la pieza de HOY, salvo que alguien la bloqueara.
//
// Corre a las 16:00 Chile, 3h después de que barbara.yml genera la pieza y
// la manda a Telegram (13:00 Chile). Pedido explícito de Joaquín, 26-ago-2026
// tarde: "todos los días publicar a las 16:00, manda las copias al telegram
// 3 horas antes... y cualquier cosa te aviso para ponerles un bloqueo".
//
// El bloqueo lo escribe alguien en el chat interno de Telegram ("bloquear
// barbara") -- lo maneja telegram-barbara-clientes/index.ts, que inserta una
// fila en `barbara_bloqueos_contenido` para la fecha de HOY (Chile). Este
// script solo pregunta si esa fila existe; el default sin ninguna señal es
// PUBLICAR, no al revés -- es justo el cambio de comportamiento que pidió
// Joaquín (antes había que escribir "aprobar barbara" para que saliera algo).
//
// No publica directo: dispara barbara-publicar-blotato.yml con el mismo
// run_id y confirmacion=PUBLICAR que ya usa "aprobar barbara" a mano, así
// hereda gratis su candado anti-duplicado y su liberación si falla.
import { readFileSync } from "node:fs";
import { supabase } from "./motor.mjs";

const REPO = process.env.GH_REPO || "Team-condor-ai/condor-ai";
const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TG = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT = process.env.TELEGRAM_CHAT_ID || "";

function hoyChile() {
  // America/Santiago: UTC-4 fijo, sin horario de verano (mismo criterio que
  // el resto del repo -- ver barbara.yml y barbaraCalendarioUtils.ts).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

async function tg(texto) {
  if (!TG || !CHAT) { console.error("Falta TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID."); return; }
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text: texto }),
    });
  } catch (e) {
    console.error("tg() falló:", e);
  }
}

async function piezaDeHoy() {
  const log = JSON.parse(readFileSync("services/barbara/content-log.json", "utf8"));
  const hoy = hoyChile();
  // De atrás para adelante: si hubo un "denuevo barbara" hoy, la última
  // entrada de hoy es la versión corregida -- esa es la que hay que publicar.
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].fecha === hoy && log[i].runId) return log[i];
  }
  return null;
}

async function estaBloqueada(hoy) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Sin credenciales no hay forma de confirmar que NO está bloqueada.
    // Publicar a ciegas acá sería ignorar un bloqueo real por un problema de
    // config -- el fallo seguro es NO publicar y avisar.
    throw new Error("Falta SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY: no se puede confirmar el bloqueo.");
  }
  const sb = supabase(SUPABASE_URL, SUPABASE_KEY);
  const filas = await sb.get(`barbara_bloqueos_contenido?fecha=eq.${hoy}&select=motivo`);
  return filas.length > 0 ? (filas[0].motivo || "sin motivo") : null;
}

async function dispararPublicacion(runId) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/barbara-publicar-blotato.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "condor-barbara-auto",
      },
      body: JSON.stringify({ ref: "main", inputs: { run_id: String(runId), confirmacion: "PUBLICAR" } }),
    },
  );
  if (!r.ok) throw new Error(`dispatch falló: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function main() {
  const hoy = hoyChile();

  const pieza = await piezaDeHoy();
  if (!pieza) {
    await tg(
      `⚠️ 16:00 Chile: no encontré ninguna pieza generada hoy (${hoy}) para publicar. ` +
      "Probablemente la generación de las 13:00 falló -- revisa el workflow \"Barbara - carruseles RRSS\".",
    );
    console.log("Sin pieza de hoy. Nada que hacer.");
    return;
  }

  const motivoBloqueo = await estaBloqueada(hoy);
  if (motivoBloqueo) {
    await tg(`⛔ Publicación de hoy (${pieza.tipo}, run ${pieza.runId}) bloqueada -- no se subió.\nMotivo: ${motivoBloqueo}`);
    console.log("Bloqueada:", motivoBloqueo);
    return;
  }

  await dispararPublicacion(pieza.runId);
  await tg(
    `✅ 16:00 Chile: nadie la bloqueó, publicando sola la pieza de hoy (${pieza.tipo}, run ${pieza.runId}) vía Blotato.\n` +
    'Si algo salió mal, escribe "bloquear barbara" para la próxima y avisa para revisar esta.',
  );
  console.log("Publicación disparada para run", pieza.runId);
}

main().catch(async (e) => {
  console.error(e);
  await tg(`🔴 16:00 Chile: la publicación automática falló -- ${String(e.message || e).slice(0, 300)}`);
  process.exitCode = 1;
});
