/**
 * Bárbara · pilares de contenido — qué tipo de pieza toca hoy.
 *
 * EL PROBLEMA
 * ---------------------------------------------------------------------------
 * Hoy el reparto de contenido está escrito en código: barbara.mjs tiene cuatro
 * series fijas y una rotación por semana ISO. Para la cuenta propia de Cóndor
 * funciona, pero no se puede copiar a un cliente por una razón concreta: de
 * esas cuatro series, TRES hablan de Cóndor o de Bárbara. Esa proporción de
 * auto-venta en la cuenta de un cliente le espantaría los seguidores.
 *
 * Cada marca necesita su propia mezcla, y esa mezcla es un dato del
 * onboarding, no una constante del repositorio.
 *
 * CÓMO SE ELIGE
 * ---------------------------------------------------------------------------
 * No al azar y no por turno fijo: por DEUDA. Se mira qué publicó la marca
 * últimamente, se compara con la mezcla que pidió, y se elige el pilar que más
 * atrasado viene. Dos ventajas sobre rotar en orden:
 *
 *   · Converge a la mezcla pedida aunque se salte días, se repita una serie a
 *     mano o el cliente pida una pieza suelta fuera de calendario.
 *   · Se autocorrige: si una semana se publicaron tres piezas de venta, la
 *     siguiente el pilar de venta queda saldado y salen las otras solas.
 *
 * Todo acá es lógica pura y determinista: se testea sin red y sin base.
 */

/**
 * El catálogo. Es fijo a propósito: los pilares son los mismos para toda
 * marca, lo que cambia entre clientes es CUÁNTO de cada uno. Un catálogo
 * abierto por cliente sonaría más flexible y en la práctica deja a cada
 * cuenta con una taxonomía distinta imposible de comparar entre sí — y sin
 * comparar entre marcas no hay memoria global (ver patrones.mjs).
 */
export const PILARES = {
  educar: {
    nombre: "Educar",
    instruccion: "Enseña algo útil del rubro SIN vender nada. El lector tiene que " +
      "poder aplicarlo aunque nunca te compre. Si al terminar la pieza sólo aprendió " +
      "que existes, no es de este pilar.",
  },
  mostrar: {
    nombre: "Mostrar / Vender",
    instruccion: "Producto, servicio u oferta concreta. UN solo argumento por pieza, " +
      "nada de listas de características. Habla del problema que resuelve, no de lo " +
      "que incluye.",
  },
  autoridad: {
    nombre: "Autoridad / Prueba",
    instruccion: "Datos, estudios o resultados MEDIBLES que respalden lo que la marca " +
      "afirma. Cada cifra con su fuente. Sin cifra real y verificable, no hay pieza de " +
      "este pilar: se cambia de pilar antes que inventar el número.",
  },
  comunidad: {
    nombre: "Comunidad",
    instruccion: "Detrás de cámara, equipo, proceso, valores. Lo que hace que la marca " +
      "se sienta hecha por personas. Nada de producto ni de oferta acá.",
  },
  prueba_social: {
    nombre: "Prueba social",
    instruccion: "Testimonios y casos reales de clientes. SÓLO con material que el " +
      "cliente entregó — está prohibido inventar un testimonio o un caso de éxito, " +
      "aunque sea verosímil. Sin material real, se cambia de pilar.",
  },
};

export const CLAVES = Object.keys(PILARES);

/**
 * Mezcla por defecto, para una marca que todavía no definió la suya.
 * Deliberadamente NO es la de Cóndor: pesa educar por sobre vender, que es lo
 * que sostiene una cuenta de cliente. La de Cóndor (3 de 4 piezas hablando de
 * Cóndor) sirve para la cuenta propia y sería un error copiarla.
 */
export const MEZCLA_POR_DEFECTO = {
  educar: 40,
  mostrar: 25,
  autoridad: 20,
  comunidad: 15,
  prueba_social: 0, // arranca en 0: sin testimonios reales cargados, no hay de dónde
};

/**
 * Normaliza lo que venga del formulario a porcentajes que suman 100.
 * Acepta pesos crudos (3, 2, 1) o porcentajes (50, 30, 20) — se reparte
 * proporcional en ambos casos, así el formulario puede pedir lo que le sea
 * más natural al cliente sin que el motor tenga que saber cuál eligió.
 */
export function normalizar(mezcla) {
  const limpia = {};
  for (const [k, v] of Object.entries(mezcla || {})) {
    const n = Number(v);
    if (CLAVES.includes(k) && Number.isFinite(n) && n > 0) limpia[k] = n;
  }
  const claves = Object.keys(limpia);
  if (!claves.length) return normalizar(MEZCLA_POR_DEFECTO);

  const total = claves.reduce((s, k) => s + limpia[k], 0);
  const out = {};
  for (const k of claves) out[k] = (limpia[k] / total) * 100;
  return out;
}

/**
 * Elige el pilar que toca, por deuda acumulada.
 *
 * `historial` son las claves de pilar de las últimas piezas, de la MÁS
 * RECIENTE a la más vieja (el orden en que las devuelve Supabase).
 *
 * Devuelve `{ pilar, instruccion, deuda, reparto }` — `reparto` es lo que se
 * publicó de verdad, útil para mostrárselo al equipo y para depurar por qué
 * eligió lo que eligió.
 */
export function elegirPilar(mezcla, historial = [], { ventana = 20 } = {}) {
  const objetivo = normalizar(mezcla);
  const recientes = historial.filter((p) => CLAVES.includes(p)).slice(0, ventana);

  /* Sin historial no hay deuda que calcular: arranca por el pilar de mayor
     peso, que es lo que la marca dijo que más quiere. */
  if (!recientes.length) {
    const pilar = Object.keys(objetivo).sort((a, b) => objetivo[b] - objetivo[a])[0];
    return { pilar, instruccion: PILARES[pilar].instruccion, deuda: objetivo[pilar], reparto: {} };
  }

  const conteo = {};
  for (const p of recientes) conteo[p] = (conteo[p] || 0) + 1;

  const reparto = {};
  for (const k of Object.keys(objetivo)) reparto[k] = ((conteo[k] || 0) / recientes.length) * 100;

  /* Deuda = lo que la marca pidió menos lo que de verdad salió. El más
     endeudado gana. Los empates se rompen por peso objetivo (el pilar que la
     marca dijo que más quiere) y después alfabéticamente, para que la función
     sea determinista: dos corridas con los mismos datos tienen que elegir lo
     mismo, o el candado de "ya se publicó hoy" deja de ser reproducible. */
  const candidatos = Object.keys(objetivo).map((k) => ({
    pilar: k,
    deuda: objetivo[k] - reparto[k],
  }));
  candidatos.sort((a, b) =>
    (b.deuda - a.deuda) ||
    (objetivo[b.pilar] - objetivo[a.pilar]) ||
    a.pilar.localeCompare(b.pilar));

  const ganador = candidatos[0];
  return {
    pilar: ganador.pilar,
    instruccion: PILARES[ganador.pilar].instruccion,
    deuda: ganador.deuda,
    reparto,
  };
}

/**
 * Bloque para el prompt del director. Va con la instrucción del pilar y, si
 * hay desvío, con el aviso de qué se viene publicando de más — para que el
 * modelo entienda por qué le tocó éste.
 */
export function bloquePrompt({ pilar, instruccion, reparto }) {
  const p = PILARES[pilar];
  if (!p) return "";
  const publicado = Object.entries(reparto || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${PILARES[k]?.nombre || k} ${Math.round(v)}%`)
    .join(" · ");

  return `PILAR DE HOY: ${p.nombre}\n${instruccion}` +
    (publicado ? `\n(Últimas piezas de esta cuenta: ${publicado}. Por eso hoy toca ${p.nombre}.)` : "");
}
