// Smoke test del worker de seguimiento: intercepta fetch (Supabase REST, Resend, Graph)
// y comprueba que despacha, marca estados y reintenta.
process.env.SUPABASE_URL = "https://fake.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.RESEND_API_KEY = "re_fake";
process.env.EMAIL_FROM = "condor.ai <hola@condorai.cl>";
process.env.WHATSAPP_TOKEN = "wa_fake";
process.env.WHATSAPP_PHONE_ID = "123456";
process.env.WA_TPL_RECORDATORIO_24H = "condor_recordatorio_24h";

const ahora = Date.now();
const enMinutos = (m) => new Date(ahora + m * 60000).toISOString();

const COLA = [
  { id: 1, lead_id: 10, reunion_id: "r-1", canal: "email", plantilla: "confirmacion", destino: "cliente@ejemplo.com",
    datos: { nombre: "Ana Pérez", titulo: "Reunión con Ana", fecha_hora: enMinutos(60 * 30), duracion_min: 30, zona: "America/Bogota" },
    programado_para: enMinutos(-5), estado: "pendiente", intentos: 0 },
  { id: 2, lead_id: 10, reunion_id: "r-1", canal: "whatsapp", plantilla: "recordatorio_24h", destino: "573001234567",
    datos: { nombre: "Ana Pérez", fecha_hora: enMinutos(60 * 24), duracion_min: 30 },
    programado_para: enMinutos(-1), estado: "pendiente", intentos: 0 },
  { id: 3, lead_id: 11, reunion_id: null, canal: "email", plantilla: "inventada", destino: "otro@ejemplo.com",
    datos: {}, programado_para: enMinutos(-2), estado: "pendiente", intentos: 0 },
  { id: 4, lead_id: 12, reunion_id: null, canal: "whatsapp", plantilla: "bienvenida", destino: "573009999999",
    datos: { nombre: "Luis" }, programado_para: enMinutos(-3), estado: "pendiente", intentos: 2 },
];

const REUNIONES_SIN_MARCAR = [
  { id: "r-9", titulo: "Reunión con Pedro", fecha_hora: enMinutos(-60 * 5), contacto: "Pedro · 573005555555 · pedro@ejemplo.com", lead_id: 20, zona: null, origen: "web" },
  { id: "r-8", titulo: "Interna equipo", fecha_hora: enMinutos(-60 * 5), contacto: null, lead_id: null, zona: null, origen: null },
];
const NOSHOWS = [
  { id: "r-7", titulo: "Reunión con Rosa", fecha_hora: enMinutos(-60 * 26), contacto: "Rosa · 573007777777 · rosa@ejemplo.com",
    email: null, whatsapp: null, cliente: "Rosa", lead_id: 21, zona: "America/Bogota" },
];

const llamadas = { patch: [], resend: [], whatsapp: [], rpc: [] };
let waFalla = true; // el primer envío de WhatsApp falla, para probar el reintento

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  const ok = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });

  if (u.includes("/rest/v1/rpc/encolar_mensaje")) { llamadas.rpc.push(body); return ok({}); }
  if (u.includes("/rest/v1/mensajes_programados")) {
    if (opts.method === "PATCH") { llamadas.patch.push({ url: u, body }); return ok({}); }
    return ok(COLA);
  }
  if (u.includes("/rest/v1/reuniones")) {
    if (u.includes("asistio=is.null")) return ok(REUNIONES_SIN_MARCAR);
    if (u.includes("asistio=is.false")) return ok(NOSHOWS);
    return ok([]);
  }
  if (u.includes("api.resend.com")) { llamadas.resend.push(body); return ok({ id: "email_1" }); }
  if (u.includes("graph.facebook.com")) {
    llamadas.whatsapp.push(body);
    if (waFalla) { waFalla = false; return { ok: false, status: 400, text: async () => '{"error":{"message":"template not found"}}' }; }
    return ok({ messages: [{ id: "wamid.1" }] });
  }
  throw new Error("URL no esperada en el test: " + u);
};

await import("./seguimiento.mjs");

// ── Comprobaciones ──
const fallos = [];
const chk = (cond, msg) => { if (!cond) fallos.push(msg); };

chk(llamadas.resend.length === 1, `esperaba 1 correo enviado, hubo ${llamadas.resend.length}`);
const correo = llamadas.resend[0] || {};
chk(correo.to?.[0] === "cliente@ejemplo.com", "el correo no fue al destinatario correcto");
chk(/Tu reunión con condor\.ai/.test(correo.subject || ""), "asunto de confirmación inesperado: " + correo.subject);
chk(/Ana/.test(correo.html || ""), "el correo no saluda por el nombre");
chk(/seguimiento-baja\?lead=10/.test(correo.html || ""), "falta el link de baja con el lead_id");

chk(llamadas.whatsapp.length === 2, `esperaba 2 envíos de WhatsApp, hubo ${llamadas.whatsapp.length}`);
const wa1 = llamadas.whatsapp[0] || {};
chk(wa1.type === "template" && wa1.template?.name === "condor_recordatorio_24h", "el recordatorio 24h debía ir como plantilla aprobada");
chk(wa1.to === "573001234567", "número de WhatsApp mal normalizado: " + wa1.to);
const wa2 = llamadas.whatsapp[1] || {};
chk(wa2.type === "text" && /Luis/.test(wa2.text?.body || ""), "sin plantilla configurada debía caer a texto libre");

const porId = (id) => llamadas.patch.filter((p) => p.url.includes(`id=eq.${id}`)).map((p) => p.body);
chk(porId(1)[0]?.estado === "enviado", "el mensaje 1 no quedó como enviado");
chk(porId(3)[0]?.estado === "error" && /plantilla desconocida/.test(porId(3)[0]?.ultimo_error || ""), "la plantilla desconocida no quedó marcada como error");
const m2 = porId(2)[0] || {};
chk(m2.estado === "pendiente" && m2.intentos === 1 && /WhatsApp 400/.test(m2.ultimo_error || ""), "el fallo de WhatsApp debía quedar pendiente para reintento: " + JSON.stringify(m2));
chk(porId(4)[0]?.estado === "enviado" && porId(4)[0]?.intentos === 3, "el mensaje 4 no acumuló bien los intentos");

const staff = llamadas.rpc.filter((r) => r.p_plantilla === "staff_asistencia");
chk(staff.length === 1, `esperaba 1 aviso de asistencia (solo la reunión externa), hubo ${staff.length}`);
chk(staff[0]?.p_reunion_id === "r-9", "el aviso de asistencia no corresponde a la reunión externa");

const rec = llamadas.rpc.filter((r) => String(r.p_plantilla).startsWith("noshow"));
chk(rec.length === 4, `esperaba 4 encolados de recuperación (2 canales x 2 pasos), hubo ${rec.length}`);
chk(rec.some((r) => r.p_canal === "email" && r.p_destino === "rosa@ejemplo.com"), "no extrajo el email del campo 'contacto'");
chk(rec.some((r) => r.p_canal === "whatsapp" && r.p_destino === "573007777777"), "no extrajo el WhatsApp del campo 'contacto'");
chk(rec.filter((r) => r.p_plantilla === "noshow_2").every((r) => new Date(r.p_cuando) > new Date(ahora + 2 * 86400000)), "noshow_2 debía quedar programado a 3 días");

if (fallos.length) { console.error("\nFALLOS:\n- " + fallos.join("\n- ")); process.exit(1); }
console.log(`\nTEST OK · ${llamadas.resend.length} email, ${llamadas.whatsapp.length} whatsapp, ${llamadas.patch.length} updates, ${llamadas.rpc.length} encolados`);
