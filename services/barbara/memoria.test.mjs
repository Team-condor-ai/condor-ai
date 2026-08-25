import test from "node:test";
import assert from "node:assert/strict";
import { prepararMemoria, seleccionarGlobales, seleccionarPrivada } from "./memoria.mjs";

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
