import test from "node:test";
import assert from "node:assert/strict";
import { persistirMedia, rutaMedia, sha256 } from "./persistencia.mjs";

test("la ruta queda aislada por cliente y pieza", () => {
  assert.equal(rutaMedia({ barbaraClienteId: "cliente-123", piezaId: "pieza_456", mimeType: "image/png" }),
    "cliente-123/pieza_456/01.png");
  assert.throws(() => rutaMedia({ barbaraClienteId: "../otro", piezaId: "pieza_456", mimeType: "image/png" }), /inválido/);
});

test("guarda bytes, hash y metadata verificable", async () => {
  const llamadas = [];
  const db = {
    async upload(...args) { llamadas.push(["upload", ...args]); },
    async post(...args) { llamadas.push(["post", ...args]); },
    async remove(...args) { llamadas.push(["remove", ...args]); },
  };
  const buffer = Buffer.from("imagen real");
  const r = await persistirMedia(db, {
    barbaraClienteId: "cliente-123", piezaId: "pieza-456",
    assets: [{ buffer, tipo: "portada", mimeType: "image/png" }],
  });
  assert.equal(llamadas[0][0], "upload");
  assert.equal(llamadas[0][2], "cliente-123/pieza-456/01.png");
  assert.equal(llamadas[1][1], "barbara_media");
  assert.equal(llamadas[1][2].sha256, sha256(buffer));
  assert.equal(r[0].bytes, buffer.length);
});

test("si falla la metadata elimina el objeto huérfano", async () => {
  const eliminados = [];
  const db = {
    async upload() {},
    async post() { throw new Error("base caída"); },
    async remove(bucket, paths) { eliminados.push({ bucket, paths }); },
  };
  await assert.rejects(() => persistirMedia(db, {
    barbaraClienteId: "cliente-123", piezaId: "pieza-456",
    assets: [{ buffer: Buffer.from("x"), tipo: "imagen", mimeType: "image/png" }],
  }), /base caída/);
  assert.deepEqual(eliminados, [{ bucket: "barbara-media", paths: ["cliente-123/pieza-456/01.png"] }]);
});

test("rechaza archivos vacíos y tipos desconocidos antes de subir", async () => {
  let subidas = 0;
  const db = { async upload() { subidas++; } };
  await assert.rejects(() => persistirMedia(db, {
    barbaraClienteId: "cliente-123", piezaId: "pieza-456",
    assets: [{ buffer: Buffer.alloc(0), tipo: "imagen", mimeType: "image/png" }],
  }), /vacío/);
  assert.equal(subidas, 0);
});
