// condor.ai · Barbara — chequeo de salud de las credenciales de Higgsfield.
// Corre unas HORAS ANTES de los runs de contenido (ver barbara-authcheck.yml).
// Prueba la autenticación SIN gastar créditos (higgsfield workspace list). Si está
// caída o venciendo, avisa a Telegram con el PASO A PASO para re-autenticar, para
// que el equipo lo arregle antes de que Barbara falle en vivo.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (+ las de Higgsfield vía el workflow)

import { execFileSync } from "node:child_process";

const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function tg(text) {
  return fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
}

// Frases que delatan una credencial muerta o incompatible (no transitorias).
const AUTH_MUERTA = /session expired|not authenticated|unauthor|forbidden|auth login|older auth flow|invalid.*(token|credential)|\b(401|403)\b/i;

const PASOS = `⚠️ *Barbara: hay que re-autenticar Higgsfield*

Las credenciales están caídas o por vencer. Si no se renuevan, Barbara no podrá publicar en el próximo horario.

*Paso a paso (2 min · lo hace Joaquín):*
1️⃣ Abre una terminal dentro del repo \`condor-ai\`.
2️⃣ Corre:  \`higgsfield auth login\`
3️⃣ Se abre el navegador → inicia sesión con la cuenta de condor.ai y autoriza.
4️⃣ Corre:  \`bash services/barbara/reauth.sh\`

Eso re-cifra y sube las credenciales solo ✅. (Este aviso se repite hasta que quede al día.)`;

// true = autenticación viva; false = caída/incompatible → hay que re-loguear.
function authViva() {
  try {
    const out = execFileSync("higgsfield", ["workspace", "list", "--json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000,
    });
    if (AUTH_MUERTA.test(out)) return false;
    return true;
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (AUTH_MUERTA.test(msg)) return false;
    // Error no relacionado con auth (red, rate limit, etc.): no disparamos falsa alarma.
    console.log("probe no-auth (se ignora):", msg.slice(0, 180));
    return true;
  }
}

async function main() {
  console.log("Barbara authcheck | TG:", !!TG);
  if (authViva()) { console.log("Higgsfield: autenticación OK ✅"); return; }
  console.log("Higgsfield: autenticación CAÍDA → avisando a Telegram");
  const j = await (await tg(PASOS)).json();
  if (!j.ok) throw new Error("Telegram: " + (j.description || ""));
  console.log("Aviso enviado.");
}

main().catch((e) => { console.error(e); process.exit(1); });
