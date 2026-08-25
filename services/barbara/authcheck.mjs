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

const NO_HAY_CLI = /ENOENT|not found|no such file|command not found|spawnSync/i;

/**
 * Tres resultados, no dos: "viva", "muerta" y "no_se_pudo_probar".
 *
 * El tercero existía como bug: si el CLI ni se podía ejecutar (ENOENT porque
 * no quedó instalado), la función caía al `catch`, el mensaje no matcheaba
 * AUTH_MUERTA y devolvía `true` — o sea reportaba "autenticación OK ✅" sin
 * haber probado nada. Visto en vivo el 23-ago-2026 corriéndolo a mano.
 *
 * Un chequeo que no pudo chequear NO es una luz verde. Que sea un estado
 * aparte permite avisar distinto: "hay que re-loguear" y "el chequeo está
 * roto" se arreglan de formas distintas.
 */
function estadoAuth() {
  try {
    const out = execFileSync("higgsfield", ["workspace", "list", "--json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000,
    });
    return AUTH_MUERTA.test(out) ? "muerta" : "viva";
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (AUTH_MUERTA.test(msg)) return "muerta";
    if (NO_HAY_CLI.test(msg)) {
      console.log("no se pudo ejecutar el CLI:", msg.slice(0, 180));
      return "no_se_pudo_probar";
    }
    // Error ajeno a la auth (red, rate limit): no se dispara falsa alarma,
    // pero tampoco se afirma que esté todo bien.
    console.log("probe no-auth (se ignora):", msg.slice(0, 180));
    return "viva";
  }
}

const CHEQUEO_ROTO = `⚠️ *Barbara: el chequeo de Higgsfield no pudo correr*

No se pudo ejecutar el CLI de Higgsfield, así que **no sabemos** si las credenciales están vivas. Esto NO es lo mismo que "está todo bien".

Revisar el paso "Instalar CLI de Higgsfield" del workflow \`barbara-authcheck\`.`;

async function main() {
  console.log("Barbara authcheck | TG:", !!TG);
  const estado = estadoAuth();

  if (estado === "viva") { console.log("Higgsfield: autenticación OK ✅"); return; }

  const aviso = estado === "muerta" ? PASOS : CHEQUEO_ROTO;
  console.log(`Higgsfield: ${estado} → avisando a Telegram`);
  const j = await (await tg(aviso)).json();
  if (!j.ok) throw new Error("Telegram: " + (j.description || ""));
  console.log("Aviso enviado.");
  // Sale distinto de 0 para que la corrida quede en rojo y no pase inadvertida
  // entre las verdes del historial.
  process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
