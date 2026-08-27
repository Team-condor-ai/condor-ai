/**
 * Bárbara · cliente de embeddings para recuperación semántica de memoria.
 *
 * Anthropic no tiene endpoint de embeddings (ver STACK-TECNICO.md y
 * angulos.mjs — es la misma razón por la que `angulos.mjs` usa un juez en
 * vez de vectores). En vez de contratar un proveedor nuevo se reusa OpenAI:
 * YA es parte del stack, transcribe las notas de voz de Telegram en
 * `telegram-barbara-clientes/index.ts` con el mismo `OPENAI_API_KEY`.
 *
 * Módulo puro de red — no toca Supabase. Eso vive en memoria-semantica.mjs.
 */

const MODELO = "text-embedding-3-small";
const DIMENSIONES = 1536;

export async function embeddingDeTexto(texto, { openaiKey, fetchFn = fetch } = {}) {
  const limpio = String(texto || "").trim();
  if (!limpio) return null;
  if (!openaiKey) throw new Error("Falta OPENAI_API_KEY para generar embeddings");

  const r = await fetchFn("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    // 8000 caracteres es de sobra para una nota de memoria (tope real hoy:
    // 1600, ver barbara_guardar_nodo) y queda lejos del límite de tokens
    // del modelo sin tener que contar tokens a mano.
    body: JSON.stringify({ model: MODELO, input: limpio.slice(0, 8000) }),
  });
  if (!r.ok) {
    throw new Error(`OpenAI embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const data = await r.json();
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== DIMENSIONES) {
    throw new Error(`Embedding con forma inesperada (${vector?.length ?? "sin datos"} dimensiones)`);
  }
  return vector;
}

export { MODELO, DIMENSIONES };
