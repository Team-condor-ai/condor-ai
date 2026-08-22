// condor.ai · Edge Function "pago-lead"
// Cobro post-reunión para los leads de la campaña, ANTES de que existan como cliente
// en el portal ('crear-pago' exige cliente creado y sesión del cliente; acá el vendedor
// genera el link de Mercado Pago desde el panel y se lo manda al lead).
//
// POST { lead_id, monto, moneda?, concepto?, enviar_correo? }  (solo admin autenticado)
//   -> crea la preferencia en MP con external_reference "lead:<id>"
//   -> deja el lead en pago_estado='pendiente' y devuelve el init_point
//   -> mp-webhook marca 'pagado' cuando MP confirma
//
// Secrets: MP_ACCESS_TOKEN, RESEND_API_KEY, EMAIL_FROM
// Deploy: supabase functions deploy pago-lead   (CON verificación de JWT: lo usa el panel)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validarMonedaCuenta, webhookUrl } from "../_shared/mercadopago.ts";

const WEB = "https://condorai.cl";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "condor.ai <onboarding@resend.dev>";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const emailCobro = (nombre: string, concepto: string, monto: number, moneda: string, link: string) =>
  `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px -18px rgba(20,20,40,.25)">
        <tr><td style="background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e);padding:30px;text-align:center;color:#fff;font-size:21px;font-weight:700">condor.ai</td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;margin:0 0 14px">Hola ${nombre} 👋</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 22px">Acá está el pago de <b>${concepto}</b>. Es seguro y toma un minuto:</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px"><tr><td style="border-radius:999px;background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e)">
            <a href="${link}" style="display:inline-block;padding:15px 34px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:999px">Pagar ${moneda} ${Number(monto).toLocaleString()} →</a>
          </td></tr></table>
          <p style="font-size:13px;color:#888;text-align:center;line-height:1.6">🔒 Procesado por Mercado Pago. Nunca vemos los datos de tu tarjeta.</p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px;text-align:center;font-size:12px;color:#999">condor.ai · <a href="${WEB}" style="color:#999">condorai.cl</a></td></tr>
      </table></td></tr></table></body></html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, servicio: "pago-lead" });

  const MP = Deno.env.get("MP_ACCESS_TOKEN");
  if (!MP) return json({ error: "Falta configurar MP_ACCESS_TOKEN" }, 500);

  // 1) Solo admins autenticados generan cobros
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return json({ error: "sin token" }, 401);
  try {
    const sbUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: esAdmin } = await sbUser.rpc("es_admin");
    if (!esAdmin) return json({ error: "no autorizado" }, 403);
  } catch { return json({ error: "no autorizado" }, 403); }

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const leadId = Number(b.lead_id);
  const monto = Number(b.monto);
  const moneda = String(b.moneda || "COP").slice(0, 3).toUpperCase();
  if (!Number.isInteger(leadId) || leadId <= 0) return json({ error: "lead_id inválido" }, 400);
  if (!monto || monto <= 0) return json({ error: "monto inválido" }, 400);
  try {
    await validarMonedaCuenta(MP, moneda);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: lead } = await sb.from("leads").select("id,nombre,negocio,email,whatsapp").eq("id", leadId).maybeSingle();
  if (!lead) return json({ error: "lead no encontrado" }, 404);

  const concepto = String(b.concepto || `condor.ai · página web para ${lead.negocio || lead.nombre || "tu negocio"}`).slice(0, 120);

  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST", headers: { Authorization: "Bearer " + MP, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: concepto, quantity: 1, unit_price: monto, currency_id: moneda }],
        payer: lead.email ? { email: lead.email } : undefined,
        back_urls: { success: `${WEB}/gracias/`, failure: WEB, pending: WEB },
        auto_return: "approved",
        notification_url: webhookUrl(),
        external_reference: `lead:${lead.id}`,          // así el webhook sabe que es un lead y no un cliente del portal
        metadata: { lead_id: lead.id, origen: "campana" },
      }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: "MP: " + JSON.stringify(d).slice(0, 300) }, 502);

    await sb.from("leads").update({ pago_estado: "pendiente", pago_monto: monto, pago_moneda: moneda }).eq("id", lead.id);

    // Opcional: mandarle el link por correo al lead
    let correoEnviado = false;
    const KEY = Deno.env.get("RESEND_API_KEY");
    if (b.enviar_correo && KEY && lead.email) {
      try {
        const nombre = String(lead.nombre || lead.negocio || "").split(" ")[0] || "Hola";
        const re = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ from: EMAIL_FROM, to: [lead.email], subject: "Tu pago de condor.ai 🦅", html: emailCobro(nombre, concepto, monto, moneda, d.init_point) }),
        });
        correoEnviado = re.ok;
      } catch { /* el link igual se devuelve al panel */ }
    }

    return json({ ok: true, init_point: d.init_point, correo_enviado: correoEnviado });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
