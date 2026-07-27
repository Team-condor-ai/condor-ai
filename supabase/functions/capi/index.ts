// condor.ai · Edge Function "capi" — Meta Conversions API (server-side)
// La landing dispara cada evento DOS veces: por el Pixel (navegador) y por acá (servidor),
// ambos con el MISMO event_id. Meta los deduplica y quedan los datos aunque el navegador
// bloquee el Pixel (iOS/adblock) — que es la mitad de los eventos en móvil.
//
// POST { evento, event_id, url, email?, telefono?, nombre?, fbp?, fbc?, valor?, moneda?, extra? }
//
// El PII NUNCA sale en claro: email/teléfono/nombre se mandan hasheados con SHA-256 (lo que exige Meta).
// Secrets: META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE (opcional, solo para probar)
// Deploy: supabase functions deploy capi --no-verify-jwt

const GRAPH = "https://graph.facebook.com/v21.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

// Eventos que usa la campaña. Lista blanca para que nadie meta basura en el pixel.
const EVENTOS = ["PageView", "ViewContent", "Lead", "Schedule", "Contact", "CompleteRegistration", "Purchase"];

// SHA-256 en hex, como pide Meta para el "advanced matching"
async function hash(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Normalización exigida por Meta antes de hashear (si no, el match baja)
const normEmail = (s: string) => s.trim().toLowerCase();
const normTel = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");
const normTexto = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, servicio: "capi" });

  const PIXEL = Deno.env.get("META_PIXEL_ID");
  const TOKEN = Deno.env.get("META_CAPI_TOKEN");
  if (!PIXEL || !TOKEN) return json({ error: "Falta configurar META_PIXEL_ID / META_CAPI_TOKEN" }, 500);

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const evento = String(b.evento || "");
  if (!EVENTOS.includes(evento)) return json({ error: "evento no permitido" }, 400);
  // El event_id es la clave de la deduplicación: tiene que ser el MISMO que usó el Pixel en el navegador.
  const eventId = String(b.event_id || crypto.randomUUID()).slice(0, 100);

  // IP y user-agent reales del visitante: sin esto Meta descarta la mitad de los matches
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ua = req.headers.get("user-agent") || "";

  const user_data: Record<string, unknown> = {};
  if (b.email) user_data.em = [await hash(normEmail(String(b.email)))];
  if (b.telefono) user_data.ph = [await hash(normTel(String(b.telefono)))];
  if (b.nombre) {
    const partes = normTexto(String(b.nombre)).split(" ");
    user_data.fn = [await hash(partes[0])];
    if (partes.length > 1) user_data.ln = [await hash(partes[partes.length - 1])];
  }
  if (b.pais) user_data.country = [await hash(normTexto(String(b.pais)))];
  if (b.fbp) user_data.fbp = String(b.fbp).slice(0, 120);        // cookies del Pixel: van SIN hashear
  if (b.fbc) user_data.fbc = String(b.fbc).slice(0, 200);
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua.slice(0, 500);

  const custom_data: Record<string, unknown> = { ...(typeof b.extra === "object" && b.extra ? b.extra : {}) };
  if (b.valor != null) custom_data.value = Number(b.valor);
  if (b.moneda) custom_data.currency = String(b.moneda).slice(0, 3).toUpperCase();

  const payload: Record<string, unknown> = {
    data: [{
      event_name: evento,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: String(b.url || "").slice(0, 500) || undefined,
      action_source: "website",
      user_data,
      custom_data,
    }],
  };
  const test = Deno.env.get("META_TEST_EVENT_CODE");
  if (test) payload.test_event_code = test;

  try {
    const r = await fetch(`${GRAPH}/${PIXEL}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("CAPI error:", JSON.stringify(j).slice(0, 300));
      return json({ ok: false, error: j?.error?.message || `Meta ${r.status}` }, 502);
    }
    return json({ ok: true, event_id: eventId, recibidos: j.events_received ?? 1 });
  } catch (e) {
    console.error("CAPI fetch:", String(e).slice(0, 200));
    return json({ ok: false, error: "no se pudo contactar a Meta" }, 502);
  }
});
