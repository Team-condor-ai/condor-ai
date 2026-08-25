// condor.ai · Bárbara — corrección dirigida.
//
// QUÉ RESUELVE
// ---------------------------------------------------------------------------
// Que un reintento arregle LO QUE EL CLIENTE PIDIÓ, en vez de generar otra
// pieza distinta y esperar que le guste.
//
// Antes de esto, `clientes.mjs` en RETRY le decía al modelo "genera una
// versión claramente mejor y distinta" — sin pasarle el pedido del cliente
// (vivía en `barbara_chats`, que nadie leía) ni la pieza anterior (no se
// guardaba). O sea: no corregía, rehacía. El cliente pedía "el titular del
// slide 3 más corto" y recibía un carrusel entero nuevo donde el titular
// largo a veces seguía ahí, habiendo gastado uno de sus 3 intentos.
//
// EL CICLO, EN CUATRO PASOS
// ---------------------------------------------------------------------------
//   1. LEER    · qué escribió el cliente y qué pieza estaba mirando
//   2. EXTRAER · convertir esa frase en una lista de cambios concretos
//   3. APLICAR · regenerar pidiendo que cambie SOLO eso (lo hace clientes.mjs)
//   4. VERIFICAR · comprobar punto por punto antes de mandársela
//
// POR QUÉ UNA LISTA Y NO EL TEXTO CRUDO
// ---------------------------------------------------------------------------
// "El logo chico y el fondo oscuro, y el precio está mal" no se puede
// verificar: o el modelo dice que lo hizo, o no. Como lista de tres puntos sí
// — y además se puede pedir "no toques nada más", que con texto libre es una
// sugerencia y con lista es una instrucción comprobable.
//
// Y sirve para algo que no es obvio: saber CUÁNTOS INTENTOS cuesta cada tipo
// de cambio. Si "acortar textos" siempre sale a la primera y "cambiar el
// tono" nunca, eso dice dónde está el trabajo pendiente del producto. Es un
// dato que hoy no existe en ninguna parte.

import { claude, textOf } from "./motor.mjs";

const MODELO = "claude-sonnet-5";

// Un cliente puede mandar tres mensajes seguidos describiendo lo mismo. Se
// leen todos los del último tramo, no solo el último: quedarse con el último
// pierde la mitad del pedido, que es justo lo que hace que "no me hiciste
// caso" sea verdad.
const MAX_MENSAJES = 6;

const schemaCambios = {
  type: "object",
  additionalProperties: false,
  properties: {
    cambios: {
      type: "array",
      description: "Cada cosa distinta que el cliente pidió cambiar. Si pidió una sola cosa, un solo elemento. NO inventes cambios que no pidió.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "number", description: "1, 2, 3… en el orden en que aparecen en el mensaje." },
          que: { type: "string", description: "Qué elemento concreto hay que cambiar, en 1-4 palabras. Ej: 'titular del slide 3', 'color de fondo', 'el precio'." },
          accion: { type: "string", description: "Qué hay que hacerle, en una frase corta y verificable. Ej: 'acortarlo a menos de 6 palabras', 'cambiarlo a $9.990'." },
          alcance: {
            type: "string",
            enum: ["texto", "diseno", "dato", "tono", "otro"],
            description: "texto = copy; diseno = colores/plantilla/composición; dato = un número o hecho concreto; tono = registro o estilo de habla; otro = no calza.",
          },
        },
        required: ["id", "que", "accion", "alcance"],
      },
    },
    es_correccion: {
      type: "boolean",
      description: "false si el mensaje NO pide ningún cambio (un 'gracias', una pregunta, un 'me gustó'). En ese caso `cambios` va vacío.",
    },
  },
  required: ["cambios", "es_correccion"],
};

const schemaVerificacion = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultados: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "number", description: "El id del cambio pedido." },
          cumplido: { type: "boolean", description: "¿La versión nueva hace lo que se pidió en ese punto?" },
          motivo: { type: "string", description: "Si no se cumplió, por qué, en una frase. Si se cumplió, vacío." },
        },
        required: ["id", "cumplido", "motivo"],
      },
    },
    cambio_de_mas: {
      type: "string",
      description: "Si la versión nueva cambió algo que NADIE pidió cambiar, descríbelo en una frase. Vacío si respetó el resto.",
    },
  },
  required: ["resultados", "cambio_de_mas"],
};

/** La última pieza generada para ese cliente, con su contenido. */
export async function piezaAnterior(db, barbaraId, tipo, piezaId = "") {
  if (piezaId) {
    const exacta = await db.get(
      `barbara_memoria?id=eq.${piezaId}&barbara_cliente_id=eq.${barbaraId}` +
      `&select=id,fecha,angulo,contenido,creado_en,tipo&limit=1`,
    ).catch(() => []);
    return exacta[0] || null;
  }
  const filas = await db.get(
    `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&tipo=eq.${tipo}` +
    `&select=id,fecha,angulo,contenido,creado_en&order=creado_en.desc&limit=1`
  ).catch(() => []);
  return filas[0] || null;
}

/**
 * Lo que escribió el cliente después de recibir esa pieza.
 *
 * Se filtra por fecha de la pieza y no simplemente "los últimos N mensajes"
 * porque si el cliente escribió algo la semana pasada y hoy no dijo nada, ese
 * mensaje viejo no es una corrección de la pieza de hoy — y tomarlo como tal
 * haría que Bárbara "corrija" algo que nadie pidió.
 */
export async function leerPedido(db, barbaraId, desdeISO, piezaId = "") {
  const desde = desdeISO ? `&creado_en=gt.${desdeISO}` : "";
  const pieza = piezaId ? `&pieza_id=eq.${piezaId}` : "";
  const filas = await db.get(
    `barbara_chats?barbara_cliente_id=eq.${barbaraId}&remitente=eq.cliente${pieza}${desde}` +
    `&select=mensaje,creado_en&order=creado_en.desc&limit=${MAX_MENSAJES}`
  ).catch(() => []);
  return filas.reverse().map((f) => f.mensaje).filter(Boolean);
}

/** La frase del cliente convertida en lista de cambios concretos. */
export async function extraerCambios(AK, mensajes, piezaPrevia) {
  if (!mensajes.length) return { cambios: [], es_correccion: false };

  const previa = piezaPrevia?.contenido
    ? `\n\nLA PIEZA QUE ESTÁ MIRANDO:\n${JSON.stringify(piezaPrevia.contenido).slice(0, 3000)}`
    : "";

  const d = await claude(AK, {
    model: MODELO,
    max_tokens: 1200,
    system:
      "Conviertes el pedido de un cliente en una lista de cambios concretos y verificables. " +
      "NO inventes cambios que no pidió, NO agregues mejoras de tu cosecha, NO interpretes de más: " +
      "si dijo una sola cosa, la lista tiene un solo elemento. Un pedido vago " +
      "('no me convence', 'algo le falta') es UN cambio de alcance 'otro' con la acción tal como la " +
      "expresó, no tres cambios inventados. Responde SOLO con el JSON.",
    output_config: { format: { type: "json_schema", schema: schemaCambios } },
    messages: [{
      role: "user",
      content: `MENSAJES DEL CLIENTE (en orden):\n${mensajes.map((m, i) => `${i + 1}. ${m}`).join("\n")}${previa}`,
    }],
  });
  const r = JSON.parse(textOf(d));
  return { cambios: r.cambios || [], es_correccion: !!r.es_correccion };
}

/** El bloque de instrucciones que se le agrega al prompt de generación. */
export function instrucciones(cambios, piezaPrevia) {
  if (!cambios.length) return "";
  const lista = cambios.map((c) => `  ${c.id}. ${c.que} → ${c.accion}`).join("\n");
  const antes = piezaPrevia?.contenido
    ? `\n\nLA VERSIÓN ANTERIOR (es la que hay que corregir, NO empieces de cero):\n${JSON.stringify(piezaPrevia.contenido)}`
    : "";
  return `

⚠️ ESTO ES UNA CORRECCIÓN, NO UNA PIEZA NUEVA.

El cliente pidió exactamente estos cambios:
${lista}

Reglas de la corrección, en orden de importancia:
  · Haz esos cambios y NADA MÁS. Todo lo que no está en la lista se queda
    igual: los mismos titulares, el mismo orden, el mismo ángulo.
  · No "aproveches" para mejorar otra cosa. Cambiar algo que el cliente no
    pidió es el motivo más común de que una corrección se sienta ignorada:
    él busca su cambio, ve todo distinto, y no encuentra lo que pidió.
  · Si un punto te parece una mala idea, hazlo igual. La marca es del
    cliente.${antes}`;
}

/**
 * ¿La versión nueva cumple cada punto?
 *
 * Se hace en una llamada aparte y no dentro de la generación a propósito: un
 * modelo que revisa su propio trabajo en el mismo turno tiende a darse por
 * bueno. Y es barato — compara dos JSON de texto, no imágenes.
 */
export async function verificar(AK, cambios, antes, despues) {
  if (!cambios.length) return { resultados: [], cambio_de_mas: "" };

  const d = await claude(AK, {
    model: MODELO,
    max_tokens: 1200,
    system:
      "Compruebas si una versión corregida cumple los cambios que se pidieron. " +
      "Eres estricto: si no se ve el cambio, no está cumplido, aunque la versión nueva sea " +
      "mejor en general. 'Quedó mejor' no es 'se hizo lo que pedí'. " +
      "Responde SOLO con el JSON.",
    output_config: { format: { type: "json_schema", schema: schemaVerificacion } },
    messages: [{
      role: "user",
      content:
        `CAMBIOS PEDIDOS:\n${cambios.map((c) => `${c.id}. ${c.que} → ${c.accion}`).join("\n")}\n\n` +
        `ANTES:\n${JSON.stringify(antes).slice(0, 4000)}\n\n` +
        `DESPUÉS:\n${JSON.stringify(despues).slice(0, 4000)}`,
    }],
  });
  const r = JSON.parse(textOf(d));
  return { resultados: r.resultados || [], cambio_de_mas: r.cambio_de_mas || "" };
}

/** Los que no se lograron, con su descripción, listos para avisarle a staff. */
export function faltantes(cambios, resultados) {
  const porId = new Map(resultados.map((r) => [r.id, r]));
  return cambios
    .filter((c) => porId.get(c.id) && !porId.get(c.id).cumplido)
    .map((c) => ({ id: c.id, que: c.que, accion: c.accion, motivo: porId.get(c.id).motivo || "" }));
}
