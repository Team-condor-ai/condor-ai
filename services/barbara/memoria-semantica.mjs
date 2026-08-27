/**
 * Bárbara · puente entre embeddings y la base de memoria.
 *
 * Separado de embeddings.mjs (cliente HTTP puro) y de memoria.mjs (puntaje
 * puro, sin red ni DB) para que ambos sigan siendo testeables sin mocks
 * pesados. Este módulo es el único que toca las dos cosas a la vez.
 */

import { embeddingDeTexto } from "./embeddings.mjs";

const textoDelNodo = (n) => `${n.titulo || ""}\n${n.contenido || ""}`.trim();

/**
 * Rellena embeddings faltantes de los nodos de ESTE cliente. El volumen real
 * por corrida es chico (solo lo nuevo desde la última vez, ver
 * STACK-TECNICO.md: "cientos, no miles" de notas por marca), así que
 * secuencial alcanza — paralelizar contra OpenAI acá sería complejidad sin
 * beneficio real. Un fallo puntual no bloquea la generación: el nodo
 * simplemente no aporta puntaje semántico esta vez y se reintenta la próxima.
 */
export async function rellenarEmbeddingsFaltantes(db, nodos, { openaiKey, log = console.log, fetchFn } = {}) {
  const faltantes = (nodos || []).filter((n) => n.id && !n.embedding && textoDelNodo(n));
  let rellenados = 0;
  for (const n of faltantes) {
    try {
      const vector = await embeddingDeTexto(textoDelNodo(n), { openaiKey, fetchFn });
      if (!vector) continue;
      await db.patch(`barbara_memoria_nodos?id=eq.${n.id}`, { embedding: vector });
      rellenados++;
    } catch (e) {
      log(`embeddings: no se pudo vectorizar el nodo ${n.id}: ${String(e).slice(0, 160)}`);
    }
  }
  return rellenados;
}

/**
 * Nodos más parecidos semánticamente al pedido actual, como
 * Map(nodoId -> similitud 0..1). Nunca lanza: si OpenAI o la RPC fallan,
 * la generación sigue solo con el puntaje por palabras de memoria.mjs.
 */
export async function nodosSimilares(db, barbaraId, consulta, { openaiKey, limite = 8, log = console.log, fetchFn } = {}) {
  const texto = String(consulta || "").trim();
  if (!texto || !openaiKey) return new Map();
  try {
    const embedding = await embeddingDeTexto(texto, { openaiKey, fetchFn });
    if (!embedding) return new Map();
    const filas = await db.rpc("barbara_memoria_similares", {
      p_barbara_cliente_id: barbaraId,
      p_embedding: embedding,
      p_limite: limite,
    });
    // distancia coseno pgvector: 0 = idéntico, 2 = opuesto. 1 - distancia da
    // una similitud 0..1 que memoria.mjs puede sumar directo a su puntaje.
    return new Map((filas || []).map((f) => [String(f.id), Math.max(0, 1 - Number(f.distancia))]));
  } catch (e) {
    log(`embeddings: búsqueda semántica no disponible, sigo solo con palabras clave: ${String(e).slice(0, 160)}`);
    return new Map();
  }
}
