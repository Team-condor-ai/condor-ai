// condor.ai · Edge Function "capturar-lead-plantillas"
//
// La llama la página pública de plantillas gratis de Bárbara
// (productos/barbara/plantillas-gratis) cuando alguien deja su correo para
// descargar. Guarda en la misma tabla `leads` que ya usa el resto del
// embudo de Cóndor (diagnóstico-regalo, Sofia) — no se creó una tabla
// aparte: es el mismo tipo de dato y ya hay un pipeline de seguimiento
// leyendo de ahí.
//
// Deploy: supabase functions deploy capturar-lead-plantillas --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, servicio: "capturar-lead-plantillas" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const email = String(b.email || "").trim().toLowerCase();
  const negocio = String(b.negocio || "").trim().slice(0, 120);
  const whatsapp = String(b.whatsapp || "").trim().slice(0, 30);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "correo inválido" }, 400);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Si ya había dejado el correo antes (volvió por el freebie), no se
  // duplica la fila: se actualiza el negocio/whatsapp si trajo algo nuevo.
  // Duplicar leads ensucia el conteo que usa el equipo de ventas.
  const { data: existente } = await sb.from("leads").select("id").eq("email", email)
    .eq("origen", "barbara-plantillas-gratis").maybeSingle();

  if (existente) {
    await sb.from("leads").update({
      negocio: negocio || undefined, whatsapp: whatsapp || undefined,
    }).eq("id", existente.id);
  } else {
    await sb.from("leads").insert({
      email, negocio: negocio || null, whatsapp: whatsapp || null,
      origen: "barbara-plantillas-gratis",
      problema: "Descargó las plantillas de carrusel gratis de Bárbara",
      estado: "activo",
    });
  }

  return json({ ok: true });
});
