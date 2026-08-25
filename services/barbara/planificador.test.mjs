import test from "node:test";
import assert from "node:assert/strict";
import { evaluarReprogramacion, proponerHorario } from "./planificador.mjs";

test("propone un horario futuro laborable", () => {
  const r = proponerHorario({ ahora: new Date("2026-08-21T19:00:00") }); // viernes tarde
  const d = new Date(r.programadaPara);
  assert.ok(d > new Date("2026-08-21T19:00:00"));
  assert.ok([1, 2, 3, 4, 5].includes(d.getDay()));
});

test("evita las ventanas cercanas ocupadas", () => {
  const r = proponerHorario({ ahora: new Date("2026-08-24T08:00:00"), ocupadas: ["2026-08-24T10:00:00", "2026-08-24T13:00:00"] });
  assert.notEqual(r.programadaPara, "2026-08-24T10:00:00.000Z");
  assert.notEqual(r.programadaPara, "2026-08-24T13:00:00.000Z");
});

test("una reprogramación humana se valida sin impedirla arbitrariamente", () => {
  assert.equal(evaluarReprogramacion({ propuesta: "2026-08-25T10:00:00Z", ocupadas: ["2026-08-25T13:00:00Z"] }).valida, false);
  assert.equal(evaluarReprogramacion({ propuesta: "2026-08-26T10:00:00Z", ocupadas: ["2026-08-25T13:00:00Z"] }).valida, true);
});
