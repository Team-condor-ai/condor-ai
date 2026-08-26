import test from "node:test";
import assert from "node:assert/strict";
import { LIMITES_PLAN, limitePlan, inicioMesUTC, metaAcumulada } from "./planes.mjs";

test("plan barbara no incluye historia ni ugc", () => {
  assert.equal(limitePlan("barbara", "carrusel"), 12);
  assert.equal(limitePlan("barbara", "historia"), 0);
  assert.equal(limitePlan("barbara", "ugc"), 0);
});

test("plan go y plus comparten los mismos cupos", () => {
  for (const plan of ["go", "plus"]) {
    assert.equal(limitePlan(plan, "carrusel"), 12);
    assert.equal(limitePlan(plan, "historia"), 20);
    assert.equal(limitePlan(plan, "ugc"), 4);
  }
});

test("un plan desconocido cae al tier barbara, no revienta", () => {
  assert.equal(limitePlan("plan-inexistente", "carrusel"), 12);
  assert.equal(limitePlan("plan-inexistente", "historia"), 0);
});

test("un tipo desconocido dentro de un plan válido da 0, no undefined", () => {
  assert.equal(limitePlan("plus", "reel-inexistente"), 0);
});

test("inicioMesUTC siempre cae en el día 1", () => {
  assert.equal(inicioMesUTC(new Date("2026-08-24T23:59:00Z")), "2026-08-01");
  assert.equal(inicioMesUTC(new Date("2026-02-01T00:00:00Z")), "2026-02-01");
});

test("metaAcumulada no amontona la cuota al inicio del mes", () => {
  // Agosto 2026 tiene 31 días; al día 15 no debería permitir ya el cupo completo.
  const mitad = metaAcumulada(12, new Date("2026-08-15T00:00:00Z"));
  assert.ok(mitad > 0 && mitad < 12);
  // El último día del mes sí permite el cupo completo.
  const fin = metaAcumulada(12, new Date("2026-08-31T00:00:00Z"));
  assert.equal(fin, 12);
});

test("LIMITES_PLAN no queda vacío por error de tipeo", () => {
  assert.ok(Object.keys(LIMITES_PLAN).length >= 3);
});
