// condor.ai · Cobros diarios (recordatorios mensuales + alertas de impago)
// Corre 1 vez al día (GitHub Actions). Usa service role (ignora RLS).
//
// Qué hace cada día, solo para clientes ACTIVOS (no archivados/borrados):
//  1. Recordatorio mensual: por cada COBRO mensual cuyo día de cobro es hoy, le
//     manda un correo recordándole pagarlo en el portal. Un cliente puede tener
//     varios, cada uno con su fecha y su monto.
//  2. Alerta de impago: si pasaron > 2 días desde que le llegó el cobro y no pagó
//     (mensualidad vencida > 2 días, o un cobro manual pendiente > 2 días), marca al
//     cliente como "irresponsable" con los días sin pagar y avisa por correo al ADMIN
//     que lo creó. (Solo alerta; no reenvía al cliente.)
//
// Secrets requeridos en el repo: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "condor.ai <onboarding@resend.dev>";
const PORTAL = "https://condorai.cl/portal.html";
const UMBRAL = 2; // días de gracia antes de marcar irresponsable

if (!SUPABASE_URL || !SERVICE) { console.error("Faltan SUPABASE_URL / SERVICE_ROLE_KEY"); process.exit(1); }

const hoy = new Date();
const hoyISO = hoy.toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.floor((a - b) / 86400000);

// REST helpers (sin SDK, para que el Action no instale nada)
const H = { "apikey": SERVICE, "Authorization": "Bearer " + SERVICE, "Content-Type": "application/json" };
const sget = async (path) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };
const spatch = (path, body) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });

async function enviar(to, subject, html) {
  if (!RESEND || !to) return false;
  try { const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" }, body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }) }); return r.ok; }
  catch { return false; }
}
const wrap = (titulo, cuerpo) => `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px -18px rgba(20,20,40,.25)">
      <tr><td style="background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e);padding:30px;text-align:center;color:#fff;font-size:21px;font-weight:700">condor.ai</td></tr>
      <tr><td style="padding:32px">${cuerpo}</td></tr>
      <tr><td style="background:#fafafa;padding:16px;text-align:center;font-size:12px;color:#999">${titulo}</td></tr>
    </table></td></tr></table></body></html>`;

const correoRecordatorio = (c, cobro) => wrap("condor.ai · recordatorio de pago", `
  <p style="font-size:16px;color:#1a1a1a;margin:0 0 14px">Hola${c.negocio ? " " + c.negocio : ""} 👋</p>
  <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 22px">Hoy corresponde el pago de <b>${cobro.titulo || "tu mensualidad"}</b> de condor.ai (${cobro.moneda || c.moneda || "CLP"} ${Number(cobro.monto || 0).toLocaleString()}). Puedes pagarla de forma segura en tu portal con un clic:</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 22px"><tr><td style="border-radius:999px;background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e)">
    <a href="${PORTAL}" style="display:inline-block;padding:14px 32px;color:#fff;font-weight:700;text-decoration:none;border-radius:999px">Pagar en mi portal →</a></td></tr></table>
  <p style="font-size:13px;color:#888;text-align:center">🔒 Pago seguro con Mercado Pago. ¿Dudas? WhatsApp +56 9 8898 9824.</p>`);

const correoAdmin = (c, dias) => wrap("condor.ai · alerta de impago", `
  <p style="font-size:16px;color:#c0263a;margin:0 0 14px;font-weight:700">⚠️ Un cliente no ha pagado</p>
  <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 10px">El cliente que creaste no ha pagado tras recibir el cobro:</p>
  <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 18px"><b>${c.negocio || c.email}</b><br>Correo: ${c.email}<br>Días sin pagar: <b>${dias}</b></p>
  <p style="font-size:14px;color:#444">Ya quedó marcado como <b>irresponsable</b> en el panel. Puedes escribirle o gestionar el cobro manualmente.</p>
  <table cellpadding="0" cellspacing="0" style="margin:18px auto 0"><tr><td style="border-radius:999px;background:#2747ff">
    <a href="https://condorai.cl/acceso/clientes" style="display:inline-block;padding:12px 28px;color:#fff;font-weight:700;text-decoration:none;border-radius:999px">Abrir el panel →</a></td></tr></table>`);

// ---- Proceso ----
//
// RECORRE COBROS, NO CLIENTES (21-ago-2026)
// ---------------------------------------------------------------------------
// Antes la mensualidad era una columna del cliente, así que bastaba mirar
// `clientes.proximo_cobro`. Ahora un cliente puede tener varios cobros
// mensuales, cada uno con su fecha y su monto: si se siguiera mirando la
// ficha, solo se cobraría uno de ellos y los demás no avisarían nunca.
//
// La mora se calcula POR COBRO y después se agrega al cliente, porque
// "irresponsable" es una etiqueta de la persona, no de la factura.
const clientes = await sget("clientes?archivado=eq.false&select=*");
const cobros = await sget("cobros?select=*");
const pagosPend = await sget("pagos?estado=eq.pendiente&select=cliente_id,cobro_enviado_en,tipo");
let recordatorios = 0, alertas = 0, reseteos = 0;

for (const c of clientes) {
  let diasMora = 0;

  // A) Cobros mensuales vencidos
  //
  // Se miran los que están cobrando o esperando autorización. Un cobro
  // 'pausada' o 'cancelada' no debe generar mora: se pausó a propósito.
  const mensuales = cobros.filter(
    (x) => x.cliente_id === c.id && x.tipo === "mensual" &&
           (x.estado === "activa" || x.estado === "pendiente") && x.proximo_cobro,
  );

  for (const m of mensuales) {
    const venc = new Date(m.proximo_cobro + "T00:00:00Z");
    const d = diasEntre(hoy, venc);
    if (d > UMBRAL) diasMora = Math.max(diasMora, d);

    // Recordatorio el día exacto del cobro, marcado en el COBRO y no en el
    // cliente: si no, el primero que avisa deja a los otros sin recordatorio.
    //
    // NO se le recuerda a quien tiene suscripción automática (`mp_preapproval_id`):
    // Mercado Pago le cobra solo. Mandarle "paga en tu portal" lo empujaría a
    // pagar dos veces el mismo mes.
    if (!m.mp_preapproval_id && m.proximo_cobro === hoyISO && m.ultimo_recordatorio_en !== hoyISO) {
      if (await enviar(c.email, "Recordatorio: tu mensualidad de condor.ai", correoRecordatorio(c, m))) {
        await spatch(`cobros?id=eq.${m.id}`, { ultimo_recordatorio_en: hoyISO });
        recordatorios++;
      }
    }
  }

  // B) Cobro manual (setup u otro) pendiente > umbral
  for (const p of pagosPend.filter(p => p.cliente_id === c.id && p.cobro_enviado_en)) {
    const d = diasEntre(hoy, new Date(p.cobro_enviado_en));
    if (d > UMBRAL) diasMora = Math.max(diasMora, d);
  }

  if (diasMora > 0) {
    // Marcar irresponsable + avisar al admin creador (una sola vez)
    const yaAvisado = !!c.alerta_admin_en;
    await spatch(`clientes?id=eq.${c.id}`, { irresponsable: true, dias_sin_pagar: diasMora, alerta_admin_en: c.alerta_admin_en || hoyISO });
    if (!yaAvisado && c.creado_por) { if (await enviar(c.creado_por, `⚠️ ${c.negocio || c.email} no ha pagado`, correoAdmin(c, diasMora))) alertas++; }
  } else if (c.irresponsable) {
    // Se puso al día: limpiar alerta
    await spatch(`clientes?id=eq.${c.id}`, { irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null });
    reseteos++;
  }
}

console.log(`OK cobros: ${recordatorios} recordatorios, ${alertas} alertas a admin, ${reseteos} reseteos. ${clientes.length} clientes activos, ${cobros.length} cobros.`);
