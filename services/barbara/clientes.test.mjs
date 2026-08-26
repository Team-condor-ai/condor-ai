import test from "node:test";
import assert from "node:assert/strict";
import { decidirElegibilidad, decidirCuota } from "./elegibilidad.mjs";

test("sin telegram_chat_id se salta antes de generar nada", () => {
  const r = decidirElegibilidad({ telegram_chat_id: null, bb: { x: 1 }, form: { y: 1 } });
  assert.equal(r.elegible, false);
  assert.equal(r.motivo, "sin_telegram");
});

test("sin brand book o sin formulario se salta", () => {
  assert.equal(decidirElegibilidad({ telegram_chat_id: "123", bb: null, form: { y: 1 } }).elegible, false);
  assert.equal(decidirElegibilidad({ telegram_chat_id: "123", bb: { x: 1 }, form: null }).elegible, false);
});

test("con los tres presentes es elegible", () => {
  const r = decidirElegibilidad({ telegram_chat_id: "123", bb: { x: 1 }, form: { y: 1 } });
  assert.equal(r.elegible, true);
  assert.equal(r.motivo, null);
});

test("un retry ignora la cuota mensual por completo", () => {
  const r = decidirCuota({ isRetry: true, limite: 0, usadas: 999, meta: 0, respetarRitmo: true });
  assert.equal(r.puede, true);
});

test("un plan sin cupo para el tipo bloquea antes de consultar cuota", () => {
  const r = decidirCuota({ isRetry: false, limite: 0, usadas: 0, meta: 0, respetarRitmo: false });
  assert.equal(r.puede, false);
  assert.equal(r.motivo, "plan_sin_tipo");
});

test("cuota mensual agotada bloquea", () => {
  const r = decidirCuota({ isRetry: false, limite: 12, usadas: 12, meta: 6, respetarRitmo: false });
  assert.equal(r.puede, false);
  assert.equal(r.motivo, "cuota_completa");
});

test("con cupo libre pero sin respetar ritmo, adelantarse al ritmo mensual no bloquea", () => {
  const r = decidirCuota({ isRetry: false, limite: 12, usadas: 8, meta: 6, respetarRitmo: false });
  assert.equal(r.puede, true);
});

test("respetando el ritmo, ir adelantado al día bloquea aunque quede cupo del mes", () => {
  const r = decidirCuota({ isRetry: false, limite: 12, usadas: 8, meta: 6, respetarRitmo: true });
  assert.equal(r.puede, false);
  assert.equal(r.motivo, "ritmo");
});

test("respetando el ritmo, ir al día o atrás no bloquea", () => {
  const r = decidirCuota({ isRetry: false, limite: 12, usadas: 4, meta: 6, respetarRitmo: true });
  assert.equal(r.puede, true);
});
