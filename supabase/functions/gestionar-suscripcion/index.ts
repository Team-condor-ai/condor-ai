// Pausa, reanuda o cancela una suscripción tanto en Mercado Pago como en Condor.
// Solo el equipo puede ejecutar esta operación financiera.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const ESTADOS = {
  pausar: { mp: "paused", local: "pausada" },
  reanudar: { mp: "authorized", local: "activa" },
  cancelar: { mp: "canceled", local: "cancelada" },
} as const;

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

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ error: "solo el equipo puede gestionar suscripciones" }, 403);

  let cobroId = "", accion = "";
  try {
    const body = await req.json();
    cobroId = String(body?.cobro_id || "");
    accion = String(body?.accion || "");
  } catch { /* validación abajo */ }
  const objetivo = ESTADOS[accion as keyof typeof ESTADOS];
  if (!cobroId || !objetivo) return json({ error: "solicitud inválida" }, 400);

  const { data: cobro } = await sb.from("cobros").select("*").eq("id", cobroId).maybeSingle();
  if (!cobro || cobro.tipo !== "mensual") return json({ error: "suscripción no encontrada" }, 404);

  // Si todavía no llegó a Mercado Pago, cancelar el borrador es solo local.
  if (!cobro.mp_preapproval_id) {
    if (accion !== "cancelar") return json({ error: "la suscripción todavía no fue autorizada" }, 409);
    await sb.from("cobros").update({ estado: "cancelada", link: null }).eq("id", cobro.id);
    return json({ ok: true, estado: "cancelada", local: true });
  }

  const respuesta = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(cobro.mp_preapproval_id)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `condor-${accion}-${cobro.id}`,
      },
      body: JSON.stringify({ status: objetivo.mp }),
    },
  );
  const mp = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    console.error("gestionar-suscripcion:", respuesta.status, mp);
    return json({ error: mp?.message || "Mercado Pago rechazó el cambio" }, 502);
  }

  const cambios: Record<string, unknown> = {
    estado: objetivo.local,
    mp_ultima_sincronizacion: new Date().toISOString(),
  };
  if (accion === "cancelar") cambios.link = null;
  await sb.from("cobros").update(cambios).eq("id", cobro.id);
  return json({ ok: true, estado: objetivo.local, mp_status: mp?.status || objetivo.mp });
});
