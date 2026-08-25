/**
 * Decisión determinista de aprendizaje privado, compartida por el motor Node
 * y las Edge Functions. El modelo propone candidatos; esta capa impone las
 * reglas que el modelo no puede saltarse.
 */

const UMBRAL_AUTO = 0.86;
const UMBRAL_PROPUESTA = 0.62;

export function normalizarAprendizaje(texto = "") {
  return String(texto).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function clave(c) {
  return normalizarAprendizaje(c.clave || c.titulo || c.contenido);
}

export function parecidoAprendizaje(a, b) {
  const aa = new Set(normalizarAprendizaje(a).split(" ").filter(Boolean));
  const bb = new Set(normalizarAprendizaje(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  const comun = [...aa].filter((x) => bb.has(x)).length;
  return comun / Math.max(aa.size, bb.size);
}

export function contieneSecreto(texto = "") {
  const t = normalizarAprendizaje(texto);
  return /\b(contrasena|password|passphrase|api key|apikey|token|bearer|clave secreta|cvv|numero de tarjeta|semilla|seed phrase)\b/.test(t);
}

export function pareceTemporal(candidato = {}) {
  if (candidato.temporal === true || candidato.duracion === "temporal") return true;
  const t = normalizarAprendizaje(candidato.contenido || "");
  return /\b(hoy|manana|esta semana|este fin de semana|solo por ahora|por esta vez|temporalmente)\b/.test(t);
}

/**
 * Decide crear/reforzar/proponer/conflicto/ignorar. Exige fuente, confianza,
 * claridad explícita y rechaza secretos o hechos efímeros antes de comparar.
 */
export function decidirAprendizaje({ nodos = [], candidato, ahora = new Date() } = {}) {
  const c = { ...candidato, confianza: Number(candidato?.confianza || 0) };
  if (!c?.contenido?.trim() || !["gusto", "dato", "regla"].includes(c.tipo)) {
    return { accion: "ignorar", razon: "candidato incompleto" };
  }
  if (!c.fuente?.trim()) return { accion: "ignorar", razon: "sin fuente" };
  if (contieneSecreto(`${c.titulo || ""} ${c.contenido}`) || c.sensible === true) {
    return { accion: "ignorar", razon: "dato sensible o secreto" };
  }
  if (pareceTemporal(c)) return { accion: "ignorar", razon: "dato temporal, queda en el chat pero no en memoria durable" };
  if (c.confianza < UMBRAL_PROPUESTA) return { accion: "ignorar", razon: "confianza baja" };

  const activas = nodos.filter((n) => n.activo !== false);
  const misma = activas.find((n) => clave(n) === clave(c) || normalizarAprendizaje(n.contenido) === normalizarAprendizaje(c.contenido));
  if (misma) {
    return { accion: "reforzar", id: misma.id, razon: "evidencia repetida", peso: (misma.peso || 1) + 1 };
  }

  const relacionado = activas.find((n) => n.tipo === c.tipo && parecidoAprendizaje(n.titulo || n.contenido, c.titulo || c.contenido) >= 0.5);
  if (relacionado) {
    return {
      accion: "conflicto", id: relacionado.id, razon: "memoria relacionada posiblemente contradictoria",
      vigente: relacionado.contenido, propuesta: c.contenido,
    };
  }

  if (!c.explicito || c.confianza < UMBRAL_AUTO || c.alto_impacto === true) {
    return {
      accion: "proponer",
      razon: c.alto_impacto === true ? "cambio de alto impacto" : c.explicito ? "requiere confirmación" : "inferencia no explícita",
    };
  }
  return {
    accion: "crear", razon: "dato explícito y suficiente confianza",
    nodo: {
      tipo: c.tipo, titulo: String(c.titulo || "Memoria aprendida").slice(0, 120),
      contenido: String(c.contenido).trim().slice(0, 1600), peso: 1,
      confianza: c.confianza,
      etiquetas: Array.isArray(c.etiquetas) ? c.etiquetas.map((x) => String(x).slice(0, 50)).slice(0, 8) : [],
      origen: String(c.fuente).slice(0, 500), actualizado_en: ahora.toISOString(),
    },
  };
}

export function eventoAprendizaje(decision, { mensajeId = null, actor = "barbara" } = {}) {
  return {
    tipo: "aprendizaje_memoria", accion: decision.accion, razon: decision.razon,
    mensaje_id: mensajeId, actor, creado_en: new Date().toISOString(),
  };
}
