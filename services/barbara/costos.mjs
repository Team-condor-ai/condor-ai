// condor.ai · Barbara — reporte semanal de costos de Higgsfield (sábados).
// Suma los créditos GASTADOS en los últimos 7 días (higgsfield account transactions),
// los convierte a CLP y lo manda a Telegram. Solo lectura: NO gasta créditos.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (+ las de Higgsfield vía el workflow)
// Variable opcional: CLP_POR_CREDITO (default 31 · plan ultra ≈ USD 99 / 3000 cr ≈ 31 CLP)

import { execFileSync } from "node:child_process";

const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const CLP_POR_CREDITO = Number(process.env.CLP_POR_CREDITO || 31);

async function tg(text) {
  return fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
}

// Trae transacciones paginando hasta cubrir la semana (o un tope de seguridad).
function traerTransacciones(desde) {
  let todas = [];
  let cursor = 0;
  for (let pagina = 0; pagina < 8; pagina++) { // hasta 800 tx
    const out = execFileSync(
      "higgsfield", ["account", "transactions", "--json", "--size", "100", "--cursor", String(cursor)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );
    const arr = JSON.parse(out);
    if (!Array.isArray(arr) || arr.length === 0) break;
    todas = todas.concat(arr);
    const masVieja = new Date(arr[arr.length - 1].created_at);
    if (masVieja < desde) break; // ya cubrimos toda la ventana de 7 días
    cursor += arr.length;
  }
  return todas;
}

function saldoActual() {
  try {
    const out = execFileSync("higgsfield", ["account", "status", "--json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
    return JSON.parse(out).credits;
  } catch { return null; }
}

const fmtCLP = (n) => "$" + Math.round(n).toLocaleString("es-CL");

async function main() {
  const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const txs = traerTransacciones(desde).filter(
    (t) => t.action === "spend" && new Date(t.created_at) >= desde,
  );

  const porModelo = {};
  let totalCred = 0;
  for (const t of txs) {
    const c = Math.abs(Number(t.credits) || 0);
    totalCred += c;
    const k = t.display_name || "otro";
    (porModelo[k] ||= { cred: 0, n: 0 });
    porModelo[k].cred += c;
    porModelo[k].n += 1;
  }

  const clp = totalCred * CLP_POR_CREDITO;
  const saldo = saldoActual();
  const rango = `${desde.toISOString().slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}`;

  const lineas = Object.entries(porModelo)
    .sort((a, b) => b[1].cred - a[1].cred)
    .map(([m, v]) => `• ${m}: ${v.cred} cr (${v.n}×)`)
    .join("\n") || "• (sin gastos registrados esta semana)";

  const msg = `💰 *Costos Higgsfield · semana*
_${rango}_

*Usado:* ${totalCred} créditos ≈ *${fmtCLP(clp)} CLP*
${saldo != null ? `*Saldo actual:* ${saldo} créditos\n` : ""}
*Por modelo:*
${lineas}

_Referencial a ${CLP_POR_CREDITO} CLP/crédito · ${txs.length} operaciones._`;

  const j = await (await tg(msg)).json();
  if (!j.ok) throw new Error("Telegram: " + (j.description || ""));
  console.log("Reporte enviado. Total:", totalCred, "cr ≈", Math.round(clp), "CLP");
}

main().catch((e) => { console.error(e); process.exit(1); });
