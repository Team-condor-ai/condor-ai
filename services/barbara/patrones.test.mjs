import test from "node:test";
import assert from "node:assert/strict";
import { cumpleUmbralGlobal, MINIMO_PIEZAS, MINIMO_MARCAS } from "./umbral-global.mjs";

test("por debajo de las 12 piezas no cumple aunque sobren marcas", () => {
  assert.equal(cumpleUmbralGlobal({ totalPiezas: 11, totalMarcas: 5 }), false);
});

test("12 piezas de una sola marca no cumple: describe a un cliente, no un patrón global", () => {
  assert.equal(cumpleUmbralGlobal({ totalPiezas: 20, totalMarcas: 1 }), false);
});

test("12 piezas de menos de 3 marcas no cumple", () => {
  assert.equal(cumpleUmbralGlobal({ totalPiezas: 12, totalMarcas: 2 }), false);
});

test("exactamente el mínimo (12 piezas / 3 marcas) sí cumple", () => {
  assert.equal(cumpleUmbralGlobal({ totalPiezas: MINIMO_PIEZAS, totalMarcas: MINIMO_MARCAS }), true);
});

test("por encima del mínimo sigue cumpliendo", () => {
  assert.equal(cumpleUmbralGlobal({ totalPiezas: 400, totalMarcas: 12 }), true);
});

test("caso real de hoy: 1 solo cliente activo nunca puede cumplir, no es un bug", () => {
  // Documenta el hallazgo de la auditoría: con Cóndor como único cliente,
  // sea cual sea el volumen de piezas, marcas.size nunca pasa de 1.
  assert.equal(cumpleUmbralGlobal({ totalPiezas: 1000, totalMarcas: 1 }), false);
});
