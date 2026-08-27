import test from "node:test";
import assert from "node:assert/strict";
import { embeddingDeTexto, MODELO, DIMENSIONES } from "./embeddings.mjs";

const vectorFalso = (n = DIMENSIONES) => Array.from({ length: n }, (_, i) => i / n);

function fetchFalso({ status = 200, vector = vectorFalso() } = {}) {
  return async (url, opts) => ({
    ok: status < 400,
    status,
    json: async () => ({ data: [{ embedding: vector }] }),
    text: async () => JSON.stringify({ error: "mock", url, body: opts?.body }),
  });
}

test("pide el modelo correcto con el texto recortado a 8000 caracteres", async () => {
  let capturado;
  const fetchFn = async (url, opts) => {
    capturado = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ data: [{ embedding: vectorFalso() }] }) };
  };
  await embeddingDeTexto("x".repeat(9000), { openaiKey: "sk-test", fetchFn });
  assert.equal(capturado.url, "https://api.openai.com/v1/embeddings");
  assert.equal(capturado.body.model, MODELO);
  assert.equal(capturado.body.input.length, 8000);
});

test("devuelve null para texto vacío sin llamar a la red", async () => {
  const r = await embeddingDeTexto("   ", { openaiKey: "sk-test", fetchFn: () => { throw new Error("no debería llamar"); } });
  assert.equal(r, null);
});

test("falla claro si falta la API key", async () => {
  await assert.rejects(() => embeddingDeTexto("hola", { fetchFn: fetchFalso() }), /OPENAI_API_KEY/);
});

test("falla claro si OpenAI responde error", async () => {
  await assert.rejects(
    () => embeddingDeTexto("hola", { openaiKey: "sk-test", fetchFn: fetchFalso({ status: 401 }) }),
    /OpenAI embeddings 401/
  );
});

test("falla claro si el embedding viene con forma inesperada", async () => {
  await assert.rejects(
    () => embeddingDeTexto("hola", { openaiKey: "sk-test", fetchFn: fetchFalso({ vector: [1, 2, 3] }) }),
    /forma inesperada/
  );
});

test("devuelve el vector cuando todo sale bien", async () => {
  const v = vectorFalso();
  const r = await embeddingDeTexto("hola", { openaiKey: "sk-test", fetchFn: fetchFalso({ vector: v }) });
  assert.equal(r.length, DIMENSIONES);
  assert.deepEqual(r, v);
});
