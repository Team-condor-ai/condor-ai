// Despacha campañas de email programadas desde el portal. Corre cada 15 min.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "condor.ai <onboarding@resend.dev>";
if (!URL || !KEY || !RESEND)
  throw new Error(
    "Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o RESEND_API_KEY",
  );
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const get = async (p) => {
  const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
const patch = async (p, b) =>
  fetch(`${URL}/rest/v1/${p}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify(b),
  });
const post = async (p, b) =>
  fetch(`${URL}/rest/v1/${p}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify(b),
  });
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
const merge = (s, c) =>
  String(s || "")
    .replaceAll("{{nombre}}", c.nombre?.split(" ")[0] || "Hola")
    .replaceAll("{{empresa}}", c.empresa || "tu negocio")
    .replaceAll("{{email}}", c.email);
const html = (campana, c) => {
  const baja = `${URL}/functions/v1/email-baja?token=${c.baja_token}`;
  const cuerpo = esc(merge(campana.cuerpo, c))
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return {
    baja,
    html: `<!doctype html><html><body style="margin:0;background:#f4f5f4;font-family:-apple-system,Segoe UI,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${esc(merge(campana.preheader, c))}</div><table width="100%" style="padding:32px 0"><tr><td align="center"><table width="100%" style="max-width:560px;background:#fff;border:1px solid #e8ebe8;border-radius:16px"><tr><td style="padding:26px 30px 8px;font-weight:750">CÓNDOR AI</td></tr><tr><td style="padding:10px 30px 26px">${cuerpo}</td></tr><tr><td style="padding:16px;text-align:center;font-size:11px;color:#999"><a href="${baja}" style="color:#777">Cancelar suscripción</a></td></tr></table></td></tr></table></body></html>`,
  };
};

const ahora = new Date().toISOString();
const campanas = await get(
  `email_campanas?estado=eq.programada&programada_para=lte.${encodeURIComponent(ahora)}&order=programada_para.asc&limit=20`,
);
let total = 0,
  errores = 0;
for (const ca of campanas) {
  await patch(`email_campanas?id=eq.${ca.id}`, { estado: "enviando" });
  const todos = await get(
    "email_contactos?estado=eq.suscrito&select=id,email,nombre,empresa,baja_token",
  );
  const ids = new Set(ca.destinatarios || []);
  const destinos = todos.filter((c) => ids.has(c.id)).slice(0, 500);
  let enviados = 0;
  const logs = [];
  for (const c of destinos) {
    const contenido = html(ca, c);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [c.email],
          subject: merge(ca.asunto, c),
          html: contenido.html,
          headers: {
            "List-Unsubscribe": `<${contenido.baja}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        enviados++;
        logs.push({
          campana_id: ca.id,
          contacto_id: c.id,
          email: c.email,
          estado: "enviado",
          proveedor_id: d.id || null,
        });
      } else
        logs.push({
          campana_id: ca.id,
          contacto_id: c.id,
          email: c.email,
          estado: "error",
          error: JSON.stringify(d).slice(0, 180),
        });
    } catch (e) {
      logs.push({
        campana_id: ca.id,
        contacto_id: c.id,
        email: c.email,
        estado: "error",
        error: String(e).slice(0, 180),
      });
    }
  }
  if (logs.length) await post("email_envios", logs);
  const fallidos = logs.length - enviados;
  await patch(`email_campanas?id=eq.${ca.id}`, {
    estado: "enviada",
    enviados,
    fallidos,
    enviada_en: new Date().toISOString(),
    ultimo_error: logs.find((x) => x.estado === "error")?.error || null,
  });
  total += enviados;
  errores += fallidos;
}
console.log(
  `Campañas: ${campanas.length} procesadas · ${total} envíos · ${errores} errores`,
);
if (errores && !total) process.exitCode = 1;
