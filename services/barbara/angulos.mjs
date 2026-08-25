/**
 * Bárbara · elección de ángulo con juez semántico separado.
 *
 * EL AGUJERO QUE TAPA
 * ---------------------------------------------------------------------------
 * Hasta ahora la anti-repetición era una sola línea dentro del prompt del
 * director: "acá van las últimas 15 piezas, NO repitas, innova". Funciona al
 * principio y se degrada solo. Dos problemas concretos:
 *
 *   1. El generador se auto-vigila. Es el mismo modelo, en la misma llamada,
 *      juzgando si lo que acaba de inventar se parece a algo — y tiene el
 *      sesgo obvio de querer entregar lo que ya escribió.
 *   2. La ventana era de 15 piezas. A 3 carruseles por semana eso son cinco
 *      semanas: en el mes seis vuelve a estar disponible todo lo del mes uno,
 *      y el parecido semántico con palabras distintas ("cómo la IA ahorra
 *      horas" vs "el tiempo que recuperas automatizando") pasa sin que nadie
 *      lo note.
 *
 * CÓMO LO RESUELVE
 * ---------------------------------------------------------------------------
 * Se parte en dos llamadas con roles distintos, y el juez NUNCA es el autor:
 *
 *   proponer() → pide N ángulos candidatos, cortos y baratos (no el carrusel
 *                entero: si hay que descartar, se descarta texto de una línea,
 *                no una generación de 8000 tokens).
 *   juzgar()   → una llamada cuyo ÚNICO trabajo es comparar candidatos contra
 *                el historial largo y decir cuál es genuinamente nuevo.
 *
 * Recién con el ángulo elegido se gasta la generación completa.
 *
 * POR QUÉ UN JUEZ Y NO EMBEDDINGS
 * ---------------------------------------------------------------------------
 * Lo "correcto de manual" sería vectorizar cada ángulo y comparar por coseno.
 * No se hace acá por una razón concreta: Anthropic no tiene endpoint de
 * embeddings, así que meterlos significa contratar un proveedor nuevo
 * (Voyage, OpenAI…) — y la orden explícita de Joaquín es que todo el motor
 * sea Sonnet. Un juez dedicado con el historial a la vista alcanza de sobra
 * para cientos de ángulos, que es el orden de magnitud real de un cliente.
 * Si algún día una marca acumula miles, ahí sí conviene vectorizar; queda
 * anotado en STACK-TECNICO.md como decisión pendiente, no como olvido.
 *
 * Todo recibe `claudeFn` por parámetro para poder testearlo sin red.
 */

const MODELO = "claude-sonnet-5";

/* Cuántos ángulos pedir de una. Cinco da margen real para descartar dos o
   tres sin volver a llamar, y sigue siendo una respuesta corta. */
export const CANDIDATOS_POR_DEFECTO = 5;

const schemaPropuesta = {
  type: "object",
  additionalProperties: false,
  required: ["angulos"],
  properties: {
    angulos: {
      type: "array",
      description: "Ángulos candidatos, ordenados del que más te convence al que menos.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["angulo", "por_que_es_distinto"],
        properties: {
          angulo: {
            type: "string",
            description: "El ángulo en UNA frase, en español, concreto y publicable. " +
              "No un tema genérico ('la IA en las empresas') sino un enfoque con filo " +
              "('lo que cuesta cada hora que tu equipo pasa copiando datos a mano').",
          },
          por_que_es_distinto: {
            type: "string",
            description: "En una línea: qué lo separa de lo ya publicado. Si no puedes " +
              "explicarlo, es que no es distinto.",
          },
        },
      },
    },
  },
};

const schemaVeredicto = {
  type: "object",
  additionalProperties: false,
  required: ["elegido_index", "descartes"],
  properties: {
    elegido_index: {
      type: "number",
      description: "Índice (base 0) del candidato genuinamente NUEVO que mejor funciona. " +
        "Si TODOS repiten algo del historial, devuelve -1.",
    },
    descartes: {
      type: "array",
      description: "Los candidatos que descartaste por parecerse a algo ya publicado.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "se_parece_a", "razon"],
        properties: {
          index: { type: "number", description: "Índice (base 0) del candidato descartado." },
          se_parece_a: { type: "string", description: "El ángulo del historial al que se parece, citado." },
          razon: { type: "string", description: "En una línea, qué comparten realmente." },
        },
      },
    },
  },
};

/**
 * Pide N ángulos candidatos. Respuesta corta a propósito: acá todavía no se
 * escribe el carrusel, solo se decide de qué va a tratar.
 */
export async function proponer(claudeFn, apiKey, {
  instruccion, research = "", historial = [], n = CANDIDATOS_POR_DEFECTO, extra = "",
}) {
  const hist = historial.length
    ? historial.map((h) => `- ${h}`).join("\n")
    : "(sin historial todavía)";

  const r = await claudeFn(apiKey, {
    model: MODELO,
    // 4000, no 1500: la primera corrida real (23-ago-2026) devolvio el JSON
    // cortado. Cinco candidatos con dos campos de prosa cada uno no caben en
    // 1500, y lo que se corta es el final de la ultima cadena.
    max_tokens: 4000,
    system:
      "Eres la directora creativa de una cuenta de Instagram que publica varias veces por semana " +
      "y lleva meses al aire. Tu trabajo acá es SOLO proponer ángulos, no escribir la pieza.\n\n" +
      "Un buen ángulo es específico y tiene filo: nombra un dolor, una cifra, una situación " +
      "reconocible. Un mal ángulo es un tema ('la importancia de la IA'), porque de un tema " +
      "salen mil piezas iguales.\n\n" +
      "Te paso todo lo ya publicado. Propón ángulos que NO se parezcan a eso — ni en palabras " +
      "ni en fondo. Dos ángulos con palabras distintas que dejan al lector con la misma idea " +
      "SON el mismo ángulo, y ese es justo el error que hay que evitar.",
    output_config: { format: { type: "json_schema", schema: schemaPropuesta } },
    messages: [{
      role: "user",
      content:
        `Tema/serie de hoy: ${instruccion}\n\n` +
        `YA PUBLICADO (no repetir nada de esto, ni en fondo):\n${hist}\n` +
        (research ? `\nInvestigación web de hoy (usa SOLO datos de acá si citas cifras):\n${research}\n` : "") +
        (extra ? `\n${extra}\n` : "") +
        `\nPropón ${n} ángulos distintos entre sí y distintos de todo lo publicado.`,
    }],
  });

  const { angulos } = parsearJSON(textoDe(claudeFn, r), r, "proponer");
  return (angulos || []).slice(0, n);
}

/**
 * Juez: compara los candidatos contra el historial COMPLETO y elige el que de
 * verdad es nuevo. Es una llamada aparte a propósito — quien juzga no es quien
 * propuso.
 */
export async function juzgar(claudeFn, apiKey, { candidatos, historial = [] }) {
  if (!candidatos.length) throw new Error("juzgar(): no llegó ningún candidato");

  /* Sin historial no hay nada contra qué comparar: el primero sirve y no se
     gasta una llamada. */
  if (!historial.length) {
    return { elegido: candidatos[0], elegido_index: 0, descartes: [], sin_historial: true };
  }

  const lista = candidatos.map((c, i) => `[${i}] ${c.angulo}`).join("\n");
  // Los ángulos históricos se recortan a 160 chars. Con 80 piezas y ángulos
  // largos, el juez tenía que CITAR el parecido dentro de `se_parece_a` y se
  // quedaba sin tokens: el 23-ago-2026 devolvió 0 chars con
  // stop_reason=max_tokens. Para decidir si dos ideas son la misma alcanza
  // con el comienzo de cada una.
  const hist = historial.map((h) => `- ${String(h).slice(0, 160)}`).join("\n");

  const r = await claudeFn(apiKey, {
    model: MODELO,
    max_tokens: 6000,
    system:
      "Tu único trabajo es detectar repetición. NO escribes contenido, NO propones ideas, " +
      "NO mejoras nada: comparas y decides.\n\n" +
      "Recibes ángulos candidatos y el historial de lo ya publicado en esa cuenta. Marca como " +
      "repetido todo candidato que le deje al lector la MISMA idea que algo del historial, " +
      "aunque esté dicho con otras palabras, otro ejemplo u otra industria. Eso es lo que la " +
      "audiencia percibe como 'ya vi esto'.\n\n" +
      "No seas exquisito al revés: que dos piezas compartan tema general (ambas sobre IA, " +
      "ambas sobre ahorro de tiempo) no las hace repetidas si el enfoque, el argumento y lo " +
      "que se lleva el lector son distintos. Repetido es misma idea, no mismo rubro.\n\n" +
      "Si TODOS los candidatos repiten, devuelve elegido_index = -1: es preferible pedir " +
      "ángulos nuevos que publicar lo mismo dos veces.",
    output_config: { format: { type: "json_schema", schema: schemaVeredicto } },
    messages: [{
      role: "user",
      content: `CANDIDATOS:\n${lista}\n\nYA PUBLICADO EN ESTA CUENTA:\n${hist}`,
    }],
  });

  const v = parsearJSON(textoDe(claudeFn, r), r, "juzgar");
  const idx = Number.isInteger(v.elegido_index) ? v.elegido_index : -1;
  const valido = idx >= 0 && idx < candidatos.length;

  return {
    elegido: valido ? candidatos[idx] : null,
    elegido_index: valido ? idx : -1,
    descartes: v.descartes || [],
    sin_historial: false,
  };
}

/**
 * Orquesta las dos fases y reintenta si el juez rechazó todo.
 *
 * Devuelve `{ angulo, intentos, descartes, agotado }`. `agotado: true`
 * significa que ni con reintentos salió algo nuevo — el llamador decide si
 * publica igual el mejor candidato o si aborta. NO se cae solo: quedarse sin
 * publicar es peor que publicar algo parecido, pero el llamador tiene que
 * poder verlo y avisar.
 */
export async function elegirAngulo(claudeFn, apiKey, {
  instruccion, research = "", historial = [], n = CANDIDATOS_POR_DEFECTO, maxIntentos = 2,
}) {
  let descartesTotales = [];
  let ultimosCandidatos = [];

  for (let intento = 1; intento <= maxIntentos; intento++) {
    /* En el segundo intento se le dice explícitamente qué se descartó y por
       qué: repetir el mismo pedido a ciegas suele devolver lo mismo. */
    const extra = descartesTotales.length
      ? "Ya descartamos estos ángulos por repetir lo publicado, no vuelvas a proponerlos ni " +
        "variantes suyas:\n" + descartesTotales.map((d) => `- ${d.se_parece_a} → ${d.razon}`).join("\n")
      : "";

    const candidatos = await proponer(claudeFn, apiKey, { instruccion, research, historial, n, extra });
    ultimosCandidatos = candidatos;
    if (!candidatos.length) continue;

    const veredicto = await juzgar(claudeFn, apiKey, { candidatos, historial });
    if (veredicto.elegido) {
      return {
        angulo: veredicto.elegido,
        intentos: intento,
        descartes: [...descartesTotales, ...veredicto.descartes],
        agotado: false,
      };
    }
    descartesTotales = [...descartesTotales, ...veredicto.descartes];
  }

  /* Agotados los intentos: se devuelve el primer candidato del último lote
     marcado como agotado, para que el llamador avise en vez de fallar mudo. */
  return {
    angulo: ultimosCandidatos[0] || null,
    intentos: maxIntentos,
    descartes: descartesTotales,
    agotado: true,
  };
}

/* `textOf` vive en barbara.mjs y en motor.mjs con firmas distintas, y este
   módulo lo usan los dos. En vez de importar uno y acoplarse, se extrae acá
   la única forma que importa: concatenar los bloques de texto de la
   respuesta. `claudeFn` queda sin usar — está en la firma solo para que el
   día que alguna variante devuelva otra forma se pueda ramificar sin tocar a
   los llamadores. */
function textoDe(_claudeFn, respuesta) {
  return (respuesta.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Parsea el JSON diciendo la causa real cuando falla.
 *
 * El 23-ago-2026, la primera corrida real de este módulo murió con
 * "Unterminated string in JSON at position 703" — el mismo mensaje inútil que
 * ya había costado caro una vez en barbara.mjs. Un JSON cortado tiene dos
 * causas posibles y el arreglo es distinto para cada una, así que hay que
 * distinguirlas en vez de adivinar: se quedó sin tokens (subir max_tokens o
 * acortar el schema), o el modelo devolvió algo que no era JSON (mirar qué).
 */
export function parsearJSON(crudo, respuesta, etiqueta) {
  try {
    return JSON.parse(crudo);
  } catch (e) {
    const razon = respuesta?.stop_reason === "max_tokens"
      ? `se quedó sin tokens (stop_reason=max_tokens). Sube max_tokens o acorta el schema de ${etiqueta}.`
      : `devolvió algo que no es JSON válido (stop_reason=${respuesta?.stop_reason}).`;
    throw new Error(
      `${etiqueta}: ${razon} ${crudo.length} chars recibidos. ` +
      `Empieza con: ${JSON.stringify(crudo.slice(0, 120))}. Error: ${String(e).slice(0, 100)}`
    );
  }
}
