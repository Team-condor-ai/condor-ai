import test from "node:test";
import assert from "node:assert/strict";
import { hitosNuevos, normalizarMetricas, textoHito } from "./metricas.mjs";

test("normaliza aliases sin conservar el payload ni datos personales", () => {
  const salida = normalizarMetricas({ metrics: { likes: "120", comments: 8, reach: 1_000, usernames: ["privado"] } });
  assert.equal(salida.me_gusta, 120);
  assert.equal(salida.comentarios, 8);
  assert.equal(salida.alcance, 1_000);
  assert.equal(salida.interacciones, 128);
  assert.equal(salida.tasa_interaccion, 0.128);
  assert.equal(salida.usernames, undefined);
});

test("valores inválidos o negativos no contaminan métricas", () => {
  const salida = normalizarMetricas({ likes: -20, comments: "no", views: Infinity });
  assert.equal(salida.me_gusta, 0);
  assert.equal(salida.comentarios, 0);
  assert.equal(salida.reproducciones, 0);
});

test("un primer snapshot alto produce un solo hito por métrica", () => {
  const hitos = hitosNuevos({ me_gusta: 1_200, alcance: 12_000 });
  assert.deepEqual(hitos, [
    { metrica: "me_gusta", umbral: 1_000, valor: 1_200 },
    { metrica: "alcance", umbral: 10_000, valor: 12_000 },
  ]);
});

test("no repite hitos ya emitidos y avanza al siguiente", () => {
  const hitos = hitosNuevos(
    { me_gusta: 650 },
    [{ metrica: "me_gusta", umbral: 100 }],
  );
  assert.deepEqual(hitos, [{ metrica: "me_gusta", umbral: 500, valor: 650 }]);
});

test("el aviso es personalizado y no promete causalidad", () => {
  const texto = textoHito({ negocio: "Cóndor", plataforma: "instagram", angulo: "Una idea", metrica: "me_gusta", umbral: 100 });
  assert.match(texto, /Cóndor/);
  assert.match(texto, /100 me gusta/);
  assert.match(texto, /seguirá observando/);
});

