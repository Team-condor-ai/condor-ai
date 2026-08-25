/**
 * Bárbara · ledger de aprendizaje privado.
 *
 * El modelo puede PROPONER recuerdos; este módulo decide qué hacer con ellos
 * sin permitir que una frase ambigua reescriba el cerebro de una marca. Es
 * determinista, testeable y no llama a ningún proveedor.
 */

import { normalizar } from "./memoria.mjs";

const UMBRAL_AUTO = 0.86;
const UMBRAL_PROPUESTA = 0.62;

function clave(c) {
  return normalizar(c.clave || c.titulo || c.contenido);
}

function parecido(a, b) {
  const aa = new Set(normalizar(a).split(" ").filter(Boolean));
  const bb = new Set(normalizar(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  const comun = [...aa].filter((x) => bb.has(x)).length;
  return comun / Math.max(aa.size, bb.size);
}

/**
 * Decide create/reforzar/proponer/conflicto/ignorar. `candidato` viene de un
 * clasificador posterior, pero esta decisión NO depende de que el LLM sea
 * perfecto: exige fuente, confianza y claridad explícita.
 */
export function decidirAprendizaje({ nodos = [], candidato, ahora = new Date() } = {}) {
  const c = { ...candidato, confianza: Number(candidato?.confianza || 0) };
  if (!c?.contenido?.trim() || !["gusto", "dato", "regla"].includes(c.tipo)) {
    return { accion: "ignorar", razon: "candidato incompleto" };
  }
  if (!c.fuente?.trim()) return { accion: "ignorar", razon: "sin fuente" };
  if (c.confianza < UMBRAL_PROPUESTA) return { accion: "ignorar", razon: "confianza baja" };

  const activas = nodos.filter((n) => n.activo !== false);
  const misma = activas.find((n) => clave(n) === clave(c) || normalizar(n.contenido) === normalizar(c.contenido));
  if (misma) {
    return { accion: "reforzar", id: misma.id, razon: "evidencia repetida", peso: (misma.peso || 1) + 1 };
  }

  // Mismo asunto pero texto incompatible: no se elige arbitrariamente. Se
  // propone al cliente/staff con ambas versiones, preservando la vigente.
  const relacionado = activas.find((n) => n.tipo === c.tipo && parecido(n.titulo || n.contenido, c.titulo || c.contenido) >= 0.5);
  if (relacionado) {
    return {
      accion: "conflicto", id: relacionado.id, razon: "memoria relacionada posiblemente contradictoria",
      vigente: relacionado.contenido, propuesta: c.contenido,
    };
  }

  if (!c.explicito || c.confianza < UMBRAL_AUTO) {
    return { accion: "proponer", razon: c.explicito ? "requiere confirmación" : "inferencia no explícita" };
  }
  return {
    accion: "crear", razon: "dato explícito y suficiente confianza",
    nodo: {
      tipo: c.tipo, titulo: String(c.titulo || "Memoria aprendida").slice(0, 120),
      contenido: String(c.contenido).trim().slice(0, 1600), peso: 1,
      origen: String(c.fuente).slice(0, 500), actualizado_en: ahora.toISOString(),
    },
  };
}

/** Versión compacta para auditar sin guardar la conversación completa dos veces. */
export function eventoAprendizaje(decision, { mensajeId = null, actor = "barbara" } = {}) {
  return {
    tipo: "aprendizaje_memoria", accion: decision.accion, razon: decision.razon,
    mensaje_id: mensajeId, actor, creado_en: new Date().toISOString(),
  };
}
