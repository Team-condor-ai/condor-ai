import test from "node:test";
import assert from "node:assert/strict";
import { prepararMemoria, seleccionarGlobales, seleccionarPrivada, terminos } from "./memoria.mjs";

const ahora = new Date("2026-08-24T12:00:00Z");

test("la regla privada reforzada gana sobre gustos y datos", () => {
  const r = seleccionarPrivada({ ahora, reglas: [{ regla: "usa fondo claro", veces_reforzada: 4 }], nodos: [
    { tipo: "gusto", titulo: "Fotos", contenido: "prefiere personas", peso: 2 },
  ] });
  assert.match(r.texto.split("\n")[0], /fondo claro/);
});

test("deduplica una instrucción repetida antes de gastar contexto", () => {
  const r = seleccionarPrivada({ ahora, reglas: [{ regla: "usa fondo claro" }], nodos: [
    { tipo: "dato", titulo: "Regla", contenido: "usa fondo claro", peso: 20 },
  ] });
  assert.equal((r.texto.match(/fondo claro/g) || []).length, 1);
});

test("respeta presupuesto sin cortar notas", () => {
  const r = seleccionarPrivada({ ahora, maxChars: 35, nodos: [
    { tipo: "dato", titulo: "A", contenido: "x".repeat(60), peso: 10 },
    { tipo: "dato", titulo: "B", contenido: "corto", peso: 1 },
  ] });
  assert.match(r.texto, /corto/);
  assert.doesNotMatch(r.texto, /xxxx/);
});

test("un patrón global apagado nunca entra al prompt", () => {
  const r = seleccionarGlobales([{ patron: "patrón privado", muestras: 99, activo: false }]);
  assert.equal(r.texto, "");
});

test("patrones activos se priorizan por muestra y la salida es auditable", () => {
  const r = prepararMemoria({ ahora, patrones: [
    { patron: "menos evidencia", muestras: 2, activo: true },
    { patron: "más evidencia", muestras: 12, activo: true },
  ] });
  assert.match(r.global.texto.split("\n")[0], /más evidencia/);
  assert.equal(r.diagnostico.global_usada, 2);
});

test("extrae términos útiles sin ruido frecuente", () => {
  assert.deepEqual(terminos("Quiero una pieza para el curso de logística y stock"), ["quiero", "pieza", "curso", "logistica", "stock"]);
});

test("una nota pertinente gana a otra más reforzada pero ajena al pedido", () => {
  const r = seleccionarPrivada({
    contexto: { consulta: "promocionar curso de logística e inventario" },
    nodos: [
      { id: "a", tipo: "dato", titulo: "Cursos", contenido: "El curso principal enseña logística e inventario", peso: 1 },
      { id: "b", tipo: "dato", titulo: "Fundador", contenido: "La fundadora se llama Elena", peso: 9 },
    ],
  });
  assert.equal(r.seleccionadas[0].id, "a");
  assert.deepEqual(r.seleccionadas[0].coincidencias.sort(), ["curso", "inventario", "logistica"]);
});

test("expande un salto del grafo desde una nota pertinente", () => {
  const r = seleccionarPrivada({
    contexto: "campaña del curso de logística",
    maxChars: 130,
    nodos: [
      { id: "curso", tipo: "dato", titulo: "Curso de logística", contenido: "Formación para operadores", peso: 1 },
      { id: "tono", tipo: "gusto", titulo: "Tono", contenido: "Usar ejemplos prácticos y directos", peso: 1 },
      { id: "otro", tipo: "gusto", titulo: "Fotografía", contenido: "Preferir fondos azules", peso: 1 },
    ],
    relaciones: [{ origen_id: "curso", destino_id: "tono", tipo: "aplica", peso: 1 }],
  });
  assert.deepEqual(r.seleccionadas.map((x) => x.id), ["curso", "tono"]);
  assert.match(r.seleccionadas[1].detalle, /relacionada/);
});

test("confianza baja reduce prioridad sin borrar la memoria", () => {
  const r = seleccionarPrivada({
    nodos: [
      { id: "seguro", tipo: "dato", titulo: "A", contenido: "Hecho confirmado", confianza: 1, peso: 1 },
      { id: "dudoso", tipo: "dato", titulo: "B", contenido: "Inferencia tentativa", confianza: 0.2, peso: 3 },
    ],
  });
  assert.equal(r.seleccionadas[0].id, "seguro");
});
