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
  const camps = await metaGet(`${AD_ACCOUNT}/campaigns`, { fields: "name,status,effective_status,objective,created_time,start_time", limit: 25 });

  // Se filtra por `effective_status`, no por `status`. `status` es solo lo que
  // dice la campaña de sí misma: puede decir ACTIVE con todos sus conjuntos y
  // anuncios pausados, o con la cuenta frenada por saldo, y Barbara seguiría
  // analizando algo que no entrega nada. `effective_status` es lo que Meta
  // considera de verdad, mirando también los niveles de abajo.
  //
  // Esto es lo que hace que al pausar una campaña, Barbara deje de analizarla
  // sola en la corrida siguiente. No hay lista que mantener a mano.
  const activas = (camps.data || []).filter(c => c.effective_status === "ACTIVE");

  const dormidas = (camps.data || []).filter(c => c.effective_status !== "ACTIVE");
  if (dormidas.length) {
    console.log(`Fuera del análisis (${dormidas.length}): ` +
      dormidas.map(c => `${c.name} [${c.effective_status}]`).join(" · "));
  }

  if (!activas.length) {
    console.log("Sin campañas activas — no se envía nada"); return;
  }
  console.log(`Analizando ${activas.length}: ` + activas.map(c => c.name).join(" · "));

  const getAcc = (acc, t) => Number((acc.find(a => a.action_type === t) || {}).value || 0);
  const convDe = (acc) => getAcc(acc, "onsite_conversion.messaging_conversation_started_7d") + getAcc(acc, "onsite_conversion.total_messaging_connection");
  const moneda = cuenta.currency || "?";
  const hoy = new Date();

  // Memoria: reportes anteriores, cargada ANTES del loop porque cada
  // campaña necesita filtrar su propia tendencia (ver más abajo).
  //
  // BUG corregido 10-ago-2026: el historial guardaba UNA sola entrada al día,
  // sin decir de qué campaña era. Con más de una campaña activa a la vez (o
  // una campaña vieja que quedó ACTIVE por error), las entradas se pisaban
  // entre sí y la "tendencia" mezclaba días de campañas distintas — se veía
  // saltar de "día 4" a "día 2" a "día 1" de una corrida a la siguiente, y
  // hasta arrastraba una entrada de una campaña de junio ya pausada. Ahora
  // cada entrada lleva `campana` y la tendencia se filtra a SOLO la campaña
  // que se está analizando en cada iteración.
  let historial = [];
  try { historial = JSON.parse(readFileSync(LOG, "utf8")); } catch { /* */ }

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

      // Tendencia SOLO de esta campaña: filtra el historial por nombre antes
      // de armar la comparación, para no mezclar el "día 4" de esta campaña
      // con el "día 2" de otra que también estuvo activa ese mismo día.
      const propia = historial.filter(h => h.campana === c.name).slice(-6);
      const tendencia_propia = propia.map(h => `- Día ${h.dia} (${h.fecha}): ${h.resultados} result. a ${h.moneda} ${h.costo}/u, gasto ${h.gasto}`).join("\n") || "(primer reporte de esta campaña)";

      resumen.push({
        campaña: c.name, dia_de_campaña: diaCampaña, fase_aprendizaje: resultados < 50 ? "EN APRENDIZAJE (no tocar aún)" : "fuera de aprendizaje",
        moneda, gasto: +spend.toFixed(0),
        frecuencia: +Number(d.frequency || 0).toFixed(2), cpm: +Number(d.cpm || 0).toFixed(0), ctr: +Number(d.ctr || 0).toFixed(2),
        resultados, tipo_resultado: convWA > 0 ? "conversaciones de WhatsApp" : "leads",
        costo_por_resultado: resultados > 0 ? +(spend / resultados).toFixed(0) : null,
        anuncios, tendencia_propia,
      });
    } catch (e) { resumen.push({ campaña: c.name, error: String(e).slice(0, 120) }); }
  }

  // 2) Claude analiza como un socio cercano (humano, corto, sin tecnicismos)
  const horaCL = new Date(Date.now() - 4 * 3600000).toISOString().slice(11, 16); // UTC-4 Chile
  // NO se hardcodea a "una campaña de WhatsApp a Colombia": puede haber más
  // de una campaña activa a la vez, con objetivos distintos (leads a una
  // landing, CTWA a WhatsApp, etc.) — cada objeto en `resumen` ya trae su
  // propio `tipo_resultado` y `tendencia_propia`, así que el prompt describe
  // el negocio en general y deja que los datos digan de qué es cada campaña.
  // Corregido 10-ago-2026: el texto fijo asumía SIEMPRE la campaña CTWA de
  // Colombia, y por eso el análisis quedaba mal cuando la campaña activa era
  // en realidad la de leads a la landing (u otra distinta).
  const sys = `Eres el socio de marketing de condor.ai, agencia chilena que vende PÁGINAS WEB a dueños de negocio, y a veces capta leads vía WhatsApp (Click-to-WhatsApp) en otras campañas. Le escribes a Joaquín por Telegram para contarle cómo va CADA campaña activa que te paso (mira "campaña" y "tipo_resultado" de cada una: dice si es leads a una landing o conversaciones de WhatsApp). Si hay más de una activa, sepáralas claramente en el mensaje — NUNCA mezcles sus números ni su tendencia. Hablas como una PERSONA REAL, cercano y simple, como un amigo que sabe de esto — NO como un robot ni un reporte corporativo.

EL TIEMPO DE CAMPAÑA MANDA — LÉELO ANTES DE OPINAR:
En los datos te llega "diaCampaña", que cuenta desde el PRIMER DÍA CON GASTO REAL (no desde que se creó). Tu diagnóstico depende completamente de ese número, así que dilo siempre y ajústate a él:
- Días 1-3: es fase de aprendizaje. NO recomiendes pausar ni escalar nada, salvo que un anuncio haya gastado mucho con CERO resultados. Lo correcto es "aún es temprano, dejémoslo estabilizar".
- Días 4-7: ya se puede leer tendencia. Acá sí: pausar los que no rinden, identificar al ganador.
- Día 8+: escalar al ganador si el costo por conversación es estable.
NUNCA saques conclusiones de día 6 en una campaña de día 2. Si son pocos días, dilo con honestidad en vez de inventar una lectura.

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

REGLAS DEL ALGORITMO DE META — ACTUALIZADAS A 2026 (post-Andromeda):

FASE DE APRENDIZAJE
- Umbral real: 50 conversiones por ad set en ventana móvil de 7 días. Advantage+ NO lo elimina.
- OJO, esto importa acá: con presupuesto chico (~USD 10/día) en CTWA, la campaña probablemente NUNCA salga formalmente del aprendizaje. Eso NO es una falla — no lo reportes como problema. Juzga por TENDENCIA del costo por conversación, no por el estado "Learning".
- Días 1-4: no tocar NADA. Ni presupuesto, ni creativos, ni público.
- Resetean el aprendizaje: subir presupuesto >20%, creativo nuevo, cambiar el evento de optimización, cambio grande de público. NO resetean: renombrar, ajustes menores de horario.

ESCALADO
- +20% cada 3-4 días. NUNCA duplicar de golpe.
- Solo escalar si el costo por conversación estuvo estable 3+ días SEGUIDOS. Un buen día suelto no es señal.
- Primero vertical (subir el presupuesto del ganador), después horizontal (duplicar el ad set a otro público).

FATIGA — los umbrales viejos cambiaron, usa estos:
- Frecuencia semanal >2,5 (ANTES era 3): preparar creativo nuevo. >4,0: refrescar YA.
- CTR cayendo 20-25% sostenido 3+ días: es la señal MÁS TEMPRANA, se adelanta 3-5 días a la frecuencia.
- CPM subiendo 15-20% sin cambios de público: Meta avisa que la relevancia bajó.
- La vida útil del creativo se desplomó con Andromeda: un concepto que antes duraba 6 semanas ahora se quema en 2-3. Curva típica de 10 días (peak días 1-3, alerta 4-7, caída fuerte 8-10).

PRESUPUESTO CHICO (este caso)
- UN SOLO ad set con público AMPLIO. Repartir entre varios los mata de hambre a todos.
- Público amplio (2-10 millones), geografía + intereses mínimos. Segmentar angosto RESTRINGE el aprendizaje y empeora resultados — es un error clásico.
- 4 anuncios bien diferenciados es el equilibrio. Y tienen que ser conceptos DISTINTOS (video-persona, video-producto, imagen, testimonio), no variaciones cosméticas: Andromeda las trata como idénticas ("diversidad falsa").

ESPECÍFICO CTWA
- La métrica que manda: CONVERSACIONES INICIADAS y su costo. NUNCA el CPL de pixel — el pixel no ve lo que pasa dentro de WhatsApp.
- Si llegan muchas conversaciones basura, la recomendación es cambiar el objetivo "Mensajes" (optimiza VOLUMEN) por "Leads con destino WhatsApp" (optimiza CALIDAD).
- Hay ventana gratis de 72 h tras el clic. Responder rápido importa muchísimo: el ideal es bajo 10 segundos.

BENCHMARKS COLOMBIA (esta campaña)
- Colombia tiene de los CPM más baratos de LATAM (~USD 2,00).
- Costo por lead de servicios digitales/web: USD 10-20 es NORMAL. No te asustes ni asustes a Joaquín si está en ese rango.

ERRORES QUE MATAN CAMPAÑAS CHICAS (avisa si los ves):
tocar antes del día 4 · subir presupuesto >20% de golpe · muchos ad sets con poco presupuesto · segmentación angosta · variaciones cosméticas en vez de conceptos distintos · juzgar por clics en vez de conversaciones · no responder rápido en WhatsApp.

Felicita si va bien, no asustes.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5", max_tokens: 800, system: sys,
      messages: [{ role: "user", content: `Campañas activas hoy (cada una trae su propia "tendencia_propia" — es SU historial, no lo mezcles con el de otra):\n${JSON.stringify(resumen, null, 2)}\n\nEscríbele a Joaquín el mensaje corto y humano por Telegram, con la decisión de qué hacer en cada campaña.` }],
    }),
  });
  if (!resp.ok) { console.error("Claude HTTP", resp.status); return; }
  const data = await resp.json();
  const analisis = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!analisis) { console.error("Claude devolvió vacío"); return; }

  await tg(`📊 *Campaña condor.ai* · ${horaCL} hrs\n\n${analisis}`);

  // Guardar UNA entrada POR CAMPAÑA (no solo la primera con resultados): así
  // la tendencia de cada una se puede filtrar después por `campana` sin
  // pisar la de las demás. `slice(-60)` ahora es por campaña en la práctica,
  // porque el filtro de arriba (`h.campana === c.name`) ya descarta el resto.
  try {
    for (const r of resumen) {
      if (r.error) continue;
      historial.push({
        campana: r.campaña, fecha: hoy.toISOString().slice(0, 10), dia: r.dia_de_campaña || null,
        resultados: r.resultados || 0, costo: r.costo_por_resultado || null, gasto: r.gasto || 0, moneda: r.moneda || "",
      });
    }
    writeFileSync(LOG, JSON.stringify(historial.slice(-200), null, 2) + "\n");
  } catch (e) { console.log("no se pudo guardar memoria:", String(e).slice(0, 80)); }
  console.log("OK análisis enviado");
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("⚠️ *Analizador Meta* falló: " + String(e).slice(0, 250)); } catch {}
  process.exit(1);
});
