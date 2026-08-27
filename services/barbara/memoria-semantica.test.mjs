import test from "node:test";
import assert from "node:assert/strict";
import { rellenarEmbeddingsFaltantes, nodosSimilares } from "./memoria-semantica.mjs";

const fetchFalso = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ embedding: Array(1536).fill(0.1) }] }) });
const silencio = () => {};

test("rellenarEmbeddingsFaltantes solo vectoriza nodos sin embedding y con texto", async () => {
  const patcheados = [];
  const db = { patch: async (path, body) => patcheados.push({ path, body }) };
  const nodos = [
    { id: "1", titulo: "Ya tiene", contenido: "x", embedding: [0.1] },
    { id: "2", titulo: "Falta", contenido: "sin vector" },
    { id: "3", titulo: "", contenido: "" }, // sin texto, se ignora
  ];
  const n = await rellenarEmbeddingsFaltantes(db, nodos, { openaiKey: "sk-test", fetchFn: fetchFalso, log: silencio });
  assert.equal(n, 1);
  assert.equal(patcheados.length, 1);
  assert.equal(patcheados[0].path, "barbara_memoria_nodos?id=eq.2");
  assert.equal(patcheados[0].body.embedding.length, 1536);
});

test("rellenarEmbeddingsFaltantes no interrumpe el resto si un nodo falla", async () => {
  const patcheados = [];
  const db = { patch: async (path, body) => patcheados.push({ path, body }) };
  let llamadas = 0;
  const fetchFn = async () => {
    llamadas++;
    if (llamadas === 1) return { ok: false, status: 500, text: async () => "boom" };
    return fetchFalso();
  };
  const nodos = [
    { id: "1", titulo: "Falla", contenido: "primero" },
    { id: "2", titulo: "OK", contenido: "segundo" },
  ];
  const n = await rellenarEmbeddingsFaltantes(db, nodos, { openaiKey: "sk-test", fetchFn, log: silencio });
  assert.equal(n, 1);
  assert.equal(patcheados[0].path, "barbara_memoria_nodos?id=eq.2");
});

test("nodosSimilares devuelve un Map(id -> similitud) a partir de la distancia coseno", async () => {
  const db = {
    rpc: async (nombre, body) => {
      assert.equal(nombre, "barbara_memoria_similares");
      assert.equal(body.p_barbara_cliente_id, "cliente-1");
      assert.equal(body.p_embedding.length, 1536);
      return [{ id: "a", distancia: 0 }, { id: "b", distancia: 0.4 }];
    },
  };
  const mapa = await nodosSimilares(db, "cliente-1", "descuento de verano", { openaiKey: "sk-test", fetchFn: fetchFalso, log: silencio });
  assert.equal(mapa.get("a"), 1);
  assert.equal(mapa.get("b"), 0.6);
});

test("nodosSimilares devuelve Map vacío sin key ni consulta, sin llamar a nada", async () => {
  const explota = () => { throw new Error("no debería llamar"); };
  assert.equal((await nodosSimilares({ rpc: explota }, "c1", "algo", { openaiKey: "", fetchFn: explota })).size, 0);
  assert.equal((await nodosSimilares({ rpc: explota }, "c1", "  ", { openaiKey: "sk-test", fetchFn: explota })).size, 0);
});

test("nodosSimilares no lanza si la RPC falla — degrada a Map vacío", async () => {
  const db = { rpc: async () => { throw new Error("columna no existe"); } };
  const mapa = await nodosSimilares(db, "c1", "algo", { openaiKey: "sk-test", fetchFn: fetchFalso, log: silencio });
  assert.equal(mapa.size, 0);
});
