import assert from "node:assert/strict";
import test from "node:test";
import { mensajesEstadoBarbara } from "./mensajesEstadoBarbara.ts";

const enChile = (iso: string) => mensajesEstadoBarbara(new Date(iso), "America/Santiago");

test("saluda Fiestas Patrias el 18 de septiembre", () => {
  assert.match(enChile("2026-09-18T15:00:00Z")[0], /Fiestas Patrias/);
});

test("pregunta por el Dieciocho al día siguiente", () => {
  assert.match(enChile("2026-09-19T15:00:00Z")[0], /ayer en el Dieciocho/);
});

test("incluye una efeméride lúdica para el día del queso", () => {
  assert.match(enChile("2026-06-04T15:00:00Z")[0], /queso/i);
});

test("calcula el tercer domingo de junio para el Día del Padre", () => {
  assert.match(enChile("2026-06-21T15:00:00Z")[0], /Día del Padre/);
});

test("fuera de efemérides conserva actividades y preguntas", () => {
  const mensajes = enChile("2026-08-26T15:00:00Z");
  assert.ok(mensajes.some((m) => /trabajando/i.test(m)));
  assert.ok(mensajes.some((m) => m.includes("¿")));
});

test("mantiene un catálogo amplio y sin repeticiones", () => {
  const mensajes = enChile("2026-08-26T15:00:00Z");
  assert.ok(mensajes.length >= 125);
  assert.equal(new Set(mensajes).size, mensajes.length);
});
