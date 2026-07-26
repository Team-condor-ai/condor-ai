// condor.ai · Seguimiento de leads y reuniones (campaña Colombia)
// Corre cada 15 min (GitHub Actions). Usa service role (ignora RLS). Sin dependencias.
//
// Qué hace en cada pasada:
//  1. Despacha la cola 'mensajes_programados': manda por Resend (email) y WhatsApp Cloud API
//     todo lo pendiente que ya venció (confirmación, recordatorio 24 h, recordatorio 1 h,
//     bienvenida del lead que pidió contacto, recuperación de no-show).
//  2. Reuniones que ya pasaron y nadie marcó asistencia (> 2 h) → avisa al equipo por correo
//     para que marquen 'asistió' en el portal.
//  3. Reuniones marcadas como NO asistió → encola la secuencia de recuperación (ahora + 3 días).
//
// La cola la llenan solos los triggers de campana_colombia.sql: nadie tiene que llamar a nada.
//
// Secrets del repo: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM,
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, ADMIN_NOTIFY (opcional),
//   WA_TPL_* (nombres de las plantillas aprobadas en Meta; ver docs/campana-colombia/ALEJANDRO-ENTREGA.md)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "condor.ai <onboarding@resend.dev>";
const ADMIN_NOTIFY = process.env.ADMIN_NOTIFY || "contacto@teamcondorcl.com";
const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE = process.env.WHATSAPP_PHONE_ID;
const WA_LANG = process.env.WA_TPL_LANG || "es";
const WEB = "https://condorai.cl";
const WA_EQUIPO = "56988989824";                 // número público de condor.ai
const MAX_INTENTOS = 5;
const LOTE = 200;

if (!SUPABASE_URL || !SERVICE) { console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

// ── REST helpers (sin SDK, para que el Action no instale nada) ──
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const sget = async (path) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };
const spatch = (path, body) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
// Encolar siempre por RPC: la función SQL ya resuelve duplicados y mensajes vencidos.
const encolar = (p) => fetch(`${SUPABASE_URL}/rest/v1/rpc/encolar_mensaje`, { method: "POST", headers: H, body: JSON.stringify(p) });

const ahora = new Date();
const iso = (d) => new Date(d).toISOString();

// Zona horaria del destinatario: la de la reunión, o deducida del prefijo del teléfono.
function zonaDe(datos, destino) {
  if (datos?.zona) return datos.zona;
  const num = String(destino || "").replace(/\D/g, "");
  if (num.startsWith("57")) return "America/Bogota";
  if (num.startsWith("51")) return "America/Lima";
  return "America/Santiago";
}
const fmtFecha = (fecha, zona) =>
  new Date(fecha).toLocaleString("es-CO", { timeZone: zona, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: true });
const fmtHora = (fecha, zona) =>
  new Date(fecha).toLocaleString("es-CO", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: true });

// Enlace "añadir a Google Calendar" (mismo formato que reunion-notificar)
function gcalLink(titulo, ini, durMin) {
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const fin = new Date(new Date(ini).getTime() + (durMin || 30) * 60000);
  const p = new URLSearchParams({ action: "TEMPLATE", text: titulo || "Reunión con condor.ai", dates: `${f(ini)}/${f(fin)}`, details: "Videollamada con el equipo de condor.ai" });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// ── Envío: email (Resend) ──
const wrap = (pie, cuerpo, idBaja) => `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px -18px rgba(20,20,40,.25)">
      <tr><td style="background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e);padding:30px;text-align:center;color:#fff;font-size:21px;font-weight:700">condor.ai</td></tr>
      <tr><td style="padding:32px">${cuerpo}</td></tr>
      <tr><td style="background:#fafafa;padding:16px;text-align:center;font-size:12px;color:#999">${pie}${
        idBaja ? `<br><a href="${SUPABASE_URL}/functions/v1/seguimiento-baja?lead=${idBaja}" style="color:#999">No quiero más correos</a>` : ""
      }</td></tr>
    </table></td></tr></table></body></html>`;

const boton = (href, texto) => `<table cellpadding="0" cellspacing="0" style="margin:0 auto 20px"><tr><td style="border-radius:999px;background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e)">
  <a href="${href}" style="display:inline-block;padding:14px 32px;color:#fff;font-weight:700;text-decoration:none;border-radius:999px">${texto}</a></td></tr></table>`;

async function enviarEmail(to, subject, html) {
  if (!RESEND) return { ok: false, error: "RESEND_API_KEY no configurada" };
  if (!to || !to.includes("@")) return { ok: false, error: "destino de correo inválido" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 160)}` };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

// ── Envío: WhatsApp (Cloud API) ──
// Fuera de la ventana de 24 h Meta SOLO deja mandar plantillas aprobadas. Por eso cada
// mensaje usa su plantilla (WA_TPL_*) con parámetros posicionales {{1}}, {{2}}...
// Si no hay plantilla configurada, se intenta texto libre (sirve solo si el lead escribió hace poco).
const WA_TPL = {
  bienvenida: process.env.WA_TPL_BIENVENIDA,
  confirmacion: process.env.WA_TPL_CONFIRMACION,
  recordatorio_24h: process.env.WA_TPL_RECORDATORIO_24H,
  recordatorio_1h: process.env.WA_TPL_RECORDATORIO_1H,
  noshow_1: process.env.WA_TPL_NOSHOW,
  noshow_2: process.env.WA_TPL_NOSHOW,
};

async function enviarWhatsApp(to, plantilla, params, textoLibre) {
  if (!WA_TOKEN || !WA_PHONE) return { ok: false, error: "WhatsApp Cloud API no configurada" };
  const num = String(to || "").replace(/\D/g, "");
  if (num.length < 8) return { ok: false, error: "número inválido" };

  const tpl = WA_TPL[plantilla];
  const body = tpl
    ? { messaging_product: "whatsapp", to: num, type: "template",
        template: { name: tpl, language: { code: WA_LANG }, components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t).slice(0, 900) })) }] } }
    : { messaging_product: "whatsapp", to: num, type: "text", text: { body: textoLibre.slice(0, 4000) } };

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE}/messages`, {
      method: "POST", headers: { Authorization: "Bearer " + WA_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok ? { ok: true } : { ok: false, error: `WhatsApp ${r.status}: ${(await r.text()).slice(0, 160)}` };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

// ── Contenido de cada plantilla ──
// Devuelve { asunto, html } para email y { params, texto } para WhatsApp.
function contenido(m) {
  const d = m.datos || {};
  const nombre = (d.nombre || "").split(" ")[0] || "Hola";
  const zona = zonaDe(d, m.destino);
  const cuando = d.fecha_hora ? fmtFecha(d.fecha_hora, zona) : "";
  const hora = d.fecha_hora ? fmtHora(d.fecha_hora, zona) : "";
  const gcal = d.fecha_hora ? gcalLink(d.titulo, d.fecha_hora, d.duracion_min) : WEB;
  const wa = `https://wa.me/${WA_EQUIPO}`;

  switch (m.plantilla) {
    case "bienvenida":
      return {
        asunto: "Recibimos tu solicitud · condor.ai",
        html: wrap("condor.ai · páginas web e IA para negocios", `
          <p style="font-size:16px;margin:0 0 14px">Hola ${nombre} 👋</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px">Recibimos tu solicitud y <b>te contactamos en menos de 24 horas</b>. Si prefieres avanzar ahora mismo, escríbenos por WhatsApp y lo vemos al tiro.</p>
          ${boton(wa, "Hablar por WhatsApp →")}`, m.lead_id),
        params: [nombre],
        texto: `Hola ${nombre} 👋 Somos condor.ai. Recibimos tu solicitud y te contactamos en menos de 24 h. Si quieres avanzar ahora, respóndenos por acá.`,
      };

    case "confirmacion":
      return {
        asunto: `Tu reunión con condor.ai: ${cuando}`,
        html: wrap("condor.ai · reunión agendada", `
          <p style="font-size:16px;margin:0 0 14px">¡Listo ${nombre}! Tu reunión quedó agendada 🎉</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 20px">🗓️ <b>${cuando}</b><br>⏱️ ${d.duracion_min || 30} minutos · videollamada</p>
          ${boton(gcal, "📅 Añadir a mi calendario")}
          <p style="font-size:14px;color:#666;line-height:1.6">Te enviaremos un recordatorio 24 h y 1 h antes. Si no puedes, avísanos por <a href="${wa}" style="color:#2747ff">WhatsApp</a> y la movemos.</p>`, m.lead_id),
        params: [nombre, cuando],
        texto: `¡Listo ${nombre}! 🎉 Tu reunión con condor.ai quedó agendada para el ${cuando}. Te recordamos 24 h y 1 h antes. Si necesitas moverla, respóndenos por acá.`,
      };

    case "recordatorio_24h":
      return {
        asunto: `Mañana: tu reunión con condor.ai (${hora})`,
        html: wrap("condor.ai · recordatorio", `
          <p style="font-size:16px;margin:0 0 14px">Hola ${nombre} 👋</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 18px">Te recordamos tu reunión con nosotros:</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 20px">🗓️ <b>${cuando}</b><br>⏱️ ${d.duracion_min || 30} minutos</p>
          ${boton(gcal, "📅 Ver en mi calendario")}
          <p style="font-size:14px;color:#666">¿Se te complicó la hora? Responde este correo o escríbenos por <a href="${wa}" style="color:#2747ff">WhatsApp</a> y la reagendamos sin problema.</p>`, m.lead_id),
        params: [nombre, cuando],
        texto: `Hola ${nombre} 👋 Te recordamos tu reunión con condor.ai: ${cuando}. Si necesitas moverla, respóndenos por acá.`,
      };

    case "recordatorio_1h":
      return {
        asunto: `En 1 hora: tu reunión con condor.ai`,
        html: wrap("condor.ai · recordatorio", `
          <p style="font-size:16px;margin:0 0 14px">${nombre}, nos vemos en 1 hora ⏰</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 20px">🗓️ Hoy a las <b>${hora}</b> · ${d.duracion_min || 30} minutos</p>
          ${boton(wa, "Avisar por WhatsApp")}
          <p style="font-size:14px;color:#666">Te llamamos al número que nos dejaste. Si algo cambió, escríbenos y lo resolvemos.</p>`, m.lead_id),
        params: [nombre, hora],
        texto: `${nombre}, nos vemos en 1 hora ⏰ (${hora}). Te contactamos por acá. Si algo cambió, avísanos.`,
      };

    case "noshow_1":
      return {
        asunto: "¿Reagendamos? · condor.ai",
        html: wrap("condor.ai · reagendar", `
          <p style="font-size:16px;margin:0 0 14px">Hola ${nombre} 👋</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px">No logramos conectarnos en el horario que habíamos agendado. Sin problema, pasa. ¿Buscamos otro momento esta semana?</p>
          ${boton(`${WEB}/agendar/`, "Elegir nuevo horario →")}
          <p style="font-size:14px;color:#666">También puedes responder este correo con el día y la hora que te acomode.</p>`, m.lead_id),
        params: [nombre],
        texto: `Hola ${nombre} 👋 No logramos conectarnos en la hora agendada. ¿Buscamos otro momento esta semana? Puedes elegir horario acá: ${WEB}/agendar/`,
      };

    case "noshow_2":
      return {
        asunto: "Última: ¿te sirve otra semana?",
        html: wrap("condor.ai · reagendar", `
          <p style="font-size:16px;margin:0 0 14px">Hola ${nombre} 👋</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px">No quiero llenarte el correo 🙏. Si todavía te interesa tener tu página web andando, aquí estamos: la reunión son 30 minutos y sales con una propuesta concreta.</p>
          ${boton(`${WEB}/agendar/`, "Agendar cuando pueda →")}`, m.lead_id),
        params: [nombre],
        texto: `Hola ${nombre}, sin apuro 🙏 Si aún te interesa tu página web, la reunión son 30 min y sales con una propuesta concreta: ${WEB}/agendar/`,
      };

    case "staff_asistencia":
      return {
        asunto: `¿Asistió? · ${d.titulo || "Reunión"} (${cuando})`,
        html: wrap("condor.ai · portal del equipo", `
          <p style="font-size:16px;margin:0 0 14px">Reunión terminada — falta marcar asistencia</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 18px"><b>${d.titulo || "Reunión"}</b><br>🗓️ ${cuando}${d.contacto ? `<br>👤 ${d.contacto}` : ""}</p>
          <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 18px">Márcala en el portal: si el cliente <b>no asistió</b>, se dispara sola la secuencia de recuperación (correo + WhatsApp hoy y en 3 días).</p>
          ${boton(`${WEB}/portal.html`, "Marcar en el portal →")}`),
        params: [d.titulo || "Reunión", cuando],
        texto: `Falta marcar asistencia de la reunión "${d.titulo || ""}" (${cuando}) en el portal.`,
      };

    default:
      return null;
  }
}

// ── 1) Despachar la cola ──
async function despachar() {
  const pendientes = await sget(
    `mensajes_programados?estado=eq.pendiente&programado_para=lte.${iso(ahora)}&order=programado_para.asc&limit=${LOTE}`,
  );
  let enviados = 0, fallidos = 0;

  for (const m of pendientes) {
    const c = contenido(m);
    if (!c) {
      await spatch(`mensajes_programados?id=eq.${m.id}`, { estado: "error", ultimo_error: `plantilla desconocida: ${m.plantilla}` });
      fallidos++;
      continue;
    }

    const r = m.canal === "email"
      ? await enviarEmail(m.destino, c.asunto, c.html)
      : await enviarWhatsApp(m.destino, m.plantilla, c.params, c.texto);

    if (r.ok) {
      await spatch(`mensajes_programados?id=eq.${m.id}`, { estado: "enviado", enviado_en: iso(new Date()), intentos: (m.intentos || 0) + 1 });
      enviados++;
    } else {
      const intentos = (m.intentos || 0) + 1;
      await spatch(`mensajes_programados?id=eq.${m.id}`, {
        estado: intentos >= MAX_INTENTOS ? "error" : "pendiente",   // sigue pendiente: se reintenta en la próxima pasada
        intentos, ultimo_error: r.error,
      });
      fallidos++;
    }
  }
  return { enviados, fallidos, cola: pendientes.length };
}

// ── 2) Reuniones sin asistencia marcada → pedirle al equipo que la marque ──
async function pedirMarcarAsistencia() {
  const limite = iso(new Date(ahora.getTime() - 2 * 3600 * 1000));   // terminaron hace más de 2 h
  const desde = iso(new Date(ahora.getTime() - 7 * 86400 * 1000));   // no revisar historia antigua
  const reuniones = await sget(
    `reuniones?asistio=is.null&fecha_hora=lt.${limite}&fecha_hora=gt.${desde}&select=id,titulo,fecha_hora,contacto,lead_id,zona,origen`,
  );
  // Solo las de cliente externo: agendadas desde la web/campaña/bot. Las internas del equipo no se marcan.
  const externas = reuniones.filter((r) => ["web", "campana", "bot"].includes(r.origen) || (!r.origen && r.contacto));
  for (const r of externas) {
    // encolar_mensaje es idempotente: si ya se avisó por esta reunión, no hace nada.
    await encolar({
      p_lead_id: r.lead_id, p_reunion_id: r.id, p_canal: "email", p_plantilla: "staff_asistencia",
      p_destino: ADMIN_NOTIFY, p_cuando: iso(ahora),
      p_datos: { titulo: r.titulo, fecha_hora: r.fecha_hora, contacto: r.contacto, zona: r.zona },
    });
  }
  return externas.length;
}

// ── 3) No-shows confirmados → secuencia de recuperación ──
async function recuperarNoShows() {
  const desde = iso(new Date(ahora.getTime() - 30 * 86400 * 1000));
  const reuniones = await sget(
    `reuniones?asistio=is.false&fecha_hora=gt.${desde}&select=id,titulo,fecha_hora,contacto,email,whatsapp,cliente,lead_id,zona`,
  );
  for (const r of reuniones) {
    const partes = String(r.contacto || "").split("·").map((s) => s.trim());
    const email = r.email || (partes[2]?.includes("@") ? partes[2] : null);
    const whatsapp = r.whatsapp || (partes[1] || "").replace(/\D/g, "") || null;
    const datos = { nombre: r.cliente || partes[0] || "", titulo: r.titulo, fecha_hora: r.fecha_hora, zona: r.zona };
    const en3dias = iso(new Date(ahora.getTime() + 3 * 86400 * 1000));

    for (const [canal, destino] of [["email", email], ["whatsapp", whatsapp]]) {
      if (!destino) continue;
      for (const [plantilla, cuando] of [["noshow_1", iso(ahora)], ["noshow_2", en3dias]]) {
        // Idempotente por el índice único (reunion_id, canal, plantilla): no repite la secuencia.
        await encolar({ p_lead_id: r.lead_id, p_reunion_id: r.id, p_canal: canal, p_plantilla: plantilla, p_destino: destino, p_cuando: cuando, p_datos: datos });
      }
    }
  }
  return reuniones.length;
}

// ── Proceso ──
const avisos = await pedirMarcarAsistencia();
const noshows = await recuperarNoShows();
const { enviados, fallidos, cola } = await despachar();   // último: despacha también lo recién encolado

console.log(`OK seguimiento: ${enviados} enviados, ${fallidos} con error, ${cola} en cola. ${avisos} reuniones sin marcar, ${noshows} no-shows en recuperación.`);
if (fallidos > 0 && enviados === 0 && cola > 0) process.exit(1);   // falla el Action si nada salió: se ve en rojo
