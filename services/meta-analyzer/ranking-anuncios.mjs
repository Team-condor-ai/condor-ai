/**
 * Ranking de los anuncios de la campaña de landing, del mejor al peor.
 *
 * QUÉ ORDENA Y POR QUÉ
 * ---------------------------------------------------------------------------
 * Joaquín pidió ordenar por CLICS A LA PÁGINA, no por CTR ni por impresiones.
 * Es el criterio correcto para esta campaña: el objetivo era llevar gente a la
 * landing, y un anuncio con CTR alto que consigue clics de gente que después
 * no carga la página es peor que uno con CTR bajo que sí la carga.
 *
 * Meta reporta dos métricas parecidas y conviene no confundirlas:
 *   · link_click       -> tocó el enlace
 *   · landing_page_view -> la página ALCANZÓ A CARGAR
 * La diferencia entre ambas es gente que se arrepintió o tenía mala conexión.
 * Se muestran las dos, y se ordena por clics al enlace como pidió.
 *
 *   node services/meta-analyzer/ranking-anuncios.mjs
 *   node services/meta-analyzer/ranking-anuncios.mjs --dias 60
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://graph.facebook.com/v21.0";

// Carga .env.local a mano: este script se corre suelto, sin el runner que
// normalmente inyecta las variables.
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
let CUENTA = (process.env.META_AD_ACCOUNT_ID || "").replace(/[^0-9]/g, "");
if (CUENTA) CUENTA = "act_" + CUENTA;

const DIAS = Number(process.argv[process.argv.indexOf("--dias") + 1]) || 90;
// Sin --campana, el script LISTA las campañas en vez de mezclarlas.
const CAMPANA = process.argv.includes("--campana")
  ? process.argv[process.argv.indexOf("--campana") + 1]
  : null;

async function get(ruta, params = {}) {
  const q = new URLSearchParams({ access_token: TOKEN, ...params });
  const r = await fetch(`${API}/${ruta}?${q}`);
  const j = await r.json();
  if (j.error) throw new Error(`${ruta} → ${j.error.message}`);
  return j;
}

/** Suma una acción concreta del arreglo `actions` que devuelve Meta. */
function accion(fila, tipo) {
  const a = (fila.actions || []).find((x) => x.action_type === tipo);
  return a ? Number(a.value) : 0;
}

const plata = (n) =>
  "$" + Math.round(n).toLocaleString("es-CL").replace(/,/g, ".");

async function main() {
  if (!TOKEN || !CUENTA) {
    console.error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID en .env.local");
    process.exit(1);
  }

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - DIAS * 86400000);
  const rango = JSON.stringify({
    since: desde.toISOString().slice(0, 10),
    until: hasta.toISOString().slice(0, 10),
  });

  const datos = await get(`${CUENTA}/insights`, {
    level: "ad",
    time_range: rango,
    fields: [
      "campaign_name", "adset_name", "ad_name", "ad_id",
      "spend", "impressions", "clicks", "ctr", "cpc",
      "actions", "cost_per_action_type",
    ].join(","),
    limit: "200",
  });

  let filas = (datos.data || []).map((f) => {
    const gasto = Number(f.spend || 0);
    const clicsEnlace = accion(f, "link_click");
    const vistas = accion(f, "landing_page_view");
    const leads = accion(f, "lead") + accion(f, "onsite_conversion.lead_grouped");
    return {
      campana: f.campaign_name || "",
      conjunto: f.adset_name || "",
      anuncio: f.ad_name || "(sin nombre)",
      gasto,
      impresiones: Number(f.impressions || 0),
      clicsEnlace,
      vistas,
      leads,
      ctr: Number(f.ctr || 0),
      costoPorClic: clicsEnlace ? gasto / clicsEnlace : 0,
      costoPorVista: vistas ? gasto / vistas : 0,
    };
  });

  if (!filas.length) {
    console.log(`Sin datos en los últimos ${DIAS} días.`);
    return;
  }

  // Agrupar POR CAMPAÑA, no todo junto.
  //
  // La primera versión de este script sumaba todos los anuncios del período y
  // el resultado mezclaba tres campañas distintas — se notaba en que convivían
  // tres formas de nombrar los anuncios ("AD 1 /", "Ad5 |", "anuncio 4,").
  // Comparar el CTR de un anuncio contra el de otra campaña, con otro público
  // y otro objetivo, no dice nada.
  const porCampana = new Map();
  for (const f of filas) {
    if (!porCampana.has(f.campana)) porCampana.set(f.campana, []);
    porCampana.get(f.campana).push(f);
  }

  if (!CAMPANA) {
    // Las fechas vienen de otra consulta: `insights` no las trae. Sin ellas no
    // se puede decir cuál campaña fue "la siguiente" a cuál, que es
    // justamente lo que hay que saber para elegir la correcta.
    const meta = await get(`${CUENTA}/campaigns`, {
      fields: "name,objective,created_time,start_time,stop_time,status",
      limit: "100",
    });
    const porNombre = new Map((meta.data || []).map((c) => [c.name, c]));

    console.log(`\nCAMPAÑAS CON DATOS EN LOS ÚLTIMOS ${DIAS} DÍAS`);
    console.log(`(ordenadas de más nueva a más antigua)\n`);
    console.log(
      "CREADA".padEnd(12) + "CAMPAÑA".padEnd(38) + "OBJETIVO".padEnd(20) +
      "CLICS".padStart(7) + "GASTO".padStart(11)
    );
    console.log("-".repeat(88));

    const orden = [...porCampana.entries()].sort((a, b) => {
      const fa = porNombre.get(a[0])?.created_time || "";
      const fb = porNombre.get(b[0])?.created_time || "";
      return fb.localeCompare(fa);
    });
    for (const [nombre, ads] of orden) {
      const c = porNombre.get(nombre) || {};
      console.log(
        (c.created_time || "?").slice(0, 10).padEnd(12) +
        (nombre || "(sin nombre)").slice(0, 36).padEnd(38) +
        (c.objective || "?").replace("OUTCOME_", "").slice(0, 18).padEnd(20) +
        String(ads.reduce((s, f) => s + f.clicsEnlace, 0)).padStart(7) +
        plata(ads.reduce((s, f) => s + f.gasto, 0)).padStart(11)
      );
    }
    console.log(
      `\nPara ver una sola:\n` +
      `   node services/meta-analyzer/ranking-anuncios.mjs --campana "parte del nombre"\n`
    );
    return;
  }

  // Filtrar a la campaña pedida (coincidencia parcial, sin distinguir tildes).
  const buscado = CAMPANA.toLowerCase();
  const elegidas = [...porCampana.keys()].filter((n) =>
    (n || "").toLowerCase().includes(buscado)
  );
  if (!elegidas.length) {
    console.log(`Ninguna campaña coincide con "${CAMPANA}".`);
    console.log("Disponibles:", [...porCampana.keys()].join(" · "));
    return;
  }
  filas = elegidas.flatMap((n) => porCampana.get(n));
  console.log(`\nCampaña: ${elegidas.join(" + ")}`);

  // El orden que pidió Joaquín: más clics a la página = mejor.
  filas.sort((a, b) => b.clicsEnlace - a.clicsEnlace);

  const tot = filas.reduce(
    (a, f) => ({
      gasto: a.gasto + f.gasto,
      clics: a.clics + f.clicsEnlace,
      vistas: a.vistas + f.vistas,
      leads: a.leads + f.leads,
      impresiones: a.impresiones + f.impresiones,
    }),
    { gasto: 0, clics: 0, vistas: 0, leads: 0, impresiones: 0 }
  );

  console.log(`\nRANKING DE ANUNCIOS — últimos ${DIAS} días`);
  console.log(`Ordenado por clics a la página, de mejor a peor.\n`);
  console.log(
    "#".padEnd(4) +
      "ANUNCIO".padEnd(38) +
      "CLICS".padStart(7) +
      "VISTAS".padStart(8) +
      "GASTO".padStart(11) +
      "$/CLIC".padStart(10) +
      "CTR".padStart(8)
  );
  console.log("-".repeat(86));

  filas.forEach((f, i) => {
    console.log(
      String(i + 1).padEnd(4) +
        f.anuncio.slice(0, 36).padEnd(38) +
        String(f.clicsEnlace).padStart(7) +
        String(f.vistas).padStart(8) +
        plata(f.gasto).padStart(11) +
        (f.clicsEnlace ? plata(f.costoPorClic) : "—").padStart(10) +
        (f.ctr.toFixed(2) + "%").padStart(8)
    );
  });

  console.log("-".repeat(86));
  console.log(
    "TOTAL".padEnd(42) +
      String(tot.clics).padStart(7) +
      String(tot.vistas).padStart(8) +
      plata(tot.gasto).padStart(11)
  );

  // Lo accionable: los que se comieron plata sin traer a nadie.
  const quemados = filas.filter((f) => f.gasto > 0 && f.clicsEnlace === 0);
  if (quemados.length) {
    const perdido = quemados.reduce((a, f) => a + f.gasto, 0);
    console.log(`\n⚠️  ${quemados.length} anuncios gastaron sin conseguir NI UN clic:`);
    quemados.forEach((f) =>
      console.log(`     ${f.anuncio.slice(0, 46).padEnd(48)} ${plata(f.gasto)}`)
    );
    console.log(
      `     Total quemado: ${plata(perdido)} (${((100 * perdido) / tot.gasto).toFixed(0)}% del gasto)`
    );
  }

  console.log("\nEMBUDO");
  console.log(`  impresiones      ${tot.impresiones.toLocaleString("es-CL")}`);
  console.log(
    `  clics al enlace  ${tot.clics}  (${((100 * tot.clics) / Math.max(1, tot.impresiones)).toFixed(2)}% de las impresiones)`
  );
  console.log(
    `  cargó la página  ${tot.vistas}  (${((100 * tot.vistas) / Math.max(1, tot.clics)).toFixed(0)}% de los clics)`
  );
  console.log(
    `  leads            ${tot.leads}  (${((100 * tot.leads) / Math.max(1, tot.vistas)).toFixed(1)}% de las visitas)`
  );
  console.log(`\n  gasto total      ${plata(tot.gasto)}`);
  if (tot.leads) console.log(`  costo por lead   ${plata(tot.gasto / tot.leads)}`);
  else console.log(`  costo por lead   — (cero leads)`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
