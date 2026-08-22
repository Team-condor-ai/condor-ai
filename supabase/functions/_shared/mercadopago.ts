/** Utilidades compartidas por el webhook y la verificación de retorno. */

export type ResultadoConciliacion = {
  reconocido: boolean;
  cambio: boolean;
  estado: string;
  pago?: any;
  cobro?: any;
  error?: string;
};

export const portalBase = () =>
  (Deno.env.get("PORTAL_URL") || "https://condorai.cl/acceso").replace(/\/$/, "");

export const webhookUrl = () =>
  `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1/mp-webhook`;

export function estadoPagoInterno(mp: any) {
  const estado = String(mp?.status || "").toLowerCase();
  const devuelto = Number(mp?.transaction_amount_refunded || 0);
  const total = Number(mp?.transaction_amount || 0);
  if (estado === "charged_back") return "contracargo";
  if (estado === "refunded" || (devuelto > 0 && devuelto >= total)) return "reembolsado";
  if (devuelto > 0) return "reembolso_parcial";
  if (estado === "approved") return "pagado";
  if (["rejected", "cancelled"].includes(estado)) return "rechazado";
  return "pendiente";
}

function fechaPago(mp: any) {
  const valor = mp?.date_approved || mp?.date_last_updated || mp?.date_created;
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Convierte una respuesta verificada de `/v1/payments/:id` en estado local.
 * El monto y la moneda se comparan contra el cobro antes de reconocer plata.
 */
export async function conciliarPago(
  sb: any,
  mp: any,
): Promise<ResultadoConciliacion> {
  const referencia = String(mp?.external_reference || "");
  if (!referencia || referencia.startsWith("lead:")) {
    return { reconocido: false, cambio: false, estado: "ignorado" };
  }

  const { data: pago, error: errorPago } = await sb
    .from("pagos")
    .select("*")
    .eq("id", referencia)
    .maybeSingle();
  if (errorPago) throw errorPago;
  if (!pago) return { reconocido: false, cambio: false, estado: "no_encontrado" };

  const { data: cobro, error: errorCobro } = pago.cobro_id
    ? await sb.from("cobros").select("*").eq("id", pago.cobro_id).maybeSingle()
    : { data: null, error: null };
  if (errorCobro) throw errorCobro;

  const esperado = Number(pago.monto || cobro?.monto || 0);
  const recibido = Number(mp?.transaction_amount || 0);
  const monedaEsperada = String(cobro?.moneda || "CLP").toUpperCase();
  const monedaRecibida = String(mp?.currency_id || "").toUpperCase();
  const aprobado = String(mp?.status || "") === "approved";

  if (
    aprobado &&
    (Math.abs(esperado - recibido) > 0.01 || monedaEsperada !== monedaRecibida)
  ) {
    return {
      reconocido: true,
      cambio: false,
      estado: "inconsistente",
      pago,
      cobro,
      error: `Mercado Pago informó ${monedaRecibida} ${recibido}; se esperaban ${monedaEsperada} ${esperado}.`,
    };
  }

  const estado = estadoPagoInterno(mp);
  const comision = Array.isArray(mp?.fee_details)
    ? mp.fee_details.reduce((s: number, f: any) => s + Number(f?.amount || 0), 0)
    : null;
  const neto = Number(mp?.transaction_details?.net_received_amount);
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = {
    estado,
    mp_id: String(mp.id),
    metodo: "Mercado Pago",
    mp_status_detail: mp?.status_detail || null,
    mp_payment_type: mp?.payment_type_id || null,
    mp_payment_method_id: mp?.payment_method_id || null,
    mp_fee_amount: comision,
    mp_net_received: Number.isFinite(neto) ? neto : null,
    mp_refunded_amount: Number(mp?.transaction_amount_refunded || 0),
    mp_ultima_sincronizacion: ahora,
  };
  if (estado === "pagado" && !pago.fecha) cambios.fecha = fechaPago(mp);

  const { data: actualizado, error: errorActualizar } = await sb
    .from("pagos")
    .update(cambios)
    .eq("id", pago.id)
    .select("*")
    .single();
  if (errorActualizar) throw errorActualizar;

  if (cobro) {
    const cambioCobro: Record<string, unknown> = { mp_ultima_sincronizacion: ahora };
    if (cobro.tipo === "unico") {
      if (estado === "pagado") cambioCobro.estado = "pagado";
      else if (["reembolsado", "contracargo"].includes(estado)) cambioCobro.estado = "pendiente";
    }
    await sb.from("cobros").update(cambioCobro).eq("id", cobro.id);
  }

  if (estado === "pagado") {
    const limpiar = { irresponsable: false, dias_sin_pagar: 0, alerta_admin_en: null };
    if (pago.tipo === "setup") {
      await sb.from("clientes").update({ setup_estado: "pagado", ...limpiar }).eq("id", pago.cliente_id);
    } else {
      await sb.from("clientes").update(limpiar).eq("id", pago.cliente_id);
    }
  }

  return {
    reconocido: true,
    cambio: pago.estado !== estado,
    estado,
    pago: actualizado,
    cobro,
  };
}

const MONEDAS_SITIO: Record<string, string> = {
  MLA: "ARS",
  MLB: "BRL",
  MLC: "CLP",
  MCO: "COP",
  MLM: "MXN",
  MPE: "PEN",
  MLU: "UYU",
};

/** Detecta la moneda admitida por la cuenta en vez de asumir el país. */
export async function monedaDeCuenta(token: string) {
  const r = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`No se pudo validar la cuenta de Mercado Pago (${r.status}).`);
  const usuario = await r.json();
  return {
    id: String(usuario?.id || ""),
    sitio: String(usuario?.site_id || ""),
    moneda: MONEDAS_SITIO[String(usuario?.site_id || "")] || "",
  };
}

export async function validarMonedaCuenta(token: string, moneda: string) {
  const cuenta = await monedaDeCuenta(token);
  if (cuenta.moneda && cuenta.moneda !== moneda.toUpperCase()) {
    throw new Error(
      `La cuenta de Mercado Pago ${cuenta.sitio} cobra en ${cuenta.moneda}; este cobro está en ${moneda}.`,
    );
  }
  return cuenta;
}
