import test from "node:test";
import assert from "node:assert/strict";
import { confirmarGeneracion, fallarGeneracion, reclamarGeneracion } from "./generaciones.mjs";

test("un claim vacío significa que otra corrida ya posee la pieza", async () => {
  const db = { async rpc() { return []; } };
  assert.equal(await reclamarGeneracion(db, { barbaraClienteId: "c", tipo: "ugc", clave: "hoy" }), null);
});

test("propaga la clave determinista y devuelve el token", async () => {
  let llamada;
  const db = { async rpc(nombre, body) { llamada = [nombre, body]; return [{ id: "r", claim_token: "t" }]; } };
  const r = await reclamarGeneracion(db, { barbaraClienteId: "c", tipo: "carrusel", clave: "nuevo:2026-08-25" });
  assert.equal(r.claim_token, "t");
  assert.equal(llamada[1].p_clave, "nuevo:2026-08-25");
});

test("confirmar exige que la base siga reconociendo el claim", async () => {
  const db = { async rpc() { return false; } };
  await assert.rejects(() => confirmarGeneracion(db, { id: "r", claim_token: "t" }, { piezaId: "p" }), /ya no era válido/);
});

test("fallar acota el error antes de persistirlo", async () => {
  let body;
  const db = { async rpc(_nombre, payload) { body = payload; return true; } };
  await fallarGeneracion(db, { id: "r", claim_token: "t" }, new Error("x".repeat(2000)));
  assert.equal(body.p_error.length, 1000);
});

