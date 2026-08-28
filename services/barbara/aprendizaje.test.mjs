import test from "node:test";
import assert from "node:assert/strict";
import { contieneSecreto, decidirAprendizaje, eventoAprendizaje, pareceTemporal } from "./aprendizaje.mjs";

const base = { tipo: "gusto", titulo: "Fondos", contenido: "Prefiere fondos claros", fuente: "chat-1", confianza: 0.95, explicito: true };

test("crea sólo recuerdos explícitos y con confianza alta", () => {
  const r = decidirAprendizaje({ candidato: base });
  assert.equal(r.accion, "crear");
  assert.equal(r.nodo.contenido, "Prefiere fondos claros");
});

test("una pregunta no es un hecho de la marca", () => {
  // "¿usamos azul?" no significa que la marca use azul. Guardar las dos cosas
  // como equivalentes es de las formas más rápidas de ensuciar la memoria.
  for (const contenido of [
    "¿Deberíamos usar azul en los carruseles?",
    "Que opinas del tono informal?",
    "conviene mostrar el precio",
  ]) {
    const r = decidirAprendizaje({ candidato: { ...base, contenido } });
    assert.equal(r.accion, "ignorar", `entró como memoria: ${contenido}`);
  }
});

test("una afirmación con signo de pregunta adentro no se salva por el texto", () => {
  // El guardia mira el contenido completo, no solo el final.
  const r = decidirAprendizaje({ candidato: { ...base, contenido: "El público pregunta ¿hay envío? todo el tiempo" } });
  assert.equal(r.accion, "ignorar");
});

test("28-ago-2026: el auto-guardado baja a 0.75, pero el piso de 0.62 no se movió", () => {
  // Antes 0.80 iba a la cola de propuestas; ahora entra solo con peso bajo.
  assert.equal(decidirAprendizaje({ candidato: { ...base, confianza: 0.80 } }).accion, "crear");
  // Y lo que estaba bajo el piso se sigue ignorando igual que siempre.
  assert.equal(decidirAprendizaje({ candidato: { ...base, confianza: 0.55 } }).accion, "ignorar");
  // Entre medio sigue existiendo la zona de propuesta.
  assert.equal(decidirAprendizaje({ candidato: { ...base, confianza: 0.70 } }).accion, "proponer");
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
