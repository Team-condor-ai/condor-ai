import assert from "node:assert/strict";
import test from "node:test";

/**
 * Copia EXACTA de `parseComando` de
 * `supabase/functions/telegram-barbara-clientes/index.ts`.
 *
 * Se duplica a propósito: esa función vive en una Edge Function de Deno que
 * este proyecto no puede importar desde Node. Duplicar 15 líneas es mejor que
 * dejar sin test la pieza que decide si un mensaje del equipo se atiende o se
 * ignora — que es justo donde estaba el bug del 23-ago.
 *
 * Si se toca allá, hay que tocar acá.
 */
function parseComando(texto) {
  const limpio = texto.trim().replace(/\s+/g, " ");
  const bajo = limpio.toLowerCase();
  for (const alias of ["denuevo barbara", "de nuevo barbara", "aprobar barbara"]) {
    // Tiene que EMPEZAR con el comando y seguir con un separador (o terminar
    // ahi). Exigir separador evita que "denuevo barbarita" se cuele; aceptar
    // cualquier puntuacion evita el hueco que encontro el test: escribir
    // "Denuevo barbara: mas corto" no matcheaba con solo espacio y coma.
    if (!bajo.startsWith(alias)) continue;
    const siguiente = bajo[alias.length];
    if (siguiente === undefined || /[\s,.:;!?¡¿()\[\]-]/.test(siguiente)) {
      const comando = alias === "aprobar barbara" ? "aprobar" : "denuevo";
      const resto = limpio.slice(alias.length).replace(/^[\s,.:;-]+/, "").trim();
      return { comando, resto };
    }
  }
  return null;
}

test("el comando pelado sigue funcionando igual que antes", () => {
  assert.deepEqual(parseComando("Denuevo barbara"), { comando: "denuevo", resto: "" });
  assert.deepEqual(parseComando("de nuevo barbara"), { comando: "denuevo", resto: "" });
  assert.deepEqual(parseComando("Aprobar barbara"), { comando: "aprobar", resto: "" });
});

test("EL BUG DEL 23-AGO: con explicación detrás ya no se ignora", () => {
  // Antes esto era `texto === "denuevo barbara"`, coincidencia exacta: el
  // mensaje no hacía nada, ni regeneraba ni contestaba, y encima se perdía la
  // parte útil.
  const r = parseComando("Denuevo barbara, el titular del slide 2 está muy largo");
  assert.equal(r.comando, "denuevo");
  assert.equal(r.resto, "el titular del slide 2 está muy largo");
});

test("acepta separarlo con espacio, coma o dos puntos", () => {
  for (const sep of [" ", ", ", ": ", " - "]) {
    const r = parseComando(`Denuevo barbara${sep}más corto`);
    assert.equal(r.resto, "más corto", `falló con separador ${JSON.stringify(sep)}`);
  }
});

test("conserva tildes y mayúsculas del resto", () => {
  // El resto se le pasa a un modelo: "más corto" no es "mas corto", y bajar
  // todo a minúsculas perdería énfasis y nombres propios.
  const r = parseComando("denuevo barbara Cámbiale el TÍTULO a algo más corto");
  assert.equal(r.resto, "Cámbiale el TÍTULO a algo más corto");
});

test("normaliza espacios de más sin romper el texto", () => {
  const r = parseComando("  Denuevo    barbara   el   fondo  más  oscuro  ");
  assert.equal(r.comando, "denuevo");
  assert.equal(r.resto, "el fondo más oscuro");
});

test("no confunde un mensaje que sólo MENCIONA el comando", () => {
  // Tiene que empezar con el comando. Si no, cualquier conversación del grupo
  // dispararía workflows.
  assert.equal(parseComando("hay que hacer denuevo barbara mañana"), null);
  assert.equal(parseComando("¿le decimos aprobar barbara?"), null);
});

test("un mensaje cualquiera del grupo no dispara nada", () => {
  assert.equal(parseComando("buenas, alguien vio el carrusel?"), null);
  assert.equal(parseComando("barbara"), null);
  assert.equal(parseComando(""), null);
});

test("no se activa con una palabra pegada al comando", () => {
  // "denuevo barbarax" no es el comando; exigir separador evita falsos
  // positivos con nombres o hashtags.
  assert.equal(parseComando("denuevo barbarita"), null);
  assert.equal(parseComando("aprobar barbaras"), null);
});

test("aprobar con texto detrás se atiende igual (el resto se ignora)", () => {
  // Aprobar no admite matices: publica la pieza tal cual. Pero si alguien
  // escribe "Aprobar barbara dale", tiene que publicar, no quedarse mudo.
  const r = parseComando("Aprobar barbara dale nomás");
  assert.equal(r.comando, "aprobar");
});
