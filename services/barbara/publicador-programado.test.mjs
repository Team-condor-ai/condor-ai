import test from "node:test";
import assert from "node:assert/strict";
import { ejecutarWorker, procesarProgramacion } from "./publicador-programado.mjs";

function detalle({ media = true } = {}) {
  return [{
    id: "prog-1", barbara_cliente_id: "cliente-1", claim_token: "claim-1", estado: "publicando",
    plataforma: "instagram",
    barbara_canales: { account_ref: "account-1", target: {}, activo: true, auto_publicar: true },
    barbara_memoria: {
      angulo: "Una idea real", contenido: { caption: "Texto #uno #dos #tres #cuatro #cinco #seis" },
      barbara_media: media ? [{ storage_path: "cliente-1/pieza-1/01.png", mime_type: "image/png" }] : [],
    },
    barbara_clientes: { telegram_chat_id: "123", clientes: { negocio: "Marca" } },
  }];
}

test("sólo finaliza publicada después de respuesta published", async () => {
  const rpc = [], avisos = [];
  const db = {
    async get() { return detalle(); },
    async sign() { return "https://storage.test/firmada"; },
    async rpc(nombre, body) { rpc.push([nombre, body]); return {}; },
    async post() {},
  };
  const blotato = {
    async subirMedia() { return { url: "https://blotato.test/media" }; },
    async crearPublicacion(payload) {
      assert.equal((payload.post.content.text.match(/#/g) || []).length, 5);
      return { postSubmissionId: "sub-1" };
    },
  };
  const r = await procesarProgramacion({
    db, blotato, programacion: { id: "prog-1", claim_token: "claim-1" },
    esperar: async () => ({ status: "published", postId: "post-real" }),
    notificar: async (x) => avisos.push(x),
  });
  assert.equal(r.ok, true);
  assert.equal(rpc[0][1].p_publicada, true);
  assert.equal(rpc[0][1].p_external_id, "post-real");
  assert.equal(avisos[0].ok, true);
});

test("failed nunca se transforma en éxito y finaliza el claim con error", async () => {
  const rpc = [], avisos = [];
  const db = {
    async get() { return detalle(); }, async sign() { return "https://firmada"; },
    async rpc(nombre, body) { rpc.push([nombre, body]); }, async post() {},
  };
  const blotato = {
    async subirMedia() { return { url: "https://media" }; },
    async crearPublicacion() { return { postSubmissionId: "sub-1" }; },
  };
  const r = await procesarProgramacion({
    db, blotato, programacion: { id: "prog-1", claim_token: "claim-1" },
    esperar: async () => ({ status: "failed", message: "rechazado" }),
    notificar: async (x) => avisos.push(x),
  });
  assert.equal(r.ok, false);
  assert.equal(rpc[0][1].p_publicada, false);
  assert.match(rpc[0][1].p_error, /failed|rechazado/);
  assert.equal(avisos[0].ok, false);
});

test("una pieza sin media no llama al proveedor", async () => {
  let publicaciones = 0;
  const db = {
    async get() { return detalle({ media: false }); },
    async rpc() {}, async post() {},
  };
  const blotato = { async crearPublicacion() { publicaciones++; } };
  const r = await procesarProgramacion({ db, blotato, programacion: { id: "prog-1", claim_token: "claim-1" } });
  assert.equal(r.ok, false);
  assert.equal(publicaciones, 0);
  assert.match(r.error, /sin media/);
});

test("el worker recupera claims y procesa exactamente lo reclamado", async () => {
  const rpc = [];
  const db = {
    async rpc(nombre) {
      rpc.push(nombre);
      if (nombre === "barbara_reclamar_publicaciones") return [];
      return 0;
    },
  };
  const r = await ejecutarWorker({ db, blotato: {}, notificar: async () => {} });
  assert.deepEqual(r, []);
  assert.deepEqual(rpc, ["barbara_recuperar_publicaciones_colgadas", "barbara_reclamar_publicaciones"]);
});
