// condor.ai · Edge Function "sugerir-producto"
// Propone un borrador de ficha de producto/servicio (descripción, features,
// precio sugerido) a partir de un nombre + contexto corto que escribe el
// staff — ej. "Bárbara, asistente de Instagram" → descripción comercial +
// características + precio de referencia.
//
// NUNCA GUARDA NADA — solo propone
// ---------------------------------------------------------------------------
// El staff revisa y edita la propuesta en `EditorProducto.tsx` antes de
// apretar "Guardar". Mismo patrón que `barbara-sugerir-marca`.
//
// Secreto:  ANTHROPIC_API_KEY
// Deploy:   supabase functions deploy sugerir-producto --project-ref <ref>
//           (CON verificación de JWT: solo admins autenticados)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pedido explícito de Joaquín (17-ago-2026): Sonnet acá, no Opus — es una
// redacción corta a partir de lo que el staff ya escribió, no investigación.
const MODEL = "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const AK = Deno.env.get("ANTHROPIC_API_KEY");
  if (!AK) return json({ ok: false, error: "ANTHROPIC_API_KEY sin configurar" }, 500);

  // 1) Quién llama
  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ ok: false, error: "sin sesión" }, 401);

  // 2) ¿Es del equipo? Con service_role para saltar RLS, igual que
  //    `barbara-sugerir-marca` — un cliente autenticado NO puede usar esto.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb
    .from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ ok: false, error: "solo el equipo" }, 403);

  // 3) Qué producto
  let nombre = "", contexto = "";
  try {
    const b = await req.json();
    nombre = String(b?.nombre ?? "").trim().slice(0, 160);
    contexto = String(b?.contexto ?? "").trim().slice(0, 600);
  } catch {
    return json({ ok: false, error: "cuerpo inválido" }, 400);
  }
  if (!nombre) return json({ ok: false, error: "falta el nombre del producto" }, 400);

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      descripcion: {
        type: "string",
        description: "1-2 frases explicando qué es el producto y a quién le sirve, tono comercial directo.",
      },
      caracteristicas: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
        description: "Hasta 6 características o beneficios concretos, frases cortas.",
      },
      precio_setup_sugerido: {
        type: "number",
        description: "Precio de instalación/configuración inicial sugerido, en pesos chilenos (CLP), 0 si no aplica.",
      },
      precio_mensual_sugerido: {
        type: "number",
        description: "Precio mensual sugerido en CLP, 0 si es pago único.",
      },
    },
    required: ["descripcion", "caracteristicas", "precio_setup_sugerido", "precio_mensual_sugerido"],
  };

  const userMsg = contexto
    ? `Producto: ${nombre}\nContexto que da el equipo: ${contexto}\n\nRedacta una ficha de producto para el catálogo interno de Cóndor AI (agencia de marketing/IA en Chile).`
    : `Producto: ${nombre}\n\nNo hay más contexto que el nombre — redacta una ficha de producto razonable para el catálogo interno de Cóndor AI (agencia de marketing/IA en Chile), coherente con lo que el nombre sugiere.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": AK,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system:
          "Eres parte del equipo comercial de Cóndor AI, una agencia de marketing digital e IA en Chile. Te dan el nombre de un producto/servicio nuevo del catálogo (a veces con contexto) y redactas una ficha: descripción comercial breve, hasta 6 características, y precios sugeridos en pesos chilenos (CLP) coherentes con los precios de mercado de la agencia (setup entre $0 y $400.000, mensual entre $0 y $150.000, según la complejidad). Es SOLO una propuesta que un humano va a revisar y editar antes de guardar — no inventes certezas sobre márgenes o costos reales. Responde SOLO con el JSON pedido.",
        output_config: { format: { type: "json_schema", schema } },
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!resp.ok) {
      return json({ ok: false, error: "IA no disponible", detalle: (await resp.text()).slice(0, 300) }, 502);
    }
    const data = await resp.json();
    const texto = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    if (!texto) return json({ ok: false, error: "la IA no devolvió una propuesta de texto" }, 502);

    const propuesta = JSON.parse(texto);
    return json({ ok: true, propuesta });
  } catch (e) {
    return json({ ok: false, error: "Fallo generando la propuesta", detalle: String(e).slice(0, 200) }, 500);
  }
});
