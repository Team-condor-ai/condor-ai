// condor.ai · Edge Function "mp-webhook"
// Recibe las notificaciones de Mercado Pago, marca el pago como pagado,
// actualiza la ficha del cliente Y AVISA POR CORREO (a ti y al cliente).
//
// Secretos: MP_ACCESS_TOKEN, RESEND_API_KEY, EMAIL_FROM (ej: condor.ai <contacto@teamcondorcl.com>)
//           ADMIN_NOTIFY (opcional, correo donde te llegan los avisos; por defecto contacto@teamcondorcl.com)
// Deploy:  supabase functions deploy mp-webhook --project-ref <ref> --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_NOTIFY = Deno.env.get("ADMIN_NOTIFY") || "contacto@teamcondorcl.com";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "condor.ai <onboarding@resend.dev>";

async function enviarCorreo(to: string, subject: string, html: string) {
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
  } catch (e) { console.error("email error:", e); }
}

async function avisarPago(sb: any, clienteId: string, tipo: string) {
  const { data: c } = await sb.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (!c) return;
  const mon = c.moneda || "CLP";
  const monto = (tipo === "mensual" ? c.mensual_monto : c.setup_monto) || 0;
  const concepto = tipo === "mensual" ? "Mensualidad" : "Pago inicial (setup)";
  // Aviso para el equipo
  await enviarCorreo(ADMIN_NOTIFY, `💰 Pago recibido · ${c.negocio || c.email}`,
    `<h2>Nuevo pago confirmado</h2>
     <p><b>Cliente:</b> ${c.negocio || ""} (${c.email})<br>
     <b>Concepto:</b> ${concepto}<br>
     <b>Monto:</b> ${mon} ${Number(monto).toLocaleString()}</p>
     <p>La ficha del cliente ya se actualizó en el portal.</p>`);
  // Aviso/recibo para el cliente
  await enviarCorreo(c.email, `✅ Recibimos tu pago · condor.ai`,
    `<h2>¡Gracias por tu pago! 🎉</h2>
     <p>Confirmamos tu <b>${concepto.toLowerCase()}</b> por <b>${mon} ${Number(monto).toLocaleString()}</b>.</p>
     <p>Puedes ver el estado y descargar tu comprobante en tu portal:</p>
     <p><a href="https://condorai.cl/portal.html">Abrir mi portal →</a></p>
     <p>— El equipo de condor.ai</p>`);
}

// ── SUSCRIPCIÓN DESDE UN LINK COMPARTIDO ────────────────────────────────
//
// Cuando alguien entra por el link de un `preapproval_plan` (Rat.IA y demás),
// NO hay ficha previa ni fila en `pagos`: Mercado Pago solo nos avisa que
// existe una suscripción nueva colgando de un plan nuestro. Acá se le crea la
// fila de suscriptor y se le abre la puerta del portal.
//
// El `mp_preapproval_id` es único en la tabla, así que un reintento de MP —o
// alguien reenviando una notificación real— no puede duplicar al suscriptor.
async function registrarSuscriptor(sb: any, pa: any, preapprovalId: string) {
  const { data: plan } = await sb
    .from("planes_suscripcion").select("*")
    .eq("mp_plan_id", String(pa.preapproval_plan_id)).maybeSingle();
  // Sin plan nuestro no se toca nada: puede ser una suscripción de otra
  // integración en la misma cuenta de Mercado Pago.
  if (!plan) return;

  const email = String(pa.payer_email || "").trim().toLowerCase();
  if (!email) {
    console.warn("suscripción sin correo del pagador, no se registra", preapprovalId);
    return;
  }

  const prox = new Date();
  prox.setMonth(prox.getMonth() + (plan.frecuencia_meses || 1));

  const { data: creado, error } = await sb.from("suscriptores").insert({
    plan_id: plan.id,
    email,
    mp_preapproval_id: preapprovalId,
    estado: "activa",
    monto: plan.monto,
    moneda: plan.moneda,
    ultimo_pago: new Date().toISOString(),
    proximo_cobro: prox.toISOString().slice(0, 10),
  }).select().single();

  // Choque de único = ya estaba registrado. Es el camino normal de un
  // reintento, no un error: se sale sin volver a mandar la bienvenida.
  if (error) {
    if (!String(error.code) .includes("23505")) console.error("alta de suscriptor:", error);
    return;
  }

  const mon = plan.moneda || "CLP";
  await enviarCorreo(email, `✅ Tu suscripción a ${plan.nombre} está activa`,
    `<h2>¡Bienvenido a ${plan.nombre}! 🎉</h2>
     <p>Tu suscripción quedó activa por <b>${mon} ${Number(plan.monto).toLocaleString()}</b> al mes.
     El cobro se hace solo; no tienes que hacer nada cada mes.</p>
     <p>Puedes ver el estado de tu suscripción y tus pagos en tu portal:</p>
     <p><a href="https://condorai.cl/portal.html">Abrir mi portal →</a></p>
     <p style="color:#666;font-size:13px">Entra con este mismo correo (<b>${email}</b>) y te enviamos un código de acceso.</p>
     <p>— El equipo de condor.ai</p>`);

  await enviarCorreo(ADMIN_NOTIFY, `🎉 Suscriptor nuevo · ${plan.nombre}`,
    `<h2>Se suscribió alguien nuevo</h2>
     <p><b>Plan:</b> ${plan.grupo} · ${plan.nombre}<br>
     <b>Correo:</b> ${email}<br>
     <b>Monto:</b> ${mon} ${Number(plan.monto).toLocaleString()}/mes</p>
     <p>Ya aparece en Suscripciones y puede entrar al portal con su correo.</p>`);

  return creado;
}

// Pago de un lead de campaña (external_reference "lead:<id>"): marca el lead y avisa al equipo.
async function marcarLeadPagado(sb: any, leadId: string, mpId: string, p: any) {
  if (!/^\d+$/.test(leadId)) return;
  const monto = Number(p.transaction_amount || 0);
  const moneda = p.currency_id || "COP";
  await sb.from("leads").update({
    pago_estado: "pagado", pago_mp_id: mpId, pago_monto: monto, pago_moneda: moneda, pago_en: new Date().toISOString(),
  }).eq("id", leadId);

  const { data: lead } = await sb.from("leads").select("nombre,negocio,email,whatsapp,campana").eq("id", leadId).maybeSingle();
  await enviarCorreo(ADMIN_NOTIFY, `💰 Pago de campaña · ${lead?.negocio || lead?.nombre || "lead " + leadId}`,
    `<h2>Nuevo pago confirmado (lead de campaña)</h2>
     <p><b>Lead:</b> ${lead?.nombre || ""} ${lead?.negocio ? `· ${lead.negocio}` : ""}<br>
     <b>Contacto:</b> ${lead?.email || "—"} · ${lead?.whatsapp || "—"}<br>
     <b>Campaña:</b> ${lead?.campana || "—"}<br>
     <b>Monto:</b> ${moneda} ${monto.toLocaleString()}</p>
     <p>Ya está marcado como pagado en el módulo de leads. Falta crearle la ficha de cliente para la mensualidad.</p>`);

  if (lead?.email) {
    await enviarCorreo(lead.email, "✅ Recibimos tu pago · condor.ai",
      `<h2>¡Gracias por tu pago! 🎉</h2>
       <p>Confirmamos <b>${moneda} ${monto.toLocaleString()}</b>. Ya empezamos con tu proyecto: en las próximas horas te escribimos para coordinar los contenidos.</p>
       <p>— El equipo de condor.ai</p>`);
  }
}


// ── FIRMA DE MERCADO PAGO ────────────────────────────────────────────────
//
// El webhook es público a la fuerza: MP lo llama sin sesión. Eso NO permite
// falsificar un pago —más abajo se consulta a la API de MP con nuestro token
// y solo se actúa si viene `approved`—, pero sí permitía que cualquiera
// reenviara una notificación real y disparara los correos otra vez.
//
// MP firma cada notificación con HMAC-SHA256 sobre
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// y manda el resultado en la cabecera `x-signature` como `ts=...,v1=...`.
//
// DEGRADA CON AVISO, NO REVIENTA: si `MP_WEBHOOK_SECRET` no está configurado
// se sigue procesando y se deja constancia en el log. Rechazar todo sin el
// secreto dejaría los cobros caídos en silencio, que es peor que el riesgo
// que se está cerrando.
async function firmaValida(req: Request, dataId: string): Promise<boolean> {
  const secreto = Deno.env.get("MP_WEBHOOK_SECRET") || "";
  if (!secreto) {
    console.warn("MP_WEBHOOK_SECRET sin configurar: no se valida la firma.");
    return true;
  }
  const cabecera = req.headers.get("x-signature") || "";
  const reqId = req.headers.get("x-request-id") || "";
  const partes = Object.fromEntries(
    cabecera.split(",").map((t) => t.trim().split("=").map((x) => x.trim())),
  );
  const ts = partes["ts"], v1 = partes["v1"];
  if (!ts || !v1) return false;

  const plantilla = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(plantilla));
  const esperado = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  // Comparación de tiempo constante: un `===` filtra por cuánto tarda en
  // fallar y deja adivinar la firma byte a byte.
  if (esperado.length !== v1.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  const MP = Deno.env.get("MP_ACCESS_TOKEN") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let id = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  try { const b = await req.json(); type = b.type || b.topic || type; id = (b.data && b.data.id) || b.id || id; } catch { /* sin body */ }

  if (id && !(await firmaValida(req, String(id)))) {
    console.warn("firma inválida, se ignora la notificación", id);
    // 200 y no 401 a propósito: MP reintenta ante un error, y reintentar algo
    // que nunca vamos a aceptar solo genera ruido en ambos lados.
    return new Response("ok", { status: 200 });
  }

  try {
    if (type.includes("payment") && id) {
      const r = await fetch("https://api.mercadopago.com/v1/payments/" + id, { headers: { Authorization: "Bearer " + MP } });
      const p = await r.json();
      // Campaña: los cobros de 'pago-lead' vienen como "lead:<id>" (el lead aún no es cliente del portal)
      if (p.status === "approved" && String(p.external_reference || "").startsWith("lead:")) {
        await marcarLeadPagado(sb, String(p.external_reference).slice(5), String(id), p);
      } else if (p.status === "approved" && p.external_reference) {
        // Se lee el estado ANTES de actualizar: si ya estaba pagado, esta es
        // una notificación repetida (MP reintenta, y cualquiera puede
        // reenviarla). Sin esto, cada repetición mandaba de nuevo el correo
        // al cliente y al equipo.
        const { data: antes } = await sb.from("pagos").select("estado").eq("id", p.external_reference).maybeSingle();
        const yaEstaba = antes?.estado === "pagado";
        await sb.from("pagos").update({ estado: "pagado", mp_id: String(id) }).eq("id", p.external_reference);
        const { data: pago } = await sb.from("pagos").select("cliente_id,tipo").eq("id", p.external_reference).maybeSingle();
        if (pago && !yaEstaba) {
          const limpiar = { irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null };
          if (pago.tipo === "setup") await sb.from("clientes").update({ setup_estado: "pagado", ...limpiar }).eq("id", pago.cliente_id);
          else { const prox = new Date(); prox.setMonth(prox.getMonth() + 1); await sb.from("clientes").update({ mensual_estado: "al_dia", proximo_cobro: prox.toISOString().slice(0, 10), ...limpiar }).eq("id", pago.cliente_id); }
          await avisarPago(sb, pago.cliente_id, pago.tipo);
        }
      }
    } else if (type.includes("preapproval") && id) {
      const r = await fetch("https://api.mercadopago.com/preapproval/" + id, { headers: { Authorization: "Bearer " + MP } });
      const pa = await r.json();
      // Suscripción nacida de un link compartido: no tiene `external_reference`
      // nuestro porque nadie la creó desde el portal. Se reconoce por el plan.
      if (pa.status === "authorized" && pa.preapproval_plan_id && !pa.external_reference) {
        await registrarSuscriptor(sb, pa, String(id));
      } else if ((pa.status === "authorized") && pa.external_reference) {
        await sb.from("pagos").update({ estado: "pagado", mp_id: String(id) }).eq("id", pa.external_reference);
        const { data: pago } = await sb.from("pagos").select("cliente_id").eq("id", pa.external_reference).maybeSingle();
        if (pago) {
          const prox = new Date(); prox.setMonth(prox.getMonth() + 1);
          await sb.from("clientes").update({ mensual_estado: "al_dia", proximo_cobro: prox.toISOString().slice(0, 10), irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null }).eq("id", pago.cliente_id);
          await avisarPago(sb, pago.cliente_id, "mensual");
        }
      }
    }
  } catch (e) { console.error("webhook error:", e); }

  return new Response("ok", { status: 200 }); // siempre 200 para que MP no reintente sin fin
});
