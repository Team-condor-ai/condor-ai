// condor.ai · Edge Function "barbara-sintetizar-perfil"
//
// Lee las reglas y gustos acumulados de UN cliente y sintetiza un "perfil":
// cómo es esta marca a la hora de dar feedback, qué le importa, con qué es
// exigente. No es psicología clínica — es un perfil de ESTILO DE TRABAJO,
// del mismo tipo que cualquier CRM guarda de una cuenta, solo que Bárbara lo
// escribe sola en vez de que un humano lo redacte a mano.
//
// SOLO CORRE SI HAY MATERIAL DE VERDAD
// ---------------------------------------------------------------------------
// Con 0 o 1 reglas no hay nada que sintetizar — inventar un perfil con poca
// muestra sería el mismo error que ya se evitó en `patrones.mjs`: un perfil
// falso pesa tanto en el prompt como uno real, y es peor que no tener nada.
//
// Deploy: supabase functions deploy barbara-sintetizar-perfil --project-ref <ref>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

const MINIMO_REGLAS = 3;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "estilo_feedback", "sensibilidades"],
  properties: {
    resumen: { type: "string", description: "2-3 frases: cómo es esta marca trabajando con Bárbara." },
    estilo_feedback: { type: "string", description: "Cómo da feedback: directo/indirecto, rápido/detallado, qué prioriza al corregir." },
    sensibilidades: { type: "string", description: "Qué le importa mucho o le molesta especialmente, según lo que ha corregido." },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, servicio: "barbara-sintetizar-perfil" });

  // Solo el equipo — mismo patrón que crear-plan-suscripcion.
  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ error: "sin sesión" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ error: "solo el equipo" }, 403);

  let barbaraClienteId: string;
  try {
    const b = await req.json();
    barbaraClienteId = String(b?.barbara_cliente_id || "");
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!barbaraClienteId) return json({ error: "falta barbara_cliente_id" }, 400);

  const { data: reglas } = await sb
    .from("barbara_reglas")
    .select("regla, categoria, veces_reforzada")
    .eq("barbara_cliente_id", barbaraClienteId)
    .eq("activa", true);

  const { data: gustos } = await sb
    .from("barbara_memoria_nodos")
    .select("titulo, contenido")
    .eq("barbara_cliente_id", barbaraClienteId)
    .eq("tipo", "gusto")
    .eq("activo", true);

  if (!reglas || reglas.length < MINIMO_REGLAS) {
    return json({
      error: `Hacen falta al menos ${MINIMO_REGLAS} reglas activas para sintetizar un perfil ` +
        `(hay ${reglas?.length ?? 0}). Con poca muestra el perfil sería inventado, no real.`,
    }, 400);
  }

  const AK = Deno.env.get("ANTHROPIC_API_KEY");
  if (!AK) return json({ error: "Falta ANTHROPIC_API_KEY" }, 500);

  const material =
    `REGLAS QUE ESTA MARCA HA PEDIDO (más veces repetida = más le importa):\n` +
    reglas.map((r) => `- [${r.categoria || "general"}] ${r.regla} (pedida ${r.veces_reforzada}x)`).join("\n") +
    (gustos?.length
      ? `\n\nGUSTOS YA REGISTRADOS:\n` + gustos.map((g) => `- ${g.titulo}: ${g.contenido}`).join("\n")
      : "");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": AK,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system:
        "Analizas las correcciones que un cliente le ha hecho a su agente de contenido (Bárbara) para " +
        "describir su ESTILO DE TRABAJO — no un análisis clínico, un perfil de cuenta como el que cualquier " +
        "equipo comercial escribiría sobre un cliente exigente. Sé concreto y basado en evidencia: cada " +
        "afirmación tiene que apoyarse en algo de las reglas dadas, nunca en un estereotipo genérico.",
      messages: [{ role: "user", content: material }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });
  if (!r.ok) return json({ error: "Claude: " + (await r.text()).slice(0, 200) }, 500);
  const data = await r.json();
  const texto = (data.content || []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  const perfil = JSON.parse(texto);

  const contenido =
    `${perfil.resumen}\n\nEstilo de feedback: ${perfil.estilo_feedback}\n\nSensibilidades: ${perfil.sensibilidades}`;

  // Un solo nodo "perfil" por cliente: se reemplaza, no se acumula — es un
  // snapshot vigente, no un historial de perfiles viejos.
  const { data: existente } = await sb
    .from("barbara_memoria_nodos")
    .select("id")
    .eq("barbara_cliente_id", barbaraClienteId)
    .eq("tipo", "perfil")
    .maybeSingle();

  const fila = {
    barbara_cliente_id: barbaraClienteId,
    tipo: "perfil",
    titulo: "Perfil de estilo",
    contenido,
    peso: reglas.length,
    origen: `Sintetizado de ${reglas.length} reglas` + (gustos?.length ? ` y ${gustos.length} gustos` : ""),
    actualizado_en: new Date().toISOString(),
  };

  if (existente) await sb.from("barbara_memoria_nodos").update(fila).eq("id", existente.id);
  else await sb.from("barbara_memoria_nodos").insert(fila);

  return json({ ok: true, contenido });
});
