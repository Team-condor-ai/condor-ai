/**
 * Backend de leads de la campaña /colombia — recibe el POST de la landing,
 * escribe una fila en esta misma hoja de cálculo y manda los correos
 * automáticos. Sin Supabase y sin WhatsApp Cloud API: el contacto por WhatsApp
 * lo hace Joaquín a mano desde esta hoja; lo único automático es el correo.
 *
 * QUÉ CORREOS SALEN SOLOS
 *   1. Al lead, apenas envía el formulario → confirmación de que llegó.
 *   2. A nosotros, en el mismo momento → aviso para escribirle por WhatsApp.
 *   3. Al lead, 24 h antes de la reunión → recordatorio.
 *   4. Al lead, ~2 h antes de la reunión → último recordatorio.
 *
 * Los dos recordatorios salen de la columna "Fecha reunión", que ahora llega
 * SOLA: desde 2026-07-31 la landing tiene calendario y el visitante elige día
 * y hora exactos. Si esa celda está vacía (lead viejo, o alguien que pidió
 * "que me contacten") no se manda ningún recordatorio; se puede escribir la
 * fecha a mano y el trigger la toma igual.
 *
 * CÓMO INSTALARLO (una vez, ~5 min):
 *  1. Crea una Google Sheet nueva (sheets.new). Ponle nombre "Leads Colombia".
 *  2. Extensiones → Apps Script.
 *  3. Borra el contenido de Code.gs y pega TODO este archivo.
 *  4. Cambia AVISAR_A por tu correo (abajo, en CONFIG).
 *  5. Guarda (Ctrl+S).
 *  6. En el selector de funciones elige `instalar` y dale a Ejecutar.
 *     Autoriza los permisos que pida (son de tu propia cuenta). Esto crea la
 *     hoja con sus columnas y deja programado el trigger de recordatorios.
 *  7. Implementar → Nueva implementación → tipo "Aplicación web".
 *       - Ejecutar como: Yo (tu cuenta)
 *       - Quién tiene acceso: Cualquier usuario
 *     Implementar → Autorizar acceso.
 *  8. Copia la URL que te da (termina en /exec) y ponla como secret
 *     VITE_LEADS_API en GitHub → Settings → Secrets → Actions.
 *
 * Si cambias este código después, hay que volver a "Implementar → Gestionar
 * implementaciones → editar (lápiz) → Nueva versión": guardar no alcanza.
 *
 * LÍMITE DE ENVÍO: una cuenta Gmail gratuita manda 100 correos al día; una de
 * Workspace, 1500. Con el volumen de esta campaña sobra, pero si algún día se
 * corta, es por acá.
 *
 * PERMISO (Ley 1581): el visitante autorizó que lo contactemos "para coordinar
 * esta reunión". Confirmación y recordatorios entran ahí. Mandarle boletines o
 * promociones NO: eso necesita otra autorización, y romperlo destruye la única
 * propuesta que tiene la landing.
 */

/* ─────────────────────────────── CONFIG ─────────────────────────────────── */

const CONFIG = {
  // A dónde llega el aviso interno de lead nuevo. CAMBIAR.
  AVISAR_A: "contacto@teamcondorcl.com",
  // Nombre que ve el destinatario como remitente.
  REMITENTE: "Cóndor.ai",
  // WhatsApp que se muestra en los correos.
  WHATSAPP: "+56 9 8898 9824",
  WHATSAPP_LINK: "https://wa.me/56988989824",
  // Zona horaria de Colombia: las horas de los correos se escriben en esta.
  TZ: "America/Bogota",
};

const SHEET_NAME = "Leads";
const HEADERS = [
  "Fecha y hora",
  "Tipo",
  "Nombre",
  "WhatsApp",
  "Correo",
  "Día/hora pedido",
  "Fecha reunión", // ← se llena A MANO al confirmar. Dispara los recordatorios.
  "Estado",
  "Recordatorio 24h",
  "Recordatorio 2h",
  "Campaña",
  "Creativo",
  "URL de origen",
];

const TIPO_LABEL = {
  reunion: "📅 Agendó reunión",
  contacto: "☎️ Quiere que lo contacten",
};

const ESTADOS = ["Pendiente", "Contactado", "Confirmado", "No respondió"];

/* ──────────────────────────────── HOJA ──────────────────────────────────── */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

const col_ = (nombre) => HEADERS.indexOf(nombre) + 1;

/** Dropdown de colores en la columna Estado, para las filas nuevas. */
function aplicarValidacionEstado_(sheet, row) {
  const c = col_("Estado");
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
  sheet.getRange(row, c).setDataValidation(rule);

  const rules = sheet.getConditionalFormatRules();
  const range = sheet.getRange(2, c, Math.max(sheet.getMaxRows() - 1, 1), 1);
  const nuevas = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Pendiente").setBackground("#fde2e1").setFontColor("#9b1c1c").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Contactado").setBackground("#fdecc8").setFontColor("#8a5a00").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Confirmado").setBackground("#d8f2de").setFontColor("#18683a").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("No respondió").setBackground("#e5e7eb").setFontColor("#374151").setRanges([range]).build(),
  ];
  const otras = rules.filter((r) => JSON.stringify(r.getRanges().map((rg) => rg.getA1Notation())) !== JSON.stringify([range.getA1Notation()]));
  sheet.setConditionalFormatRules([...otras, ...nuevas]);
}

/* ─────────────────────────────── CORREOS ────────────────────────────────── */

/**
 * Envoltorio HTML de los correos. Sobrio y con la marca, pero sin imágenes
 * externas ni banners: un correo transaccional cargado de gráficos es lo que
 * más lo empuja a spam, y este tiene que llegar sí o sí.
 */
function plantilla_(titulo, cuerpoHtml, pie) {
  return [
    '<div style="margin:0;padding:24px 12px;background:#fff8f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #f0e4dc;border-radius:18px;padding:30px 26px;">',
    '<p style="margin:0 0 22px;font-size:17px;font-weight:700;color:#0e1116;letter-spacing:-.02em;">cóndor<span style="color:#2347E0;">.ai</span></p>',
    '<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;font-weight:700;color:#0e1116;letter-spacing:-.02em;">' + titulo + "</h1>",
    '<div style="font-size:15px;line-height:1.6;color:#4d5560;">' + cuerpoHtml + "</div>",
    '<p style="margin:26px 0 0;">',
    '<a href="' + CONFIG.WHATSAPP_LINK + '" style="display:inline-block;background:#00c95c;color:#04220f;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:999px;">Escribirnos por WhatsApp</a>',
    "</p>",
    '<hr style="border:0;border-top:1px solid #f0e4dc;margin:26px 0 16px;">',
    '<p style="margin:0;font-size:12px;line-height:1.55;color:#8a8f98;">' + pie + "</p>",
    "</div></div>",
  ].join("");
}

function fmtFecha_(fecha) {
  return Utilities.formatDate(new Date(fecha), CONFIG.TZ, "EEEE d 'de' MMMM 'a las' HH:mm");
}

const PIE_LEAD =
  "Recibes este correo porque dejaste tus datos en condorai.cl/colombia para coordinar una reunión. " +
  "Solo te escribimos por eso. Si quieres que borremos tus datos, respóndenos y lo hacemos.";

/** 1 · Al lead, apenas envía el formulario. */
function correoConfirmacion_(datos) {
  if (!datos.correo) return;
  const esReunion = datos.tipo === "reunion";
  const cuando = datos.fecha_hora
    ? '<p style="font-size:17px;color:#0e1116;">Quedó para el <b>' + datos.fecha_hora + "</b>, hora Colombia.</p>"
    : "";

  const cuerpo = esReunion
    ? "<p>Hola " + datos.nombre + ",</p>" +
      "<p>Tu reunión quedó agendada.</p>" +
      cuando +
      "<p><b>Te escribimos por WhatsApp</b> al " + datos.whatsapp +
      " con el enlace de la videollamada.</p>" +
      "<p>La reunión dura 30 minutos, es por videollamada y no tiene costo. Te vamos a preguntar por tu negocio, " +
      "quién te compra y qué necesitas que la página haga. De ahí sale la propuesta, con el precio por escrito.</p>" +
      "<p>Si no te sirve lo que te proponemos, ahí queda y no te costó nada.</p>"
    : "<p>Hola " + datos.nombre + ",</p>" +
      "<p>Recibimos tus datos. <b>Te escribimos por WhatsApp</b> al " + datos.whatsapp +
      " dentro de las próximas 24 horas, en horario de 8:00 a 21:00 hora Colombia.</p>" +
      "<p>Si prefieres adelantarte, puedes escribirnos tú directamente acá abajo.</p>";

  enviar_(
    datos.correo,
    esReunion ? "Recibimos tu solicitud de reunión — Cóndor.ai" : "Recibimos tus datos — Cóndor.ai",
    plantilla_(esReunion ? "Tu reunión está en camino" : "Recibimos tus datos", cuerpo, PIE_LEAD)
  );
}

/** 2 · A nosotros: hay que escribirle por WhatsApp. */
function correoAviso_(datos) {
  if (!CONFIG.AVISAR_A) return;
  const wsp = "https://wa.me/" + String(datos.whatsapp).replace(/\D/g, "");
  const cuerpo =
    "<p><b>" + datos.nombre + "</b> — " + (TIPO_LABEL[datos.tipo] || datos.tipo) + "</p>" +
    "<p>WhatsApp: <b>" + datos.whatsapp + "</b><br>" +
    "Correo: " + (datos.correo || "—") + "<br>" +
    "Le acomoda: " + (datos.fecha_hora || "no dijo") + "<br>" +
    "Campaña: " + ((datos.origen && datos.origen.utm_campaign) || "—") +
    " · Creativo: " + (datos.creativo || "—") + "</p>" +
    '<p><a href="' + wsp + '">Abrir chat con ' + datos.nombre + "</a></p>" +
    "<p>Cuando cierres el día y la hora, escríbelos en la columna <b>Fecha reunión</b> de la hoja: " +
    "de ahí salen los recordatorios automáticos.</p>";
  enviar_(CONFIG.AVISAR_A, "Lead nuevo Colombia: " + datos.nombre, plantilla_("Lead nuevo", cuerpo, "Aviso interno."));
}

/** 3 y 4 · Recordatorios. `horas` es cuánto falta para la reunión. */
function correoRecordatorio_(datos, horas) {
  if (!datos.correo) return;
  const es24 = horas >= 12;
  const cuerpo =
    "<p>Hola " + datos.nombre + ",</p>" +
    (es24
      ? "<p>Te recordamos que <b>mañana</b> tenemos nuestra reunión:</p>"
      : "<p>Nos vemos en un rato. Tu reunión es <b>hoy</b>:</p>") +
    '<p style="font-size:17px;color:#0e1116;"><b>' + fmtFecha_(datos.fechaReunion) + "</b> (hora Colombia)</p>" +
    "<p>Son 30 minutos por videollamada. No necesitas preparar nada: con que nos cuentes de tu negocio basta.</p>" +
    "<p>Si te surgió algo y no puedes, avísanos por WhatsApp y la movemos sin problema.</p>";
  enviar_(
    datos.correo,
    es24 ? "Mañana es tu reunión con Cóndor.ai" : "Hoy es tu reunión con Cóndor.ai",
    plantilla_(es24 ? "Tu reunión es mañana" : "Tu reunión es hoy", cuerpo, PIE_LEAD)
  );
}

/** Un correo nunca puede tumbar el guardado del lead. */
function enviar_(para, asunto, html) {
  try {
    MailApp.sendEmail({ to: para, subject: asunto, htmlBody: html, name: CONFIG.REMITENTE });
  } catch (err) {
    console.error("No se pudo enviar a " + para + ": " + err);
  }
}

/* ─────────────────────────── TRIGGER HORARIO ────────────────────────────── */

/**
 * Corre cada hora. Busca reuniones confirmadas y manda el recordatorio de 24 h
 * y el de ~2 h, marcando cada envío en su columna para no repetirlo.
 *
 * Las ventanas son amplias a propósito (el trigger horario de Apps Script no
 * dispara al minuto exacto): 20–28 h para el primero, 1–4 h para el segundo.
 * Peor un recordatorio con dos horas de holgura que uno que no sale.
 */
function enviarRecordatorios() {
  const sheet = getSheet_();
  const filas = sheet.getLastRow() - 1;
  if (filas < 1) return;

  const datos = sheet.getRange(2, 1, filas, HEADERS.length).getValues();
  const ahora = new Date();

  datos.forEach(function (fila, i) {
    const row = i + 2;
    const fechaReunion = fila[col_("Fecha reunión") - 1];
    if (!fechaReunion || !(fechaReunion instanceof Date)) return;

    const horas = (fechaReunion.getTime() - ahora.getTime()) / 36e5;
    const lead = {
      nombre: fila[col_("Nombre") - 1],
      correo: fila[col_("Correo") - 1],
      fechaReunion: fechaReunion,
    };
    if (!lead.correo) return;

    if (horas >= 20 && horas <= 28 && !fila[col_("Recordatorio 24h") - 1]) {
      correoRecordatorio_(lead, horas);
      sheet.getRange(row, col_("Recordatorio 24h")).setValue(new Date());
    }
    if (horas >= 1 && horas <= 4 && !fila[col_("Recordatorio 2h") - 1]) {
      correoRecordatorio_(lead, horas);
      sheet.getRange(row, col_("Recordatorio 2h")).setValue(new Date());
    }
  });
}

/* ──────────────────────────────── HTTP ──────────────────────────────────── */

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    const tipo = body.tipo;
    const nombre = body.nombre;
    const whatsapp = body.whatsapp;
    const correo = body.correo;
    const fecha_hora = body.fecha_hora;
    const origen = body.origen;
    const creativo = body.creativo;

    if (!nombre || !whatsapp || (tipo !== "reunion" && tipo !== "contacto")) {
      return respuesta_({ ok: false, error: "Faltan campos requeridos (nombre, whatsapp, tipo)." });
    }

    // La landing manda la fecha elegida en ISO: se guarda como fecha real para
    // que los recordatorios salgan solos. Si algún día llega sin ella (versión
    // vieja de la página), la columna queda vacía y se llena a mano.
    let fechaReunion = "";
    if (tipo === "reunion" && body.fecha_iso) {
      const d = new Date(body.fecha_iso);
      if (!isNaN(d.getTime())) fechaReunion = d;
    }

    const sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      TIPO_LABEL[tipo] || tipo,
      nombre,
      whatsapp,
      correo || "",
      tipo === "reunion" ? fecha_hora || "" : "",
      fechaReunion,
      "Pendiente",
      "", // Recordatorio 24h
      "", // Recordatorio 2h
      (origen && origen.utm_campaign) || "",
      creativo || "",
      (origen && origen.url) || "",
    ]);
    aplicarValidacionEstado_(sheet, sheet.getLastRow());

    // El lead YA está guardado: si un correo falla, no se pierde nada.
    const datos = { tipo: tipo, nombre: nombre, whatsapp: whatsapp, correo: correo, fecha_hora: fecha_hora, origen: origen, creativo: creativo };
    correoConfirmacion_(datos);
    correoAviso_(datos);

    return respuesta_({ ok: true });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err) });
  }
}

/** Para probar el deploy a mano desde el navegador (GET a la URL /exec). */
function doGet() {
  return respuesta_({ ok: true, info: "Leads Colombia — endpoint activo. Usa POST." });
}

/* ─────────────────────────────── INSTALACIÓN ────────────────────────────── */

/** Ejecutar UNA vez desde el editor: crea la hoja y programa los recordatorios. */
function instalar() {
  getSheet_();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === "enviarRecordatorios"; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("enviarRecordatorios").timeBased().everyHours(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast("Hoja lista y recordatorios programados cada hora.", "Cóndor.ai", 8);
}

/** Manda los cuatro correos a AVISAR_A para revisar cómo se ven. No toca la hoja. */
function probarCorreos() {
  const demo = {
    tipo: "reunion",
    nombre: "Prueba",
    whatsapp: "+57 300 000 0000",
    correo: CONFIG.AVISAR_A,
    fecha_hora: "Tarde (12–18)",
    origen: { utm_campaign: "prueba" },
  };
  correoConfirmacion_(demo);
  correoAviso_(demo);
  demo.fechaReunion = new Date(Date.now() + 24 * 36e5);
  correoRecordatorio_(demo, 24);
  demo.fechaReunion = new Date(Date.now() + 2 * 36e5);
  correoRecordatorio_(demo, 2);
}
