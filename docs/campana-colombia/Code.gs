/**
 * Backend de leads de la campaña /colombia — recibe el POST de la landing y
 * escribe una fila en esta misma hoja de cálculo. Sin Supabase, sin WhatsApp
 * Cloud API: el seguimiento es 100% manual desde esta hoja.
 *
 * CÓMO INSTALARLO (una vez, ~5 min):
 *  1. Crea una Google Sheet nueva (sheets.new). Ponle nombre "Leads Colombia".
 *  2. Extensiones → Apps Script.
 *  3. Borra el contenido de Code.gs y pega TODO este archivo.
 *  4. Guarda (Ctrl+S / ícono de guardar).
 *  5. Implementar → Nueva implementación → tipo "Aplicación web".
 *       - Ejecutar como: Yo (tu cuenta)
 *       - Quién tiene acceso: Cualquier usuario
 *     Implementar → Autorizar acceso (es tu propio script, dale permiso).
 *  6. Copia la URL que te da ("URL de la aplicación web", termina en /exec).
 *  7. Esa URL va en Vercel como VITE_LEADS_API del proyecto web-v2, y luego
 *     redeploy. (Puede hacerlo Claude con esa URL.)
 *
 * Si más adelante cambias el código de este script, tienes que volver a
 * "Implementar → Gestionar implementaciones → editar (lápiz) → Nueva versión"
 * para que el cambio quede en vivo — guardar solo no alcanza.
 */

const SHEET_NAME = "Leads";
const HEADERS = [
  "Fecha y hora",
  "Tipo",
  "Nombre",
  "WhatsApp",
  "Correo",
  "Día/hora pedido",
  "Estado",
  "Campaña",
  "Creativo",
  "URL de origen",
];

const TIPO_LABEL = {
  reunion: "📅 Agendó reunión",
  contacto: "☎️ Quiere que lo contacten",
};

const ESTADOS = ["Pendiente", "Contactado", "Confirmado", "No respondió"];

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

/** Dropdown de colores en la columna Estado, para las filas nuevas. */
function aplicarValidacionEstado_(sheet, row) {
  const col = HEADERS.indexOf("Estado") + 1;
  const cell = sheet.getRange(row, col);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
  cell.setDataValidation(rule);

  const rules = sheet.getConditionalFormatRules();
  const range = sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1);
  const nuevas = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Pendiente").setBackground("#fde2e1").setFontColor("#9b1c1c").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Contactado").setBackground("#fdecc8").setFontColor("#8a5a00").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Confirmado").setBackground("#d8f2de").setFontColor("#18683a").setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("No respondió").setBackground("#e5e7eb").setFontColor("#374151").setRanges([range]).build(),
  ];
  // Reemplaza reglas previas sobre la misma columna para no duplicarlas en cada request.
  const otras = rules.filter((r) => JSON.stringify(r.getRanges().map((rg) => rg.getA1Notation())) !== JSON.stringify([range.getA1Notation()]));
  sheet.setConditionalFormatRules([...otras, ...nuevas]);
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const {
      tipo, nombre, whatsapp, correo, fecha_hora, origen, creativo,
    } = body;

    if (!nombre || !whatsapp || (tipo !== "reunion" && tipo !== "contacto")) {
      return respuesta_({ ok: false, error: "Faltan campos requeridos (nombre, whatsapp, tipo)." });
    }

    const sheet = getSheet_();
    const fila = [
      new Date(),
      TIPO_LABEL[tipo] || tipo,
      nombre,
      whatsapp,
      correo || "",
      tipo === "reunion" ? (fecha_hora || "") : "",
      "Pendiente",
      (origen && origen.utm_campaign) || "",
      creativo || "",
      (origen && origen.url) || "",
    ];
    sheet.appendRow(fila);
    aplicarValidacionEstado_(sheet, sheet.getLastRow());

    return respuesta_({ ok: true });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err) });
  }
}

/** Para probar el deploy a mano desde el navegador (GET a la URL /exec). */
function doGet() {
  return respuesta_({ ok: true, info: "Leads Colombia — endpoint activo. Usa POST." });
}
