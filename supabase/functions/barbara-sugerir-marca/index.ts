// condor.ai · Edge Function "barbara-sugerir-marca"
// Propone un borrador de brand book (paleta, tipografía, detalles) para un
// cliente de Bárbara, usando Claude con la herramienta de búsqueda web para
// leer su presencia pública (Instagram / sitio web) si el staff pasó un link.
//
// NUNCA GUARDA NADA — solo propone
// ---------------------------------------------------------------------------
// El staff revisa y edita la propuesta en `BrandBookEditor.tsx` antes de
// apretar "Guardar". Esta función es de solo lectura sobre la web pública;
// no toca `barbara_brand_book` ni ninguna otra tabla.
//
// Secreto:  ANTHROPIC_API_KEY
// Deploy:   supabase functions deploy barbara-sugerir-marca --project-ref <ref>
//           (CON verificación de JWT: solo admins autenticados, mismo
//           patrón que `enviar-correos`)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-opus-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
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
  //    `enviar-correos` — un cliente autenticado NO puede usar esto.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb
    .from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ ok: false, error: "solo el equipo" }, 403);

  // 3) Qué negocio
  let negocio = "", rubro = "", link = "";
  try {
    const b = await req.json();
    negocio = String(b?.negocio ?? "").trim().slice(0, 160);
    rubro = String(b?.rubro ?? "").trim().slice(0, 120);
    link = String(b?.link ?? "").trim().slice(0, 300);
  } catch {
    return json({ ok: false, error: "cuerpo inválido" }, 400);
  }
  if (!negocio) return json({ ok: false, error: "falta el nombre del negocio" }, 400);

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      paleta_colores: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            hex: { type: "string", description: "Color en hex, ej. #C6FF00" },
            uso: { type: "string", description: "Ej: acento, fondo, texto, secundario" },
          },
          required: ["hex", "uso"],
        },
        description: "Hasta 6 colores de marca.",
      },
      tipografia: { type: "string", description: "Sugerencia de tipografía(s) para títulos y texto." },
      detalles: {
        type: "string",
        description: "Notas de estilo: qué transmite la marca, qué evitar, referencias visuales encontradas.",
      },
    },
    required: ["paleta_colores", "tipografia", "detalles"],
  };

  const userMsg = link
    ? `Negocio: ${negocio}\nRubro: ${rubro || "no especificado"}\nLink de referencia: ${link}\n\nBusca este link y la presencia pública del negocio (Instagram, sitio web, Google) y propón un borrador de identidad de marca fiel a lo que encuentres.`
    : `Negocio: ${negocio}\nRubro: ${rubro || "no especificado"}\n\nNo hay link de referencia — busca por el nombre del negocio y su rubro para encontrar su presencia pública (Instagram, sitio web, Google Maps) y propón un borrador de identidad de marca. Si no encuentras nada específico, propón algo coherente con el rubro.`;

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
        max_tokens: 2000,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        system:
          "Eres Bárbara, directora de arte. Investigas la presencia pública de un negocio (Instagram, sitio web, Google) y propones un borrador de identidad de marca: paleta de colores (hasta 6, con hex y su uso), tipografía sugerida y detalles de estilo (qué transmite, qué evitar). Es SOLO una propuesta que un humano va a revisar y editar antes de guardar — no inventes certezas, si no encuentras nada di que es una propuesta genérica coherente con el rubro. Responde SOLO con el JSON pedido.",
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
