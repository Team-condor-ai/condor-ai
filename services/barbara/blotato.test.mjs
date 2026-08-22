import assert from "node:assert/strict";
import test from "node:test";
import { construirPayloadPublicacion, crearClienteBlotato } from "./blotato.mjs";

test("construye un carrusel y deja la programación en la raíz", () => {
  const payload = construirPayloadPublicacion({
    accountId: "cuenta-1",
    platform: "instagram",
    text: "Caption",
    mediaUrls: ["https://cdn.example/1.png", "https://cdn.example/2.png"],
    scheduledTime: "2026-08-24T13:00:00-04:00",
  });

  assert.equal(payload.post.content.platform, "instagram");
  assert.equal(payload.post.target.targetType, "instagram");
  assert.equal(payload.scheduledTime, "2026-08-24T17:00:00.000Z");
  assert.equal(payload.post.scheduledTime, undefined);
  assert.equal(payload.post.content.mediaUrls.length, 2);
});

test("rechaza publicaciones vacías y media que no sea pública", () => {
  assert.throws(() => construirPayloadPublicacion({ accountId: "1", platform: "instagram" }), /texto o al menos/);
  assert.throws(() => construirPayloadPublicacion({
    accountId: "1", platform: "instagram", mediaUrls: ["C:\\imagen.png"],
  }), /URL http/);
});

test("cliente usa el header oficial y no filtra la clave en la respuesta", async () => {
  let peticion;
  const cliente = crearClienteBlotato({
    apiKey: "secreto-prueba",
    fetchImpl: async (url, options) => {
      peticion = { url, options };
      return new Response(JSON.stringify({ id: "usuario" }), { status: 200 });
    },
  });

  assert.deepEqual(await cliente.obtenerUsuario(), { id: "usuario" });
  assert.equal(peticion.url, "https://backend.blotato.com/v2/users/me");
  assert.equal(peticion.options.headers["blotato-api-key"], "secreto-prueba");
});

test("sube media mediante el endpoint oficial", async () => {
  let peticion;
  const cliente = crearClienteBlotato({
    apiKey: "x",
    fetchImpl: async (url, options) => {
      peticion = { url, options };
      return new Response(JSON.stringify({ url: "https://database.blotato.com/media.png" }), { status: 201 });
    },
  });

  const dataUrl = "data:image/png;base64,AAAA";
  assert.equal((await cliente.subirMedia(dataUrl)).url, "https://database.blotato.com/media.png");
  assert.equal(peticion.url, "https://backend.blotato.com/v2/media");
  assert.deepEqual(JSON.parse(peticion.options.body), { url: dataUrl });
});

test("cliente conserva el error HTTP para diagnóstico", async () => {
  const cliente = crearClienteBlotato({
    apiKey: "x",
    fetchImpl: async () => new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 }),
  });

  await assert.rejects(cliente.listarCuentas(), (error) => error.status === 401 && /unauthorized/.test(error.message));
});
