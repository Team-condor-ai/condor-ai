import test from "node:test";
import assert from "node:assert/strict";
import { nombreNota, parsearNota, serializarCerebro } from "./obsidian.mjs";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

test("nombres iguales no colisionan porque llevan identidad estable", () => {
  assert.notEqual(nombreNota({ id: ID1, titulo: "Tono de marca" }), nombreNota({ id: ID2, titulo: "Tono de marca" }));
});

test("exporta frontmatter, índice y wikilinks por name", () => {
  const r = serializarCerebro({
    exportadoEn: "2026-08-25T12:00:00Z",
    nodos: [
      { id: ID1, tipo: "perfil", titulo: "Perfil", contenido: "Marca cercana", version: 2, etiquetas: ["tono"] },
      { id: ID2, tipo: "dato", titulo: "Producto", contenido: "Curso de logística", version: 1 },
    ],
    relaciones: [{ origen_id: ID1, destino_id: ID2, tipo: "aplica_a", peso: .8, activa: true }],
  });
  assert.equal(r.archivos.length, 2);
  assert.match(r.indice, /\[\[perfil-11111111\]\]/);
  assert.match(r.archivos[0].contenido, /\[\[producto-22222222\]\]/);
  assert.equal(r.manifest.notas.length, 2);
});

test("una nota exportada vuelve a entrar sin perder campos editables", () => {
  const exportado = serializarCerebro({ nodos: [{ id: ID1, tipo: "gusto", titulo: "Diseño", contenido: "Prefiere fondos claros", version: 4, etiquetas: ["visual"] }] });
  const nota = parsearNota(exportado.archivos[0].contenido);
  assert.equal(nota.nodo_id, ID1);
  assert.equal(nota.version, 4);
  assert.equal(nota.tipo, "gusto");
  assert.equal(nota.contenido, "Prefiere fondos claros");
  assert.deepEqual(nota.etiquetas, ["visual"]);
});

test("rechaza IDs manipulados y notas sin contenido", () => {
  assert.throws(() => parsearNota("---\nname: x\nbarbara_id: ../../otro\n---\n# X\ncontenido"), /barbara_id inválido/);
  assert.throws(() => parsearNota("---\nname: x\n---\n# X\n\n## Relaciones\n- nada"), /sin name o contenido/);
});
