// condor.ai · Edge Function "crear-pago"
// Lleva a Mercado Pago un cobro de la tabla `cobros` (21-ago-2026).
// - unico   -> pago de una vez (preference)
// - mensual -> suscripción que se cobra sola (preapproval)
// Devuelve el init_point (URL del checkout de MP) para redirigir al cliente.
//
// EL MONTO SALE DEL COBRO, NO DE LA FICHA NI DEL NAVEGADOR
// Hasta el 21-ago el monto salía de `clientes.setup_monto`/`mensual_monto`, que
// solo daban para un trato por cliente. Ahora cada cobro es una fila propia con
// su monto, su título y su historial de pagos.
//
// Secreto: MP_ACCESS_TOKEN  (de la cuenta Mercado Pago)
// Deploy:  supabase functions deploy crear-pago --project-ref <ref>   (CON verificación de JWT)
// El cliente debe estar logueado en el portal; se identifica por su correo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  portalBase,
  validarMonedaCuenta,
  webhookUrl,
} from "../_shared/mercadopago.ts";

const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "condor.ai <onboarding@resend.dev>";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

// Correo de cobro estético (HTML) con el botón de pago
function emailCobro(cliente: any, tipo: string, monto: number, moneda: string, link: string, detalle = "", montoClp: number | null = null) {
  // Un cobro puntual lleva su propio nombre ("la landing de septiembre"); decirle
  // "el pago inicial (setup)" a un cliente que lleva meses con nosotros confunde.
  const concepto = detalle
    ? detalle
    : tipo === "mensual" ? "tu mensualidad" : "el pago inicial (setup)";
  const titulo = tipo === "mensual" ? "Tu mensualidad de condor.ai" : "Tu pago de condor.ai está listo";
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px -18px rgba(20,20,40,.25)">
      <tr><td style="background:linear-gradient(115deg,#2747ff 0%,#7a5bff 48%,#ff3b4e 100%);padding:34px 32px;text-align:center">
        <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-.5px">condor.ai</div>
        <div style="color:rgba(255,255,255,.9);font-size:14px;margin-top:4px">${titulo}</div>
      </td></tr>
      <tr><td style="padding:34px 32px">
        <p style="font-size:16px;color:#1a1a1a;margin:0 0 14px">Hola${cliente.negocio ? " " + cliente.negocio : ""} 👋</p>
        <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 22px">Ya puedes pagar <b>${concepto}</b> de forma segura con tarjeta. Solo haz clic en el botón:</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 22px"><tr><td style="border-radius:999px;background:linear-gradient(115deg,#2747ff,#7a5bff,#ff3b4e)">
          <a href="${link}" style="display:inline-block;padding:15px 34px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:999px">Pagar ${moneda} ${Number(monto).toLocaleString()} →</a>
        </td></tr></table>
        ${montoClp != null ? `<p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 6px;text-align:center">Mercado Pago te cobrará el equivalente en pesos chilenos: <b>CLP ${Number(montoClp).toLocaleString("es-CL")}</b> al tipo de cambio del momento.</p>` : ""}
        <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 6px;text-align:center">🔒 Pago 100% seguro procesado por Mercado Pago.<br>Nunca vemos ni guardamos los datos de tu tarjeta.</p>
        <p style="font-size:13px;color:#888;line-height:1.6;margin:18px 0 0">¿Dudas? Escríbenos por WhatsApp al +56 9 8898 9824 o entra a <a href="${portalBase()}" style="color:#2747ff">tu portal</a>.</p>
      </td></tr>
      <tr><td style="background:#fafafa;padding:18px 32px;text-align:center;font-size:12px;color:#999">condor.ai · Inteligencia artificial para hacer crecer tu negocio</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function enviarCorreo(to: string, subject: string, html: string) {
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    return r.ok;
  } catch { return false; }
}

// Crea un cobro nuevo y lo numera dentro del cliente.
//
// El número es POR CLIENTE y no se reusa: es lo que identifica al cobro cuando
// no tiene título ("Cobro 3"). Por eso se toma del último y se suma uno, en vez
// de contar las filas — si alguna se anula, contar daría un número repetido.
async function crearCobro(sb: any, cliente: any, tipo: string, titulo: string, monto: number, porQuien: string) {
  const { data: ultimo } = await sb.from("cobros")
    .select("numero").eq("cliente_id", cliente.id)
    .order("numero", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from("cobros").insert({
    cliente_id: cliente.id,
    numero: (Number(ultimo?.numero) || 0) + 1,
    tipo,
    titulo: titulo || null,
    monto: Math.round(monto),
    moneda: cliente.moneda || "CLP",
    estado: "pendiente",
    creado_por: porQuien,
  }).select().single();
  if (error) { console.error("crearCobro:", error.message); return null; }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const MP = Deno.env.get("MP_ACCESS_TOKEN");
  if (!MP) return json({ error: "Falta configurar MP_ACCESS_TOKEN" }, 500);

  let tipo = "setup", clienteId: string | null = null, enviarCorreoFlag = false;
  let forzarNuevo = false;
  // La forma nueva de pedir un cobro: el id de la fila de `cobros`. Todo lo
  // demás (tipo/monto/concepto) es el camino viejo, que se sigue aceptando
  // mientras las pantallas terminan de migrar — ver `resolver el cobro`.
  let cobroId: string | null = null;
  // Solo se usan si quien llama es ADMIN — ver el bloque de más abajo.
  let montoPedido: number | null = null, conceptoPedido = "";
  try {
    const b = await req.json();
    if (b?.cobro_id) cobroId = String(b.cobro_id);
    if (b?.tipo) tipo = b.tipo;
    if (b?.cliente_id) clienteId = b.cliente_id;
    if (b?.enviar_correo) enviarCorreoFlag = true;
    if (b?.forzar_nuevo) forzarNuevo = true;
    if (b?.monto != null) montoPedido = Number(b.monto);
    if (b?.concepto) conceptoPedido = String(b.concepto).slice(0, 200);
  } catch { /* default */ }

  // Identificar al usuario por su sesión (correo)
  const auth = req.headers.get("Authorization") || "";
  const sbUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // V1 · Rate limit: máximo 30 cobros por usuario cada 15 min (anti-abuso)
  try {
    const clave = "pago:" + user.email, ahora = new Date();
    const { data: rl } = await sb.from("rate_limits").select("*").eq("clave", clave).maybeSingle();
    if (rl && rl.reinicia_en && new Date(rl.reinicia_en) > ahora) {
      if ((rl.conteo ?? 0) >= 30) return json({ error: "Demasiados cobros seguidos. Espera unos minutos." }, 429);
      await sb.from("rate_limits").update({ conteo: (rl.conteo ?? 0) + 1 }).eq("clave", clave);
    } else {
      await sb.from("rate_limits").upsert({ clave, conteo: 1, reinicia_en: new Date(ahora.getTime() + 15 * 60000).toISOString() });
    }
  } catch { /* si la tabla no existe aún, no bloqueamos */ }

  const { data: adminRow } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  const esAdmin = !!adminRow;

  // La pantalla nueva envía cliente_id, pero un cobro ya contiene esa relación.
  // Resolverla también acá evita que un link manual dependa de que el cliente
  // tenga correo o de que el navegador repita información que ya está en BD.
  if (esAdmin && !clienteId && cobroId) {
    const { data: cobroObjetivo } = await sb.from("cobros")
      .select("cliente_id").eq("id", cobroId).maybeSingle();
    clienteId = cobroObjetivo?.cliente_id ?? null;
  }

  // Admin puede cobrar a cualquier cliente (cliente_id); el cliente normal, solo a sí mismo
  let cliente: any = null;
  if (esAdmin && clienteId) cliente = (await sb.from("clientes").select("*").eq("id", clienteId).maybeSingle()).data;
  else cliente = (await sb.from("clientes").select("*").eq("email", user.email).maybeSingle()).data;
  if (!cliente) return json({ error: "cliente no encontrado" }, 404);

  // RESOLVER EL COBRO — Y LA PROTECCIÓN DEL MONTO, QUE NO SE RELAJA
  // ---------------------------------------------------------------------------
  // Si el monto pudiera venir del navegador para cualquiera, un cliente con la
  // consola abierta se cobraría $1 a sí mismo. Por eso el monto se lee SIEMPRE
  // de la fila de `cobros`, que solo un admin puede escribir.
  //
  // Un admin sí puede pedir un monto libre — ya puede editar la ficha, no hay
  // nada que proteger ahí—, pero al hacerlo se CREA un cobro. Así queda escrito
  // qué se cobró y por cuánto, en vez de perderse dentro de un parámetro.
  let cobro: any = null;

  if (cobroId) {
    cobro = (await sb.from("cobros").select("*").eq("id", cobroId).maybeSingle()).data;
    if (!cobro) return json({ error: "cobro no encontrado" }, 404);
    // Un cliente logueado solo puede pagar SUS cobros. Sin esta línea, mandando
    // el id de otro cobro se podría generar el link de pago de un tercero.
    if (cobro.cliente_id !== cliente.id) return json({ error: "ese cobro no es de este cliente" }, 403);
  } else {
    // CAMINO VIEJO (las pantallas que todavía llaman con `tipo`). Se resuelve
    // contra `cobros` igual, para que ningún cobro quede fuera del modelo nuevo.
    const esMensual = tipo === "mensual";
    const libre = (esAdmin && montoPedido && montoPedido > 0) ? Math.round(montoPedido) : 0;

    // UN MONTO PEDIDO SIEMPRE CREA UN COBRO, TAMBIÉN EN MENSUAL
    // Si se reusara el cobro mensual que ya existe, pedir una mensualidad
    // distinta cobraría el monto viejo sin decir nada. Y una mensualidad de
    // otro monto no es el mismo trato: es otra suscripción.
    if (libre) {
      cobro = await crearCobro(
        sb, cliente, esMensual ? "mensual" : "unico",
        conceptoPedido || (esMensual ? "Mensualidad" : "Setup"),
        libre, user.email,
      );
      if (!cobro) return json({ error: "no se pudo crear el cobro" }, 500);
    } else if (esMensual) {
      cobro = (await sb.from("cobros").select("*")
        .eq("cliente_id", cliente.id).eq("tipo", "mensual").neq("estado", "cancelada")
        .order("numero", { ascending: false }).limit(1).maybeSingle()).data;
    } else {
      cobro = (await sb.from("cobros").select("*")
        .eq("cliente_id", cliente.id).eq("tipo", "unico").eq("titulo", "Setup")
        .limit(1).maybeSingle()).data;
    }

    // No había cobro que reusar: se crea desde lo que diga la ficha vieja.
    if (!cobro) {
      const montoNuevo = esMensual ? (cliente.mensual_monto || 0) : (cliente.setup_monto || 0);
      if (!montoNuevo || montoNuevo <= 0) return json({ error: "monto no definido para este cobro" }, 400);
      cobro = await crearCobro(
        sb, cliente, esMensual ? "mensual" : "unico",
        esMensual ? "Mensualidad" : "Setup", montoNuevo, user.email,
      );
      if (!cobro) return json({ error: "no se pudo crear el cobro" }, 500);
    }
  }

  if (cobro.estado === "anulado" || cobro.estado === "cancelada")
    return json({ error: "ese cobro está anulado" }, 400);

  const tipoCobro: string = cobro.tipo;
  let monto = Number(cobro.monto) || 0;
  const moneda = cobro.moneda || cliente.moneda || "CLP";
  const concepto = cobro.titulo || cliente.concepto || `condor.ai · cobro ${cobro.numero}`;
  if (tipoCobro !== "mensual") {
    const { data: abonados } = await sb.from("pagos")
      .select("monto")
      .eq("cobro_id", cobro.id)
      .eq("estado", "pagado");
    const recibido = (abonados || []).reduce((s: number, p: any) => s + Number(p.monto || 0), 0);
    monto = Math.max(0, monto - recibido);
  }
  if (monto <= 0) return json({ error: "el cobro no tiene monto" }, 400);

  // COBRAR EN OTRA MONEDA NO ES POSIBLE EN MERCADO PAGO CHILE
  // ---------------------------------------------------------------------------
  // La cuenta de Mercado Pago es chilena (site MLC): solo emite cobros en CLP,
  // la API rechaza cualquier otra moneda. `moneda`/`monto` siguen siendo lo que
  // el cliente ve y lo que se negoció (ej. USD) — acá se convierte a CLP con el
  // tipo de cambio del día (misma tabla que usa la función `tipo-cambio`) y ESO
  // es lo único que se le manda a Mercado Pago.
  let montoCargo = monto;
  let tasaCambioAplicada: number | null = null;
  if (moneda !== "CLP") {
    const { data: tc } = await sb.from("tipos_cambio").select("a_clp").eq("moneda", moneda).maybeSingle();
    const tasa = Number(tc?.a_clp);
    if (!tasa || tasa <= 0) {
      return json({
        error: `No hay tipo de cambio guardado para ${moneda} todavía. Espera a que la función tipo-cambio lo traiga y vuelve a intentar.`,
      }, 400);
    }
    tasaCambioAplicada = tasa;
    montoCargo = Math.round(monto * tasa);
  }

  let cuentaMp: { id: string; sitio: string; moneda: string };
  try {
    cuentaMp = await validarMonedaCuenta(MP, "CLP");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }

  // Cada preferencia nueva deja un intento pendiente. Se reutiliza el enlace
  // mientras siga vigente; solo el equipo puede reemplazar explícitamente un
  // enlace creado con otra cuenta durante una migración.
  if (cobro.link && !forzarNuevo) {
    if (!cobro.mp_cuenta_id || cobro.mp_cuenta_id !== cuentaMp.id) {
      return json({
        error: esAdmin
          ? "este enlace pertenece a la integración anterior; regenéralo en la cuenta actual"
          : "este enlace está siendo renovado por el equipo; inténtalo nuevamente más tarde",
      }, 409);
    }
    if (tipoCobro === "mensual") {
      return json({ init_point: cobro.link, correo_enviado: false, cobro_id: cobro.id, reutilizado: true });
    }
    const { data: intento } = await sb.from("pagos")
      .select("id,monto,link")
      .eq("cobro_id", cobro.id)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (intento && intento.link === cobro.link && Number(intento.monto) === monto) {
      return json({
        init_point: cobro.link,
        correo_enviado: false,
        pago_id: intento.id,
        cobro_id: cobro.id,
        reutilizado: true,
      });
    }
    // Un abono cambió el saldo o el enlace viene de la cuenta antigua.
    // El intento queda como historial no cobrado y se crea uno por el saldo.
    await sb.from("pagos").update({
      estado: "rechazado",
      mp_status_detail: "link_reemplazado_por_saldo",
      mp_ultima_sincronizacion: new Date().toISOString(),
    }).eq("cobro_id", cobro.id).eq("estado", "pendiente");
  }
  if (forzarNuevo && !esAdmin) {
    return json({ error: "solo el equipo puede reemplazar un link" }, 403);
  }
  if (
    forzarNuevo && tipoCobro === "mensual" &&
    cobro.mp_preapproval_id && cobro.estado === "activa"
  ) {
    return json({ error: "cancela la suscripción activa antes de crear otra" }, 409);
  }

  if (forzarNuevo && tipoCobro !== "mensual") {
    await sb.from("pagos").update({
      estado: "rechazado",
      mp_status_detail: "link_reemplazado",
      mp_ultima_sincronizacion: new Date().toISOString(),
    }).eq("cobro_id", cobro.id).eq("estado", "pendiente");
  }

  // AUTORIZAR UNA SUSCRIPCIÓN NO ES UN PAGO
  // ---------------------------------------------------------------------------
  // En un cobro único se registra la fila de `pagos` acá mismo: ese link ES la
  // plata, y su id viaja como `external_reference`.
  //
  // En un mensual NO se registra nada todavía. Lo que se está creando es el
  // permiso para cobrar; los meses llegan después, uno por uno, por
  // `subscription_authorized_payment`. Anotar la autorización como pago dejaría
  // una fila de plata que nunca entró, y además ocuparía el primer mes: el
  // índice único (cobro_id, periodo) rechazaría el cobro real de ese mes.
  //
  // Por eso la suscripción se referencia por el COBRO y no por un pago.
  let pago: { id: string } | null = null;
  if (tipoCobro !== "mensual") {
    const { data, error: ep } = await sb.from("pagos")
      .insert({
        cliente_id: cliente.id, cobro_id: cobro.id, tipo: tipoCobro,
        monto, estado: "pendiente", detalle: concepto,
      })
      .select().single();
    if (ep) return json({ error: "no se pudo registrar el pago: " + ep.message }, 500);
    pago = data;
  }

  // Lo que hay que dejar escrito en el cobro después de hablar con MP. Se junta
  // en un solo update junto con el link — ver el bloque de guardado.
  let datosCobro: Record<string, unknown> = {};

  const referencia = pago ? pago.id : `cobro:${cobro.id}`;
  const retorno = `${portalBase()}/pago/resultado?cobro_id=${encodeURIComponent(cobro.id)}`;

  try {
    let initPoint = "";
    if (tipoCobro === "mensual") {
      // Mercado Pago exige payer_email para crear una suscripción. Los cobros
      // únicos no tienen esta limitación y pueden compartirse completamente a mano.
      if (!cliente.email) {
        return json({
          error: "Mercado Pago exige un correo para crear una suscripción mensual. Agrégalo a la ficha del cliente.",
        }, 400);
      }
      // Suscripción (cobro automático mensual)
      const r = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST", headers: {
          Authorization: "Bearer " + MP,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `condor-suscripcion-${cobro.id}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          reason: concepto + " (mensualidad)",
          external_reference: referencia,
          payer_email: cliente.email,
          back_url: retorno,
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: montoCargo, currency_id: "CLP" },
          status: "pending",
        }),
      });
      const d = await r.json();
      if (!r.ok) return json({ error: "MP: " + JSON.stringify(d).slice(0, 300) }, 502);
      initPoint = d.init_point;
      if (!initPoint) throw new Error("Mercado Pago no devolvió el enlace de suscripción.");

      // GUARDAR EL ID DE LA SUSCRIPCIÓN NO ES OPCIONAL
      // Antes se descartaba, y sin él no había forma de pausar, cancelar ni
      // reconocer los cobros mensuales que MP hace solo: el webhook resuelve
      // cada cobro recurrente por este id. El estado se queda en 'pendiente'
      // hasta que el cliente autorice — decirlo activo antes sería mentir.
      datosCobro = {
        ...(d.id ? { mp_preapproval_id: String(d.id) } : {}),
        mp_cuenta_id: cuentaMp.id,
        mp_checkout_creado_en: new Date().toISOString(),
        ...(tasaCambioAplicada != null ? {
          monto_clp_cobrado: montoCargo,
          tasa_cambio_aplicada: tasaCambioAplicada,
          tasa_cambio_en: new Date().toISOString(),
        } : {}),
      };
    } else {
      // Pago único (setup u otro)
      const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST", headers: {
          Authorization: "Bearer " + MP,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `condor-pago-${pago!.id}`,
        },
        body: JSON.stringify({
          items: [{ title: concepto, quantity: 1, unit_price: montoCargo, currency_id: "CLP" }],
          ...(cliente.email ? { payer: { email: cliente.email } } : {}),
          back_urls: { success: retorno, failure: retorno, pending: retorno },
          auto_return: "approved",
          notification_url: webhookUrl(),
          external_reference: referencia,
          statement_descriptor: "CONDOR AI",
          metadata: { cliente_id: cliente.id, cobro_id: cobro.id, tipo: tipoCobro },
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        await sb.from("pagos").update({
          estado: "rechazado",
          mp_status_detail: "checkout_rechazado_por_mp",
          mp_ultima_sincronizacion: new Date().toISOString(),
        }).eq("id", pago!.id);
        return json({ error: "MP: " + JSON.stringify(d).slice(0, 300) }, 502);
      }
      initPoint = Deno.env.get("MP_ENVIRONMENT") === "sandbox"
        ? (d.sandbox_init_point || d.init_point)
        : d.init_point;
      if (!initPoint) throw new Error("Mercado Pago no devolvió el enlace de pago.");
      datosCobro = {
        mp_preference_id: d.id ? String(d.id) : null,
        mp_cuenta_id: cuentaMp.id,
        mp_checkout_creado_en: new Date().toISOString(),
        ...(tasaCambioAplicada != null ? {
          monto_clp_cobrado: montoCargo,
          tasa_cambio_aplicada: tasaCambioAplicada,
          tasa_cambio_en: new Date().toISOString(),
        } : {}),
      };
    }

    // El link se guarda para poder volver a copiarlo o reenviarlo sin generar
    // un cobro nuevo — si no, cada "no me llegó" dejaría una fila duplicada.
    if (pago) await sb.from("pagos").update({ link: initPoint }).eq("id", pago.id);

    // GUARDAR EL LINK Y LA CUENTA JUNTOS, Y MIRAR SI FALLÓ
    // -------------------------------------------------------------------------
    // Eran dos updates y ninguno revisaba el error. Si el segundo fallaba —por
    // ejemplo con la migración de Mercado Pago v2 sin aplicar, que deja el
    // cobro sin `mp_cuenta_id`— el cobro quedaba con link pero sin cuenta, y a
    // partir de ahí TODA llamada devolvía 409 "este enlace pertenece a la
    // integración anterior". Un cobro trabado para siempre, en silencio.
    //
    // Ahora van en un solo update y el error se cuenta: el link ya existe en
    // Mercado Pago y se devuelve igual (no perder un checkout válido), pero se
    // dice qué quedó sin escribir en vez de descubrirlo al segundo intento.
    const { error: errorCobro } = await sb.from("cobros")
      .update({ ...datosCobro, link: initPoint })
      .eq("id", cobro.id);
    let aviso: string | null = null;
    if (errorCobro) {
      console.error("crear-pago · no se pudo guardar el cobro:", errorCobro.message);
      aviso =
        "El link se creó en Mercado Pago pero no se pudo guardar en el cobro: " +
        errorCobro.message +
        " · Cópialo ahora; revisa las migraciones de Supabase antes de generar otro.";
    }

    // Si el admin pidió enviar el cobro por correo: email bonito al cliente + marcar cobro_enviado_en
    let correoEnviado = false;
    if (enviarCorreoFlag && esAdmin && cliente.email) {
      correoEnviado = await enviarCorreo(
        cliente.email,
        tipoCobro === "mensual" ? "Tu mensualidad de condor.ai" : "Tu pago de condor.ai está listo 🦅",
        emailCobro(cliente, tipoCobro, monto, moneda, initPoint, cobro.titulo || "", tasaCambioAplicada != null ? montoCargo : null),
      );
      if (pago) await sb.from("pagos").update({ cobro_enviado_en: new Date().toISOString() }).eq("id", pago.id);
    }
    return json({
      init_point: initPoint,
      correo_enviado: correoEnviado,
      pago_id: pago ? pago.id : null,
      cobro_id: cobro.id,
      reutilizado: false,
      aviso,
    });
  } catch (e) {
    if (pago) {
      await sb.from("pagos").update({
        estado: "rechazado",
        mp_status_detail: "checkout_no_creado",
        mp_ultima_sincronizacion: new Date().toISOString(),
      }).eq("id", pago.id);
    }
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
