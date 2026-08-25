import test from "node:test";
import assert from "node:assert/strict";
import { evaluarReprogramacion, proponerHorario } from "./planificador.mjs";

test("propone un horario futuro laborable", () => {
  const r = proponerHorario({ ahora: new Date("2026-08-21T23:00:00Z") }); // viernes 19:00 en Chile
  const d = new Date(r.programadaPara);
  assert.ok(d > new Date("2026-08-21T23:00:00Z"));
  assert.equal(r.programadaPara, "2026-08-24T14:00:00.000Z"); // lunes 10:00 Chile
});

test("10:00 Chile conserva la hora humana al cambiar horario de verano", () => {
  const invierno = proponerHorario({ ahora: new Date("2026-08-24T11:00:00Z"), horas: [10] });
  const verano = proponerHorario({ ahora: new Date("2027-01-04T11:00:00Z"), horas: [10] });
  assert.equal(invierno.programadaPara, "2026-08-24T14:00:00.000Z");
  assert.equal(verano.programadaPara, "2027-01-04T13:00:00.000Z");
});

test("el resultado no depende del timezone local del runner", () => {
  const r = proponerHorario({ ahora: new Date("2026-08-24T12:00:00Z"), horas: [10], zonaHoraria: "America/Bogota" });
  assert.equal(r.programadaPara, "2026-08-24T15:00:00.000Z");
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
