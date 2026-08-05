// condor.ai · Analizador de campañas Meta (2x/día → Telegram)
// Lee las campañas activas de la cuenta publicitaria vía Meta Marketing API,
// las analiza con Claude usando la metodología "3 Q's" (¿Qué pasó? ¿Por qué? ¿Qué hacemos?)
// y manda un reporte accionable al grupo de Telegram.
//
// Secrets requeridos (GitHub Actions):
//   META_ACCESS_TOKEN    → System User token (largo, no expira)
//   META_AD_ACCOUNT_ID   → act_XXXXXXXXX
//   ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (ya existen)

import { readFileSync, writeFileSync } from "node:fs";
const LOG = "services/meta-analyzer/campaign-log.json";

// Limpia espacios/saltos de línea que a veces se pegan al copiar los secrets
const clean = (s) => (s || "").replace(/[\s\r\n]+/g, "").trim();
const META_TOKEN = clean(process.env.META_ACCESS_TOKEN);
// Normaliza el ID: acepta "123...", "act_123...", con espacios o "act_act_..." por error
let AD_ACCOUNT = clean(process.env.META_AD_ACCOUNT_ID).replace(/^act_/i, "").replace(/[^0-9]/g, "");
if (AD_ACCOUNT) AD_ACCOUNT = "act_" + AD_ACCOUNT;
const AK = clean(process.env.ANTHROPIC_API_KEY);
const TG = clean(process.env.TELEGRAM_BOT_TOKEN);
const CHAT = clean(process.env.TELEGRAM_CHAT_ID);
const API = "https://graph.facebook.com/v21.0";

const tg = (text) => fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "Markdown" }),
}).then(r => r.json());

async function metaGet(path, params = {}) {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Reintenta hasta 4 veces ante fallos de red de GitHub↔Meta (ETIMEDOUT/fetch failed)
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      const j = await r.json();
      if (j.error) throw new Error("Meta API: " + (j.error.message || JSON.stringify(j.error)));
      return j;
    } catch (e) {
      lastErr = e;
      const msg = String(e);
      // Si es error real de Meta (no de red), no reintentar
      if (msg.includes("Meta API:")) throw e;
      await new Promise(res => setTimeout(res, 3000 * (i + 1)));
    }
  }
  throw lastErr;
}

const INSIGHTS = ["impressions", "reach", "frequency", "spend", "cpm", "ctr",
  "cpc", "clicks", "actions", "cost_per_action_type", "quality_ranking",
  "engagement_rate_ranking", "conversion_rate_ranking"].join(",");

async function main() {
  if (!META_TOKEN || !AD_ACCOUNT) {
    await tg("⚠️ *Analizador Meta*: faltan los secrets META_ACCESS_TOKEN o META_AD_ACCOUNT_ID. Configúralos en GitHub para activar el análisis.");
    console.log("Faltan secrets Meta"); return;
  }

  // 0) Moneda de la cuenta (para no confundir soles/pesos)
  const cuenta = await metaGet(`${AD_ACCOUNT}`, { fields: "currency,name" });

  // 1) Campañas activas (+ fecha de lanzamiento para saber el "día de campaña")
  const camps = await metaGet(`${AD_ACCOUNT}/campaigns`, { fields: "name,status,objective,created_time,start_time", limit: 25 });
  const activas = (camps.data || []).filter(c => c.status === "ACTIVE");

  if (!activas.length) {
    console.log("Sin campañas activas — no se envía nada"); return;
  }

  const getAcc = (acc, t) => Number((acc.find(a => a.action_type === t) || {}).value || 0);
  const convDe = (acc) => getAcc(acc, "onsite_conversion.messaging_conversation_started_7d") + getAcc(acc, "onsite_conversion.total_messaging_connection");
  const moneda = cuenta.currency || "?";
  const hoy = new Date();

  const resumen = [];
  for (const c of activas) {
    try {
      /* Día de campaña.
       *
       * NO sirve `start_time`: es cuándo se CREÓ la campaña, no cuándo
       * empezó a entregar. La de Colombia se creó el 1-ago y salió al aire
       * el 4-ago, así que contaba 3 días de más — y con eso el análisis
       * recomendaba escalar o pausar creativos que ni siquiera habían
       * terminado su primer día real.
       *
       * El día 1 es el primero con gasto. Se saca del desglose diario, que
       * solo trae días con entrega.
       */
      const diario = await metaGet(`${c.id}/insights`, {
        fields: "spend", date_preset: "maximum", level: "campaign", time_increment: 1,
      });
      const conGasto = (diario.data || []).filter(d => Number(d.spend || 0) > 0);
      const primerDia = conGasto.length ? new Date(conGasto[0].date_start + "T12:00:00Z") : null;
      const diaCampaña = primerDia
        ? Math.max(1, Math.floor((hoy - primerDia) / 86400000) + 1)
        : 1;   // creada pero todavía sin entregar

      const ins = await metaGet(`${c.id}/insights`, { fields: INSIGHTS, date_preset: "maximum", level: "campaign" });
      const d = (ins.data || [])[0] || {};
      const acc = d.actions || [];
      const convWA = convDe(acc);
      const leadsForm = getAcc(acc, "lead") + getAcc(acc, "offsite_conversion.fb_pixel_lead");
      const resultados = convWA > 0 ? convWA : leadsForm;
      const spend = Number(d.spend || 0);

      // Desglose por anuncio (para recomendar pausar/escalar)
      let anuncios = [];
      try {
        const ads = await metaGet(`${c.id}/insights`, { fields: "ad_name,spend,actions,ctr", level: "ad", date_preset: "maximum", limit: 30 });
        anuncios = (ads.data || []).map(a => {
          const r = convDe(a.actions || []) || (getAcc(a.actions || [], "lead"));
          const s = Number(a.spend || 0);
          return { anuncio: a.ad_name, gasto: +s.toFixed(0), resultados: r, costo: r > 0 ? +(s / r).toFixed(0) : null, ctr: +Number(a.ctr || 0).toFixed(2) };
        }).sort((x, y) => (y.resultados - x.resultados));
      } catch { /* */ }

      resumen.push({
        campaña: c.name, dia_de_campaña: diaCampaña, fase_aprendizaje: resultados < 50 ? "EN APRENDIZAJE (no tocar aún)" : "fuera de aprendizaje",
        moneda, gasto: +spend.toFixed(0),
        frecuencia: +Number(d.frequency || 0).toFixed(2), cpm: +Number(d.cpm || 0).toFixed(0), ctr: +Number(d.ctr || 0).toFixed(2),
        resultados, tipo_resultado: convWA > 0 ? "conversaciones de WhatsApp" : "leads",
        costo_por_resultado: resultados > 0 ? +(spend / resultados).toFixed(0) : null,
        anuncios,
      });
    } catch (e) { resumen.push({ campaña: c.name, error: String(e).slice(0, 120) }); }
  }

  // Memoria: reportes anteriores (tendencia)
  let historial = [];
  try { historial = JSON.parse(readFileSync(LOG, "utf8")); } catch { /* */ }
  const tendencia = historial.slice(-6).map(h => `- Día ${h.dia} (${h.fecha}): ${h.resultados} result. a ${h.moneda} ${h.costo}/u, gasto ${h.gasto}`).join("\n") || "(primer reporte)";

  // 2) Claude analiza como un socio cercano (humano, corto, sin tecnicismos)
  const horaCL = new Date(Date.now() - 4 * 3600000).toISOString().slice(11, 16); // UTC-4 Chile
  const sys = `Eres el socio de marketing de condor.ai (agencia que vende páginas web y videos con IA a restaurantes/negocios de Perú). Le escribes a Joaquín por Telegram para contarle cómo va su campaña de Meta Ads. Hablas como una PERSONA REAL, cercano y simple, como un amigo que sabe de esto — NO como un robot ni un reporte corporativo.

REGLAS DE ESTILO (muy importante):
- Mensaje CORTO (máx ~120 palabras). Nada de textos largos.
- NADA de títulos con "#", ni "ANÁLISIS CRÍTICO", ni secciones rígidas, ni mayúsculas gritando.
- Tono humano y motivador: "Oye Joaco, vamos bien…" / "Ojo con esto…".
- Usa 1-2 emojis máximo, naturales.
- Habla en la moneda que te paso (no inventes USD si es PEN o CLP).
- Lo más importante en campañas de WhatsApp (CTWA) es: cuántas CONVERSACIONES se iniciaron y a qué costo. Esa es la métrica que importa, NO el "CPL" de pixel.

QUÉ DECIR (lenguaje simple, fluido):
- Cómo viene hoy: di el DÍA DE CAMPAÑA, los resultados y el costo por conversación (🟢/🟡/🔴).
- Compara con la tendencia que te paso (¿mejora o empeora vs días anteriores?).
- DECISIONES DE ACCIÓN concretas mirando el desglose por anuncio: qué anuncio PAUSAR (el que gasta y no trae resultados), cuál ESCALAR (el ganador), si conviene SUBIR presupuesto (máx +20-30%, nunca el doble) o ajustar público.

REGLAS DEL ALGORITMO DE META (úsalas para decidir):
- Fase de aprendizaje = primeras ~50 conversiones o primeros ~3-4 días: NO tocar nada, dejar estabilizar.
- Si ya salió de aprendizaje y el costo por conversación es bueno y estable: se puede escalar el anuncio ganador +20-30% cada 3-4 días.
- Si un anuncio gastó bastante y trae 0-1 resultados: PAUSARLO.
- Nunca cambiar varias cosas de golpe ni subir presupuesto >30% (resetea el aprendizaje).
- Frecuencia > 3 = fatiga, hay que refrescar creativo.

Benchmark WhatsApp Perú/Chile: conversación a menos de ~CLP 1000 (~S/5) es EXCELENTE, hasta ~CLP 3000 buena. Lo que de verdad importa es que esas conversaciones se conviertan en clientes (responder rápido). Felicita si va bien, no asustes.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5", max_tokens: 800, system: sys,
      messages: [{ role: "user", content: `Datos de la campaña hoy:\n${JSON.stringify(resumen, null, 2)}\n\nTendencia de días anteriores (tu memoria):\n${tendencia}\n\nEscríbele a Joaquín el mensaje corto y humano por Telegram, con la decisión de qué hacer.` }],
    }),
  });
  if (!resp.ok) { console.error("Claude HTTP", resp.status); return; }
  const data = await resp.json();
  const analisis = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!analisis) { console.error("Claude devolvió vacío"); return; }

  await tg(`📊 *Campaña condor.ai* · ${horaCL} hrs\n\n${analisis}`);

  // Guardar este reporte en la memoria (tendencia)
  try {
    const r0 = resumen.find(r => r.resultados != null) || resumen[0] || {};
    historial.push({ fecha: hoy.toISOString().slice(0, 10), dia: r0.dia_de_campaña || null, resultados: r0.resultados || 0, costo: r0.costo_por_resultado || null, gasto: r0.gasto || 0, moneda: r0.moneda || "" });
    writeFileSync(LOG, JSON.stringify(historial.slice(-60), null, 2) + "\n");
  } catch (e) { console.log("no se pudo guardar memoria:", String(e).slice(0, 80)); }
  console.log("OK análisis enviado");
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("⚠️ *Analizador Meta* falló: " + String(e).slice(0, 250)); } catch {}
  process.exit(1);
});
