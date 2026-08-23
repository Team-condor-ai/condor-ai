/**
 * Bárbara · lo que el equipo de Cóndor le corrigió, convertido en regla.
 *
 * EL AGUJERO QUE TAPA
 * ---------------------------------------------------------------------------
 * Desde el 23-ago-2026 el equipo puede escribir "Denuevo barbara, los
 * titulares muy largos" y Bárbara corrige eso. Pero lo corregía UNA vez y se
 * olvidaba: a la semana siguiente volvía a escribir titulares largos y había
 * que pedírselo de nuevo.
 *
 * Para los clientes esto ya estaba resuelto (`barbara_reglas` +
 * `barbara-destilar-regla`). La cuenta propia de Cóndor se había quedado sin
 * memoria de sus propias correcciones — el clásico "en casa de herrero,
 * cuchillo de palo".
 *
 * LO QUE DECIDE, Y POR QUÉ IMPORTA
 * ---------------------------------------------------------------------------
 * Distingue una corrección PUNTUAL ("el slide 5 no pega con el tema") de una
 * preferencia DURADERA ("los titulares en 5 palabras o menos"). Sólo la
 * segunda se guarda.
 *
 * Guardar todo es el modo exacto en que este tipo de memoria falla: la lista
 * se llena de arreglos de una pieza puntual, ocupa el prompt, y la generación
 * empeora en vez de mejorar. Ante la duda NO se guarda — una regla de menos
 * sólo significa que el equipo la va a repetir, y ahí sí se guarda; una regla
 * de más contamina todo lo que venga después.
 *
 * POR QUÉ UN ARCHIVO Y NO SUPABASE
 * ---------------------------------------------------------------------------
 * `barbara.mjs` no tiene `barbara_cliente_id` (no es un cliente, es la cuenta
 * propia) y ya persiste su estado en el repo con `content-log.json`, que el
 * workflow commitea solo. Meter una tabla nueva con un id centinela sería más
 * partes móviles para el mismo resultado.
 */

import { readFileSync, writeFileSync } from "node:fs";

const MODELO = "claude-sonnet-5";
export const ARCHIVO_REGLAS = "services/barbara/reglas-condor.json";

/* Tope de reglas que viajan al prompt. Más que esto deja de ser memoria y pasa
   a ser un manual que compite con la instrucción del día. */
const MAX_EN_PROMPT = 20;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["es_duradera", "regla", "categoria"],
  properties: {
    es_duradera: {
      type: "boolean",
      description:
        "true SÓLO si expresa una preferencia estable que conviene aplicar SIEMPRE. " +
        "false si es un arreglo puntual de esta pieza.",
    },
    regla: {
      type: "string",
      description:
        "La preferencia en una frase corta, en imperativo y accionable para un director " +
        "creativo. Ej: 'mantén los titulares en 5 palabras o menos'. Vacío si no es duradera.",
    },
    categoria: {
      type: "string",
      enum: ["copy", "diseno", "producto", "tono", "formato", "ninguna"],
    },
  },
};

const SISTEMA = `Analizas la corrección que el equipo de Cóndor le hizo a una pieza de su propia
cuenta de Instagram y decides si expresa una PREFERENCIA DURADERA (que conviene aplicar a todo lo
que se genere de aquí en adelante) o un ARREGLO PUNTUAL de esa pieza.

Duradera: "los titulares más cortos", "nunca uses fondos oscuros en el noticiero",
"siempre cierra con una pregunta", "no me gusta el tono vendedor".
Puntual: "el slide 5 no tiene que ver con el tema", "esa cifra está mal", "cambia esa imagen",
"esta vez habla de retención".

Ante la duda, responde que NO es duradera. Una regla de más contamina todo lo que se genere
después; una regla de menos sólo significa que el equipo la va a repetir, y ahí sí se guarda.

Responde SOLO con el JSON pedido.`;

/* Normalizar para comparar: sin acentos, sin mayúsculas, sin puntuación. Lo
   que importa es si dicen lo mismo, no cómo se escribieron. */
const norm = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function leerReglas(ruta = ARCHIVO_REGLAS) {
  try {
    const d = JSON.parse(readFileSync(ruta, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

export function guardarReglas(reglas, ruta = ARCHIVO_REGLAS) {
  writeFileSync(ruta, JSON.stringify(reglas, null, 2) + "\n");
}

/**
 * Mete la regla nueva en la lista: refuerza si ya estaba, agrega si no.
 *
 * Que el equipo repita algo ES la señal de que le importa — vale más subir el
 * contador que tener dos filas casi iguales compitiendo por el mismo espacio
 * del prompt. Devuelve `{ reglas, reforzada }` sin mutar la lista original.
 */
export function integrar(reglas, regla, { categoria = null, origen = "", fecha = null } = {}) {
  const limpia = String(regla).trim();
  if (!limpia) return { reglas, reforzada: false };

  const hoy = fecha || new Date().toISOString().slice(0, 10);
  const idx = reglas.findIndex((r) => norm(r.regla) === norm(limpia));

  if (idx >= 0) {
    const copia = reglas.map((r, i) =>
      i === idx ? { ...r, veces_reforzada: (r.veces_reforzada || 1) + 1, actualizada: hoy } : r);
    return { reglas: copia, reforzada: true };
  }
  return {
    reglas: [...reglas, {
      regla: limpia, categoria, origen: String(origen).slice(0, 300),
      veces_reforzada: 1, creada: hoy, actualizada: hoy, activa: true,
    }],
    reforzada: false,
  };
}

/** Pregunta al modelo si la corrección es duradera. `claudeFn` es (apiKey, body). */
export async function destilar(claudeFn, apiKey, { texto, previas = [] }) {
  const lista = previas.length
    ? previas.map((r) => `- ${r.regla}`).join("\n")
    : "(ninguna todavía)";

  const d = await claudeFn(apiKey, {
    model: MODELO,
    max_tokens: 600,
    system: SISTEMA,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{
      role: "user",
      content:
        `Reglas que la cuenta YA tiene:\n${lista}\n\n` +
        `Corrección nueva del equipo:\n"${texto}"\n\n` +
        `¿Es una preferencia duradera? Si ya está cubierta por una regla existente, ` +
        `devuelve esa MISMA redacción para que se refuerce en vez de duplicarse.`,
    }],
  });

  const crudo = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const r = JSON.parse(crudo);
  return {
    es_duradera: Boolean(r.es_duradera),
    regla: String(r.regla || "").trim(),
    categoria: r.categoria === "ninguna" ? null : (r.categoria || null),
  };
}

/**
 * Ciclo completo: destila, integra y guarda. Nunca lanza — si algo falla, la
 * corrección de HOY ya se aplicó igual; aprender no puede costarle la pieza al
 * equipo. Devuelve qué pasó, para poder registrarlo.
 */
export async function aprenderDeCorreccion(claudeFn, apiKey, texto, { ruta = ARCHIVO_REGLAS } = {}) {
  try {
    const previas = leerReglas(ruta).filter((r) => r.activa !== false);
    const d = await destilar(claudeFn, apiKey, { texto, previas });
    if (!d.es_duradera || !d.regla) return { guardada: false, motivo: "corrección puntual" };

    const { reglas, reforzada } = integrar(leerReglas(ruta), d.regla, {
      categoria: d.categoria, origen: texto,
    });
    guardarReglas(reglas, ruta);
    return { guardada: true, reforzada, regla: d.regla };
  } catch (e) {
    return { guardada: false, motivo: "error: " + String(e).slice(0, 140) };
  }
}

/** El bloque para el prompt del director. "" si no hay nada que decir. */
export function bloquePrompt(reglas) {
  const activas = (reglas || [])
    .filter((r) => r.activa !== false && r.regla)
    .sort((a, b) => (b.veces_reforzada || 1) - (a.veces_reforzada || 1))
    .slice(0, MAX_EN_PROMPT);
  if (!activas.length) return "";

  return "\n\nLO QUE EL EQUIPO YA TE CORRIGIÓ (respétalo SIEMPRE, es lo que más pesa):\n" +
    activas.map((r) =>
      `- ${r.regla}${(r.veces_reforzada || 1) > 1 ? ` (lo pidieron ${r.veces_reforzada} veces)` : ""}`
    ).join("\n");
}
