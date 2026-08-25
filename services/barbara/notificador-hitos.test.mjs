import test from "node:test";
import assert from "node:assert/strict";
import { ejecutarNotificador } from "./notificador-hitos.mjs";

function dbFalso(filas) {
  const llamadas = [];
  return {
    llamadas,
    async rpc(nombre, payload) {
      llamadas.push([nombre, payload]);
      if (nombre === "barbara_reclamar_notificaciones") return filas;
      return [];
    },
  };
}

const FILA = {
  id: "n1", claim_token: "claim", telegram_chat_id: "123", negocio: "Marca",
  plataforma: "instagram", angulo: "Idea", metrica: "me_gusta", umbral: 100, valor: 121,
};

test("confirma la cola sólo después de entregar Telegram", async () => {
  const db = dbFalso([FILA]);
  const textos = [];
  const salida = await ejecutarNotificador({ db, notificar: async (x) => textos.push(x.texto) });
  assert.equal(salida[0].ok, true);
  assert.match(textos[0], /100 me gusta/);
  assert.equal(db.llamadas.at(-1)[1].p_enviada, true);
});

test("una falla queda reintentable y no se declara enviada", async () => {
  const db = dbFalso([FILA]);
  const salida = await ejecutarNotificador({ db, notificar: async () => { throw new Error("caído"); } });
  assert.equal(salida[0].ok, false);
  assert.equal(db.llamadas.at(-1)[1].p_enviada, false);
  assert.match(db.llamadas.at(-1)[1].p_error, /caído/);
});

