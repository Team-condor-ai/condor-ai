/**
 * Bárbara · revisión visual antes de entregar.
 *
 * POR QUÉ EXISTE
 * ---------------------------------------------------------------------------
 * Hasta ahora nadie MIRABA las imágenes antes de mandarlas. El prompt pedía
 * las cosas bien y se asumía que salían bien, y no: el 23-ago-2026 salieron a
 * Telegram piezas con "Espar añados" y "Endor cliente" (palabras que no
 * existen), titulares cortados por la banda del logo, el personaje encima del
 * subtítulo y círculos fantasma alrededor del personaje.
 *
 * Todos esos errores son evidentes A LA VISTA y ninguno se puede detectar
 * leyendo el JSON del plan: pasan al DIBUJAR. La única forma de cazarlos antes
 * de entregar es mirar el PNG.
 *
 * QUÉ BUSCA, Y QUÉ NO
 * ---------------------------------------------------------------------------
 * El listón es "sin errores evidentes", no "perfecto". Se rechaza lo que
 * cualquiera notaría de inmediato:
 *   · palabras mal escritas o inventadas;
 *   · texto cortado, pisado o ilegible;
 *   · formas fantasma (cajas, círculos) que no son parte del diseño;
 *   · elementos que se tapan entre sí.
 *
 * NO se rechaza por gusto: que un color no convenza o que la composición
 * pudiera ser mejor no es un defecto. Un revisor exquisito rechaza todo, y un
 * paso que siempre rechaza se termina desactivando.
 *
 * CÓMO SE USA
 * ---------------------------------------------------------------------------
 * Se le pasan los buffers ya compuestos (con logo y personaje pegados): lo que
 * se revisa tiene que ser exactamente lo que se va a publicar, no un paso
 * intermedio.
 */

const MODELO = "claude-sonnet-5";

// Ancho al que se reducen las imágenes para revisar. 900px alcanza de sobra
// para leer un titular y notar un solape, y baja bastante el costo respecto
// de mandar el PNG de 1k completo.
export const ANCHO_REVISION = 900;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["piezas"],
  properties: {
    piezas: {
      type: "array",
      description: "Un elemento por imagen, EN EL MISMO ORDEN en que se entregaron.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["indice", "aprobada", "problemas"],
        properties: {
          indice: { type: "number", description: "Posición de la imagen, base 0." },
          aprobada: {
            type: "boolean",
            description: "false SÓLO si tiene un error evidente de los listados. " +
              "Una pieza mejorable pero sin errores va aprobada.",
          },
          problemas: {
            type: "array",
            description: "Los errores concretos encontrados. Vacío si está aprobada.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["tipo", "detalle"],
              properties: {
                tipo: {
                  type: "string",
                  enum: ["ortografia", "texto_cortado", "solape", "forma_fantasma", "ilegible", "otro"],
                },
                detalle: {
                  type: "string",
                  description: "Qué se ve mal y dónde, en una frase. Cita el texto exacto si es ortografía.",
                },
              },
            },
          },
        },
      },
    },
  },
};

const SISTEMA = `Revisas piezas gráficas para Instagram ANTES de publicarlas. Tu trabajo es
cazar errores evidentes, no opinar de diseño.

RECHAZA una pieza sólo si tiene alguno de estos:
· ORTOGRAFÍA: una palabra mal escrita, partida, inventada o que no existe en español.
  Es el error más frecuente y el más grave: el texto lo DIBUJA un modelo de imagen, y
  cuando falla produce cosas como "Espar añados" o "Endor cliente". Lee cada palabra.
· TEXTO CORTADO: un titular al que le falta el borde superior o inferior de las letras,
  o que se sale del cuadro.
· SOLAPE: dos elementos encimados de modo que uno tapa al otro — texto sobre una
  ilustración, un círculo sobre una línea de texto.
· FORMA FANTASMA: una caja, rectángulo o círculo que no pertenece al diseño y se nota
  como una mancha de otro tono sobre el fondo.
· ILEGIBLE: texto con contraste insuficiente contra su fondo.

NO rechaces por: gusto estético, que la composición podría ser mejor, que el color no
convence, que sobra espacio, o que el copy podría ser más corto. Nada de eso es un
error. El listón es "sin errores evidentes", no "perfecto".

Ante la duda, APRUEBA. Un revisor que rechaza todo termina apagado, y entonces no
revisa nada.

Responde SOLO con el JSON.`;

/**
 * Mira las imágenes y devuelve un veredicto por cada una.
 *
 * `imagenes`: array de Buffer PNG, en el orden en que se van a publicar.
 * `reducir`: función (buf) => Promise<Buffer> para achicar antes de mandar.
 */
export async function revisar(claudeFn, apiKey, imagenes, { reducir = null } = {}) {
  if (!imagenes.length) return [];

  const contenido = [];
  for (let i = 0; i < imagenes.length; i++) {
    const buf = reducir ? await reducir(imagenes[i]) : imagenes[i];
    contenido.push({ type: "text", text: `Imagen ${i} (índice ${i}):` });
    contenido.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: buf.toString("base64") },
    });
  }
  contenido.push({
    type: "text",
    text: `Revisa las ${imagenes.length} imágenes y devuelve un veredicto por cada una, ` +
      `en el mismo orden. Lee CADA palabra buscando errores de ortografía.`,
  });

  const d = await claudeFn(apiKey, {
    model: MODELO,
    max_tokens: 4000,
    system: SISTEMA,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: contenido }],
  });

  const crudo = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let parsed;
  try {
    parsed = JSON.parse(crudo);
  } catch (e) {
    throw new Error(
      `revisión: respuesta no parseable (stop_reason=${d.stop_reason}, ${crudo.length} chars): ` +
      String(e).slice(0, 120)
    );
  }

  // Se normaliza a un veredicto por imagen: si el modelo devuelve de menos, lo
  // que falta se da por aprobado. Bloquear una entrega por una respuesta
  // incompleta del revisor sería peor que dejar pasar la pieza.
  const porIndice = new Map((parsed.piezas || []).map((p) => [p.indice, p]));
  return imagenes.map((_, i) => {
    const p = porIndice.get(i);
    if (!p) return { indice: i, aprobada: true, problemas: [] };
    return {
      indice: i,
      aprobada: p.aprobada !== false,
      problemas: p.aprobada === false ? (p.problemas || []) : [],
    };
  });
}

/** Los índices que hay que rehacer. */
export const rechazadas = (veredictos) =>
  veredictos.filter((v) => !v.aprobada).map((v) => v.indice);

/** Resumen legible para el mensaje de Telegram. "" si salió todo limpio. */
export function resumen(veredictos) {
  const malas = veredictos.filter((v) => !v.aprobada);
  if (!malas.length) return "";
  const lineas = malas.map((v) => {
    const detalle = (v.problemas || [])
      .map((p) => `${p.tipo}: ${p.detalle}`)
      .join(" · ") || "sin detalle";
    return `  · slide ${v.indice + 1} — ${detalle}`;
  });
  return `\n\n🔍 *La revisión encontró:*\n${lineas.join("\n")}`;
}
