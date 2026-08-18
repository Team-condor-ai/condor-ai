// condor.ai · Edge Function "barbara-destilar-regla"
//
// Convierte una corrección del cliente en una REGLA DURADERA de su marca.
//
// EL PROBLEMA QUE RESUELVE
// ---------------------------------------------------------------------------
// El texto de las correcciones ya se guardaba en `barbara_chats`, pero el
// motor nunca leía esa tabla: si el cliente pedía lo mismo cinco veces, a la
// sexta Bárbara volvía a equivocarse. Esta función es el puente que faltaba.
//
// LO QUE DECIDE, Y POR QUE IMPORTA
// ---------------------------------------------------------------------------
// Distingue una corrección PUNTUAL ("cambia esta foto", "ese título no me
// gusta") de una preferencia DURADERA ("nunca uses fotos de stock", "los
// captions cortos"). Solo la segunda se guarda. Si se guardara todo, la lista
// de reglas se llena de ruido y la generación empeora en vez de mejorar —
// que es exactamente el modo en que este tipo de memoria falla.
//
// Se llama sin esperar respuesta desde el webhook de Telegram: si esto falla,
// la corrección igual quedó guardada y el reintento igual se disparó. Nunca
// puede romper el flujo principal.
//
// Secreto: ANTHROPIC_API_KEY
// Deploy:  supabase functions deploy barbara-destilar-regla --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    es_duradera: {
      type: "boolean",
      description: "true solo si la corrección expresa una preferencia estable de la marca que conviene aplicar SIEMPRE. false si es un arreglo puntual de esta pieza.",
    },
    regla: {
      type: "string",
      description: "La preferencia en una frase corta, en tercera persona y accionable para un director creativo. Ej: 'prefiere captions de máximo dos líneas'. Vacío si es_duradera es false.",
    },
    categoria: {
      type: "string",
      enum: ["copy", "diseno", "producto", "tono", "formato", "ninguna"],
    },
  },
  required: ["es_duradera", "regla", "categoria"],
};

const SISTEMA = `Analizas la corrección que un cliente le hizo a una pieza de contenido de su
marca y decides si expresa una PREFERENCIA DURADERA (que conviene aplicar a todo lo que se genere
de aquí en adelante) o un ARREGLO PUNTUAL de esa pieza.

Duradera: "los textos más cortos", "nunca uses fondos oscuros", "siempre menciona el precio",
"no me gusta el tono informal".
Puntual: "cambia esta foto", "el segundo slide está mal", "corrige el dedo de la mano",
"esta vez usa el producto azul".

Ante la duda, responde que NO es duradera. Una regla de más contamina todo lo que la marca
genere después; una regla de menos solo significa que el cliente la va a repetir, y ahí sí se
guarda. Responde SOLO con el JSON pedido.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const AK = Deno.env.get("ANTHROPIC_API_KEY");
  if (!AK) return json({ ok: false, error: "ANTHROPIC_API_KEY sin configurar" }, 500);

  let barbaraClienteId = "", texto = "";
  try {
    const b = await req.json();
    barbaraClienteId = String(b?.barbara_cliente_id ?? "");
    texto = String(b?.texto ?? "").trim().slice(0, 800);
  } catch {
    return json({ ok: false, error: "cuerpo inválido" }, 400);
  }
  if (!barbaraClienteId || !texto) return json({ ok: false, error: "faltan datos" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Las reglas que ya tiene: se le pasan para que no proponga una que ya está
  // dicha con otras palabras, y para poder reforzar en vez de duplicar.
  const { data: previas } = await sb
    .from("barbara_reglas")
    .select("id, regla")
    .eq("barbara_cliente_id", barbaraClienteId)
    .eq("activa", true)
    .order("veces_reforzada", { ascending: false })
    .limit(40);

  const listaPrevias = (previas ?? []).map((r) => `- ${r.regla}`).join("\n") || "(ninguna todavía)";

  let d: { es_duradera?: boolean; regla?: string; categoria?: string };
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
        max_tokens: 500,
        system: SISTEMA,
        output_config: { format: { type: "json_schema", schema } },
        messages: [{
          role: "user",
          content: `Reglas que la marca YA tiene:\n${listaPrevias}\n\n` +
                   `Corrección nueva del cliente:\n"${texto}"\n\n` +
                   `¿Es una preferencia duradera? Si ya está cubierta por una regla existente, ` +
                   `devuelve esa MISMA redacción para que se refuerce en vez de duplicarse.`,
        }],
      }),
    });
    if (!resp.ok) return json({ ok: false, error: "IA no disponible" }, 502);
    const r = await resp.json();
    const t = (r.content ?? []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("");
    d = JSON.parse(t);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, 500);
  }

  if (!d.es_duradera || !d.regla?.trim()) {
    return json({ ok: true, guardada: false, motivo: "corrección puntual" });
  }

  const regla = d.regla.trim();

  // Si ya existe (comparando sin acentos ni mayúsculas), se REFUERZA. Que el
  // cliente lo repita es la señal de que le importa, y eso vale más que tener
  // dos filas casi iguales compitiendo por el mismo espacio del prompt.
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

  const igual = (previas ?? []).find((r) => norm(r.regla) === norm(regla));
  if (igual) {
    const { data: actual } = await sb
      .from("barbara_reglas").select("veces_reforzada").eq("id", igual.id).maybeSingle();
    await sb.from("barbara_reglas").update({
      veces_reforzada: (actual?.veces_reforzada ?? 1) + 1,
      actualizado_en: new Date().toISOString(),
    }).eq("id", igual.id);
    return json({ ok: true, guardada: true, reforzada: true, regla });
  }

  const { error } = await sb.from("barbara_reglas").insert({
    barbara_cliente_id: barbaraClienteId,
    regla,
    categoria: d.categoria === "ninguna" ? null : d.categoria,
    origen: texto,
  });
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, guardada: true, reforzada: false, regla });
});
