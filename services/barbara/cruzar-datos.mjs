/**
 * Bárbara · datos cruzados: lo que el cliente DICE contra lo que RINDIÓ.
 *
 * EL PROBLEMA QUE RESUELVE
 * ---------------------------------------------------------------------------
 * `barbara_reglas` guarda preferencias declaradas ("prefiere captions cortos")
 * y `barbara_memoria` guarda las piezas con sus métricas. Hasta ahora nadie
 * cruzaba las dos: una preferencia podía estar hundiendo el rendimiento
 * durante meses y el sistema la seguía obedeciendo sin decir nada.
 *
 * QUÉ HACE, Y QUÉ NO HACE A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Para cada regla activa separa las piezas publicadas en dos grupos —las que
 * plausiblemente la aplicaron y el resto— y compara su rendimiento. Emite un
 * hallazgo explicable, con las muestras a la vista.
 *
 * NUNCA desactiva ni edita una regla. La regla es del cliente; un dato en
 * contra abre una conversación, no la cierra. El hallazgo más fuerte que puede
 * emitir es `revisar_con_cliente`. Esta línea es deliberada: automatizar el
 * borrado de preferencias declaradas es exactamente cómo este tipo de sistema
 * pierde la confianza de la marca.
 *
 * Es determinista y sin llamadas a IA: se puede correr seguido, probar y
 * explicar. La atribución ("¿esta pieza aplicó la regla?") es una heurística
 * léxica, no una certeza — por eso el veredicto siempre viaja con el número
 * de muestras y el equipo puede descartarlo mirando.
 */

import { terminos } from "./memoria.mjs";

// Bajo esto, cualquier diferencia es ruido de muestra chica, no una señal.
const MIN_MUESTRAS = 3;
// Diferencia relativa mínima para afirmar algo. 15% es la línea entre "rindió
// distinto" y "rindió parecido y el orden lo decidió el azar".
const UMBRAL_DIFERENCIA = 0.15;
// Solo una pieza publicada es evidencia: un borrador nunca se expuso a nadie.
const ESTADOS_CON_EVIDENCIA = new Set(["publicada"]);

const PESO_VEREDICTO = { contradicha: 0, confirmada: 1, sin_diferencia: 2, sin_evidencia: 3 };

/**
 * Tasa de interacción, no interacciones crudas: una pieza con alcance enorme y
 * poca reacción no puede ganarle a una chica que movió a casi todos los que la
 * vieron. Sin alcance devuelve 0 en vez de dividir por cero.
 */
export function rendimiento(pieza = {}) {
  const m = pieza.metricas || {};
  // `_shared/barbara-metricas.mjs` ya normaliza `interacciones` (suma de me
  // gusta + comentarios + compartidos + guardados) y deja `tasa_interaccion`
  // calculada. Se prefiere ese valor: recalcularlo acá sería una segunda
  // definición de "rendimiento" que puede derivar de la del resto del sistema.
  const tasa = Number(m.tasa_interaccion);
  if (Number.isFinite(tasa) && tasa >= 0) return tasa;
  const alcance = Number(m.alcance) || 0;
  const interacciones = Number(m.interacciones) || 0;
  if (alcance <= 0) return 0;
  return interacciones / alcance;
}

/** Mediana, no promedio: con 3 muestras una pieza viral distorsiona el promedio. */
function mediana(valores) {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

function textoPieza(pieza = {}) {
  return [pieza.angulo, pieza.titulo, pieza.texto, pieza.caption, pieza.tipo, ...(pieza.etiquetas || [])]
    .filter(Boolean).join(" ");
}

/** Heurística de atribución: comparten al menos un término con contenido. */
function aplicaLaRegla(pieza, terminosRegla) {
  if (!terminosRegla.length) return false;
  const t = new Set(terminos(textoPieza(pieza)));
  return terminosRegla.some((x) => t.has(x));
}

/**
 * Cruza reglas declaradas contra el rendimiento real de las piezas publicadas.
 * Devuelve hallazgos ordenados: primero lo accionable.
 */
export function cruzar({ reglas = [], piezas = [] } = {}) {
  const publicadas = piezas.filter((p) => ESTADOS_CON_EVIDENCIA.has(String(p?.estado || "")));
  const activas = reglas.filter((r) => r?.activa !== false && r?.regla);

  const hallazgos = activas.map((regla) => {
    const terminosRegla = terminos(regla.regla);
    const aFavor = [];
    const resto = [];
    for (const p of publicadas) (aplicaLaRegla(p, terminosRegla) ? aFavor : resto).push(p);

    const base = {
      regla_id: regla.id ?? null,
      regla: String(regla.regla).trim(),
      muestras_a_favor: aFavor.length,
      muestras_resto: resto.length,
    };

    if (aFavor.length < MIN_MUESTRAS || resto.length < MIN_MUESTRAS) {
      return {
        ...base,
        veredicto: "sin_evidencia",
        accion: "esperar",
        motivo: `Hacen falta al menos ${MIN_MUESTRAS} piezas publicadas de cada lado para comparar; hay ${aFavor.length} que la aplican y ${resto.length} que no.`,
      };
    }

    const conRegla = mediana(aFavor.map(rendimiento));
    const sinRegla = mediana(resto.map(rendimiento));
    const mejor = Math.max(conRegla, sinRegla);
    const diferencia = mejor > 0 ? Math.abs(conRegla - sinRegla) / mejor : 0;
    const pct = (x) => `${(x * 100).toFixed(1)}%`;

    if (diferencia < UMBRAL_DIFERENCIA) {
      return {
        ...base,
        veredicto: "sin_diferencia",
        accion: "ninguna",
        rendimiento_con_regla: conRegla,
        rendimiento_sin_regla: sinRegla,
        motivo: `Rinden casi igual (${pct(conRegla)} contra ${pct(sinRegla)}): la diferencia no alcanza para afirmar nada.`,
      };
    }

    if (conRegla > sinRegla) {
      return {
        ...base,
        veredicto: "confirmada",
        accion: "reforzar",
        rendimiento_con_regla: conRegla,
        rendimiento_sin_regla: sinRegla,
        motivo: `Las piezas que la aplican rinden ${pct(conRegla)} contra ${pct(sinRegla)} del resto. El dato respalda la preferencia.`,
      };
    }

    return {
      ...base,
      veredicto: "contradicha",
      // Jamás "desactivar": la regla la puso el cliente y puede tener razones
      // que las métricas no ven (marca, legal, stock). Esto abre la charla.
      accion: "revisar_con_cliente",
      rendimiento_con_regla: conRegla,
      rendimiento_sin_regla: sinRegla,
      motivo: `Las piezas que la aplican rinden ${pct(conRegla)} contra ${pct(sinRegla)} del resto. Vale la pena mostrarle el dato al cliente antes de seguir aplicándola.`,
    };
  });

  hallazgos.sort((a, b) =>
    PESO_VEREDICTO[a.veredicto] - PESO_VEREDICTO[b.veredicto]
    || a.regla.localeCompare(b.regla, "es"));

  return { hallazgos, piezas_evaluadas: publicadas.length };
}
