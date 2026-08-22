// condor.ai · Edge Function "mp-webhook"
// Recibe las notificaciones de Mercado Pago, marca el pago como pagado,
// actualiza la ficha del cliente Y AVISA POR CORREO (a ti y al cliente).
//
// Secretos: MP_ACCESS_TOKEN, RESEND_API_KEY, EMAIL_FROM (ej: condor.ai <contacto@teamcondorcl.com>)
//           ADMIN_NOTIFY (opcional, correo donde te llegan los avisos; por defecto contacto@teamcondorcl.com)
// Deploy:  supabase functions deploy mp-webhook --project-ref <ref> --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { conciliarPago, portalBase } from "../_shared/mercadopago.ts";

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

const escapar = (valor: unknown) => String(valor ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

async function avisarPago(sb: any, pago: any, cobro?: any) {
  const { data: c } = await sb.from("clientes").select("*").eq("id", pago.cliente_id).maybeSingle();
  if (!c) return;
  const mon = cobro?.moneda || c.moneda || "CLP";
  const monto = Number(pago.monto || cobro?.monto || 0);
  const concepto = pago.detalle || cobro?.titulo || (pago.tipo === "mensual" ? "Mensualidad" : "Pago condor.ai");
  const negocio = escapar(c.negocio || c.email);
  const correo = escapar(c.email);
  const conceptoSeguro = escapar(concepto);
  // Aviso para el equipo
  await enviarCorreo(ADMIN_NOTIFY, `💰 Pago recibido · ${c.negocio || c.email}`,
    `<h2>Nuevo pago confirmado</h2>
     <p><b>Cliente:</b> ${negocio} (${correo})<br>
     <b>Concepto:</b> ${conceptoSeguro}<br>
     <b>Monto:</b> ${mon} ${Number(monto).toLocaleString()}</p>
     <p>La ficha del cliente ya se actualizó en el portal.</p>`);
  // Aviso/recibo para el cliente
  await enviarCorreo(c.email, `✅ Recibimos tu pago · condor.ai`,
    `<h2>¡Gracias por tu pago! 🎉</h2>
     <p>Confirmamos <b>${conceptoSeguro}</b> por <b>${mon} ${Number(monto).toLocaleString()}</b>.</p>
     <p>Puedes ver el estado y descargar tu comprobante en tu portal:</p>
     <p><a href="${portalBase()}">Abrir mi portal →</a></p>
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
     <p><a href="${portalBase()}">Abrir mi portal →</a></p>
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


// Deja el cobro al día tras un pago aprobado.
//
// PUENTE TEMPORAL HACIA LAS COLUMNAS VIEJAS
// ---------------------------------------------------------------------------
// `clientes.setup_estado` / `mensual_estado` / `proximo_cobro` quedaron sin uso
// el 21-ago (ahora el estado vive en `cobros`), pero varias pantallas del
// portal todavía las leen. Se siguen escribiendo para que no muestren un estado
// viejo. Este bloque se borra junto con la migración que elimina esas columnas.
async function marcarCobroPagado(sb: any, pago: any) {
  const limpiar = { irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null };
  const prox = new Date(); prox.setMonth(prox.getMonth() + 1);
  const proxISO = prox.toISOString().slice(0, 10);

  let esMensual = pago.tipo === "mensual";

  if (pago.cobro_id) {
    const { data: cobro } = await sb.from("cobros").select("tipo").eq("id", pago.cobro_id).maybeSingle();
    if (cobro) esMensual = cobro.tipo === "mensual";
    // Un mensual no se "paga": queda activo y corre su próxima fecha. Un único
    // sí se cierra — es su único pago.
    await sb.from("cobros")
      .update(esMensual ? { estado: "activa", proximo_cobro: proxISO } : { estado: "pagado" })
      .eq("id", pago.cobro_id);
  }

  if (esMensual) {
    await sb.from("clientes")
      .update({ mensual_estado: "al_dia", proximo_cobro: proxISO, ...limpiar })
      .eq("id", pago.cliente_id);
  } else if (pago.tipo === "setup") {
    await sb.from("clientes").update({ setup_estado: "pagado", ...limpiar }).eq("id", pago.cliente_id);
  } else {
    // Un cobro suelto nunca tuvo columna en la ficha; solo levanta la mora.
    await sb.from("clientes").update(limpiar).eq("id", pago.cliente_id);
  }
}

// El cliente autorizó la suscripción: el cobro queda activo y se guarda el id
// de Mercado Pago. AUTORIZAR NO ES COBRAR — no se registra ningún pago acá; los
// meses entran uno por uno por `subscription_authorized_payment`.
async function activarCobroMensual(sb: any, cobroId: string, preapprovalId: string) {
  const { data: cobro } = await sb.from("cobros").select("*").eq("id", cobroId).maybeSingle();
  if (!cobro) { console.warn("preapproval sin cobro local:", cobroId); return; }
  // Reintento de MP sobre algo que ya estaba activo: no hay nada que hacer.
  if (cobro.estado === "activa" && cobro.mp_preapproval_id === preapprovalId) return;

  const prox = cobro.proximo_cobro || new Date().toISOString().slice(0, 10);
  await sb.from("cobros").update({
    estado: "activa", mp_preapproval_id: preapprovalId, proximo_cobro: prox,
  }).eq("id", cobroId);

  // Puente temporal — ver la nota de `marcarCobroPagado`.
  await sb.from("clientes").update({
    mensual_estado: "al_dia", proximo_cobro: prox,
    irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null,
  }).eq("id", cobro.cliente_id);
}

// UN PAGO POR MES — Y HASTA HOY NO SE GUARDABA NINGUNO
// ---------------------------------------------------------------------------
// Mercado Pago avisa cada cobro de una suscripción con el tema
// `subscription_authorized_payment`. El webhook no lo manejaba: marcaba pagada
// la fila de la AUTORIZACIÓN y nada más. O sea que una suscripción de un año
// dejaba 1 pago registrado en vez de 12, y el historial del cliente mostraba un
// solo cobro por meses de plata que sí se había cobrado.
async function registrarCobroMensual(sb: any, apId: string, MP: string) {
  const r = await fetch("https://api.mercadopago.com/authorized_payments/" + apId, {
    headers: { Authorization: "Bearer " + MP },
  });
  if (!r.ok) { console.error("authorized_payment no encontrado:", apId); return; }
  const ap = await r.json();

  // Solo cuenta el que de verdad se cobró. `scheduled` y `recycling` son
  // intentos: registrarlos daría por pagado un mes que todavía no entró.
  if (ap.status !== "processed") return;

  // Según la versión del recurso, `payment` puede venir expandido o ser solo
  // el identificador. Consultamos el pago real cuando tenemos ese ID: así no
  // damos una mensualidad por pagada usando únicamente el estado del débito y
  // además conservamos comisión, monto neto, método y detalle del rechazo.
  const paymentRef = ap.payment;
  const paymentId = typeof paymentRef === "object" && paymentRef !== null
    ? paymentRef.id
    : paymentRef;
  let payment = typeof paymentRef === "object" && paymentRef !== null
    ? paymentRef
    : null;

  if (paymentId) {
    const paymentResponse = await fetch(
      "https://api.mercadopago.com/v1/payments/" + paymentId,
      { headers: { Authorization: "Bearer " + MP } },
    );
    if (!paymentResponse.ok) {
      throw new Error(
        `Mercado Pago respondió ${paymentResponse.status} al consultar el pago recurrente ${paymentId}`,
      );
    }
    payment = await paymentResponse.json();
  }

  if (payment?.status && payment.status !== "approved") return;

  const preapprovalId = String(ap.preapproval_id || "");
  if (!preapprovalId) return;

  const { data: cobro } = await sb.from("cobros").select("*")
    .eq("mp_preapproval_id", preapprovalId).maybeSingle();
  if (!cobro) { console.warn("cobro mensual sin fila local:", preapprovalId); return; }

  // El período marca QUÉ MES se cobró. `debit_date` es la fecha que MP tenía
  // agendada; si no viene, hoy. El índice único (cobro_id, periodo) hace que un
  // reintento de MP no deje dos filas del mismo mes.
  const base = ap.debit_date ? new Date(ap.debit_date) : new Date();
  const periodo = base.toISOString().slice(0, 8) + "01";

  const monto = Math.round(
    Number(payment?.transaction_amount) ||
      Number(ap.transaction_amount) ||
      Number(cobro.monto) ||
      0,
  );
  const moneda = String(payment?.currency_id || ap.currency_id || cobro.moneda || "CLP");
  if (String(cobro.moneda || "CLP").toUpperCase() !== moneda.toUpperCase()) {
    throw new Error(
      `Moneda inesperada en la mensualidad ${apId}: ${moneda}`,
    );
  }
  const comision = Array.isArray(payment?.fee_details)
    ? payment.fee_details.reduce(
      (total: number, fee: { amount?: number }) => total + Number(fee.amount || 0),
      0,
    )
    : 0;
  const neto = Number(payment?.transaction_details?.net_received_amount) ||
    Math.max(0, monto - comision);

  const { data: pagoMensual, error } = await sb.from("pagos").insert({
    cliente_id: cobro.cliente_id,
    cobro_id: cobro.id,
    tipo: "mensual",
    monto,
    estado: "pagado",
    mp_id: String(paymentId || apId),
    detalle: cobro.titulo || "Mensualidad",
    fecha: base.toISOString().slice(0, 10),
    metodo: "Mercado Pago",
    periodo,
    mp_status_detail: payment?.status_detail || null,
    mp_payment_type: payment?.payment_type_id || null,
    mp_payment_method_id: payment?.payment_method_id || null,
    mp_fee_amount: comision,
    mp_net_received: neto,
    mp_ultima_sincronizacion: new Date().toISOString(),
  }).select("*").single();

  // 23505 = ese mes ya estaba registrado. Es el camino normal de un reintento
  // de MP, no un error: se sale sin volver a avisar.
  if (error) {
    if (!String(error.code).includes("23505")) console.error("cobro mensual:", error.message);
    return;
  }

  const prox = new Date(base); prox.setMonth(prox.getMonth() + 1);
  const proxISO = prox.toISOString().slice(0, 10);
  await sb.from("cobros").update({ estado: "activa", proximo_cobro: proxISO }).eq("id", cobro.id);
  // Puente temporal — ver la nota de `marcarCobroPagado`.
  await sb.from("clientes").update({
    mensual_estado: "al_dia", proximo_cobro: proxISO,
    irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null,
  }).eq("id", cobro.cliente_id);

  if (pagoMensual) {
    await avisarPago(sb, pagoMensual, cobro);
    await sb.from("pagos").update({ mp_notificado_en: new Date().toISOString() }).eq("id", pagoMensual.id);
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
async function firmaValida(req: Request, dataId: string): Promise<boolean> {
  const secreto = Deno.env.get("MP_WEBHOOK_SECRET") || "";
  if (!secreto) {
    console.error("MP_WEBHOOK_SECRET sin configurar: webhook rechazado.");
    return false;
  }
  const cabecera = req.headers.get("x-signature") || "";
  const reqId = req.headers.get("x-request-id") || "";
  const partes = Object.fromEntries(
    cabecera.split(",").map((t) => t.trim().split("=").map((x) => x.trim())),
  );
  const ts = partes["ts"], v1 = partes["v1"];
  if (!ts || !v1) return false;

  const plantilla = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`;
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
  if (!MP) return new Response("Mercado Pago no configurado", { status: 503 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let id = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  try { const b = await req.json(); type = b.type || b.topic || type; id = (b.data && b.data.id) || b.id || id; } catch { /* sin body */ }

  if (id && !(await firmaValida(req, String(id)))) {
    console.warn("firma inválida, se ignora la notificación", id);
    return new Response("firma inválida", { status: 401 });
  }

  let eventoId: number | null = null;
  if (id) {
    try {
      const { data: evento } = await sb.from("mercadopago_eventos").insert({
        tipo: type || "desconocido",
        recurso_id: String(id),
        accion: url.searchParams.get("action"),
        request_id: req.headers.get("x-request-id"),
        firma_valida: true,
      }).select("id").single();
      eventoId = evento?.id ?? null;
    } catch { /* la integración sigue si la migración de auditoría aún no llegó */ }
  }

  try {
    // ⚠️ EL ORDEN DE ESTAS RAMAS NO ES INDIFERENTE
    // El tema del cobro mensual es `subscription_authorized_payment`, e
    // `includes("payment")` también lo captura. Si la rama de pagos fuera
    // primero, cada cobro mensual entraría ahí, buscaría un pago por un
    // `external_reference` que no existe y se perdería en silencio — que es
    // exactamente el bug que esto viene a cerrar.
    if (type.includes("authorized_payment") && id) {
      await registrarCobroMensual(sb, String(id), MP);
    } else if (type.includes("payment") && id) {
      const r = await fetch("https://api.mercadopago.com/v1/payments/" + id, { headers: { Authorization: "Bearer " + MP } });
      if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status} al consultar el pago ${id}`);
      const p = await r.json();
      // Campaña: los cobros de 'pago-lead' vienen como "lead:<id>" (el lead aún no es cliente del portal)
      if (p.status === "approved" && String(p.external_reference || "").startsWith("lead:")) {
        await marcarLeadPagado(sb, String(p.external_reference).slice(5), String(id), p);
      } else if (p.external_reference) {
        const resultado = await conciliarPago(sb, p);
        if (resultado.error) throw new Error(resultado.error);
        if (
          resultado.estado === "pagado" && resultado.pago &&
          !resultado.pago.mp_notificado_en
        ) {
          await avisarPago(sb, resultado.pago, resultado.cobro);
          await sb.from("pagos").update({ mp_notificado_en: new Date().toISOString() })
            .eq("id", resultado.pago.id);
        }
      }
    } else if (type.includes("preapproval") && id) {
      const r = await fetch("https://api.mercadopago.com/preapproval/" + id, { headers: { Authorization: "Bearer " + MP } });
      const pa = await r.json();
      // Suscripción nacida de un link compartido: no tiene `external_reference`
      // nuestro porque nadie la creó desde el portal. Se reconoce por el plan.
      if (pa.status === "authorized" && pa.preapproval_plan_id && !pa.external_reference) {
        await registrarSuscriptor(sb, pa, String(id));
      } else if (pa.status === "authorized" && String(pa.external_reference || "").startsWith("cobro:")) {
        // FORMA NUEVA (21-ago): la suscripción referencia al COBRO, no a un pago.
        await activarCobroMensual(sb, String(pa.external_reference).slice(6), String(id));
      } else if ((pa.status === "authorized") && pa.external_reference) {
        // FORMA VIEJA: `external_reference` era el id de un pago que `crear-pago`
        // creaba para la autorización. Se conserva por los links que ya estén en
        // manos de un cliente; se puede borrar cuando no quede ninguno vivo.
        await sb.from("pagos").update({ estado: "pagado", mp_id: String(id) }).eq("id", pa.external_reference);
        const { data: pago } = await sb.from("pagos").select("*").eq("id", pa.external_reference).maybeSingle();
        if (pago) {
          // Recién acá se guarda el id de la suscripción si `crear-pago` no
          // alcanzó a hacerlo: sin él, ningún cobro mensual futuro se puede
          // asociar a este cobro.
          if (pago.cobro_id) {
            await sb.from("cobros")
              .update({ mp_preapproval_id: String(id) })
              .eq("id", pago.cobro_id).is("mp_preapproval_id", null);
          }
          await marcarCobroPagado(sb, pago);
          const { data: cobro } = pago.cobro_id
            ? await sb.from("cobros").select("*").eq("id", pago.cobro_id).maybeSingle()
            : { data: null };
          await avisarPago(sb, pago, cobro);
          await sb.from("pagos").update({ mp_notificado_en: new Date().toISOString() }).eq("id", pago.id);
        }
      } else if (pa.status === "cancelled" || pa.status === "canceled") {
        // Suscripción dada de baja en Mercado Pago: el cobro deja de estar
        // activo, o el portal seguiría diciendo que cobra todos los meses.
        // Se resuelve por el id de MP, que sirve para las dos formas de
        // referencia; y si no, se cae a la referencia vieja.
        const ref = String(pa.external_reference || "");
        let cobroId = "";
        const { data: porMp } = await sb.from("cobros").select("id").eq("mp_preapproval_id", String(id)).maybeSingle();
        if (porMp) cobroId = porMp.id;
        else if (ref.startsWith("cobro:")) cobroId = ref.slice(6);
        else if (ref) {
          const { data: pago } = await sb.from("pagos").select("cobro_id").eq("id", ref).maybeSingle();
          if (pago?.cobro_id) cobroId = pago.cobro_id;
        }
        if (cobroId) await sb.from("cobros").update({ estado: "cancelada" }).eq("id", cobroId);
      }
    }
    if (eventoId) {
      await sb.from("mercadopago_eventos").update({
        procesado: true,
        resultado: "ok",
        procesado_en: new Date().toISOString(),
      }).eq("id", eventoId);
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("webhook error:", mensaje);
    if (eventoId) {
      await sb.from("mercadopago_eventos").update({
        procesado: false,
        resultado: mensaje.slice(0, 500),
        procesado_en: new Date().toISOString(),
      }).eq("id", eventoId);
    }
    // Un error transitorio sí debe reintentarse; un 200 escondería pagos caídos.
    return new Response("error al procesar", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
