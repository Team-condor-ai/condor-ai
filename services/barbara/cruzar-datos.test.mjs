import test from "node:test";
import assert from "node:assert/strict";
import { rendimiento, cruzar } from "./cruzar-datos.mjs";

// Fabrica una pieza publicada con métricas. `n` sirve para que el texto varíe
// y no colisionen las claves de deduplicación.
function pieza({ id, texto, alcance = 1000, interacciones = 50, dias = 5 }) {
  return {
    id,
    estado: "publicada",
    angulo: texto,
    metricas: { alcance, interacciones },
    creado_en: new Date(Date.now() - dias * 86_400_000).toISOString(),
  };
}

test("rendimiento es la tasa de interacción, no el número crudo", () => {
  // 50/1000 pierde contra 30/200: el alcance grande no puede disfrazar
  // una pieza que a casi nadie le movió nada.
  assert.ok(rendimiento({ metricas: { alcance: 200, interacciones: 30 } })
    > rendimiento({ metricas: { alcance: 1000, interacciones: 50 } }));
});

test("una pieza sin alcance no rinde infinito ni rompe la división", () => {
  assert.equal(rendimiento({ metricas: { alcance: 0, interacciones: 5 } }), 0);
  assert.equal(rendimiento({}), 0);
});

test("sin muestras suficientes el veredicto es sin_evidencia, no una corazonada", () => {
  const reglas = [{ id: "r1", regla: "prefiere captions cortos", activa: true }];
  const piezas = [pieza({ id: "p1", texto: "captions cortos", alcance: 1000, interacciones: 200 })];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].veredicto, "sin_evidencia");
  // Y dice CUÁNTAS le faltan, para que el equipo sepa si vale la pena esperar.
  assert.ok(hallazgos[0].motivo.includes("3"));
});

test("una preferencia que rinde mejor queda confirmada", () => {
  const reglas = [{ id: "r1", regla: "hablar de envio gratis", activa: true }];
  const piezas = [
    pieza({ id: "a1", texto: "envio gratis a todo chile", alcance: 1000, interacciones: 300 }),
    pieza({ id: "a2", texto: "envio gratis desde hoy", alcance: 1000, interacciones: 320 }),
    pieza({ id: "a3", texto: "aprovecha el envio gratis", alcance: 1000, interacciones: 280 }),
    pieza({ id: "b1", texto: "nueva coleccion invierno", alcance: 1000, interacciones: 60 }),
    pieza({ id: "b2", texto: "conoce la marca", alcance: 1000, interacciones: 50 }),
    pieza({ id: "b3", texto: "detras de camara", alcance: 1000, interacciones: 55 }),
  ];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos[0].veredicto, "confirmada");
  assert.ok(hallazgos[0].muestras_a_favor >= 3);
});

test("una preferencia que rinde PEOR se marca para revisar, nunca se borra sola", () => {
  const reglas = [{ id: "r1", regla: "hablar de envio gratis", activa: true }];
  const piezas = [
    pieza({ id: "a1", texto: "envio gratis a todo chile", alcance: 1000, interacciones: 20 }),
    pieza({ id: "a2", texto: "envio gratis desde hoy", alcance: 1000, interacciones: 25 }),
    pieza({ id: "a3", texto: "aprovecha el envio gratis", alcance: 1000, interacciones: 18 }),
    pieza({ id: "b1", texto: "nueva coleccion invierno", alcance: 1000, interacciones: 300 }),
    pieza({ id: "b2", texto: "conoce la marca", alcance: 1000, interacciones: 280 }),
    pieza({ id: "b3", texto: "detras de camara", alcance: 1000, interacciones: 320 }),
  ];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos[0].veredicto, "contradicha");
  // La regla es del CLIENTE: el dato abre una conversación, no la cierra.
  assert.equal(hallazgos[0].accion, "revisar_con_cliente");
  assert.notEqual(hallazgos[0].accion, "desactivar");
});

test("una diferencia mínima no alcanza para contradecir al cliente", () => {
  const reglas = [{ id: "r1", regla: "hablar de envio gratis", activa: true }];
  // 100 vs 105 por mil: ruido, no señal.
  const piezas = [
    pieza({ id: "a1", texto: "envio gratis uno", alcance: 1000, interacciones: 100 }),
    pieza({ id: "a2", texto: "envio gratis dos", alcance: 1000, interacciones: 100 }),
    pieza({ id: "a3", texto: "envio gratis tres", alcance: 1000, interacciones: 100 }),
    pieza({ id: "b1", texto: "coleccion invierno", alcance: 1000, interacciones: 105 }),
    pieza({ id: "b2", texto: "conoce la marca", alcance: 1000, interacciones: 105 }),
    pieza({ id: "b3", texto: "detras de camara", alcance: 1000, interacciones: 105 }),
  ];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos[0].veredicto, "sin_diferencia");
});

test("solo se cruzan piezas publicadas: un borrador no es evidencia de nada", () => {
  const reglas = [{ id: "r1", regla: "hablar de envio gratis", activa: true }];
  const piezas = [
    { ...pieza({ id: "a1", texto: "envio gratis uno", interacciones: 300 }), estado: "borrador" },
    { ...pieza({ id: "a2", texto: "envio gratis dos", interacciones: 300 }), estado: "requiere_ajuste" },
    { ...pieza({ id: "a3", texto: "envio gratis tres", interacciones: 300 }), estado: "aprobada" },
  ];
  const { hallazgos, piezas_evaluadas } = cruzar({ reglas, piezas });
  assert.equal(piezas_evaluadas, 0);
  assert.equal(hallazgos[0].veredicto, "sin_evidencia");
});

test("una regla desactivada no se cruza", () => {
  const reglas = [{ id: "r1", regla: "hablar de envio gratis", activa: false }];
  const piezas = [pieza({ id: "a1", texto: "envio gratis" })];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos.length, 0);
});

test("los hallazgos accionables van primero", () => {
  const reglas = [
    { id: "r1", regla: "sin evidencia todavia", activa: true },
    { id: "r2", regla: "envio gratis", activa: true },
  ];
  const piezas = [
    pieza({ id: "a1", texto: "envio gratis uno", alcance: 1000, interacciones: 20 }),
    pieza({ id: "a2", texto: "envio gratis dos", alcance: 1000, interacciones: 25 }),
    pieza({ id: "a3", texto: "envio gratis tres", alcance: 1000, interacciones: 18 }),
    pieza({ id: "b1", texto: "coleccion invierno", alcance: 1000, interacciones: 300 }),
    pieza({ id: "b2", texto: "conoce la marca", alcance: 1000, interacciones: 280 }),
    pieza({ id: "b3", texto: "detras de camara", alcance: 1000, interacciones: 320 }),
  ];
  const { hallazgos } = cruzar({ reglas, piezas });
  assert.equal(hallazgos[0].regla_id, "r2");
  assert.equal(hallazgos[0].veredicto, "contradicha");
});

test("no inventa un hallazgo cuando no hay reglas ni piezas", () => {
  const { hallazgos, piezas_evaluadas } = cruzar({});
  assert.deepEqual(hallazgos, []);
  assert.equal(piezas_evaluadas, 0);
});
