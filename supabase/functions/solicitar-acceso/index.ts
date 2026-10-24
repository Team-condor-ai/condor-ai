// condor.ai · Edge Function "solicitar-acceso"
// Cierra el agujero de seguridad: SOLO los correos registrados por un admin
// (en la tabla admins o clientes) reciben el código. Un correo ajeno NUNCA recibe nada.
// Genera el código nosotros (admin.generateLink) y lo enviamos con Resend, con un
// diseño bonito propio (dice "condor AI", sin convertirse en enlace a un dominio .ai).
// Además limita los intentos por IP (anti-bot).
//
// Deploy: supabase functions deploy solicitar-acceso --project-ref <ref> --no-verify-jwt
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), RESEND_API_KEY, EMAIL_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "condor AI <onboarding@resend.dev>";
const LIMITE = 5, VENTANA_MIN = 15;

function emailCodigo(codigo: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#151517">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;border:1px solid #E9EAF0;border-radius:22px;overflow:hidden">
      <tr><td style="padding:28px 32px 0"><span style="font-size:22px;font-weight:700;letter-spacing:-.04em">condor<span style="color:#014CFD">.ai</span></span></td></tr>
      <tr><td style="padding:22px 32px 8px">
        <p style="font-size:20px;font-weight:600;letter-spacing:-.03em;margin:0 0 8px">Tu código de acceso</p>
        <p style="font-size:14px;color:#5B5E6B;margin:0 0 22px;line-height:1.55">Escríbelo en el portal para entrar. Vence en 1 hora.</p>
        <div style="display:inline-block;background:#EEF3FF;border:1px solid #C9D8FF;border-radius:14px;padding:16px 26px;font-size:34px;font-weight:700;letter-spacing:.3em;color:#014CFD">${codigo}</div>
        <p style="font-size:12.5px;color:#8A8D9A;margin:22px 0 0;line-height:1.6">Si no fuiste tú, ignora este correo: nadie puede entrar sin el código.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;font-size:12px;color:#8A8D9A">Cóndor AI · Santiago, Chile</td></tr>
    </table></td></tr></table></body></html>`;
}

// Devuelve null si salió bien, o el motivo del fallo (se guarda en acceso_errores para poder diagnosticar).
async function enviarResend(to: string, codigo: string): Promise<string | null> {
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY) return "Falta el secreto RESEND_API_KEY";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject: "Tu código de acceso · condor AI", html: emailCodigo(codigo) }),
    });
    if (r.ok) return null;
    return `Resend ${r.status} (from: ${EMAIL_FROM}): ${(await r.text()).slice(0, 300)}`;
  } catch (e) { return "Resend no respondió: " + String(e).slice(0, 200); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  let email = "";
  try { const b = await req.json(); email = String(b?.email || "").trim().toLowerCase(); } catch { /* */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "correo inválido" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) Rate limit por IP
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
  const clave = "otp:" + ip, ahora = new Date();
  const { data: rl } = await sb.from("rate_limits").select("*").eq("clave", clave).maybeSingle();
  if (rl && rl.reinicia_en && new Date(rl.reinicia_en) > ahora) {
    if ((rl.conteo ?? 0) >= LIMITE) return json({ ok: false, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }, 429);
    await sb.from("rate_limits").update({ conteo: (rl.conteo ?? 0) + 1 }).eq("clave", clave);
  } else {
    await sb.from("rate_limits").upsert({ clave, conteo: 1, reinicia_en: new Date(ahora.getTime() + VENTANA_MIN * 60000).toISOString() });
  }

  // 2) ¿Correo autorizado? (admin o cliente activo)
  const { data: autorizado } = await sb.rpc("correo_autorizado", { p_email: email });

  // V5 · Registrar el intento (para detectar abuso). Nunca bloquea si la tabla no existe.
  try { await sb.from("acceso_log").insert({ email, ip, autorizado: !!autorizado }); } catch { /* */ }

  const generica = { ok: true, mensaje: "Si tu correo está registrado, te enviamos un código." };
  if (!autorizado) return json(generica);

  // V4 · Límite extra por CORREO (anti-bombing a una víctima concreta): máx 3 códigos / 15 min
  try {
    const cKey = "otpmail:" + email;
    const { data: rlm } = await sb.from("rate_limits").select("*").eq("clave", cKey).maybeSingle();
    if (rlm && rlm.reinicia_en && new Date(rlm.reinicia_en) > ahora) {
      if ((rlm.conteo ?? 0) >= 3) return json(generica); // silencioso: ya se enviaron suficientes
      await sb.from("rate_limits").update({ conteo: (rlm.conteo ?? 0) + 1 }).eq("clave", cKey);
    } else {
      await sb.from("rate_limits").upsert({ clave: cKey, conteo: 1, reinicia_en: new Date(ahora.getTime() + VENTANA_MIN * 60000).toISOString() });
    }
  } catch { /* */ }

  // 3) Crear usuario de auth si es su primera vez, generar el código y enviarlo con Resend
  try {
    await sb.auth.admin.createUser({ email, email_confirm: true }).catch(() => {}); // si ya existe, no pasa nada
    const { data: link } = await sb.auth.admin.generateLink({ type: "magiclink", email });
    const codigo = (link?.properties as any)?.email_otp;
    if (!codigo) await sb.from("acceso_errores").insert({ email, etapa: "generar_codigo", detalle: "Supabase no devolvió el código" });
    else {
      const fallo = await enviarResend(email, codigo);
      if (fallo) await sb.from("acceso_errores").insert({ email, etapa: "enviar_correo", detalle: fallo });
    }
  } catch (e) { // no revelamos errores internos al navegador, pero sí quedan anotados para el equipo
    try { await sb.from("acceso_errores").insert({ email, etapa: "excepcion", detalle: String(e).slice(0, 300) }); } catch { /* */ }
  }

  return json(generica);
});
