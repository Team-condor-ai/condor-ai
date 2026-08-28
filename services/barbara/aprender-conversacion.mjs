/**
 * Bárbara · qué de una conversación merece entrar al cerebro.
 *
 * EL PROBLEMA QUE RESUELVE
 * ---------------------------------------------------------------------------
 * Hasta ahora Bárbara solo aprendía de CORRECCIONES (`barbara-destilar-regla`).
 * Todo lo que el cliente contaba conversando —su público real, su margen, que
 * vende solo mayorista, que odia una palabra— se perdía apenas terminaba el
 * chat. El cliente lo contaba una vez y tenía que volver a contarlo.
 *
 * Este módulo es la POLÍTICA, no la extracción: decide qué turno de la
 * conversación es candidato a memoria, con cuánta confianza, y qué ya se sabe.
 * Es determinista a propósito — la parte cara (redactar el nodo) puede hacerla
 * un modelo después, pero a quién se le cree y qué se descarta no debería
 * depender de una llamada que a veces falla.
 *
 * LAS DOS REGLAS QUE NO SE NEGOCIAN
 * ---------------------------------------------------------------------------
 * 1. Nunca se aprende de lo que dijo Bárbara. Si sus propias frases entraran
 *    al cerebro, cada invención se volvería un "hecho" de la marca y se
 *    reforzaría sola en la siguiente pieza. Es el camino corto a un cerebro
 *    lleno de cosas que nadie dijo nunca.
 * 2. Una pregunta no es un hecho. "¿usamos azul?" no significa que la marca
 *    use azul, y confundir las dos cosas es cómo se ensucia una memoria.
 */

import { normalizar } from "./memoria.mjs";

const MAX_CONTENIDO = 600;
// Menos que esto no es información: es un acuse de recibo.
const MIN_LARGO = 25;

const REMITENTES_QUE_ENSEÑAN = new Set(["cliente", "staff"]);

// Cortesía pura. Se comparan normalizados y completos, no por inclusión: un
// mensaje que EMPIEZA con "dale" puede seguir con algo que importa.
const RELLENO = new Set([
  "hola", "buenas", "ok", "oka", "okey", "listo", "dale", "gracias", "graciasm",
  "perfecto", "bien", "ya", "si", "no", "buenisimo", "genial", "excelente",
  "dale gracias", "muchas gracias", "de acuerdo", "entendido",
]);

/**
 * Un turno que termina en '?' o abre con un interrogativo está preguntando,
 * no afirmando. Se mira el texto completo: si además de preguntar afirma algo,
 * separar las dos mitades es trabajo del modelo, no de esta política.
 */
function esPregunta(texto = "") {
  const t = String(texto).trim();
  if (t.includes("?") || t.includes("¿")) return true;
  return /^(que|qué|cual|cuál|como|cómo|cuando|cuándo|donde|dónde|quien|quién|por que|por qué|deberiamos|deberíamos|te parece|puedes|podrias|podrías)\b/i
    .test(normalizar(t));
}

/** Un audio transcrito puede traer errores; no puede pesar como algo tecleado. */
export function confianzaDe({ remitente, es_audio: esAudio } = {}) {
  const base = remitente === "cliente" ? 0.85 : 0.75;
  const valor = esAudio ? base - 0.2 : base;
  return Math.max(0, Math.min(1, Number(valor.toFixed(2))));
}

/** Turnos de la conversación → candidatas a nodo de memoria. */
export function candidatasDeConversacion(turnos = []) {
  if (!Array.isArray(turnos)) return [];
  return turnos
    .filter((t) => REMITENTES_QUE_ENSEÑAN.has(String(t?.remitente || "")))
    .map((t) => ({ turno: t, texto: String(t?.mensaje || "").trim() }))
    .filter(({ texto }) => texto.length >= MIN_LARGO)
    .filter(({ texto }) => !RELLENO.has(normalizar(texto)))
    .filter(({ texto }) => !esPregunta(texto))
    .map(({ turno, texto }) => ({
      contenido: texto.slice(0, MAX_CONTENIDO),
      origen: `chat:${turno.remitente}`,
      confianza: confianzaDe(turno),
      es_audio: Boolean(turno.es_audio),
    }));
}

/**
 * Descarta lo que el cerebro ya sabe y lo que se repite dentro de la misma
 * tanda. La comparación es por contenido normalizado: "Vende SOLO al por
 * mayor." y "vende solo al por mayor" son el mismo recuerdo.
 */
export function filtrarNuevas(candidatas = [], existentes = []) {
  const vistos = new Set(existentes.map((n) => normalizar(n?.contenido || "")).filter(Boolean));
  const salida = [];
  for (const c of candidatas) {
    const clave = normalizar(c?.contenido || "");
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(c);
  }
  return salida;
}
