import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });
const EMAIL_FROM =
  Deno.env.get("EMAIL_FROM") || "condor.ai <onboarding@resend.dev>";
const TOPE = 200;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c]!,
  );

function plantilla(cuerpo: string, preheader = "", baja?: string) {
  const parrafos = esc(cuerpo)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f4;padding:32px 0"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8ebe8"><tr><td style="padding:26px 30px 8px;font-size:15px;font-weight:750;color:#16191a">CÓNDOR AI</td></tr><tr><td style="padding:10px 30px 26px">${parrafos}</td></tr><tr><td style="background:#fafbfa;padding:16px 30px;text-align:center;font-size:11px;color:#98a19e;border-top:1px solid #e8ebe8">condor.ai · <a href="https://condorai.cl" style="color:#6b7472">condorai.cl</a>${baja ? ` · <a href="${baja}" style="color:#6b7472">Cancelar suscripción</a>` : ""}</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY)
    return json({ ok: false, error: "RESEND_API_KEY sin configurar" }, 500);
  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    },
  );
  const {
    data: { user },
  } = await sbUser.auth.getUser();
  if (!user?.email) return json({ ok: false, error: "sin sesión" }, 401);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  if (!admin) return json({ ok: false, error: "solo el equipo" }, 403);

  let mensajes: {
    contacto_id?: string | null;
    para: string;
    asunto: string;
    cuerpo: string;
    preheader?: string;
  }[] = [];
  let campanaId: string | null = null;
  try {
    const b = await req.json();
    mensajes = Array.isArray(b?.mensajes) ? b.mensajes : [];
    campanaId = typeof b?.campana_id === "string" ? b.campana_id : null;
  } catch {
    return json({ ok: false, error: "cuerpo inválido" }, 400);
  }
  mensajes = mensajes
    .filter((m) => m && /.+@.+\..+/.test(m.para) && m.asunto)
    .slice(0, TOPE);
  if (!mensajes.length)
    return json({ ok: false, error: "nada que enviar" }, 400);

  const [{ data: clientes }, { data: contactos }] = await Promise.all([
    sb.from("clientes").select("email"),
    sb.from("email_contactos").select("id,email,estado,baja_token"),
  ]);
  const operativos = new Set(
    (clientes ?? []).map((c) => String(c.email).toLowerCase()),
  );
  const marketing = new Map(
    (contactos ?? []).map((c) => [String(c.email).toLowerCase(), c]),
  );
  const fuera = mensajes.filter((m) => {
    const c = marketing.get(m.para.toLowerCase());
    return !(c?.estado === "suscrito" || operativos.has(m.para.toLowerCase()));
  });
  if (fuera.length)
    return json(
      {
        ok: false,
        error: `hay ${fuera.length} destino(s) sin consentimiento ni vínculo de cliente`,
      },
      400,
    );

  let enviados = 0;
  const fallos: string[] = [];
  const bitacora: Record<string, unknown>[] = [];
  for (const m of mensajes) {
    const contacto = marketing.get(m.para.toLowerCase());
    const baja = contacto?.baja_token
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-baja?token=${contacto.baja_token}`
      : undefined;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [m.para],
          subject: m.asunto,
          html: plantilla(m.cuerpo || "", m.preheader || "", baja),
          headers: baja
            ? {
                "List-Unsubscribe": `<${baja}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        enviados++;
        bitacora.push({
          campana_id: campanaId,
          contacto_id: contacto?.id ?? null,
          email: m.para,
          estado: "enviado",
          proveedor_id: d.id ?? null,
        });
      } else {
        const e = JSON.stringify(d).slice(0, 180);
        fallos.push(`${m.para}: ${e}`);
        bitacora.push({
          campana_id: campanaId,
          contacto_id: contacto?.id ?? null,
          email: m.para,
          estado: "error",
          error: e,
        });
      }
    } catch (e) {
      const msg = String(e).slice(0, 180);
      fallos.push(`${m.para}: ${msg}`);
      bitacora.push({
        campana_id: campanaId,
        contacto_id: contacto?.id ?? null,
        email: m.para,
        estado: "error",
        error: msg,
      });
    }
  }
  if (campanaId) {
    await sb.from("email_envios").insert(bitacora);
    await sb
      .from("email_campanas")
      .update({
        estado: "enviada",
        enviados,
        fallidos: fallos.length,
        enviada_en: new Date().toISOString(),
        ultimo_error: fallos[0] ?? null,
      })
      .eq("id", campanaId);
  }
  return json({ ok: true, enviados, fallos });
});
