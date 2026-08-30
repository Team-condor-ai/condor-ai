import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_TELEGRAM,
  agruparSlides,
  alertarRevision,
  alertarStaff,
  chatDeStaff,
  textoAlertaRevision,
} from "./alertas.mjs";

const ENV = { TELEGRAM_BOT_TOKEN: "bot123", TELEGRAM_CHAT_ID: "-100staff" };

/** Doble de `tg`: guarda lo que se le pidió y contesta lo que se le indique. */
function tgFalso({ ok = true, status = 200, cuerpo = { ok: true, result: { message_id: 7 } } } = {}) {
  const llamadas = [];
  const fn = async (token, metodo, payload) => {
    llamadas.push({ token, metodo, payload });
    return { ok, status, json: async () => cuerpo };
  };
  fn.llamadas = llamadas;
  return fn;
}

/** Log falso: los tests no tienen que ensuciar la salida de node --test. */
function logFalso() {
  const lineas = [];
  const fn = (...args) => lineas.push(args.join(" "));
  fn.lineas = lineas;
  return fn;
}

// Dos slides con el mismo defecto real que salió el 23-ago-2026 a Telegram.
const SLIDES = [
  { indice: 2, aprobada: false, problemas: [{ tipo: "solape", detalle: "el titular pisa el cuerpo" }] },
  { indice: 4, aprobada: false, problemas: [{ tipo: "ortografia", detalle: 'dice "Espar añados"' }] },
];

const PIEZA = { negocio: "Panadería Lucía", tipo: "carrusel", plantilla: "foto", fecha: "2026-08-30", total: 5, slides: SLIDES };

test("el mensaje dice qué cliente, qué pieza y qué problema concreto", () => {
  const texto = textoAlertaRevision(PIEZA);
  assert.match(texto, /Panadería Lucía/, "sin el cliente, staff no sabe a quién mirar");
  assert.match(texto, /carrusel/);
  assert.match(texto, /plantilla foto/);
  assert.match(texto, /2026-08-30/);
  assert.match(texto, /slide 3 — solape: el titular pisa el cuerpo/, "los índices se muestran en base 1");
  assert.match(texto, /slide 5 — ortografia: dice "Espar añados"/);
  assert.match(texto, /antes de que se publique/, "una alerta sin qué-hacer es ruido");
});

test("aclara que la pieza igual se entregó: si no, staff la busca para frenarla", () => {
  assert.match(textoAlertaRevision(PIEZA), /SE ENTREGÓ igual/);
});

test("una sola alerta por pieza, con todos los slides adentro", async () => {
  const tgFn = tgFalso();
  await alertarRevision(PIEZA, { env: ENV, tgFn, log: logFalso() });
  assert.equal(tgFn.llamadas.length, 1, "un mensaje por slide haría que se silencie el canal");
  const texto = tgFn.llamadas[0].payload.text;
  assert.match(texto, /slide 3/);
  assert.match(texto, /slide 5/);
});

test("agrupa el mismo slide reportado dos veces y no repite el mismo problema", () => {
  const agrupados = agruparSlides([
    { indice: 1, problemas: [{ tipo: "solape", detalle: "pisa" }] },
    { indice: 1, problemas: [{ tipo: "solape", detalle: "pisa" }, { tipo: "ilegible", detalle: "sobre zona clara" }] },
  ]);
  assert.equal(agrupados.length, 1);
  assert.deepEqual(agrupados[0].problemas.map((p) => p.tipo), ["solape", "ilegible"]);
});

test("va SIEMPRE al chat de staff, nunca al del cliente", async () => {
  const tgFn = tgFalso();
  // Se le cuela el chat del cliente en los datos, como está en clientes.mjs.
  // Mandarle al cliente "tu pieza salió con defectos" es peor que no avisar.
  await alertarRevision({ ...PIEZA, telegram_chat_id: "555cliente", chatId: "555cliente" }, { env: ENV, tgFn, log: logFalso() });
  assert.equal(tgFn.llamadas[0].payload.chat_id, "-100staff");
  assert.equal(tgFn.llamadas[0].token, "bot123");
  assert.equal(tgFn.llamadas[0].metodo, "sendMessage");
});

test("BARBARA_ALERTAS_CHAT_ID manda si está; si no, cae a TELEGRAM_CHAT_ID", () => {
  assert.equal(chatDeStaff(ENV).chatId, "-100staff");
  assert.equal(chatDeStaff({ ...ENV, BARBARA_ALERTAS_CHAT_ID: "-100alertas" }).chatId, "-100alertas");
  // Sin el fallback esto no funcionaría hasta que infra cargue el secret nuevo.
  assert.equal(chatDeStaff({}).chatId, "");
});

test("si Telegram lanza, la generación sigue: no se propaga el error", async () => {
  const log = logFalso();
  const r = await alertarRevision(PIEZA, {
    env: ENV, log,
    tgFn: async () => { throw new Error("ECONNRESET"); },
  });
  assert.equal(r.enviada, false);
  assert.match(r.motivo, /ECONNRESET/);
  assert.match(log.lineas.join("\n"), /la pieza sigue su curso/);
});

test("un 400 de Telegram llega con su motivo real, no como 'algo falló'", async () => {
  const tgFn = tgFalso({ ok: false, status: 400, cuerpo: { ok: false, description: "chat not found" } });
  const r = await alertarStaff("hola", { env: ENV, tgFn, log: logFalso() });
  assert.equal(r.enviada, false);
  assert.equal(r.motivo, "chat not found",
    "sin la description, un chat mal configurado se ve igual que un token revocado");
});

test("un HTTP 200 con ok:false tampoco se declara enviado", async () => {
  const tgFn = tgFalso({ ok: true, status: 200, cuerpo: { ok: false, description: "bot was blocked by the user" } });
  const r = await alertarStaff("hola", { env: ENV, tgFn, log: logFalso() });
  assert.equal(r.enviada, false);
  assert.match(r.motivo, /blocked/);
});

test("sin credenciales no se llama a Telegram y la alerta queda en el log", async () => {
  const tgFn = tgFalso();
  const log = logFalso();
  const r = await alertarRevision(PIEZA, { env: {}, tgFn, log });
  assert.equal(r.enviada, false);
  assert.equal(r.motivo, "sin_credenciales");
  assert.equal(tgFn.llamadas.length, 0);
  assert.match(log.lineas.join("\n"), /Panadería Lucía/, "el texto no se pierde: queda donde estaba antes");
});

test("sin slides con problemas no se manda nada: el silencio es la buena noticia", async () => {
  const tgFn = tgFalso();
  const r = await alertarRevision({ ...PIEZA, slides: [] }, { env: ENV, tgFn, log: logFalso() });
  assert.equal(r.motivo, "sin_problemas");
  assert.equal(tgFn.llamadas.length, 0);
  assert.equal(textoAlertaRevision({ ...PIEZA, slides: [] }), "");
});

test("un detalle kilométrico no hace que Telegram rechace el mensaje entero", () => {
  const texto = textoAlertaRevision({
    ...PIEZA,
    slides: Array.from({ length: 40 }, (_, i) => ({
      indice: i, problemas: [{ tipo: "solape", detalle: "x".repeat(500) }],
    })),
  });
  assert.ok(texto.length <= LIMITE_TELEGRAM, `quedó en ${texto.length}, Telegram corta en 4096`);
  assert.match(texto, /Panadería Lucía/, "la cabecera tiene que sobrevivir al recorte");
  assert.match(texto, /antes de que se publique/, "el qué-hacer también");
});

test("datos incompletos no rompen el mensaje ni lo dejan con etiquetas vacías", () => {
  const texto = textoAlertaRevision({ slides: [{ indice: 0, problemas: [] }] });
  assert.match(texto, /cliente sin nombre/);
  assert.doesNotMatch(texto, /plantilla \n|plantilla $/m);
  assert.match(texto, /slide 1 — sin detalle/);
});

test("el mensaje respeta el tope aunque el nombre del cliente sea absurdo", async () => {
  const tgFn = tgFalso();
  await alertarRevision({ ...PIEZA, negocio: "N".repeat(3000) }, { env: ENV, tgFn, log: logFalso() });
  // La cabecera no se recorta a propósito, pero el envío igual tiene que
  // salir: se comprueba que se llamó y que el texto sigue siendo manejable.
  assert.equal(tgFn.llamadas.length, 1);
  assert.ok(tgFn.llamadas[0].payload.text.length < 4096);
});
