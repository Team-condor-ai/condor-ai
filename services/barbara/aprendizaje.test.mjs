import test from "node:test";
import assert from "node:assert/strict";
import { contieneSecreto, decidirAprendizaje, eventoAprendizaje, pareceTemporal } from "./aprendizaje.mjs";

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

test("nunca memoriza contraseñas ni tokens aunque sean explícitos", () => {
  const d = decidirAprendizaje({ candidato: {
    tipo: "dato", titulo: "API key", contenido: "Mi token es sk-secreto",
    fuente: "chat:4", explicito: true, confianza: 0.99,
  } });
  assert.equal(d.accion, "ignorar");
  assert.match(d.razon, /sensible|secreto/);
  assert.equal(contieneSecreto("contraseña: abc"), true);
});

test("un dato temporal queda en el chat y no contamina memoria durable", () => {
  const d = decidirAprendizaje({ candidato: {
    tipo: "gusto", titulo: "Campaña", contenido: "Esta semana usar sólo rojo",
    fuente: "chat:5", explicito: true, confianza: 0.98,
  } });
  assert.equal(d.accion, "ignorar");
  assert.equal(pareceTemporal({ contenido: "mañana publicar temprano" }), true);
});

test("un cambio de alto impacto siempre pide aprobación", () => {
  const d = decidirAprendizaje({ candidato: {
    tipo: "regla", titulo: "Voz", contenido: "No volver a usar humor",
    fuente: "chat:6", explicito: true, confianza: 0.99, alto_impacto: true,
  } });
  assert.equal(d.accion, "proponer");
  assert.match(d.razon, /alto impacto/);
});
