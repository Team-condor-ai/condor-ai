// condor.ai · Nicolás — Reportes de ingresos semanales y mensuales
// Semanal (viernes): lee pagos de la semana → Google Sheets (Apps Script) → link a Telegram
// Mensual (día 1): consolida el mes que cerró → análisis Claude → Telegram
//
// Escribe en Google Sheets vía un Apps Script Web App (sin claves de servicio,
// evita la política iam.disableServiceAccountKeyCreation de la organización).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//          NICOLAS_SHEETS_URL, NICOLAS_SHEETS_TOKEN, ANTHROPIC_API_KEY

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Bot propio de Nicolás (distinto al de Barbara). Cae al de siempre si aún no lo creas.
const TG = process.env.NICOLAS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.NICOLAS_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const AK = process.env.ANTHROPIC_API_KEY;
const SHEETS_URL = (process.env.NICOLAS_SHEETS_URL || "").trim();
const SHEETS_TOKEN = (process.env.NICOLAS_SHEETS_TOKEN || "").trim();
const MODO = process.env.NICOLAS_MODO || "semanal"; // "semanal" | "mensual"

if (!SUPABASE_URL || !SERVICE) { console.error("Faltan SUPABASE_URL / SERVICE_ROLE_KEY"); process.exit(1); }
if (!TG || !CHAT) { console.error("Faltan NICOLAS_TELEGRAM_BOT_TOKEN / NICOLAS_TELEGRAM_CHAT_ID"); process.exit(1); }
if (!SHEETS_URL || !SHEETS_TOKEN) { console.error("Faltan NICOLAS_SHEETS_URL / NICOLAS_SHEETS_TOKEN"); process.exit(1); }

// ── Supabase REST ──────────────────────────────────────────────────
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };
const sget = async (path) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error("Supabase: " + await r.text());
  return r.json();
};

// ── Telegram ───────────────────────────────────────────────────────
const tg = (text) => fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
}).then(r => r.json());

// ── Google Sheets vía Apps Script Web App ──────────────────────────
// Envía una matriz de filas; el Apps Script crea/limpia la pestaña y devuelve la URL.
async function escribirReporte(nombreHoja, filas) {
  const r = await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: SHEETS_TOKEN, hoja: nombreHoja, filas }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error("Apps Script: " + (d.error || ("HTTP " + r.status)));
  return d.url || "https://docs.google.com/spreadsheets";
}

// ── Datos de Supabase ──────────────────────────────────────────────
function rangoFechas(dias) {
  const hasta = new Date();
  const desde = new Date(Date.now() - dias * 86400000);
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

// ── Mes calendario anterior (para el F29) ──────────────────────────
// El F29 es por mes calendario, no por ventana rolling de 30 días (que es
// lo que usa el resto de este reporte). Se calcula el mes que ya cerró del
// todo, sea cual sea el día en que este job corra.
function mesCalendarioAnterior() {
  const hoy = new Date();
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const inicioMesAnterior = new Date(finMesAnterior.getFullYear(), finMesAnterior.getMonth(), 1);
  return {
    desde: inicioMesAnterior.toISOString().slice(0, 10),
    hasta: finMesAnterior.toISOString().slice(0, 10),
    etiqueta: inicioMesAnterior.toISOString().slice(0, 7),
  };
}

// IVA chileno: los precios ya incluyen IVA, así que se saca con 19/119.
function calcularIVA(montoBruto) {
  const neto = Math.round(montoBruto / 1.19);
  return { neto, iva: montoBruto - neto };
}

async function obtenerIngresosRatia(desde, hasta) {
  return sget(
    `ingresos_ratia?select=monto_bruto,tipo,plan,creado_en&creado_en=gte.${desde}T00:00:00&creado_en=lte.${hasta}T23:59:59`
  );
}

// ── Sección F29: IVA débito consolidado del RUT de Cóndor.ai ──────
// Rat.IA cobra por Flow a nombre de Cóndor.ai (mismo RUT), así que su IVA
// se suma al de los clientes de la agencia — el F29 es por RUT, no por
// producto. Ver docs/superpowers/specs/2026-08-08-ratia-cobro-onboarding-design.md
// en el repo vigia-precios para el porqué de esa decisión.
async function seccionF29() {
  const { desde, hasta, etiqueta } = mesCalendarioAnterior();

  const pagosCondor = (await obtenerPagos(desde, hasta)).filter(p => p.estado === "pagado");
  // El IVA/F29 se calcula en CLP. Si hay pagos en otra moneda (ej. clientes
  // de Colombia) NO se mezclan acá sin conversión — se excluyen y se
  // avisan, para no ensuciar un número que va directo a una declaración de
  // impuestos. Revisarlos con el contador aparte.
  const pagosCondorCLP = pagosCondor.filter(p => (p.moneda || "CLP") === "CLP");
  const excluidos = pagosCondor.length - pagosCondorCLP.length;

  // Mientras la migración `supabase/migrations/ingresos_ratia.sql` no esté
  // aplicada (o si Flow todavía no cobró nada), esta tabla no existe y
  // Supabase responde con error. No puede tumbar toda la sección: sin esto,
  // un F29 sin Rat.IA se convertiría en un F29 sin NADA, y el mes se pasa
  // sin el número de la agencia tampoco.
  let ingresosRatia = [];
  let ratiaDisponible = true;
  try {
    ingresosRatia = await obtenerIngresosRatia(desde, hasta);
  } catch (e) {
    ratiaDisponible = false;
    console.log("ingresos_ratia no disponible (¿migración sin aplicar?):", String(e).slice(0, 120));
  }

  const brutoCondor = pagosCondorCLP.reduce((s, p) => s + (p.monto || 0), 0);
  const brutoRatia = ingresosRatia.reduce((s, p) => s + (p.monto_bruto || 0), 0);
  const brutoTotal = brutoCondor + brutoRatia;
  const { neto, iva } = calcularIVA(brutoTotal);

  const filas = [
    ["F29 — Cóndor.ai (incluye Rat.IA)", etiqueta],
    [],
    ["Origen", "Bruto (con IVA)"],
    ["Clientes agencia (CLP)", String(brutoCondor)],
    ["Rat.IA (Flow)", ratiaDisponible ? String(brutoRatia) : "sin datos"],
    ["TOTAL BRUTO", String(brutoTotal)],
    [],
    ["Neto (bruto / 1.19)", String(neto)],
    ["IVA débito fiscal (código 538 aprox.)", String(iva)],
  ];
  if (!ratiaDisponible) {
    filas.push([], ["⚠️ No se pudo leer ingresos_ratia — el total NO incluye Rat.IA. Revisar que la migración esté aplicada antes de declarar."]);
  }
  if (excluidos) {
    filas.push([], [`⚠️ ${excluidos} pago(s) en otra moneda excluidos del cálculo — revisar con el contador.`]);
  }
  filas.push([], ["⚠️ Falta el crédito fiscal (compras/gastos del mes) — no está en ninguna base de datos acá, agregarlo a mano o con el contador."]);

  const url = await escribirReporte(`F29 ${etiqueta}`, filas);
  return { etiqueta, brutoCondor, brutoRatia, brutoTotal, neto, iva, excluidos, ratiaDisponible, url };
}

async function obtenerPagos(desde, hasta) {
  const pagos = await sget(
    `pagos?select=monto,estado,tipo,cliente_id,creado_en&creado_en=gte.${desde}T00:00:00&creado_en=lte.${hasta}T23:59:59&order=creado_en.desc`
  );
  const clientes = await sget("clientes?select=id,negocio,plan,moneda&archivado=eq.false");
  const cMap = Object.fromEntries(clientes.map(c => [c.id, c]));
  return pagos.map(p => ({
    ...p,
    negocio: cMap[p.cliente_id]?.negocio || "—",
    plan: cMap[p.cliente_id]?.plan || "—",
    moneda: cMap[p.cliente_id]?.moneda || "CLP",
  }));
}

// ── Informe semanal ────────────────────────────────────────────────
async function reporteSemanal() {
  const { desde, hasta } = rangoFechas(7);
  const pagos = await obtenerPagos(desde, hasta);

  const pagados = pagos.filter(p => p.estado === "pagado");
  const pendientes = pagos.filter(p => p.estado === "pendiente");
  const totalCobrado = pagados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalPend = pendientes.reduce((s, p) => s + (p.monto || 0), 0);

  const headers = ["Cliente", "Plan", "Tipo", "Monto", "Moneda", "Estado", "Fecha"];
  const filas = [
    headers,
    ...pagos.map(p => [
      p.negocio, p.plan, p.tipo || "—",
      String(p.monto || 0), p.moneda,
      p.estado === "pagado" ? "✅ Pagado" : "⏳ Pendiente",
      (p.creado_en || "").slice(0, 10),
    ]),
    [],
    ["RESUMEN"],
    ["Total cobrado", String(totalCobrado)],
    ["Total pendiente", String(totalPend)],
    ["Pagos confirmados", String(pagados.length)],
  ];

  const url = await escribirReporte(`Semana ${desde}`, filas);
  await tg(`📊 *Nicolás · Reporte semanal*\n_${desde} → ${hasta}_\n\n` +
    `✅ Cobrado: *${totalCobrado.toLocaleString()}* (${pagados.length} pagos)\n` +
    `⏳ Pendiente: ${totalPend.toLocaleString()} (${pendientes.length} cobros)\n\n` +
    `[Ver en Google Sheets →](${url})`);
}

// ── Informe mensual con análisis Claude ────────────────────────────
async function reporteMensual() {
  const { desde, hasta } = rangoFechas(30);
  const pagos = await obtenerPagos(desde, hasta);

  const pagados = pagos.filter(p => p.estado === "pagado");
  const pendientes = pagos.filter(p => p.estado === "pendiente");
  const totalCobrado = pagados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalPend = pendientes.reduce((s, p) => s + (p.monto || 0), 0);

  const porCliente = {};
  for (const p of pagados) {
    if (!porCliente[p.negocio]) porCliente[p.negocio] = { total: 0, pagos: 0, moneda: p.moneda };
    porCliente[p.negocio].total += (p.monto || 0);
    porCliente[p.negocio].pagos++;
  }

  const headers = ["Cliente", "Plan", "Tipo", "Monto", "Moneda", "Estado", "Fecha"];
  const filas = [
    headers,
    ...pagos.map(p => [
      p.negocio, p.plan, p.tipo || "—",
      String(p.monto || 0), p.moneda,
      p.estado === "pagado" ? "✅ Pagado" : "⏳ Pendiente",
      (p.creado_en || "").slice(0, 10),
    ]),
    [],
    ["RESUMEN DEL MES"],
    ["Total cobrado", String(totalCobrado)],
    ["Total pendiente", String(totalPend)],
    ["Clientes con cobros", String(new Set(pagos.map(p => p.cliente_id)).size)],
  ];

  const url = await escribirReporte(`Mes ${new Date().toISOString().slice(0, 7)}`, filas);

  // Análisis humanizado con Claude Haiku
  let analisis = "";
  if (AK) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 600,
          system: `Eres Nicolás, el asistente financiero de condor.ai. Le escribes a Joaquín por Telegram con el cierre del mes. Tono cercano y humano, como un contador amigo. Máx 150 palabras. Sin títulos ni secciones. Habla de los números, destaca si el mes fue bueno o regular, menciona clientes morosos si los hay, y da 1 consejo concreto para el próximo mes.`,
          messages: [{
            role: "user",
            content: `Resumen del mes:\n- Total cobrado: ${totalCobrado.toLocaleString()}\n- Total pendiente: ${totalPend.toLocaleString()}\n- Pagos confirmados: ${pagados.length}\n- Cobros pendientes: ${pendientes.length}\n- Clientes activos con cobros: ${Object.keys(porCliente).length}\n\nTop clientes:\n${Object.entries(porCliente).sort((a,b)=>b[1].total-a[1].total).slice(0,5).map(([n,d])=>`  ${n}: ${d.moneda} ${d.total.toLocaleString()}`).join("\n")}\n\nEscribe el cierre de mes para Joaquín.`,
          }],
        }),
      });
      const d = await r.json();
      analisis = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    } catch (e) { console.log("Claude análisis falló:", String(e).slice(0, 80)); }
  }

  // F29 del mes calendario que ya cerró (independiente de la ventana
  // rolling de arriba, que es para el tablero de negocio, no para el SII).
  let f29Msg = "";
  try {
    const f29 = await seccionF29();
    f29Msg = `\n\n🧾 *Para el F29 de ${f29.etiqueta}*\n` +
      `Bruto (agencia + Rat.IA): *${f29.brutoTotal.toLocaleString()}*\n` +
      `Neto: ${f29.neto.toLocaleString()} · IVA débito: *${f29.iva.toLocaleString()}*\n` +
      (f29.ratiaDisponible ? "" : "⚠️ Sin datos de Rat.IA — el total no la incluye.\n") +
      (f29.excluidos ? `⚠️ ${f29.excluidos} pago(s) en otra moneda no incluidos — revisar aparte.\n` : "") +
      `⚠️ Falta sumar el crédito fiscal (compras/gastos del mes).\n` +
      `[Ver detalle →](${f29.url})`;
  } catch (e) {
    console.log("Sección F29 falló:", String(e).slice(0, 120));
  }

  const msg = `📊 *Nicolás · Cierre del mes ${new Date().toISOString().slice(0, 7)}*\n\n` +
    (analisis ? analisis + "\n\n" : "") +
    `💰 Total cobrado: *${totalCobrado.toLocaleString()}*\n` +
    `⏳ Pendiente: ${totalPend.toLocaleString()}\n\n` +
    `[Ver reporte completo →](${url})` +
    f29Msg;
  await tg(msg);
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("Nicolás | modo:", MODO);
  if (MODO === "mensual") {
    await reporteMensual();
  } else {
    await reporteSemanal();
  }
  console.log("OK");
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("⚠️ *Nicolás* falló: " + String(e).slice(0, 250)); } catch {}
  process.exit(1);
});
