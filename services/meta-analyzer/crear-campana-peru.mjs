// condor.ai · Campaña de Perú en Meta Ads — estructura lista, EN PAUSA
//
//   node services/meta-analyzer/crear-campana-peru.mjs            # solo el plan
//   node services/meta-analyzer/crear-campana-peru.mjs --crear     # la crea, APAGADA
//
// Deja la campaña y el conjunto configurados y apagados. Los 5 anuncios los
// sube Joaquín a mano desde el administrador (3 fotos + 2 videos/imágenes),
// porque los creativos no viven en el repo. Los textos listos para pegar están
// en `textos-peru.md`, al lado de este archivo.
//
// ── POR QUÉ ESTÁ ARMADA ASÍ (todo sale de datos de la cuenta, 11-ago-2026) ──
//
// Se copia la estructura de `CO · WhatsApp · Ago 2026`, que es la ÚNICA de las
// cuatro campañas de esta cuenta que cerró clientes: 61 conversaciones por
// $45.450, y de ahí 3 clientes a ~$70.000 de ticket. ROAS 4,6× y $15.150 por
// cliente. No se inventa nada de la estructura: se lee el conjunto de esa
// campaña en vivo y solo se cambia el país.
//
// Lo que NO se repite, y por qué:
//
// · NO se manda a una landing con formulario. `CO · Páginas web` gastó $23.229
//   con 7,29% de CTR —el anuncio era excelente— y consiguió UN lead. De 250
//   clics al sitio, 1 dejó los datos. El formulario era el cuello, y ya se
//   probó reducirlo a un campo sin que cambiara el resultado.
//
// · NO se optimiza por un evento de píxel de bajo volumen. `PERU Leads
//   DiagnosticoIA` corrió 51 días con OUTCOME_SALES y sacó 17 leads: 0,33 al
//   día. Meta pide ~50 conversiones semanales por conjunto para salir de la
//   fase de aprendizaje, así que esa campaña nunca salió de aprendizaje en mes
//   y medio. CONVERSATIONS tiene el volumen que ese evento no tiene: la de
//   Colombia hizo 12 conversaciones al día.
//
// · NO se reparte el presupuesto en varios conjuntos ni se estira en el
//   tiempo. La de Perú gastó $45.163 repartidos en 51 días (~$885/día): a ese
//   ritmo ningún conjunto junta señal. Un solo conjunto, con los 5 creativos
//   adentro, y Meta reparte hacia el que rinde.
//
// · Público AMPLIO (país + edad, sin intereses) con Advantage+. Es lo que
//   corría en Colombia y no hay razón para encarecer el CPM con filtros.
//
// ── LO QUE HAY QUE SABER ANTES DE ENCENDERLA ───────────────────────────────
//
// 1. La fuga NO está en el anuncio, está en la conversación. En Colombia: 61
//    conversaciones iniciadas → 32 llegaron al segundo mensaje → 22 al tercero.
//    La mitad se muere después del primer mensaje. El `wa-bot` sigue escrito y
//    SIN DESPLEGAR, y un lead de CTWA espera respuesta en menos de 30 segundos.
//    Subir el presupuesto sin cerrar esa fuga es pagar más caro por la misma
//    pérdida.
//
// 2. Perú tuvo el mejor CTR de las cuatro campañas (10,17%), pero también el
//    CPM más alto ($7.210 contra $3.576 de Colombia). Eran objetivos distintos
//    y los CPM no son comparables directamente, así que NO se promete un costo
//    por conversación: se mide los primeros días y se ajusta.
//
// 3. La cuenta tiene $22.734 de saldo pendiente. Hoy no bloquea la entrega
//    (`account_status` = puede crear y publicar), pero conviene pagarlo.
import fs from "node:fs";

const API = "https://graph.facebook.com/v21.0";

// ── Lo que se puede cambiar sin tocar el resto ────────────────────────────
const PAIS = "PE";
const NOMBRE_CAMPANA = "PE · WhatsApp · Ago 2026";
const NOMBRE_CONJUNTO = "PE · Dueños de negocio · 25-65 · WhatsApp";
// Mismo presupuesto diario que Colombia (10.000 CLP). Se deja igual a
// propósito: así el rendimiento de Perú es comparable con el de Colombia sin
// tener que corregir por presupuesto. OJO: en CLP el monto va SIN centavos —
// el resto de monedas de Meta van ×100, el peso chileno no.
const PRESUPUESTO_DIARIO = 10000;
// El conjunto de Colombia que sirve de molde. Se lee en vivo para no copiar a
// mano un `targeting` que Meta podría haber cambiado de forma.
const MOLDE_ADSET = "52597168113416";

const clean = (s) => (s || "").replace(/[\s\r\n]+/g, "").trim();
const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const leer = (k) => {
  const m = env.match(new RegExp("^" + k + "\\s*=\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const TOKEN = clean(leer("META_ACCESS_TOKEN"));
const CUENTA = "act_" + clean(leer("META_AD_ACCOUNT_ID")).replace(/^act_/i, "").replace(/[^0-9]/g, "");

async function meta(ruta, metodo = "GET", cuerpo = null) {
  const url = `${API}/${ruta}${ruta.includes("?") ? "&" : "?"}access_token=${TOKEN}`;
  const opciones = { method: metodo };
  if (cuerpo) {
    opciones.headers = { "Content-Type": "application/json" };
    opciones.body = JSON.stringify(cuerpo);
  }
  const r = await fetch(url, opciones);
  const j = await r.json();
  if (j.error) throw new Error(j.error.error_user_msg || j.error.message);
  return j;
}

const plata = (n) => "$" + Number(n).toLocaleString("es-CL");

async function main() {
  const crear = process.argv.includes("--crear");

  // ── El molde ────────────────────────────────────────────────────────────
  const molde = await meta(
    `${MOLDE_ADSET}?fields=name,daily_budget,targeting,billing_event,bid_strategy,optimization_goal,destination_type,promoted_object`
  );

  // Solo cambia el país. Todo lo demás del targeting (edad, Advantage+, tipos
  // de ubicación) se hereda tal cual del conjunto que funcionó.
  const targeting = JSON.parse(JSON.stringify(molde.targeting));
  targeting.geo_locations = {
    countries: [PAIS],
    location_types: molde.targeting?.geo_locations?.location_types || ["home", "recent"],
  };

  console.log("MOLDE   ", molde.name);
  console.log("         optimiza", molde.optimization_goal, "· destino", molde.destination_type);
  console.log("         WhatsApp +" + molde.promoted_object?.whatsapp_phone_number);
  console.log();
  console.log("A CREAR  " + NOMBRE_CAMPANA);
  console.log("         conjunto: " + NOMBRE_CONJUNTO);
  console.log("         país: " + PAIS + " · edad " + targeting.age_min + "-" + targeting.age_max +
              " · Advantage+ " + (targeting.targeting_automation?.advantage_audience ? "sí" : "no"));
  console.log("         presupuesto diario: " + plata(PRESUPUESTO_DIARIO) + " CLP");
  console.log("         anuncios: 0 (los sube Joaquín a mano — textos en textos-peru.md)");

  if (!crear) {
    console.log("\nSOLO PLAN. Para crearla (apagada):");
    console.log("  node services/meta-analyzer/crear-campana-peru.mjs --crear");
    return;
  }

  // Si ya existe, no se crea una gemela: dos campañas iguales apagadas y nadie
  // sabe cuál es la buena. Pasó antes con la de Colombia.
  const existentes = await meta(`${CUENTA}/campaigns?fields=id,name,status&limit=200`);
  const yaEsta = existentes.data.find((x) => x.name === NOMBRE_CAMPANA);
  if (yaEsta) {
    console.log(`\nYa existe la campaña ${yaEsta.id} (${yaEsta.status}). No se crea otra.`);
    const cj = await meta(`${yaEsta.id}/adsets?fields=id,name,status&limit=10`);
    cj.data.forEach((c) => console.log(`  conjunto ${c.id} · ${c.status} · ${c.name}`));
    return;
  }

  console.log("\nCreando campaña...");
  const campana = await meta(`${CUENTA}/campaigns`, "POST", {
    name: NOMBRE_CAMPANA,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    is_adset_budget_sharing_enabled: false,
  });
  console.log("  campaña », " + campana.id);

  const conjunto = await meta(`${CUENTA}/adsets`, "POST", {
    name: NOMBRE_CONJUNTO,
    campaign_id: campana.id,
    status: "PAUSED",
    daily_budget: PRESUPUESTO_DIARIO,
    billing_event: molde.billing_event,
    optimization_goal: molde.optimization_goal,
    destination_type: molde.destination_type,
    bid_strategy: molde.bid_strategy,
    targeting,
    promoted_object: {
      page_id: molde.promoted_object.page_id,
      whatsapp_phone_number: molde.promoted_object.whatsapp_phone_number,
    },
  });
  console.log("  conjunto », " + conjunto.id);

  console.log("\nTODO QUEDÓ APAGADO.");
  console.log("Falta: subir los 5 creativos como anuncios dentro del conjunto " + conjunto.id);
  console.log("Textos listos para pegar: services/meta-analyzer/textos-peru.md");
  console.log(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${CUENTA.replace("act_", "")}`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
