import test from "node:test";
import assert from "node:assert/strict";
import { candidatasDeConversacion, filtrarNuevas, confianzaDe } from "./aprender-conversacion.mjs";

const msg = (remitente, mensaje, extra = {}) => ({ remitente, mensaje, ...extra });

test("jamás aprende de lo que dijo la propia Bárbara", () => {
  // Si aprendiera de sí misma, cada invención suya se volvería un hecho de la
  // marca y se reforzaría sola. Es la forma más rápida de corromper el cerebro.
  const turnos = [
    msg("barbara", "Tu público objetivo son mujeres de 30 a 45 años del sur."),
    msg("barbara", "La marca siempre usa verde oliva."),
  ];
  assert.deepEqual(candidatasDeConversacion(turnos), []);
});

test("aprende de lo que dice el cliente", () => {
  const turnos = [msg("cliente", "Nuestro público real son emprendedoras de 25 a 40 en Santiago.")];
  const c = candidatasDeConversacion(turnos);
  assert.equal(c.length, 1);
  assert.match(c[0].contenido, /emprendedoras/);
});

test("una pregunta no es un hecho de la marca", () => {
  // "¿usamos azul?" no significa que la marca use azul.
  const turnos = [
    msg("cliente", "¿Deberíamos usar azul en los carruseles?"),
    msg("cliente", "Que opinas del tono informal?"),
  ];
  assert.deepEqual(candidatasDeConversacion(turnos), []);
});

test("un saludo o un acuse no ocupa lugar en el cerebro", () => {
  const turnos = [
    msg("cliente", "hola"),
    msg("cliente", "ok"),
    msg("cliente", "gracias!!"),
    msg("cliente", "dale"),
  ];
  assert.deepEqual(candidatasDeConversacion(turnos), []);
});

test("el staff también enseña, pero queda marcado como origen distinto", () => {
  const turnos = [msg("staff", "El cliente factura sobre 80 millones al mes y vende solo mayorista.")];
  const c = candidatasDeConversacion(turnos);
  assert.equal(c.length, 1);
  assert.equal(c[0].origen, "chat:staff");
});

test("un audio transcrito vale menos que algo escrito a mano", () => {
  // La transcripción puede equivocarse; no puede pesar igual que el texto
  // que el cliente tecleó.
  const escrito = confianzaDe({ remitente: "cliente", es_audio: false });
  const hablado = confianzaDe({ remitente: "cliente", es_audio: true });
  assert.ok(hablado < escrito);
  assert.ok(hablado > 0);
});

test("la confianza nunca sale del rango 0..1", () => {
  for (const t of [
    { remitente: "cliente", es_audio: true },
    { remitente: "staff", es_audio: false },
    { remitente: "cliente", es_audio: false },
  ]) {
    const c = confianzaDe(t);
    assert.ok(c >= 0 && c <= 1, `confianza fuera de rango: ${c}`);
  }
});

test("no vuelve a guardar algo que el cerebro ya sabe", () => {
  const candidatas = [
    { contenido: "Vende solo al por mayor", titulo: "canal", origen: "chat:cliente", confianza: 0.8 },
    { contenido: "El público son emprendedoras", titulo: "publico", origen: "chat:cliente", confianza: 0.8 },
  ];
  const existentes = [{ contenido: "vende SOLO al por mayor." }];
  const nuevas = filtrarNuevas(candidatas, existentes);
  assert.equal(nuevas.length, 1);
  assert.match(nuevas[0].contenido, /emprendedoras/);
});

test("tampoco se duplica a sí misma dentro de la misma conversación", () => {
  const candidatas = [
    { contenido: "Vende solo al por mayor", confianza: 0.8 },
    { contenido: "vende solo al por mayor", confianza: 0.9 },
  ];
  assert.equal(filtrarNuevas(candidatas, []).length, 1);
});

test("un mensaje larguísimo se recorta y no revienta el presupuesto", () => {
  const turnos = [msg("cliente", "Nuestro público objetivo " + "x".repeat(5000))];
  const c = candidatasDeConversacion(turnos);
  assert.equal(c.length, 1);
  assert.ok(c[0].contenido.length <= 600, `quedó en ${c[0].contenido.length}`);
});

test("sin conversación no inventa memoria", () => {
  assert.deepEqual(candidatasDeConversacion([]), []);
  assert.deepEqual(candidatasDeConversacion(), []);
});
