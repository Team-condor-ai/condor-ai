import test from "node:test";
import assert from "node:assert/strict";
import { decidirAprendizaje, eventoAprendizaje } from "./aprendizaje.mjs";

const base = { tipo: "gusto", titulo: "Fondos", contenido: "Prefiere fondos claros", fuente: "chat-1", confianza: 0.95, explicito: true };

test("crea sólo recuerdos explícitos y con confianza alta", () => {
  const r = decidirAprendizaje({ candidato: base });
  assert.equal(r.accion, "crear");
  assert.equal(r.nodo.contenido, "Prefiere fondos claros");
});

test("una evidencia igual refuerza en vez de duplicar", () => {
  const r = decidirAprendizaje({ nodos: [{ id: "a", tipo: "gusto", titulo: "Fondos", contenido: "Prefiere fondos claros", peso: 2 }], candidato: base });
  assert.deepEqual({ accion: r.accion, id: r.id, peso: r.peso }, { accion: "reforzar", id: "a", peso: 3 });
});

test("una inferencia no explícita se propone y no se escribe sola", () => {
  const r = decidirAprendizaje({ candidato: { ...base, explicito: false } });
  assert.equal(r.accion, "proponer");
});

test("un posible conflicto conserva ambas versiones para revisión", () => {
  const r = decidirAprendizaje({ nodos: [{ id: "a", tipo: "gusto", titulo: "Fondos visuales", contenido: "Usar fondos oscuros" }], candidato: base });
  assert.equal(r.accion, "conflicto");
  assert.equal(r.id, "a");
});

test("el ledger registra actor, motivo y tiempo", () => {
  const e = eventoAprendizaje({ accion: "crear", razon: "dato explícito" }, { mensajeId: "m1", actor: "cliente" });
  assert.equal(e.mensaje_id, "m1");
  assert.equal(e.actor, "cliente");
  assert.match(e.creado_en, /^\d{4}-\d{2}-\d{2}T/);
});
