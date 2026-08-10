/**
 * Pausa (o reactiva) la campaña "CO · Páginas web · Ago 2026" — campaña y
 * adset, que es lo que corta el gasto de verdad (pausar solo los ads
 * individuales deja el adset corriendo y Meta puede seguir gastando en
 * fase de aprendizaje).
 *
 * Motivo: terremoto 7,4 en Chocó, Colombia, el 10-ago-2026 — 21 muertos,
 * daños estructurales en Cali, Manizales, Pereira y Quibdó, sentido en
 * Bogotá. La campaña targetea Colombia completo. Se pausa por sensibilidad
 * de marca y porque el comportamiento de la audiencia esta semana no
 * refleja el funnel normal (contaminaría el aprendizaje del algoritmo).
 *
 *   node services/meta-analyzer/pausar-campana-colombia.mjs           # pausa
 *   node services/meta-analyzer/pausar-campana-colombia.mjs --activar # reactiva
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://graph.facebook.com/v21.0";
const NOMBRES_CAMPANA = ["CO · Páginas web · Ago 2026", "CO · WhatsApp · Ago 2026"];

function cargarEnv() {
  for (const p of [".env.local", ".env"]) {
    const ruta = path.resolve(process.cwd(), p);
    if (!fs.existsSync(ruta)) continue;
    for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}
cargarEnv();

const TOKEN = (process.env.META_ACCESS_TOKEN || "").trim();
let AD_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/i, "").replace(/[^0-9]/g, "");
if (AD_ACCOUNT) AD_ACCOUNT = "act_" + AD_ACCOUNT;

const ACTIVAR = process.argv.includes("--activar");
const ESTADO = ACTIVAR ? "ACTIVE" : "PAUSED";

async function api(ruta, { metodo = "GET", campos, cuerpo } = {}) {
  const url = new URL(`${API}/${ruta}`);
  url.searchParams.set("access_token", TOKEN);
  if (campos) url.searchParams.set("fields", campos);
  const opciones = { method: metodo };
  if (cuerpo) {
    opciones.body = new URLSearchParams({ ...cuerpo, access_token: TOKEN });
    opciones.method = "POST";
  }
  const r = await fetch(url, opciones);
  const j = await r.json();
  if (j.error) throw new Error(`${ruta} → ${j.error.message}`);
  return j;
}

async function main() {
  if (!TOKEN || !AD_ACCOUNT) {
    console.error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID en .env.local");
    process.exit(1);
  }

  const campanas = await api(`${AD_ACCOUNT}/campaigns`, { campos: "id,name,status,effective_status" })
    .then((r) => (r.data ?? []).filter((c) => NOMBRES_CAMPANA.includes(c.name)));

  if (!campanas.length) {
    console.error(`No se encontró ninguna campaña llamada ${NOMBRES_CAMPANA.map((n) => `"${n}"`).join(" / ")} en ${AD_ACCOUNT}.`);
    process.exit(1);
  }

  for (const campana of campanas) {
    console.log(`Campaña ${campana.id} — estado actual: ${campana.effective_status}`);

    const adsets = await api(`${campana.id}/adsets`, { campos: "id,name,status,effective_status" })
      .then((r) => r.data ?? []);

    await api(campana.id, { cuerpo: { status: ESTADO } });
    console.log(`  ✓ Campaña → ${ESTADO}`);

    for (const conjunto of adsets) {
      await api(conjunto.id, { cuerpo: { status: ESTADO } });
      console.log(`  ✓ Conjunto ${conjunto.id} (${conjunto.name}) → ${ESTADO}`);
    }
  }

  console.log(`\nListo. Todo en ${ESTADO}.`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
