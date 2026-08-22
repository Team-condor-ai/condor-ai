// Verifica el retorno de Checkout Pro contra la API de Mercado Pago.
// Nunca confía en `status=approved` de la URL del navegador.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { conciliarPago } from "../_shared/mercadopago.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const token = Deno.env.get("MP_ACCESS_TOKEN") || "";
  if (!token) return json({ error: "Mercado Pago no está configurado" }, 503);

  const auth = req.headers.get("Authorization") || "";
  const sbUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await sbUsuario.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);

  let paymentId = "";
  try {
    paymentId = String((await req.json())?.payment_id || "").trim();
  } catch { /* validación abajo */ }
  if (!/^\d+$/.test(paymentId)) return json({ error: "payment_id inválido" }, 400);

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) return json({ error: "Mercado Pago no encontró ese pago" }, 404);
  const mp = await respuesta.json();

  const referencia = String(mp?.external_reference || "");
  if (!/^[0-9a-f-]{36}$/i.test(referencia)) {
    return json({ error: "el pago no pertenece al portal de clientes" }, 403);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: pago } = await sb.from("pagos").select("id,cliente_id").eq("id", referencia).maybeSingle();
  if (!pago) return json({ error: "pago local no encontrado" }, 404);

  const [{ data: admin }, { data: cliente }] = await Promise.all([
    sb.from("admins").select("email").eq("email", user.email).maybeSingle(),
    sb.from("clientes").select("email").eq("id", pago.cliente_id).maybeSingle(),
  ]);
  if (!admin && cliente?.email?.toLowerCase() !== user.email.toLowerCase()) {
    return json({ error: "ese pago no pertenece a tu cuenta" }, 403);
  }

  try {
    const resultado = await conciliarPago(sb, mp);
    if (resultado.error) return json({ error: resultado.error, estado: resultado.estado }, 409);
    return json({
      ok: true,
      estado: resultado.estado,
      pago_id: resultado.pago?.id || referencia,
      cobro_id: resultado.pago?.cobro_id || null,
      monto: resultado.pago?.monto || Number(mp.transaction_amount || 0),
      moneda: resultado.cobro?.moneda || mp.currency_id || "CLP",
      detalle: resultado.pago?.detalle || resultado.cobro?.titulo || "Pago condor.ai",
      fecha: resultado.pago?.fecha || null,
    });
  } catch (e) {
    console.error("verificar-pago:", e);
    return json({ error: "no se pudo conciliar el pago" }, 500);
  }
});
