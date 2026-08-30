import test from "node:test";
import assert from "node:assert/strict";
import {
  MINIMO_PIEZAS_MES,
  clasificarPieza,
  tasaAprobacionPorMes,
  tendenciaAprobacion,
  resumenAprobacion,
  aprobacionDelCliente,
  aprobacionDeTodos,
} from "./metricas-aprobacion.mjs";

/** Una fila de `barbara_memoria` como la escribe clientes.mjs. Por defecto:
 *  pieza nueva, ya cerrada y aprobada sin que nadie pidiera cambios. */
const pieza = (fecha, extra = {}) => ({
  id: `${fecha}-${Math.random().toString(36).slice(2, 7)}`,
  fecha,
  tipo: "carrusel",
  corrige_a: null,
  aprobada_sin_cambios: true,
  correcciones_pedidas: 0,
  ...extra,
});

/** n piezas del mismo mes, las primeras `corregidas` con correcciones reales. */
const mes = (yyyymm, n, corregidas = 0) =>
  Array.from({ length: n }, (_, i) =>
    pieza(`${yyyymm}-${String((i % 28) + 1).padStart(2, "0")}`,
      i < corregidas ? { aprobada_sin_cambios: false, correcciones_pedidas: 1 } : {}));

// ---- Meses sin datos suficientes --------------------------------------------

test("sin ninguna pieza no inventa meses ni porcentajes", () => {
  const r = tasaAprobacionPorMes([]);
  assert.deepEqual(r.meses, []);
  assert.equal(r.total.tasa, null);
  assert.equal(r.total.cerradas, 0);
  assert.equal(r.total.suficiente, false);
});

test("un mes por debajo del mínimo aparece en la serie pero sin porcentaje", () => {
  // 5 cerradas, 4 limpias: 80% suena buenísimo y no significa nada.
  const r = tasaAprobacionPorMes(mes("2026-03", 5, 1));
  assert.equal(r.meses.length, 1, "el mes flaco no se esconde: un hueco no es continuidad");
  assert.equal(r.meses[0].mes, "2026-03");
  assert.equal(r.meses[0].cerradas, 5);
  assert.equal(r.meses[0].aprobadas, 4);
  assert.equal(r.meses[0].tasa, null);
  assert.equal(r.meses[0].suficiente, false);
});

test("el mínimo es configurable y con muestra suficiente sí reporta", () => {
  const r = tasaAprobacionPorMes(mes("2026-03", 5, 1), { minimo: 3 });
  assert.equal(r.meses[0].tasa, 0.8);
  assert.equal(r.meses[0].suficiente, true);
});

test("justo en el mínimo ya reporta; una menos, no", () => {
  assert.equal(tasaAprobacionPorMes(mes("2026-04", MINIMO_PIEZAS_MES)).meses[0].tasa, 1);
  assert.equal(tasaAprobacionPorMes(mes("2026-04", MINIMO_PIEZAS_MES - 1)).meses[0].tasa, null);
});

// ---- Piezas todavía abiertas -------------------------------------------------

test("una pieza sin cerrar no cuenta ni a favor ni en contra", () => {
  const piezas = [...mes("2026-05", 6), pieza("2026-05-20", { aprobada_sin_cambios: null })];
  const r = tasaAprobacionPorMes(piezas);
  assert.equal(r.meses[0].cerradas, 6, "la abierta no entra al denominador");
  assert.equal(r.meses[0].aprobadas, 6, "ni al numerador: el silencio todavía no venció");
  assert.equal(r.meses[0].tasa, 1);
  assert.equal(r.descartes.abiertas, 1);
});

test("un mes entero sin cerrar da 0 cerradas, no 0%", () => {
  const abiertas = mes("2026-05", 8).map((p) => ({ ...p, aprobada_sin_cambios: null }));
  const r = tasaAprobacionPorMes(abiertas);
  assert.deepEqual(r.meses, [], "cero piezas cerradas no es un mes de piezas rechazadas");
  assert.equal(r.descartes.abiertas, 8);
});

// ---- Reintentos --------------------------------------------------------------

test("los reintentos no cuentan como piezas nuevas", () => {
  const piezas = [
    ...mes("2026-06", 6, 2),
    // Los dos reintentos de esas dos piezas corregidas: salen aprobados, como
    // suele pasar. Contarlos daría 6/8 en vez de 4/6, o sea: corregir mucho
    // MEJORARÍA la tasa. Justo lo contrario de lo que la métrica quiere decir.
    pieza("2026-06-10", { corrige_a: "pieza-1" }),
    pieza("2026-06-11", { corrige_a: "pieza-2" }),
  ];
  const r = tasaAprobacionPorMes(piezas);
  assert.equal(r.meses[0].cerradas, 6);
  assert.equal(r.meses[0].aprobadas, 4);
  assert.equal(r.meses[0].tasa, 0.667);
  assert.equal(r.descartes.reintentos, 2);
});

test("un reintento se descarta aunque siga abierto", () => {
  const r = tasaAprobacionPorMes([pieza("2026-06-10", { corrige_a: "x", aprobada_sin_cambios: null })]);
  assert.equal(r.descartes.reintentos, 1);
  assert.equal(r.descartes.abiertas, 0, "primero es reintento; no se cuenta dos veces");
});

// ---- La trampa de correcciones_pedidas ---------------------------------------

test("manda el correcciones_pedidas DE LA FILA, no un contador del cliente", () => {
  // Escenario real: el cliente lleva 2 correcciones gastadas en su contador
  // acumulado (barbara_correcciones.intentos_usados). Si la métrica mirara ese
  // contador, estas 6 piezas limpias figurarían todas corregidas y el cliente
  // aparecería en 0%. Cada fila trae el suyo y todas están en cero.
  const piezas = mes("2026-07", 6).map((p) => ({ ...p, correcciones_pedidas: 0 }));
  const r = tasaAprobacionPorMes(piezas);
  assert.equal(r.meses[0].tasa, 1);
  assert.equal(r.meses[0].inconsistentes, 0);
});

test("cada fila se juzga con su propio contador, no con el de la anterior", () => {
  const piezas = [
    ...mes("2026-07", 4),
    pieza("2026-07-20", { aprobada_sin_cambios: false, correcciones_pedidas: 3 }),
    // La siguiente pieza salió limpia. Con el contador acumulado del cliente
    // heredaría esas 3 correcciones y quedaría marcada como corregida sin que
    // nadie la hubiera corregido: dato falso, y encima uno del que después
    // aprende la memoria global.
    pieza("2026-07-21"),
  ];
  const r = tasaAprobacionPorMes(piezas);
  assert.equal(r.meses[0].cerradas, 6);
  assert.equal(r.meses[0].aprobadas, 5);
  assert.equal(r.meses[0].tasa, 0.833);
});

test("si veredicto y contador de la fila se contradicen, la pieza no suma", () => {
  // Aprobada según el flag pero con correcciones propias: la fila no es
  // confiable y esta métrica redondea en contra de sí misma.
  const contradictoria = clasificarPieza(pieza("2026-07-05", { aprobada_sin_cambios: true, correcciones_pedidas: 2 }));
  assert.equal(contradictoria.aprobada, false);
  assert.equal(contradictoria.inconsistente, true);

  // Y al revés: marcada como corregida con su contador en cero (la fila
  // envenenada que describe clientes.mjs). Tampoco se le regala el punto.
  const envenenada = clasificarPieza(pieza("2026-07-06", { aprobada_sin_cambios: false, correcciones_pedidas: 0 }));
  assert.equal(envenenada.aprobada, false);
  assert.equal(envenenada.inconsistente, true);

  const r = tasaAprobacionPorMes([...mes("2026-07", 5), pieza("2026-07-05", { correcciones_pedidas: 2 })]);
  assert.equal(r.meses[0].aprobadas, 5);
  assert.equal(r.meses[0].inconsistentes, 1, "queda anotado para poder auditarlo");
  assert.equal(r.total.inconsistentes, 1);
});

test("correcciones_pedidas nulo se lee como cero, no como NaN", () => {
  const c = clasificarPieza(pieza("2026-07-07", { correcciones_pedidas: null }));
  assert.equal(c.aprobada, true);
  assert.equal(c.inconsistente, false);
});

// ---- Serie mes a mes ---------------------------------------------------------

test("la serie sale en orden cronológico aunque las filas lleguen desordenadas", () => {
  const piezas = [...mes("2026-08", 6), ...mes("2026-01", 6), ...mes("2026-04", 6)];
  assert.deepEqual(tasaAprobacionPorMes(piezas).meses.map((m) => m.mes), ["2026-01", "2026-04", "2026-08"]);
});

test("la serie muestra un cliente que aprende: 40% en el mes 1, 90% en el mes 6", () => {
  const piezas = [
    ...mes("2026-01", 10, 6), // 40%
    ...mes("2026-02", 10, 5), // 50%
    ...mes("2026-03", 10, 3), // 70%
    ...mes("2026-06", 10, 1), // 90%
  ];
  const r = tasaAprobacionPorMes(piezas);
  assert.deepEqual(r.meses.map((m) => m.tasa), [0.4, 0.5, 0.7, 0.9]);
  assert.equal(r.total.tasa, 0.625);

  const t = tendenciaAprobacion(r.meses);
  assert.equal(t.direccion, "mejora");
  assert.equal(t.delta, 50);
  assert.equal(t.desde, "2026-01");
  assert.equal(t.hasta, "2026-06");
});

test("la serie también delata al cliente que empeora", () => {
  const r = tasaAprobacionPorMes([...mes("2026-01", 10, 1), ...mes("2026-06", 10, 6)]);
  const t = tendenciaAprobacion(r.meses);
  assert.equal(t.direccion, "empeora");
  assert.equal(t.delta, -50);
});

test("los meses sin muestra se saltean en la tendencia, no valen 0", () => {
  const piezas = [...mes("2026-01", 10, 6), ...mes("2026-02", 2, 2), ...mes("2026-03", 10, 1)];
  const t = tendenciaAprobacion(tasaAprobacionPorMes(piezas).meses);
  assert.equal(t.desde, "2026-01");
  assert.equal(t.hasta, "2026-03");
  assert.equal(t.meses_medibles, 2, "febrero tuvo 2 piezas: no es un mes malo, es un mes chico");
});

test("una diferencia dentro del ruido no se llama mejora", () => {
  // 70% -> 75%: media pieza de diferencia sobre 10. No es aprendizaje.
  const r = tasaAprobacionPorMes([...mes("2026-01", 10, 3), ...mes("2026-02", 8, 2)]);
  assert.equal(tendenciaAprobacion(r.meses).direccion, "estable");
});

test("con un solo mes medible no hay tendencia que inventar", () => {
  assert.equal(tendenciaAprobacion(tasaAprobacionPorMes(mes("2026-01", 10, 3)).meses), null);
  assert.equal(tendenciaAprobacion([]), null);
});

// ---- Fechas ------------------------------------------------------------------

test("manda la fecha de la pieza, no cuándo se escribió la fila", () => {
  // Pieza del 31 de enero generada pasada la medianoche UTC: va a enero.
  const c = clasificarPieza(pieza("2026-01-31", { creado_en: "2026-02-01T00:12:00Z" }));
  assert.equal(c.mes, "2026-01");
});

test("sin fecha cae a creado_en; sin ninguna de las dos se descarta", () => {
  assert.equal(clasificarPieza({ fecha: null, creado_en: "2026-02-03T10:00:00Z", aprobada_sin_cambios: true }).mes, "2026-02");
  assert.equal(clasificarPieza({ aprobada_sin_cambios: true }).descarte, "sin_fecha");
  assert.equal(tasaAprobacionPorMes([{ aprobada_sin_cambios: true }]).descartes.sin_fecha, 1);
});

// ---- Resumen -----------------------------------------------------------------

test("el resumen dice sin muestra en vez de un porcentaje engañoso", () => {
  const texto = resumenAprobacion(tasaAprobacionPorMes([...mes("2026-01", 10, 5), ...mes("2026-02", 3)]), { negocio: "Joyería X" });
  assert.match(texto, /Joyería X/);
  assert.match(texto, /2026-01\s+50%/);
  assert.match(texto, /2026-02\s+sin muestra/);
  assert.match(texto, /no se reporta porcentaje/);
});

test("el resumen no revienta con un cliente sin piezas cerradas", () => {
  const texto = resumenAprobacion(tasaAprobacionPorMes([pieza("2026-01-02", { aprobada_sin_cambios: null })]));
  assert.match(texto, /todavía no hay ninguna pieza cerrada/);
  assert.match(texto, /1 sin cerrar/);
});

// ---- La parte que toca la base ----------------------------------------------

test("aprobacionDelCliente filtra por cliente y no por estado de la pieza", async () => {
  const rutas = [];
  const db = { get: async (ruta) => { rutas.push(ruta); return mes("2026-01", 10, 4); } };
  const r = await aprobacionDelCliente(db, "cli-1");
  assert.equal(rutas.length, 1);
  assert.match(rutas[0], /^barbara_memoria\?barbara_cliente_id=eq\.cli-1/);
  assert.match(rutas[0], /select=id,fecha,creado_en,tipo,corrige_a,aprobada_sin_cambios,correcciones_pedidas/);
  assert.doesNotMatch(rutas[0], /corrige_a=is\.null|aprobada_sin_cambios=/,
    "el filtrado vive en el cálculo puro: si filtrara acá, los descartes darían siempre cero");
  assert.equal(r.meses[0].tasa, 0.6);
});

test("aprobacionDelCliente acepta una fecha desde y exige el id", async () => {
  const rutas = [];
  const db = { get: async (ruta) => { rutas.push(ruta); return []; } };
  await aprobacionDelCliente(db, "cli-1", { desde: "2026-01-01" });
  assert.match(rutas[0], /&fecha=gte\.2026-01-01/);
  await assert.rejects(() => aprobacionDelCliente(db, ""), /barbara_cliente_id/);
});

test("aprobacionDeTodos ordena por peor tasa y manda al final a los sin muestra", async () => {
  const porCliente = {
    "c-bien": mes("2026-01", 10, 1),
    "c-mal": mes("2026-01", 10, 7),
    "c-nuevo": mes("2026-01", 2),
  };
  const db = {
    get: async (ruta) => {
      if (ruta.startsWith("barbara_clientes")) return [
        { id: "c-bien", clientes: { negocio: "Bien" } },
        { id: "c-nuevo", clientes: [{ negocio: "Nuevo" }] },
        { id: "c-mal", clientes: { negocio: "Mal" } },
      ];
      return porCliente[/eq\.([^&]+)/.exec(ruta)[1]];
    },
  };
  const filas = await aprobacionDeTodos(db);
  assert.deepEqual(filas.map((f) => f.negocio), ["Mal", "Bien", "Nuevo"]);
  assert.equal(filas[0].total.tasa, 0.3);
  assert.equal(filas[2].total.tasa, null, "2 piezas no dan un 100% publicable");
});
