// condor.ai · Edge Function "enviar-correos"
// Envía un correo a varios clientes desde el portal de staff.
//
// Secreto:  RESEND_API_KEY
// Deploy:   supabase functions deploy enviar-correos --project-ref <ref>
//           (CON verificación de JWT: solo admins autenticados)
//
// POR QUÉ NO SE MANDA DESDE EL NAVEGADOR
// ---------------------------------------------------------------------------
// Con la key de Resend en el front, cualquiera que abra el sitio podría mandar
// correos firmados como condor.ai. Acá la key vive del lado del servidor y
// además se comprueba que quien llama esté en `admins`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "condor.ai <onboarding@resend.dev>";

// Tope por llamada. No es capricho: Resend limita, y un error de selección
// —"todos" cuando se quería uno— con 500 clientes es irreversible.
const TOPE = 200;

function plantilla(cuerpo: string) {
  const parrafos = cuerpo
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 14px">${
      p.replace(/\n/g, "<br>")
    }</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f4;padding:32px 0"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8ebe8">
    <tr><td style="padding:26px 30px 6px">
      <div style="font-size:15px;font-weight:700;letter-spacing:.3px;color:#16191a">CÓNDOR AI</div>
    </td></tr>
    <tr><td style="padding:10px 30px 26px">${parrafos}</td></tr>
    <tr><td style="background:#fafbfa;padding:16px 30px;text-align:center;font-size:11.5px;color:#98a19e;border-top:1px solid #e8ebe8">
      condor.ai · <a href="https://condorai.cl" style="color:#6b7472">condorai.cl</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY) return json({ ok: false, error: "RESEND_API_KEY sin configurar" }, 500);

  // 1) Quién llama
  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ ok: false, error: "sin sesión" }, 401);

  // 2) ¿Es del equipo? Se comprueba con service_role para saltar RLS, igual
  //    que hace `crear-pago`. Un cliente autenticado NO puede usar esto.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb
    .from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ ok: false, error: "solo el equipo" }, 403);

  // 3) Qué mandar
  let mensajes: { para: string; asunto: string; cuerpo: string }[] = [];
  try {
    const b = await req.json();
    mensajes = Array.isArray(b?.mensajes) ? b.mensajes : [];
  } catch {
    return json({ ok: false, error: "cuerpo inválido" }, 400);
  }
  mensajes = mensajes.filter(
    (m) => m && typeof m.para === "string" && /.+@.+\..+/.test(m.para) && m.asunto,
  );
  if (!mensajes.length) return json({ ok: false, error: "nada que enviar" }, 400);
  if (mensajes.length > TOPE)
    return json({ ok: false, error: `máximo ${TOPE} por envío` }, 400);

  // 4) LOS DESTINATARIOS SE VALIDAN CONTRA LA BASE
  //    El navegador manda la lista, pero acá se comprueba que cada correo sea
  //    de un cliente real. Sin esto, un admin con la consola abierta —o
  //    cualquier cosa que se cuele en el front— podría usar el remitente de
  //    condor.ai para mandar correo a donde quisiera.
  const { data: clientes } = await sb.from("clientes").select("email");
  const validos = new Set((clientes ?? []).map((c) => String(c.email).toLowerCase()));
  const fuera = mensajes.filter((m) => !validos.has(m.para.toLowerCase()));
  if (fuera.length)
    return json(
      { ok: false, error: `hay ${fuera.length} correo(s) que no son de clientes` },
      400,
    );

  // 5) Enviar, uno por uno, sin cortar todo por una falla
  let enviados = 0;
  const fallos: string[] = [];
  for (const m of mensajes) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [m.para],
          subject: m.asunto,
          html: plantilla(m.cuerpo || ""),
        }),
      });
      if (r.ok) enviados++;
      else fallos.push(`${m.para}: ${(await r.text()).slice(0, 90)}`);
    } catch (e) {
      fallos.push(`${m.para}: ${String(e).slice(0, 90)}`);
    }
  }

  return json({ ok: true, enviados, fallos });
});
