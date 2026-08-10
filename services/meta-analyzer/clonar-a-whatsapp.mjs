// condor.ai · Clona la campaña de landing a una versión con CTA a WhatsApp
//
//   node services/meta-analyzer/clonar-a-whatsapp.mjs           # muestra el plan
//   node services/meta-analyzer/clonar-a-whatsapp.mjs --crear   # la crea, APAGADA
//
// QUÉ HACE Y QUÉ NO
// ---------------------------------------------------------------------------
// Copia la campaña "CO · Páginas web · Ago 2026" con el mismo público, el mismo
// presupuesto y los mismos 7 creativos (imágenes, videos y textos), pero
// mandando a WhatsApp en vez de a la landing.
//
// TODO QUEDA EN PAUSED: campaña, conjunto y los 7 anuncios. Nada se entrega
// hasta que alguien lo active a mano. Es a propósito — se pidió revisar antes.
//
// LA ESTRUCTURA NO SE INVENTÓ
// ---------------------------------------------------------------------------
// Se copió de los anuncios a WhatsApp que YA existen en esta cuenta ("Ad1 |
// Ivideo 1"), que es la única forma de estar seguro de que Meta la acepta:
//
//   objetivo           OUTCOME_ENGAGEMENT
//   destination_type   MESSAGING_INSTAGRAM_DIRECT_WHATSAPP
//   optimization_goal  CONVERSATIONS
//   promoted_object    { page_id, whatsapp_phone_number }
//   call_to_action     WHATSAPP_MESSAGE → https://api.whatsapp.com/send
//
// LOS TEXTOS SE ADAPTAN
// ---------------------------------------------------------------------------
// Los originales decían "Agenda una llamada de 30 minutos". Mandando a WhatsApp
// eso ya no calza: el titular pasa a invitar a escribir. El cuerpo del anuncio
// se respeta tal cual — es el que consiguió 7,3% de CTR y no hay razón para
// tocarlo.

import fs from "node:fs";

const clean = (s) => (s || "").replace(/[\s\r\n]+/g, "").trim();
const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const leer = (k) => {
  const m = env.match(new RegExp("^" + k + "\\s*=\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};

const TOKEN = clean(leer("META_ACCESS_TOKEN"));
const CUENTA = "act_" + clean(leer("META_AD_ACCOUNT_ID")).replace(/^act_/i, "").replace(/[^0-9]/g, "");
const API = "https://graph.facebook.com/v21.0";

const ORIGEN_ADSET = "52595253993216";
const PAGE_ID = "1110141278850197";
const IG_ID = "17841448715856246";
const WHATSAPP = "56988989824";
const CTA_WSP = {
  type: "WHATSAPP_MESSAGE",
  value: { app_destination: "WHATSAPP", link: "https://api.whatsapp.com/send" },
};

// Titulares nuevos: el original invitaba a agendar, y a WhatsApp se invita a
// escribir. Se mapea por nombre de anuncio para no perder cuál es cuál.
const TITULARES = {
  "anuncio 1": "Tu web desde $390.000 · escríbenos",
  "anuncio 2": "Tu página en 7 días · pregúntanos",
  "anuncio 3": "Tu web en 5 días · escríbenos",
  "anuncio 4": "Webs que convierten · cotiza por WhatsApp",
  "anuncio 5": "Tu mejor vendedor 24/7 · escríbenos",
  "anuncio 6": "Mira cómo quedaría tu web · escríbenos",
  "anuncio 7": "Deja que tu web venda · escríbenos",
};

async function meta(ruta, metodo = "GET", cuerpo = null) {
  const url = `${API}/${ruta}`;
  const opciones = { method: metodo };
  if (cuerpo) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(cuerpo)) {
      fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    fd.append("access_token", TOKEN);
    opciones.body = fd;
  }
  const final = cuerpo ? url : `${url}${url.includes("?") ? "&" : "?"}access_token=${TOKEN}`;
  const r = await fetch(final, opciones);
  const j = await r.json();
  if (j.error) {
    const e = j.error;
    // El mensaje a secas casi nunca sirve; el detalle está en error_user_msg
    // y en blame_field_specs, que dice QUÉ campo está mal.
    const partes = [e.message];
    if (e.error_user_msg) partes.push(e.error_user_msg);
    if (e.error_data?.blame_field_specs) partes.push(JSON.stringify(e.error_data.blame_field_specs));
    throw new Error(partes.join(" · "));
  }
  return j;
}

const clave = (nombre) => (nombre.match(/anuncio\s*\d+/i) || [""])[0].toLowerCase().replace(/\s+/g, " ");

async function main() {
  const crear = process.argv.includes("--crear");

  // ── Leer el original ──────────────────────────────────────────────────
  const adsetOrig = await meta(`${ORIGEN_ADSET}?fields=name,daily_budget,targeting,billing_event,bid_strategy,attribution_spec`);
  const ads = await meta(`${ORIGEN_ADSET}/ads?fields=id,name,status,creative{id,object_story_spec,asset_feed_spec}&limit=50`);

  console.log(`Origen: ${adsetOrig.name}`);
  console.log(`Presupuesto diario: $${(adsetOrig.daily_budget / 100).toLocaleString("es-CL")}`);
  console.log(`Creativos a copiar: ${ads.data.length}\n`);

  const plan = ads.data.map((a) => {
    const c = a.creative || {};
    const oss = c.object_story_spec || {};
    const afs = c.asset_feed_spec || null;
    const k = clave(a.name);
    const esVideo = Boolean(oss.video_data);
    return {
      nombre: a.name,
      titularNuevo: TITULARES[k] || "Escríbenos por WhatsApp",
      esVideo,
      videoId: oss.video_data?.video_id,
      cuerpo: esVideo ? oss.video_data.message : (afs?.bodies?.[0]?.text || ""),
      descripcion: esVideo ? oss.video_data.link_description : (afs?.descriptions?.[0]?.text || ""),
      imagenes: afs?.images || [],
      imagenVideo: oss.video_data?.image_hash,
    };
  });

  for (const p of plan) {
    console.log(`· ${p.nombre}`);
    console.log(`    ${p.esVideo ? "video " + p.videoId : p.imagenes.length + " imágenes"}`);
    console.log(`    titular: ${p.titularNuevo}`);
  }

  if (!crear) {
    console.log("\nSOLO PLAN. Para crearla (apagada):");
    console.log("  node services/meta-analyzer/clonar-a-whatsapp.mjs --crear");
    return;
  }

  // ── Campaña ───────────────────────────────────────────────────────────
  // Si ya existe (por una corrida anterior que se cortó), se reusa: crear otra
  // dejaría dos campañas gemelas apagadas y nadie sabría cuál es la buena.
  const existentes = await meta(`${CUENTA}/campaigns?fields=id,name,status&limit=100`);
  const yaEsta = existentes.data.find((x) => x.name === "CO · WhatsApp · Ago 2026");
  if (yaEsta) {
    const conjuntos = await meta(`${yaEsta.id}/adsets?fields=id,name&limit=10`);
    const cj = conjuntos.data[0];
    console.log(`\nYa existía la campaña ${yaEsta.id} (${yaEsta.status}).`);
    console.log(`Se reusa su conjunto ${cj.id} y solo se crean los anuncios que falten.`);
    const hechos = await meta(`${cj.id}/ads?fields=name&limit=50`);
    const nombres = new Set(hechos.data.map((a) => a.name));
    await crearAnuncios(plan.filter((p) => !nombres.has(`${p.nombre} · WhatsApp`)), cj.id);
    return;
  }

  console.log("\nCreando campaña...");
  const campana = await meta(`${CUENTA}/campaigns`, "POST", {
    name: "CO · WhatsApp · Ago 2026",
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",                    // apagada, para revisar
    special_ad_categories: [],
    buying_type: "AUCTION",
    // Meta ahora obliga a declararlo cuando el presupuesto va en el conjunto y
    // no en la campaña. En false: el conjunto usa SU presupuesto y no le presta
    // el 20% a ningún otro. Con un solo conjunto, compartir no tendría sentido.
    is_adset_budget_sharing_enabled: false,
  });
  console.log("  campaña", campana.id);

  // ── Conjunto ──────────────────────────────────────────────────────────
  const conjunto = await meta(`${CUENTA}/adsets`, "POST", {
    name: "CO · Dueños de negocio · 25-60 · WhatsApp",
    campaign_id: campana.id,
    status: "PAUSED",
    daily_budget: adsetOrig.daily_budget,
    billing_event: "IMPRESSIONS",
    optimization_goal: "CONVERSATIONS",
    destination_type: "MESSAGING_INSTAGRAM_DIRECT_WHATSAPP",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: adsetOrig.targeting,
    promoted_object: { page_id: PAGE_ID, whatsapp_phone_number: WHATSAPP },
  });
  console.log("  conjunto", conjunto.id);

  await crearAnuncios(plan, conjunto.id);
}

// Se separa en su propia función para poder llamarla también cuando la campaña
// ya existe y solo faltan anuncios.
async function crearAnuncios(plan, adsetId) {
  if (!plan.length) {
    console.log("\nNo falta ningún anuncio.");
    return;
  }
  let ok = 0;
  for (const p of plan) {
    try {
      let spec;
      if (p.esVideo) {
        spec = {
          page_id: PAGE_ID,
          instagram_user_id: IG_ID,
          video_data: {
            video_id: p.videoId,
            title: p.titularNuevo,
            message: p.cuerpo,
            link_description: p.descripcion,
            image_hash: p.imagenVideo,
            call_to_action: CTA_WSP,
          },
        };
      } else {
        spec = {
          page_id: PAGE_ID,
          instagram_user_id: IG_ID,
          link_data: {
            image_hash: p.imagenes[0]?.hash,
            name: p.titularNuevo,
            message: p.cuerpo,
            description: p.descripcion,
            link: "https://api.whatsapp.com/send",
            call_to_action: CTA_WSP,
          },
        };
      }

      const creativo = await meta(`${CUENTA}/adcreatives`, "POST", {
        name: `${p.nombre} · WhatsApp`,
        object_story_spec: spec,
        degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } },
      });

      const anuncio = await meta(`${CUENTA}/ads`, "POST", {
        name: `${p.nombre} · WhatsApp`,
        adset_id: adsetId,
        creative: { creative_id: creativo.id },
        status: "PAUSED",
      });
      console.log(`  ✓ ${p.nombre} → ${anuncio.id}`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${p.nombre}: ${e.message.slice(0, 160)}`);
    }
  }

  console.log(`\n${ok}/${plan.length} anuncios creados.`);
  console.log("TODO QUEDÓ APAGADO. Revísalo en el administrador antes de activar.");
  console.log(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${CUENTA.replace("act_", "")}`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
