import assert from "node:assert/strict";
import test from "node:test";
import { normalizar, elegirPilar, bloquePrompt, MEZCLA_POR_DEFECTO, CLAVES } from "./pilares.mjs";

const suma = (o) => Object.values(o).reduce((s, v) => s + v, 0);

test("normalizar reparte proporcional y suma 100", () => {
  const out = normalizar({ educar: 3, mostrar: 1 });
  assert.ok(Math.abs(suma(out) - 100) < 1e-9);
  assert.ok(Math.abs(out.educar - 75) < 1e-9);
  assert.ok(Math.abs(out.mostrar - 25) < 1e-9);
});

test("normalizar acepta porcentajes tal cual", () => {
  const out = normalizar({ educar: 50, mostrar: 30, autoridad: 20 });
  assert.ok(Math.abs(out.educar - 50) < 1e-9);
});

test("normalizar descarta claves desconocidas y valores basura", () => {
  const out = normalizar({ educar: 50, inventado: 50, mostrar: "no", autoridad: -5 });
  assert.deepEqual(Object.keys(out), ["educar"]);
});

test("normalizar cae a la mezcla por defecto si no queda nada válido", () => {
  const out = normalizar({ inventado: 10 });
  assert.deepEqual(Object.keys(out).sort(), Object.keys(normalizar(MEZCLA_POR_DEFECTO)).sort());
});

test("la mezcla por defecto NO es la de Cóndor: educar pesa más que vender", () => {
  // Copiarle a un cliente la mezcla de la cuenta propia de Cóndor (3 de 4
  // series hablando de Cóndor) le espantaría los seguidores. Este test
  // existe para que ese cambio no pase inadvertido.
  const m = normalizar(MEZCLA_POR_DEFECTO);
  assert.ok(m.educar > m.mostrar, "educar tiene que pesar más que mostrar/vender");
});

test("sin historial arranca por el pilar de mayor peso", () => {
  const r = elegirPilar({ educar: 10, mostrar: 90 }, []);
  assert.equal(r.pilar, "mostrar");
});

test("elige el pilar más endeudado, no el siguiente por turno", () => {
  // Pidió mitad y mitad, pero las últimas 4 fueron todas de venta.
  const r = elegirPilar({ educar: 50, mostrar: 50 }, ["mostrar", "mostrar", "mostrar", "mostrar"]);
  assert.equal(r.pilar, "educar");
  assert.ok(r.deuda > 0);
});

test("converge a la mezcla pedida a lo largo de muchas piezas", () => {
  const mezcla = { educar: 50, mostrar: 30, autoridad: 20 };
  const historial = []; // más reciente primero
  for (let i = 0; i < 60; i++) {
    historial.unshift(elegirPilar(mezcla, historial).pilar);
  }
  const conteo = {};
  for (const p of historial) conteo[p] = (conteo[p] || 0) + 1;

  // Con 60 piezas el reparto real tiene que quedar cerca del pedido.
  assert.ok(Math.abs((conteo.educar / 60) * 100 - 50) < 8, `educar quedó en ${conteo.educar}/60`);
  assert.ok(Math.abs((conteo.mostrar / 60) * 100 - 30) < 8, `mostrar quedó en ${conteo.mostrar}/60`);
  assert.ok(Math.abs((conteo.autoridad / 60) * 100 - 20) < 8, `autoridad quedó en ${conteo.autoridad}/60`);
});

test("un pilar con peso 0 nunca sale", () => {
  const mezcla = { educar: 50, mostrar: 50, prueba_social: 0 };
  const historial = [];
  for (let i = 0; i < 30; i++) historial.unshift(elegirPilar(mezcla, historial).pilar);
  assert.ok(!historial.includes("prueba_social"),
    "prueba_social en 0 significa que la marca no entregó testimonios: inventarlos está prohibido");
});

test("es determinista: mismos datos, misma elección", () => {
  const mezcla = { educar: 33, mostrar: 33, autoridad: 34 };
  const hist = ["educar", "mostrar"];
  assert.equal(elegirPilar(mezcla, hist).pilar, elegirPilar(mezcla, hist).pilar);
});

test("ignora entradas de historial que no son pilares conocidos", () => {
  const r = elegirPilar({ educar: 50, mostrar: 50 }, ["basura", "otra-cosa", "mostrar"]);
  assert.equal(r.pilar, "educar");
});

test("la ventana acota cuánto historial pesa", () => {
  const mezcla = { educar: 50, mostrar: 50 };
  const historial = ["educar", ...Array(50).fill("mostrar")];
  // Con ventana 1 sólo cuenta la última pieza (educar) → toca mostrar.
  assert.equal(elegirPilar(mezcla, historial, { ventana: 1 }).pilar, "mostrar");
});

test("bloquePrompt nombra el pilar y explica por qué tocó", () => {
  const r = elegirPilar({ educar: 50, mostrar: 50 }, ["mostrar", "mostrar"]);
  const txt = bloquePrompt(r);
  assert.match(txt, /PILAR DE HOY: Educar/);
  assert.match(txt, /Por eso hoy toca Educar/);
});

test("bloquePrompt con un pilar inválido devuelve vacío en vez de romper el prompt", () => {
  assert.equal(bloquePrompt({ pilar: "inventado", instruccion: "x", reparto: {} }), "");
});

test("todo pilar del catálogo trae instrucción usable", () => {
  for (const k of CLAVES) {
    const r = elegirPilar({ [k]: 100 }, []);
    assert.equal(r.pilar, k);
    assert.ok(r.instruccion.length > 40, `${k} necesita una instrucción de verdad`);
  }
});
