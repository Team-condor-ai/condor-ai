/**
 * Crea la campaña de Colombia en Meta Ads vía Marketing API.
 *
 * SIEMPRE la deja EN PAUSA. Una campaña activa gasta desde el primer minuto y
 * esa decisión no es de un script.
 *
 * Corre desde GitHub Actions para que META_ACCESS_TOKEN no salga nunca de los
 * secrets del repo.
 *
 *   node crear-campana-colombia.mjs --dry-run   # imprime lo que haría
 *   node crear-campana-colombia.mjs             # lo crea, en pausa
 *
 * ── POR QUÉ ESTÁ ARMADA ASÍ ──────────────────────────────────────────────
 *
 * El presupuesto manda: 250.000 CLP para 25 días son ~10.000 CLP/día, unos
 * 11 USD. Con esa plata:
 *
 * · UN SOLO conjunto de anuncios con los 7 creativos dentro, no siete
 *   conjuntos. Meta reparte el presupuesto hacia el creativo que rinde. Con
 *   siete conjuntos, cada uno recibiría ~1,5 USD/día: ninguno junta datos
 *   suficientes para decidir nada y los siete se quedan en aprendizaje.
 *
 * · Público AMPLIO (país + edad, sin intereses). Con presupuesto chico, cada
 *   filtro que se agrega encarece el CPM y le quita espacio al algoritmo. Los
 *   intereses de "emprendimiento" en Meta son además notoriamente imprecisos:
 *   los marca cualquiera que le dio like a una frase motivacional.
 *
 * · Optimización por `Lead`, no por `Schedule`. Meta necesita ~50
 *   conversiones semanales por conjunto para salir de la fase de aprendizaje.
 *   Con este presupuesto, `Schedule` solo no llega; `Lead` (que ahora cuenta
 *   las dos formas de dejar los datos) tiene el triple de volumen. `Schedule`
 *   se sigue midiendo, pero como métrica, no como objetivo.
 *
 * · Advantage+ placements: dejar que Meta elija dónde mostrar. Restringir a
 *   feed encarece el alcance sin mejorar la conversión a este volumen.
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

const API = "https://graph.facebook.com/v21.0";
const TOKEN = (process.env.META_ACCESS_TOKEN || "").trim();
const PIXEL_ID = (process.env.META_PIXEL_ID || "2066041737623288").trim();
const PAGE_ID = (process.env.META_PAGE_ID || "1110141278850197").trim();
const DRY = process.argv.includes("--dry-run");
const DIR_CREATIVOS = process.env.CREATIVOS_DIR || "creativos";

let AD_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/i, "").replace(/[^0-9]/g, "");
if (AD_ACCOUNT) AD_ACCOUNT = "act_" + AD_ACCOUNT;

/* ── Plan de campaña ───────────────────────────────────────────────────── */

const PLAN = {
  nombre: "CO · Páginas web · Ago 2026",
  presupuestoTotalCLP: 250_000,
  dias: 25,
  urlBase: "https://condorai.cl/colombia/",
  utm: { source: "meta", medium: "paid", campaign: "co_web_ago" },
  edadMin: 25,
  // Advantage+ no acepta un máximo bajo 65: con la audiencia automática, la
  // edad es una sugerencia y Meta puede salirse si encuentra conversiones.
  // Además conviene: muchos dueños de PYME pasan de los 60 y recortar ahí
  // dejaba fuera a parte del público que mejor convierte.
  edadMax: 65,
  // Colombia completo. Las ciudades grandes concentran el inventario igual, y
  // limitar a tres ciudades sube el CPM sin mejorar la calidad del lead.
  paises: ["CO"],
};

/* Textos de los anuncios. Un texto por creativo permite ver si lo que mueve la
   aguja es la imagen o el copy; si todos llevan el mismo, no se puede separar. */
const COPY = {
  titular: "Tu página web lista, a tu medida",
  descripcion: "Reunión de 30 minutos, sin costo",
  cta: "LEARN_MORE",
  cuerpos: [
    "¿Llevas meses pidiendo cotizaciones que nunca llegan? Somos cuatro personas con oficina. Nos sentamos contigo, entendemos tu negocio y construimos tu página. Agenda 30 minutos, sin costo.",
    "Más de 4 años creando páginas web para empresas en Latinoamérica. Hablas siempre con quien la está construyendo, no con un vendedor. Reunión sin costo ni compromiso.",
    "Tu negocio necesita que te encuentren. Hacemos páginas web que trabajan para ti, con el dominio a tu nombre. Conversemos 30 minutos y te decimos qué necesitas.",
    "Sin letra chica: te damos el precio por escrito en la primera reunión. Si no te sirve, no seguimos y no te costó nada.",
    "Puedes entrar a los sitios que hemos hecho y navegarlos como lo haría tu cliente. Están en vivo. Después conversamos.",
    "Cuatro personas y una oficina. A la reunión entra quien va a construir tu página, y es con quien vas a hablar después.",
    "¿Tu competencia aparece en Google y tú no? Empecemos por tu página. Reunión de 30 minutos sin costo, en horario colombiano.",
  ],
};

/* ── Utilidades de la Graph API ────────────────────────────────────────── */

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
  if (j.error) {
    // "Invalid parameter" a secas no sirve para nada: el detalle útil viene en
    // error_user_msg y en error_data.blame_field_specs, que dice QUÉ campo.
    const e = j.error;
    const partes = [e.message];
    if (e.error_user_title) partes.push(e.error_user_title);
    if (e.error_user_msg) partes.push(e.error_user_msg);
    const culpables = e.error_data?.blame_field_specs;
    if (culpables) partes.push(`campo: ${JSON.stringify(culpables)}`);
    throw new Error(`${ruta} → ${partes.join(" · ")}`);
  }
  return j;
}

const urlDeCreativo = (n) =>
  `${PLAN.urlBase}?utm_source=${PLAN.utm.source}&utm_medium=${PLAN.utm.medium}` +
  `&utm_campaign=${PLAN.utm.campaign}&utm_content=creativo_${String(n).padStart(2, "0")}`;

/* ── Creativos ─────────────────────────────────────────────────────────────
 *
 * La carpeta trae cada concepto en TRES formatos (16:9, 4:5 y 9:16) más los
 * videos. Un anuncio por CONCEPTO, no por archivo: los tres formatos del mismo
 * concepto son el mismo anuncio mostrado en distintos lugares.
 *
 * El formato se deduce de las DIMENSIONES REALES y no del nombre del archivo:
 * en esta carpeta los nombres no son fiables ("billete dolar vertical 16,9"
 * mide 941x1672, que es 9:16; "imagen profesional horizontal 4,5" es 4:5).
 * Fiarse del nombre habría mandado la imagen horizontal a Reels.
 */

const IMAGENES = [".jpg", ".jpeg", ".png"];
const VIDEOS = [".mp4", ".mov"];

/** Tokens de formato que se quitan del nombre para agrupar por concepto. */
const RUIDO = /\b(cuadrad[oa]|horizontal|vertical+|16[,.]?9|9[,.]?16|4[,.]?5|1x1|copy)\b/gi;

function ratioA(w, h) {
  const r = w / h;
  if (r > 1.5) return "16:9";
  if (r < 0.65) return "9:16";
  if (r < 0.95) return "4:5";
  return "1:1";
}

/** Lee el tamaño de un PNG o JPEG sin dependencias. */
function medidas(ruta) {
  const b = readFileSync(ruta);
  if (b[0] === 0x89 && b[1] === 0x50) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { w: 0, h: 0 };
}

function listarConceptos() {
  let archivos = [];
  try {
    archivos = readdirSync(DIR_CREATIVOS);
  } catch {
    return [];
  }

  const porConcepto = new Map();
  for (const f of archivos.sort()) {
    const ext = extname(f).toLowerCase();
    const ruta = join(DIR_CREATIVOS, f);

    if (VIDEOS.includes(ext)) {
      // Cada video es su propio anuncio: no vienen en variantes de formato.
      porConcepto.set(f, { nombre: basename(f, ext), tipo: "video", archivos: [{ ruta, formato: "video" }] });
      continue;
    }
    if (!IMAGENES.includes(ext)) continue;

    const concepto = basename(f, ext).replace(RUIDO, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const { w, h } = medidas(ruta);
    if (!porConcepto.has(concepto)) porConcepto.set(concepto, { nombre: concepto, tipo: "imagen", archivos: [] });
    porConcepto.get(concepto).archivos.push({ ruta, formato: ratioA(w, h), w, h });
  }
  return [...porConcepto.values()];
}

/** El formato que manda cuando solo se puede elegir uno.
 *  4:5 es el que mejor rinde en el feed, que es donde va la mayor parte del
 *  presupuesto; 9:16 solo gana en Reels y Stories. */
const ORDEN_FORMATO = ["4:5", "1:1", "9:16", "16:9"];
const principal = (archivos) =>
  ORDEN_FORMATO.map((f) => archivos.find((a) => a.formato === f)).find(Boolean) ?? archivos[0];

/** Sube una imagen y devuelve su hash, que es como Meta la referencia. */
async function subirImagen(ruta) {
  const bytes = readFileSync(ruta);
  const form = new FormData();
  form.append("access_token", TOKEN);
  form.append("filename", new Blob([bytes]), basename(ruta));
  const r = await fetch(`${API}/${AD_ACCOUNT}/adimages`, { method: "POST", body: form });
  const j = await r.json();
  if (j.error) throw new Error(`subir imagen → ${j.error.message}`);
  return Object.values(j.images)[0].hash;
}

async function subirVideo(ruta) {
  const bytes = readFileSync(ruta);
  const form = new FormData();
  form.append("access_token", TOKEN);
  form.append("source", new Blob([bytes]), basename(ruta));
  const r = await fetch(`${API}/${AD_ACCOUNT}/advideos`, { method: "POST", body: form });
  const j = await r.json();
  if (j.error) throw new Error(`subir video → ${j.error.message}`);
  return j.id;
}

/* ── Ejecución ─────────────────────────────────────────────────────────── */

async function main() {
  if (!TOKEN || !AD_ACCOUNT) {
    console.error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID.");
    process.exit(1);
  }

  // La cuenta define la moneda: el presupuesto va en la unidad mínima de ESA
  // moneda (centavos), no en pesos chilenos. Convertir a ojo es cómo se
  // termina gastando 100 veces lo previsto.
  const cuenta = await api(AD_ACCOUNT, { campos: "name,currency,account_status,timezone_name" });
  console.log(`Cuenta: ${cuenta.name} · ${cuenta.currency} · estado ${cuenta.account_status} · ${cuenta.timezone_name}`);
  if (cuenta.account_status !== 1) {
    console.error("La cuenta publicitaria NO está activa (falta método de pago o está restringida).");
    process.exit(1);
  }

  const tasas = { CLP: 1, COP: 4.2, USD: 0.00105, MXN: 0.019, EUR: 0.00098 };
  const tasa = tasas[cuenta.currency];
  if (!tasa) {
    console.error(`No tengo tasa para ${cuenta.currency}. Agrégala antes de correr esto.`);
    process.exit(1);
  }
  const diarioCLP = Math.floor(PLAN.presupuestoTotalCLP / PLAN.dias);
  // Sin decimales el CLP no lleva centavos; el resto de monedas sí (×100).
  const decimales = cuenta.currency === "CLP" || cuenta.currency === "COP" ? 1 : 100;
  const diarioMinimo = Math.round(diarioCLP * tasa * decimales);
  console.log(`Presupuesto: ${diarioCLP} CLP/día → ${diarioMinimo} (unidad mínima ${cuenta.currency})`);

  const creativos = listarConceptos();
  console.log(`\nConceptos encontrados en ${DIR_CREATIVOS}: ${creativos.length} anuncios\n`);
  creativos.forEach((c, i) => {
    const fmts = c.archivos.map((a) => a.formato).join(", ");
    console.log(`  ${i + 1}. [${c.tipo}] ${c.nombre}`);
    console.log(`     formatos: ${fmts}`);
    console.log(`     url: ${urlDeCreativo(i + 1)}`);
  });

  if (DRY) {
    console.log("\n[--dry-run] No se creó nada.");
    return;
  }
  if (!PAGE_ID) {
    console.error("\nFalta META_PAGE_ID (la página de Facebook que firma los anuncios).");
    process.exit(1);
  }

  /* Reutiliza lo que ya exista con el mismo nombre.
     Crear anuncios falla por motivos ajenos al script (la app en modo
     desarrollo, un creativo rechazado, la sesión caída a mitad de subida) y
     sin esto cada reintento dejaba otra campaña vacía en la cuenta. */
  const existentes = await api(`${AD_ACCOUNT}/campaigns`, {
    campos: "id,name,status",
  }).then((r) => (r.data ?? []).filter((c) => c.name === PLAN.nombre));

  let campana = existentes[0];
  if (campana) {
    console.log(`\n· Reutilizando campaña ${campana.id} que ya existía`);
  } else {
  // 1 · Campaña
  campana = await api(`${AD_ACCOUNT}/campaigns`, {
    cuerpo: {
      name: PLAN.nombre,
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      special_ad_categories: "[]",
      buying_type: "AUCTION",
      // Obligatorio desde 2026 cuando el presupuesto vive en el conjunto y no
      // en la campaña. En false: acá hay UN solo conjunto, así que no hay con
      // quién compartir y activarlo solo abre la puerta a que Meta mueva plata
      // si algún día se agrega otro.
      is_adset_budget_sharing_enabled: "false",
    },
  });
  console.log(`\n✓ Campaña ${campana.id} (EN PAUSA)`);

  // 2 · Conjunto de anuncios: uno solo, con todos los creativos dentro.
  const conjunto = await api(`${AD_ACCOUNT}/adsets`, {
    cuerpo: {
      name: "CO · Dueños de negocio · 25-60",
      campaign_id: campana.id,
      status: "PAUSED",
      daily_budget: String(diarioMinimo),
      billing_event: "IMPRESSIONS",
      optimization_goal: "OFFSITE_CONVERSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: JSON.stringify({ pixel_id: PIXEL_ID, custom_event_type: "LEAD" }),
      targeting: JSON.stringify({
        geo_locations: { countries: PLAN.paises },
        age_min: PLAN.edadMin,
        age_max: PLAN.edadMax,
        targeting_automation: { advantage_audience: 1 },
      }),
    },
  });
  console.log(`✓ Conjunto ${conjunto.id} · ${diarioMinimo} ${cuenta.currency}/día · optimiza por Lead`);
  }

  // Anuncios que ya existen: no se repiten al reintentar.
  const yaCreados = new Set(
    await api(`${conjunto.id}/ads`, { campos: "name" })
      .then((r) => (r.data ?? []).map((a) => a.name))
      .catch(() => []),
  );

  // 3 · Un anuncio por creativo, cada uno con SU url etiquetada.
  for (let i = 0; i < creativos.length; i++) {
    const c = creativos[i];
    if (yaCreados.has(`${i + 1} · ${c.nombre}`)) {
      console.log(`  · Anuncio ${i + 1} ya existía, se salta`);
      continue;
    }
    const link = urlDeCreativo(i + 1);
    const mensaje = COPY.cuerpos[i % COPY.cuerpos.length];

    const spec = { page_id: PAGE_ID };
    if (c.tipo === "imagen") {
      // Se sube el formato que manda en feed. Los otros dos quedan disponibles
      // en la biblioteca de la cuenta: Meta recorta solo para cada ubicación, y
      // montar reglas de customización por placement con este presupuesto añade
      // superficie de error sin ganancia medible.
      const elegido = principal(c.archivos);
      console.log(`     usando ${elegido.formato} (${elegido.w}x${elegido.h})`);
      spec.link_data = {
        link,
        message: mensaje,
        name: COPY.titular,
        description: COPY.descripcion,
        image_hash: await subirImagen(elegido.ruta),
        call_to_action: { type: COPY.cta, value: { link } },
      };
    } else {
      spec.video_data = {
        video_id: await subirVideo(c.archivos[0].ruta),
        message: mensaje,
        title: COPY.titular,
        link_description: COPY.descripcion,
        call_to_action: { type: COPY.cta, value: { link } },
      };
    }

    const creative = await api(`${AD_ACCOUNT}/adcreatives`, {
      cuerpo: { name: `Creativo ${i + 1} · ${c.nombre}`, object_story_spec: JSON.stringify(spec) },
    });
    const anuncio = await api(`${AD_ACCOUNT}/ads`, {
      cuerpo: {
        name: `${i + 1} · ${c.nombre}`,
        adset_id: conjunto.id,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: "PAUSED",
      },
    });
    console.log(`  ✓ Anuncio ${i + 1}/${creativos.length}: ${anuncio.id} (${c.tipo})`);
  }

  console.log(`\nTodo creado y EN PAUSA.`);
  console.log(`Revísala acá: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT.replace("act_", "")}`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
