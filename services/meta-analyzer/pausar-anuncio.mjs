/**
 * Pausa (o reactiva) UN anuncio suelto dentro de su conjunto, sin tocar la
 * campaña ni el adset.
 *
 * Es distinto de `pausar-campana-colombia.mjs`, que apaga campaña + adset para
 * cortar el gasto por completo. Acá el objetivo es el contrario: que el
 * conjunto SIGA corriendo y Meta reparta ese presupuesto entre los anuncios
 * que quedan. Por eso se toca solo el nivel `ad`.
 *
 *   node services/meta-analyzer/pausar-anuncio.mjs --anuncio "video pizarra"
 *   node services/meta-analyzer/pausar-anuncio.mjs --anuncio "video pizarra" --confirmar
 *   node services/meta-analyzer/pausar-anuncio.mjs --anuncio "video pizarra" --activar --confirmar
 *
 * Sin `--confirmar` NO cambia nada: lista lo que haría con los números de cada
 * anuncio a la vista. Es a propósito — pausar el anuncio equivocado en una
 * campaña de 10 días de presupuesto no se arregla con deshacer.
 *
 * Las credenciales viven en los secrets de GitHub Actions, así que en la
 * práctica esto se dispara desde `.github/workflows/pausar-anuncio.yml`.
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://graph.facebook.com/v21.0";

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

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};
const BUSCADO = (arg("--anuncio") || "").trim().toLowerCase();
const ACTIVAR = process.argv.includes("--activar");
const CONFIRMAR = process.argv.includes("--confirmar");
const ESTADO = ACTIVAR ? "ACTIVE" : "PAUSED";

async function api(ruta, { campos, cuerpo, params } = {}) {
  const url = new URL(`${API}/${ruta}`);
  url.searchParams.set("access_token", TOKEN);
  if (campos) url.searchParams.set("fields", campos);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const opciones = { method: "GET" };
  if (cuerpo) {
    opciones.method = "POST";
    opciones.body = new URLSearchParams({ ...cuerpo, access_token: TOKEN });
  }
  const r = await fetch(url, opciones);
  const j = await r.json();
  if (j.error) throw new Error(`${ruta} → ${j.error.message}`);
  return j;
}

const plata = (n) => "$" + Math.round(n).toLocaleString("es-CL");

/* Mismo criterio que meta-analyzer.mjs: la primera métrica es la que muestra
   el administrador; la segunda es más ancha y va solo de respaldo. Nunca se
   suman ni se toma la mayor. */
const conversaciones = (acciones = []) => {
  const de = (t) => Number((acciones.find((a) => a.action_type === t) || {}).value || 0);
  return (
    de("onsite_conversion.messaging_conversation_started_7d") ||
    de("onsite_conversion.total_messaging_connection")
  );
};

async function main() {
  if (!TOKEN || !AD_ACCOUNT) {
    console.error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID.");
    process.exit(1);
  }
  if (!BUSCADO) {
    console.error('Falta --anuncio "parte del nombre".');
    process.exit(1);
  }

  // Los anuncios de la cuenta, con su estado.
  const ads = await api(`${AD_ACCOUNT}/ads`, {
    campos: "id,name,status,effective_status,adset{id,name},campaign{id,name}",
    params: { limit: "200" },
  }).then((r) => r.data || []);

  // Sus números de por vida, para no pausar a ciegas.
  const insights = await api(`${AD_ACCOUNT}/insights`, {
    campos: "ad_id,spend,actions,ctr",
    params: { level: "ad", date_preset: "maximum", limit: "200" },
  }).then((r) => r.data || []);
  const porId = new Map(insights.map((f) => [f.ad_id, f]));

  const coinciden = ads.filter((a) => (a.name || "").toLowerCase().includes(BUSCADO));

  if (!coinciden.length) {
    console.error(`Ningún anuncio contiene "${BUSCADO}".`);
    console.error("Disponibles:");
    ads.forEach((a) => console.error(`   · ${a.name}  [${a.effective_status}]`));
    process.exit(1);
  }

  // Si coincide con más de uno, NO se actúa: un `--anuncio "video"` que apaga
  // los dos videos de la campaña sería un desastre silencioso.
  if (coinciden.length > 1 && CONFIRMAR) {
    console.error(`"${BUSCADO}" coincide con ${coinciden.length} anuncios. Sé más específico:`);
    coinciden.forEach((a) => console.error(`   · ${a.name}`));
    process.exit(1);
  }

  console.log(`Cuenta ${AD_ACCOUNT} · acción: ${ESTADO}\n`);
  for (const a of coinciden) {
    const f = porId.get(a.id) || {};
    const gasto = Number(f.spend || 0);
    const conv = conversaciones(f.actions);
    console.log(`${a.name}`);
    console.log(`   campaña   ${a.campaign?.name || "?"}`);
    console.log(`   conjunto  ${a.adset?.name || "?"}`);
    console.log(`   estado    ${a.effective_status}`);
    console.log(`   de por vida: ${conv} conversaciones · ${plata(gasto)} gastados` +
                (conv ? ` · ${plata(gasto / conv)} por conversación` : "") +
                ` · CTR ${Number(f.ctr || 0).toFixed(2)}%`);

    if (!CONFIRMAR) { console.log(`   → SIMULACIÓN, no se tocó nada.\n`); continue; }

    if (a.status === ESTADO) {
      console.log(`   → ya estaba en ${ESTADO}, no se toca.\n`);
      continue;
    }
    await api(a.id, { cuerpo: { status: ESTADO } });
    console.log(`   ✓ ${a.status} → ${ESTADO}\n`);
  }

  if (!CONFIRMAR) {
    console.log("Para aplicarlo de verdad, agrega --confirmar");
    return;
  }

  // Se releen los anuncios del mismo conjunto: lo que importa después de
  // pausar uno es cuántos quedan vivos, porque Andromeda castiga la falta de
  // diversidad y bajar de 5 anuncios activos tiene costo.
  const adsetId = coinciden[0].adset?.id;
  if (adsetId) {
    const hermanos = await api(`${adsetId}/ads`, { campos: "name,effective_status", params: { limit: "50" } })
      .then((r) => r.data || []);
    const vivos = hermanos.filter((h) => h.effective_status === "ACTIVE");
    console.log(`Quedan ${vivos.length} anuncios activos en el conjunto:`);
    hermanos.forEach((h) => console.log(`   ${h.effective_status === "ACTIVE" ? "●" : "○"} ${h.name}`));
    if (vivos.length < 5) {
      console.log(`\n⚠️  Meta recomienda ≥5 anuncios activos por conjunto. Van ${vivos.length}.`);
      console.log("   Subir creativos nuevos para reponer la diversidad.");
    }
  }
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
