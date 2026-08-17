// condor.ai · Edge Function "crear-plan-suscripcion"
// Crea un PLAN de suscripción en Mercado Pago y guarda su link compartible.
//
// EN QUÉ SE DIFERENCIA DE `crear-pago`
// ---------------------------------------------------------------------------
// `crear-pago` genera un cobro para UNA persona: hay que saber su correo antes
// y tener su ficha creada. Acá se crea un `preapproval_plan`, que devuelve un
// `init_point` reutilizable: el mismo link sirve para cualquiera, y cada quien
// genera su propia suscripción al pagar. Es lo que permite vender Rat.IA sin
// dar de alta a cada suscriptor a mano.
//
// Secreto: MP_ACCESS_TOKEN
// Deploy:  supabase functions deploy crear-plan-suscripcion --project-ref <ref>
//          (CON verificación de JWT: solo admins)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VUELTA = "https://condorai.cl/portal.html";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const MP = Deno.env.get("MP_ACCESS_TOKEN");
  if (!MP) return json({ error: "Falta configurar MP_ACCESS_TOKEN" }, 500);

  // 1) Solo el equipo
  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ error: "sin sesión" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ error: "solo el equipo" }, 403);

  // 2) Datos del plan
  let grupo = "General", nombre = "", descripcion = "", monto = 0, moneda = "CLP", frecuencia = 1;
  try {
    const b = await req.json();
    grupo = String(b?.grupo ?? "General").trim().slice(0, 60) || "General";
    nombre = String(b?.nombre ?? "").trim().slice(0, 120);
    descripcion = String(b?.descripcion ?? "").trim().slice(0, 300);
    monto = Math.round(Number(b?.monto ?? 0));
    moneda = String(b?.moneda ?? "CLP").trim().toUpperCase().slice(0, 3);
    frecuencia = Math.max(1, Math.round(Number(b?.frecuencia_meses ?? 1)));
  } catch {
    return json({ error: "cuerpo inválido" }, 400);
  }
  if (!nombre) return json({ error: "falta el nombre del plan" }, 400);
  if (!monto || monto <= 0) return json({ error: "el monto tiene que ser mayor que cero" }, 400);

  try {
    const r = await fetch("https://api.mercadopago.com/preapproval_plan", {
      method: "POST",
      headers: { Authorization: "Bearer " + MP, "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: nombre,
        back_url: VUELTA,
        auto_recurring: {
          frequency: frecuencia,
          frequency_type: "months",
          transaction_amount: monto,
          currency_id: moneda,
        },
      }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: "MP: " + JSON.stringify(d).slice(0, 300) }, 502);

    // El plan solo sirve si tiene link: sin `init_point` no hay nada que
    // compartir, y guardarlo igual dejaría una fila que parece funcionar.
    if (!d.init_point) {
      return json({ error: "Mercado Pago creó el plan pero no devolvió un link." }, 502);
    }

    const { data: fila, error: errFila } = await sb.from("planes_suscripcion").insert({
      grupo, nombre, descripcion: descripcion || null,
      monto, moneda, frecuencia_meses: frecuencia,
      mp_plan_id: String(d.id), init_point: d.init_point,
    }).select().single();
    if (errFila) return json({ error: "plan creado en MP pero no se pudo guardar: " + errFila.message }, 500);

    return json({ ok: true, plan: fila });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
