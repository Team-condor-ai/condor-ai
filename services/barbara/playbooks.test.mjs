import assert from "node:assert/strict";
import test from "node:test";
import { playbooksPara, bloquePrompt } from "./playbooks.mjs";

/* Doble de `db` que registra las queries y devuelve filas fijas. */
function dbFalso(filas = []) {
  const queries = [];
  return {
    queries,
    async get(q) { queries.push(q); return filas; },
  };
}

test("sin rubro pide sólo los playbooks sin rubro", async () => {
  const db = dbFalso();
  await playbooksPara(db, { tipo: "general" });
  assert.match(db.queries[0], /rubro=is\.null/);
});

test("con rubro y tipo específico filtra el rubro en memoria, no con dos or=", async () => {
  // PostgREST pisa el primer `or=` con el segundo; si la query llevara dos,
  // el filtro de tipo se perdería y entrarían playbooks de otro formato.
  const db = dbFalso([
    { regla: "sirve para todos", tipo: "carrusel", rubro: null, peso: 5 },
    { regla: "sólo gastronomía", tipo: "carrusel", rubro: "gastronomia", peso: 3 },
    { regla: "de otro rubro", tipo: "carrusel", rubro: "inmobiliaria", peso: 9 },
  ]);
  const out = await playbooksPara(db, { tipo: "carrusel", rubro: "Gastronomia" });

  assert.equal(db.queries.length, 1);
  assert.equal((db.queries[0].match(/or=/g) || []).length, 1, "una sola cláusula or=");
  assert.deepEqual(out.map((p) => p.regla), ["sirve para todos", "sólo gastronomía"]);
});

test("normaliza el rubro a minúsculas al comparar", async () => {
  const db = dbFalso([{ regla: "x", tipo: "ugc", rubro: "gastronomia", peso: 1 }]);
  const out = await playbooksPara(db, { tipo: "ugc", rubro: "  GASTRONOMIA " });
  assert.equal(out.length, 1);
});

test("un tipo desconocido cae a general en vez de romper la query", async () => {
  const db = dbFalso();
  await playbooksPara(db, { tipo: "reel-inventado" });
  assert.match(db.queries[0], /tipo=eq\.general/);
});

test("respeta el límite después de filtrar por rubro", async () => {
  const filas = Array.from({ length: 30 }, (_, i) => ({
    regla: `r${i}`, tipo: "carrusel", rubro: null, peso: 0,
  }));
  const db = dbFalso(filas);
  const out = await playbooksPara(db, { tipo: "carrusel", rubro: "x", limite: 4 });
  assert.equal(out.length, 4);
});

test("si la tabla no existe todavía devuelve vacío en vez de tumbar la generación", async () => {
  const db = { async get() { throw new Error('relation "barbara_playbooks" does not exist'); } };
  const out = await playbooksPara(db, { tipo: "carrusel" });
  assert.deepEqual(out, []);
});

test("bloquePrompt vacío no deja un encabezado colgando", () => {
  assert.equal(bloquePrompt([]), "");
  assert.equal(bloquePrompt(undefined), "");
});

test("bloquePrompt deja claro que la marca le gana al playbook", () => {
  const txt = bloquePrompt([{ regla: "cierra con pregunta" }]);
  assert.match(txt, /MANDA LA MARCA/);
  assert.match(txt, /cierra con pregunta/);
});
