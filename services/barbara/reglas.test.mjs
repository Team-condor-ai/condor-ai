import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  integrar, leerReglas, guardarReglas, destilar, aprenderDeCorreccion, bloquePrompt,
} from "./reglas.mjs";

function claudeFalso(respuesta) {
  const llamadas = [];
  const fn = async (apiKey, body) => {
    llamadas.push({ apiKey, body });
    if (respuesta instanceof Error) throw respuesta;
    return { content: [{ type: "text", text: JSON.stringify(respuesta) }] };
  };
  fn.llamadas = llamadas;
  return fn;
}

function rutaTmp(t, contenido = null) {
  const dir = mkdtempSync(join(tmpdir(), "barbara-reglas-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ruta = join(dir, "reglas.json");
  if (contenido) writeFileSync(ruta, JSON.stringify(contenido));
  return ruta;
}

test("una regla nueva se agrega con el contador en 1", () => {
  const { reglas, reforzada } = integrar([], "mantén los titulares en 5 palabras");
  assert.equal(reforzada, false);
  assert.equal(reglas.length, 1);
  assert.equal(reglas[0].veces_reforzada, 1);
  assert.equal(reglas[0].activa, true);
});

test("repetir la misma regla la REFUERZA en vez de duplicarla", () => {
  // Que el equipo lo repita es la señal de que importa. Dos filas casi
  // iguales sólo compiten por el mismo espacio del prompt.
  const base = integrar([], "titulares cortos").reglas;
  const { reglas, reforzada } = integrar(base, "titulares cortos");
  assert.equal(reforzada, true);
  assert.equal(reglas.length, 1);
  assert.equal(reglas[0].veces_reforzada, 2);
});

test("reconoce la misma regla escrita con tildes, mayúsculas o puntuación distinta", () => {
  const base = integrar([], "Mantén los titulares CORTOS.").reglas;
  const { reglas, reforzada } = integrar(base, "manten los titulares cortos");
  assert.equal(reforzada, true, "sin normalizar, se duplicaría por una tilde");
  assert.equal(reglas.length, 1);
});

test("integrar no muta la lista original", () => {
  const original = integrar([], "una regla").reglas;
  const antes = JSON.stringify(original);
  integrar(original, "otra regla");
  assert.equal(JSON.stringify(original), antes);
});

test("una regla vacía no entra", () => {
  assert.equal(integrar([], "   ").reglas.length, 0);
});

test("destilar devuelve lo que dijo el modelo, normalizado", async () => {
  const claude = claudeFalso({ es_duradera: true, regla: "  cierra con pregunta  ", categoria: "copy" });
  const d = await destilar(claude, "k", { texto: "siempre cierra preguntando", previas: [] });
  assert.equal(d.es_duradera, true);
  assert.equal(d.regla, "cierra con pregunta");
  assert.equal(d.categoria, "copy");
});

test("categoría 'ninguna' se guarda como null, no como el string", async () => {
  const claude = claudeFalso({ es_duradera: true, regla: "x", categoria: "ninguna" });
  assert.equal((await destilar(claude, "k", { texto: "y" })).categoria, null);
});

test("destilar le pasa las reglas previas para que pueda reforzar", async () => {
  const claude = claudeFalso({ es_duradera: false, regla: "", categoria: "ninguna" });
  await destilar(claude, "k", { texto: "algo", previas: [{ regla: "regla vieja" }] });
  assert.match(claude.llamadas[0].body.messages[0].content, /regla vieja/);
});

test("una corrección PUNTUAL no se guarda", async (t) => {
  // Es la decisión central: guardar todo llena la lista de arreglos de una
  // pieza y empeora la generación en vez de mejorarla.
  const ruta = rutaTmp(t);
  const claude = claudeFalso({ es_duradera: false, regla: "", categoria: "ninguna" });
  const r = await aprenderDeCorreccion(claude, "k", "el slide 5 no pega con el tema", { ruta });

  assert.equal(r.guardada, false);
  assert.equal(r.motivo, "corrección puntual");
  assert.deepEqual(leerReglas(ruta), []);
});

test("una preferencia DURADERA se guarda y se relee", async (t) => {
  const ruta = rutaTmp(t);
  const claude = claudeFalso({ es_duradera: true, regla: "titulares en 5 palabras", categoria: "copy" });
  const r = await aprenderDeCorreccion(claude, "k", "los titulares muy largos", { ruta });

  assert.equal(r.guardada, true);
  assert.equal(r.reforzada, false);
  const guardadas = leerReglas(ruta);
  assert.equal(guardadas.length, 1);
  assert.equal(guardadas[0].regla, "titulares en 5 palabras");
  assert.equal(guardadas[0].origen, "los titulares muy largos");
});

test("aprender NUNCA lanza: si el modelo falla, la pieza de hoy no se cae", async (t) => {
  const ruta = rutaTmp(t);
  const claude = claudeFalso(new Error("API caída"));
  const r = await aprenderDeCorreccion(claude, "k", "algo", { ruta });

  assert.equal(r.guardada, false);
  assert.match(r.motivo, /error/);
});

test("aprender tolera un archivo de reglas corrupto", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "barbara-reglas-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ruta = join(dir, "reglas.json");
  writeFileSync(ruta, "{esto no es json");

  const claude = claudeFalso({ es_duradera: true, regla: "una regla", categoria: "copy" });
  const r = await aprenderDeCorreccion(claude, "k", "x", { ruta });
  assert.equal(r.guardada, true, "un archivo roto no puede impedir aprender");
});

test("bloquePrompt ordena por veces reforzada y muestra el conteo", () => {
  const txt = bloquePrompt([
    { regla: "poco pedida", veces_reforzada: 1, activa: true },
    { regla: "muy pedida", veces_reforzada: 4, activa: true },
  ]);
  assert.ok(txt.indexOf("muy pedida") < txt.indexOf("poco pedida"), "la más repetida va primero");
  assert.match(txt, /lo pidieron 4 veces/);
  assert.doesNotMatch(txt, /poco pedida \(lo pidieron/, "con 1 vez no se pone el conteo");
});

test("bloquePrompt ignora las reglas desactivadas", () => {
  const txt = bloquePrompt([{ regla: "apagada", veces_reforzada: 9, activa: false }]);
  assert.equal(txt, "");
});

test("bloquePrompt vacío no deja un encabezado colgando", () => {
  assert.equal(bloquePrompt([]), "");
  assert.equal(bloquePrompt(undefined), "");
});

test("bloquePrompt acota cuántas reglas viajan al prompt", () => {
  const muchas = Array.from({ length: 60 }, (_, i) => ({
    regla: `regla ${i}`, veces_reforzada: 1, activa: true,
  }));
  const lineas = bloquePrompt(muchas).split("\n").filter((l) => l.startsWith("- "));
  assert.equal(lineas.length, 20, "más que esto deja de ser memoria y compite con la instrucción del día");
});

test("guardarReglas y leerReglas hacen ida y vuelta", (t) => {
  const ruta = rutaTmp(t);
  const reglas = integrar([], "una regla").reglas;
  guardarReglas(reglas, ruta);
  assert.deepEqual(leerReglas(ruta), reglas);
});
