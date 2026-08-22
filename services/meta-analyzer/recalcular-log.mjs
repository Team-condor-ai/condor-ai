/**
 * Reescribe `campaign-log.json` con las conversaciones REALES de Meta.
 *
 * Por qué existe: hasta el 22-ago-2026 el analizador sumaba dos métricas de
 * conversación que se solapan, así que cada entrada del historial quedó
 * inflada ~2,1x (al día 12 decía 241 donde el administrador mostraba 113).
 * Corregir el script hacia adelante no arregla lo ya escrito: la primera
 * corrida con el número bueno le mostraría a Bárbara una caída de 241 a ~115
 * y reportaría al Telegram del equipo un derrumbe que nunca pasó.
 *
 * No se "ajusta" el histórico dividiendo por 2,1 — ese factor es el de UN día
 * y no tiene por qué ser el de los demás. Se vuelve a pedir el desglose
 * diario a Meta y se recalcula cada día con la métrica correcta.
 *
 *   node services/meta-analyzer/recalcular-log.mjs              # muestra el diff
 *   node services/meta-analyzer/recalcular-log.mjs --confirmar  # lo escribe
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOG = "services/meta-analyzer/campaign-log.json";
const API = "https://graph.facebook.com/v21.0";
const clean = (s) => (s || "").replace(/[\s\r\n]+/g, "").trim();
const TOKEN = clean(process.env.META_ACCESS_TOKEN);
let CUENTA = clean(process.env.META_AD_ACCOUNT_ID).replace(/[^0-9]/g, "");
if (CUENTA) CUENTA = "act_" + CUENTA;
const CONFIRMAR = process.argv.includes("--confirmar");

async function get(ruta, params = {}) {
  const url = new URL(`${API}/${ruta}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

// La MISMA definición que meta-analyzer.mjs: la específica manda, la ancha es
// respaldo. Si estas dos se separan, el historial vuelve a mentir.
const conversaciones = (acciones = []) => {
  const de = (t) => Number((acciones.find((a) => a.action_type === t) || {}).value || 0);
  return (
    de("onsite_conversion.messaging_conversation_started_7d") ||
    de("onsite_conversion.total_messaging_connection")
  );
};

async function main() {
  if (!TOKEN || !CUENTA) { console.error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID."); process.exit(1); }

  const historial = JSON.parse(readFileSync(LOG, "utf8"));
  const campanas = [...new Set(historial.map((h) => h.campana).filter(Boolean))];
  console.log(`Historial: ${historial.length} entradas · ${campanas.length} campañas\n`);

  // id por nombre, para pedirle a Meta el desglose de cada una.
  const todas = await get(`${CUENTA}/campaigns`, { fields: "id,name", limit: "200" });
  const idDe = new Map((todas.data || []).map((c) => [c.name, c.id]));

  // Acumulado real por campaña y fecha. Meta entrega el día suelto, así que se
  // suma en orden: el historial guarda el ACUMULADO de la campaña, no el día.
  const real = new Map();
  for (const nombre of campanas) {
    const id = idDe.get(nombre);
    if (!id) { console.log(`⚠️  "${nombre}" ya no está en la cuenta, se deja como está.`); continue; }
    const diario = await get(`${id}/insights`, {
      fields: "spend,actions", level: "campaign", date_preset: "maximum", time_increment: "1", limit: "500",
    });
    let convAcum = 0, gastoAcum = 0, dia = 0;
    for (const f of diario.data || []) {
      const gastoDia = Number(f.spend || 0);
      if (gastoDia <= 0) continue;          // el día 1 es el primero CON gasto
      dia++;
      convAcum += conversaciones(f.actions);
      gastoAcum += gastoDia;
      real.set(`${nombre}|${f.date_start}`, {
        dia, resultados: convAcum, gasto: Math.round(gastoAcum),
        costo: convAcum ? Math.round(gastoAcum / convAcum) : null,
      });
    }
    console.log(`${nombre}: ${dia} días con gasto, ${convAcum} conversaciones reales`);
  }

  console.log("\nCAMBIOS");
  console.log("fecha        campaña                          antes  →  después");
  let tocadas = 0;
  const nuevo = historial.map((h) => {
    const r = real.get(`${h.campana}|${h.fecha}`);
    if (!r) return h;
    if (h.resultados === r.resultados && h.gasto === r.gasto) return h;
    tocadas++;
    console.log(
      `${h.fecha}   ${(h.campana || "").slice(0, 30).padEnd(32)} ${String(h.resultados).padStart(5)}  →  ${String(r.resultados).padStart(5)}` +
      `   (costo ${h.costo} → ${r.costo})`
    );
    return { ...h, ...r };
  });

  if (!tocadas) { console.log("(nada que corregir)"); return; }
  console.log(`\n${tocadas} entradas corregidas.`);

  if (!CONFIRMAR) { console.log("\nSIMULACIÓN. Para escribirlo: --confirmar"); return; }
  writeFileSync(LOG, JSON.stringify(nuevo, null, 2) + "\n");
  console.log("Escrito en " + LOG);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
