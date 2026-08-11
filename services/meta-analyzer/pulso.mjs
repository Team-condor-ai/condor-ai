// condor.ai · Pulso de campaña Meta (cada 6 h → Telegram)
//
// QUÉ ES Y QUÉ NO ES
// -----------------------------------------------------------------------------
// Esto NO reemplaza a meta-analyzer.mjs. Aquel corre 1 vez al día, mira la
// campaña COMPLETA desde que arrancó y le pide a Claude un análisis con
// recomendaciones. Este es lo contrario: números crudos SOLO del día de hoy,
// cuatro veces al día, sin llamar a Claude.
//
// La razón de existir: cuando una campaña está en prueba, esperar al reporte de
// la noche significa quemar el presupuesto del día entero antes de enterarse de
// que algo va mal. Con un pulso cada 6 h se puede pausar a media tarde.
//
// "HOY" ES EL DÍA DE LA CUENTA PUBLICITARIA, no el de GitHub. La cuenta está en
// Chile/Continental (UTC-4) y `date_preset=today` lo resuelve Meta en esa zona,
// así que el corte del día es medianoche en Chile aunque el runner esté en UTC.
//
// Secrets requeridos (los mismos que ya usa el analizador diario):
//   META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const clean = (s) => (s || "").replace(/[\s\r\n]+/g, "").trim();
const META_TOKEN = clean(process.env.META_ACCESS_TOKEN);
let AD_ACCOUNT = clean(process.env.META_AD_ACCOUNT_ID).replace(/^act_/i, "").replace(/[^0-9]/g, "");
if (AD_ACCOUNT) AD_ACCOUNT = "act_" + AD_ACCOUNT;
const TG = clean(process.env.TELEGRAM_BOT_TOKEN);
const CHAT = clean(process.env.TELEGRAM_CHAT_ID);
const API = "https://graph.facebook.com/v21.0";

/* Telegram en HTML y no en Markdown: los nombres de los anuncios los escribe
   Joaquín a mano ("anuncio 4 ,imagen azul") y cualquier * o _ suelto rompe un
   mensaje Markdown entero. En HTML basta con escapar tres caracteres. */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tg(html) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const j = await r.json();
  if (!j.ok) console.error("Telegram:", JSON.stringify(j));
  return j;
}

async function metaGet(path, params = {}) {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // La red GitHub↔Meta falla cada tanto; reintentar es más barato que perder el pulso.
  let ultimo;
  for (let i = 0; i < 4; i++) {
    try {
      const j = await (await fetch(url, { signal: AbortSignal.timeout(25000) })).json();
      if (j.error) throw new Error("Meta API: " + (j.error.message || JSON.stringify(j.error)));
      return j;
    } catch (e) {
      ultimo = e;
      if (String(e).includes("Meta API:")) throw e;   // error real, no de red
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw ultimo;
}

/* Meta devuelve las conversiones en una lista de {action_type, value}. */
const acciones = (fila) => Object.fromEntries((fila.actions || []).map((a) => [a.action_type, +a.value]));

const CLICS_WEB = "link_click";                                    // clic en el enlace
const LANDING = "landing_page_view";                               // la página llegó a cargar
const INTENTO = "offsite_conversion.fb_pixel_view_content";        // escribió el 1er dígito
const LEAD = "offsite_conversion.fb_pixel_lead";                   // dejó el número

const plata = (n) => "$" + Math.round(n).toLocaleString("es-CL");
const pct = (n) => n.toFixed(1).replace(".", ",") + "%";

/** Los números que importan de una fila de insights, ya desglosados. */
function medir(fila) {
  const a = acciones(fila);
  const gasto = +fila.spend || 0;
  const clics = a[CLICS_WEB] ?? +fila.clicks ?? 0;
  const landing = a[LANDING] || 0;
  return {
    gasto,
    impresiones: +fila.impressions || 0,
    clics,
    ctr: +fila.ctr || 0,
    landing,
    intentos: a[INTENTO] || 0,
    leads: a[LEAD] || 0,
    /* Cuánto cuesta poner UNA persona en la página. Es la vara honesta
       mientras no haya leads: mide plata quemada contra gente que llegó. */
    costoLanding: landing ? gasto / landing : Infinity,
  };
}

const sumar = (xs) =>
  xs.reduce((t, m) => ({
    gasto: t.gasto + m.gasto,
    impresiones: t.impresiones + m.impresiones,
    clics: t.clics + m.clics,
    landing: t.landing + m.landing,
    intentos: t.intentos + m.intentos,
    leads: t.leads + m.leads,
  }), { gasto: 0, impresiones: 0, clics: 0, landing: 0, intentos: 0, leads: 0 });

/* Ranking: primero por leads (que es el objetivo), y mientras no haya ninguno,
   por lo que cuesta traer a una persona a la página. Ordenar por CTR sería
   premiar al que consigue clics baratos que no llegan a la web. */
function ordenar(anuncios) {
  return [...anuncios].sort((a, b) => {
    if (b.m.leads !== a.m.leads) return b.m.leads - a.m.leads;
    return a.m.costoLanding - b.m.costoLanding;
  });
}

async function main() {
  if (!META_TOKEN || !AD_ACCOUNT || !TG || !CHAT) {
    console.error("Faltan secrets: META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / TELEGRAM_*");
    process.exit(1);
  }

  const FIELDS = "campaign_name,ad_name,spend,impressions,clicks,ctr,actions";

  const [hoy, ayer, cuenta, camps] = await Promise.all([
    metaGet(`${AD_ACCOUNT}/insights`, { level: "ad", fields: FIELDS, date_preset: "today", limit: 100 }),
    metaGet(`${AD_ACCOUNT}/insights`, { level: "account", fields: "spend,actions", date_preset: "yesterday" }),
    metaGet(AD_ACCOUNT, { fields: "timezone_name,currency" }),
    metaGet(`${AD_ACCOUNT}/campaigns`, { fields: "name,effective_status", limit: 100 }),
  ]);

  // Solo se reportan campañas VIVAS.
  //
  // Sin esto, el pulso informaba de campañas ya apagadas (pasó el 11-ago-2026
  // a las 03:21 UTC). No era un error de datos: `date_preset: "today"` usa el
  // huso de la CUENTA, que es Chile. A las 03:21 UTC en Chile todavía era el
  // día anterior, así que "hoy" devolvía el gasto de una campaña que se pausó
  // durante esa jornada — real, pero ya no accionable. Un reporte de algo
  // apagado hace dudar de todos los demás.
  //
  // Se mira `effective_status` y no `status`, igual que en meta-analyzer.mjs:
  // `status` es lo que la campaña dice de sí misma y puede decir ACTIVE con
  // todos sus conjuntos pausados o con la cuenta frenada por saldo.
  const vivas = new Set((camps.data || [])
    .filter((c) => c.effective_status === "ACTIVE")
    .map((c) => c.name));

  const conGasto = (hoy.data || []).filter((f) => +f.spend > 0);
  const filas = conGasto.filter((f) => vivas.has(f.campaign_name));

  const apagadas = [...new Set(conGasto
    .filter((f) => !vivas.has(f.campaign_name))
    .map((f) => f.campaign_name))];
  if (apagadas.length) {
    console.log(`Fuera del pulso, ya no están activas: ${apagadas.join(" · ")}`);
  }
  const ahora = new Date().toLocaleString("es-CL", {
    timeZone: cuenta.timezone_name || "Chile/Continental",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  if (!filas.length) {
    // Se distinguen los dos casos a propósito: "no hay campañas activas" y
    // "hay activas pero todavía no gastan" son situaciones muy distintas, y
    // el mismo mensaje para ambas es cómo uno deja de leer los avisos.
    const nota = apagadas.length
      ? "No hay campañas activas. El gasto de hoy corresponde a campañas ya pausadas."
      : "Hoy todavía no hay gasto registrado.";
    await tg(`📊 <b>Pulso de campaña</b> · ${esc(ahora)}\n\n${esc(nota)}`);
    return;
  }

  const anuncios = filas.map((f) => ({ nombre: f.ad_name, campana: f.campaign_name, m: medir(f) }));
  const t = sumar(anuncios.map((a) => a.m));
  const ctr = t.impresiones ? (t.clics / t.impresiones) * 100 : 0;

  const l = [];
  l.push(`📊 <b>Pulso de campaña</b> · hoy hasta las ${esc(ahora)}`);
  l.push("");
  l.push(`💸 Quemado hoy: <b>${plata(t.gasto)}</b>`);
  l.push(`👆 Clics a la web: <b>${t.clics}</b>  ·  CTR ${pct(ctr)}`);
  l.push(`🌐 Llegaron a la página: <b>${t.landing}</b>` +
         (t.landing ? `  (${plata(t.gasto / t.landing)} c/u)` : ""));
  l.push(`✍️ Empezaron a escribir el número: <b>${t.intentos}</b>`);
  l.push(`✅ Dejaron el WhatsApp: <b>${t.leads}</b>` +
         (t.leads ? `  (${plata(t.gasto / t.leads)} c/u)` : ""));

  /* Dónde se rompe el embudo. Sin esto hay que sacar los porcentajes a mano. */
  if (t.landing) {
    const aEscribir = (t.intentos / t.landing) * 100;
    const aDejar = t.intentos ? (t.leads / t.intentos) * 100 : 0;
    l.push("");
    l.push(`📉 De los que llegaron, ${pct(aEscribir)} tocó el formulario` +
           (t.intentos ? `, y de esos ${pct(aDejar)} lo completó.` : "."));
  }

  const orden = ordenar(anuncios);

  /* Solo los que trajeron a alguien. Un anuncio con 0 visitas no es "el
     tercer mejor": es uno de los que hay que apagar, y aparece más abajo. */
  const buenos = orden.filter((a) => a.m.landing > 0 || a.m.leads > 0);
  if (buenos.length) {
    l.push("");
    l.push("🏆 <b>Mejores creativos de hoy</b>");
    for (const a of buenos.slice(0, 3)) {
      l.push(`  · ${esc(a.nombre)} — ${plata(a.m.gasto)}, ${a.m.landing} visitas ` +
             `(${plata(a.m.costoLanding)} c/u)` + (a.m.leads ? `, ${a.m.leads} leads` : ""));
    }
  }

  /* Los que gastan sin traer a nadie: es la plata que se puede recuperar hoy
     mismo apagándolos, y es lo que uno no ve mirando solo a los ganadores. */
  const malos = orden.filter((a) => a.m.landing === 0 && a.m.gasto > 0);
  if (malos.length) {
    const perdido = malos.reduce((s, a) => s + a.m.gasto, 0);
    l.push("");
    l.push(`🚨 <b>Gastando sin traer a nadie</b> (${plata(perdido)} hoy)`);
    for (const a of malos.slice(0, 4)) l.push(`  · ${esc(a.nombre)} — ${plata(a.m.gasto)}`);
  }

  const ay = (ayer.data || [])[0];
  if (ay) {
    const m = medir(ay);
    l.push("");
    l.push(`<i>Ayer cerró con ${plata(m.gasto)} y ${m.leads} leads.</i>`);
  }

  await tg(l.join("\n"));
  console.log("Pulso enviado:", plata(t.gasto), "·", t.leads, "leads");
}

main().catch(async (e) => {
  console.error(e);
  // Un pulso que falla en silencio es peor que no tenerlo: se cree que no pasa nada.
  await tg(`⚠️ <b>Pulso de campaña</b> falló: ${esc(e.message || e)}`).catch(() => {});
  process.exit(1);
});
