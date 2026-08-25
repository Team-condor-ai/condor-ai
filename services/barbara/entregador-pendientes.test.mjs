import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ejecutarEntregador, procesarEntrega } from "./entregador-pendientes.mjs";

const buffer = Buffer.from("imagen-real");
const sha256 = createHash("sha256").update(buffer).digest("hex");
const FILA = {
  id: "pieza", claim_token: "claim", telegram_chat_id: "chat", negocio: "Marca", tipo: "carrusel",
  caption: "Caption", telegram_media_ids: [],
  media: [{ storage_path: "c/p/01.png", mime_type: "image/png", bytes: buffer.length, sha256 }],
};

function respuesta(body) { return { async json() { return body; } }; }
function dbFalso(filas = []) {
  const llamadas = [];
  return {
    llamadas,
    async sign() { return "https://storage/asset"; },
    async rpc(nombre, payload) {
      llamadas.push([nombre, payload]);
      if (nombre === "barbara_reclamar_entregas") return filas;
      return true;
    },
  };
}
const fetchFn = async () => ({ ok: true, async arrayBuffer() { return buffer; } });

test("persiste checkpoint de media antes de enviar el caption", async () => {
  const db = dbFalso();
  const metodos = [];
  const telegram = async (_token, metodo) => {
    metodos.push(metodo);
    return respuesta(metodo === "sendPhoto" ? { ok: true, result: { message_id: 10 } } : { ok: true, result: { message_id: 11 } });
  };
  const salida = await procesarEntrega({ db, telegram, token: "t", fila: FILA, fetchFn });
  assert.equal(salida.ok, true);
  assert.deepEqual(metodos, ["sendPhoto", "sendMessage"]);
  assert.deepEqual(db.llamadas.map((x) => x[0]), ["barbara_registrar_media_entregada", "barbara_confirmar_entrega"]);
});

test("si media ya tiene checkpoint reintenta sólo el caption", async () => {
  const db = dbFalso();
  const metodos = [];
  const telegram = async (_token, metodo) => {
    metodos.push(metodo);
    return respuesta({ ok: true, result: { message_id: 22 } });
  };
  const salida = await procesarEntrega({ db, telegram, token: "t", fila: { ...FILA, telegram_media_ids: [10] }, fetchFn });
  assert.equal(salida.ok, true);
  assert.deepEqual(metodos, ["sendMessage"]);
});

test("rechaza un asset corrupto antes de tocar Telegram", async () => {
  const db = dbFalso();
  let llamadasTelegram = 0;
  const salida = await procesarEntrega({
    db, token: "t", fila: FILA,
    telegram: async () => { llamadasTelegram++; return respuesta({ ok: true }); },
    fetchFn: async () => ({ ok: true, async arrayBuffer() { return Buffer.from("corrupta"); } }),
  });
  assert.equal(salida.ok, false);
  assert.equal(llamadasTelegram, 0);
  assert.equal(db.llamadas.at(-1)[0], "barbara_fallar_entrega");
});

test("el worker recupera claims y procesa exactamente la cola", async () => {
  const db = dbFalso([{ ...FILA, telegram_media_ids: [10] }]);
  const salida = await ejecutarEntregador({
    db, token: "t", fetchFn,
    telegram: async () => respuesta({ ok: true, result: { message_id: 20 } }),
  });
  assert.equal(salida.length, 1);
  assert.equal(salida[0].ok, true);
  assert.equal(db.llamadas[0][0], "barbara_recuperar_entregas_colgadas");
  assert.equal(db.llamadas[1][0], "barbara_reclamar_entregas");
});

