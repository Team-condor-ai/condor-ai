import test from "node:test";
import assert from "node:assert/strict";
import { filasDeCruce, ejecutarCruceSemanal } from "./cruce-semanal.mjs";

test("un veredicto sin comparación guarda rendimiento nulo, no cero", () => {
  // Un 0 en la tabla se leería como "rindió pésimo". No es lo mismo que
  // "no hubo con qué compararlo".
  const [fila] = filasDeCruce("c1", {
    hallazgos: [{
      regla_id: "r1", regla: "captions cortos", veredicto: "sin_evidencia",
      accion: "esperar", motivo: "faltan muestras", muestras_a_favor: 1, muestras_resto: 0,
    }],
    piezas_evaluadas: 1,
  });
  assert.equal(fila.rendimiento_con_regla, null);
  assert.equal(fila.rendimiento_sin_regla, null);
  assert.equal(fila.piezas_evaluadas, 1);
});

test("un hallazgo con comparación conserva los dos rendimientos", () => {
  const [fila] = filasDeCruce("c1", {
    hallazgos: [{
      regla_id: "r1", regla: "envio gratis", veredicto: "contradicha",
      accion: "revisar_con_cliente", motivo: "rinde peor",
      muestras_a_favor: 3, muestras_resto: 4,
      rendimiento_con_regla: 0.02, rendimiento_sin_regla: 0.3,
    }],
    piezas_evaluadas: 7,
  });
  assert.equal(fila.rendimiento_con_regla, 0.02);
  assert.equal(fila.rendimiento_sin_regla, 0.3);
  assert.equal(fila.barbara_cliente_id, "c1");
});

test("una regla sin id igual deja fila: el texto es lo que importa", () => {
  const [fila] = filasDeCruce("c1", {
    hallazgos: [{ regla: "sin id", veredicto: "sin_evidencia", accion: "esperar", motivo: "x" }],
    piezas_evaluadas: 0,
  });
  assert.equal(fila.regla_id, null);
  assert.equal(fila.regla, "sin id");
});

test("sin hallazgos no inventa filas", () => {
  assert.deepEqual(filasDeCruce("c1", { hallazgos: [], piezas_evaluadas: 0 }), []);
  assert.deepEqual(filasDeCruce("c1", {}), []);
});

// --- la corrida completa, contra un doble de la base ---

function dbFalsa({ clientes = [], reglas = [], piezas = [], fallarInsertDe = null } = {}) {
  const insertados = [];
  const tabla = (nombre) => ({
    select() { return this; },
    eq(col, val) {
      if (nombre === "barbara_reglas" && col === "barbara_cliente_id") this._cliente = val;
      if (nombre === "barbara_memoria" && col === "barbara_cliente_id") this._cliente = val;
      return this;
    },
    gte() { return this; },
    insert(filas) {
      if (fallarInsertDe && filas[0]?.barbara_cliente_id === fallarInsertDe) {
        return Promise.resolve({ error: { message: "insert falló" } });
      }
      insertados.push(...filas);
      return Promise.resolve({ error: null });
    },
    then(resolver) {
      if (nombre === "barbara_clientes") return resolver({ data: clientes, error: null });
      if (nombre === "barbara_reglas") return resolver({ data: reglas.filter((r) => r.barbara_cliente_id === this._cliente), error: null });
      return resolver({ data: piezas.filter((p) => p.barbara_cliente_id === this._cliente), error: null });
    },
  });
  return { from: (n) => tabla(n), insertados };
}

const piezaPub = (cliente, texto, interacciones) => ({
  barbara_cliente_id: cliente, id: `${cliente}-${texto}-${interacciones}`,
  estado: "publicada", angulo: texto,
  metricas: { alcance: 1000, interacciones },
  creado_en: new Date().toISOString(),
});

test("escribe un hallazgo por regla y cuenta los accionables", async () => {
  const db = dbFalsa({
    clientes: [{ id: "c1" }],
    reglas: [{ id: "r1", barbara_cliente_id: "c1", regla: "envio gratis", activa: true }],
    piezas: [
      piezaPub("c1", "envio gratis uno", 20),
      piezaPub("c1", "envio gratis dos", 25),
      piezaPub("c1", "envio gratis tres", 18),
      piezaPub("c1", "coleccion invierno", 300),
      piezaPub("c1", "conoce la marca", 280),
      piezaPub("c1", "detras de camara", 320),
    ],
  });
  const r = await ejecutarCruceSemanal({ db });
  assert.equal(r.clientes, 1);
  assert.equal(r.hallazgos, 1);
  assert.equal(r.accionables, 1);
  assert.equal(db.insertados[0].veredicto, "contradicha");
});

test("si un cliente falla al guardar, los demás igual se cruzan", async () => {
  const db = dbFalsa({
    clientes: [{ id: "c1" }, { id: "c2" }],
    reglas: [
      { id: "r1", barbara_cliente_id: "c1", regla: "envio gratis", activa: true },
      { id: "r2", barbara_cliente_id: "c2", regla: "envio gratis", activa: true },
    ],
    piezas: [
      piezaPub("c1", "envio gratis uno", 20),
      piezaPub("c2", "envio gratis uno", 20),
    ],
    fallarInsertDe: "c1",
  });
  const r = await ejecutarCruceSemanal({ db });
  assert.equal(r.clientes, 1, "c2 tuvo que guardarse igual");
  assert.ok(db.insertados.every((f) => f.barbara_cliente_id === "c2"));
});

test("un cliente sin reglas no genera filas vacías", async () => {
  const db = dbFalsa({ clientes: [{ id: "c1" }], reglas: [], piezas: [] });
  const r = await ejecutarCruceSemanal({ db });
  assert.equal(r.hallazgos, 0);
  assert.equal(db.insertados.length, 0);
});
