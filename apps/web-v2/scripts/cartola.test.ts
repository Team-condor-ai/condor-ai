import test from "node:test";
import assert from "node:assert/strict";
import {
  filasDeItems,
  parsearCartola,
  type FilaTexto,
} from "../src/portal/staff/contabilidad/cartola.ts";

const pieza = (texto: string, xFin: number) => ({
  x: xFin - Math.max(texto.length * 4, 10),
  xFin,
  texto,
});

function fila(y: number, ...piezas: ReturnType<typeof pieza>[]): FilaTexto {
  return { y, piezas };
}

test("lee por separado DESDE y HASTA aunque compartan la misma fila", () => {
  const filas = [
    fila(1, pieza("DESDE : 01/07/2026 HASTA : 31/07/2026", 180)),
    fila(10, pieza("01/07", 30), pieza("SALDO INICIAL", 110), pieza("0", 300)),
    fila(
      20,
      pieza("02/07", 30),
      pieza("TRASPASO DE:CLIENTE", 130),
      pieza("140.000", 250),
      pieza("140.000", 300),
    ),
    fila(
      30,
      pieza("03/07", 30),
      pieza("PAGO:PROVEEDOR", 130),
      pieza("39.604", 200),
      pieza("100.396", 300),
    ),
    fila(40, pieza("31/07", 30), pieza("SALDO FINAL", 110), pieza("100.396", 300)),
  ];

  const cartola = parsearCartola(filas);

  assert.equal(cartola.desde, "2026-07-01");
  assert.equal(cartola.hasta, "2026-07-31");
  assert.equal(cartola.lineas.length, 2);
  assert.equal(cartola.lineas[0].abono, 140_000);
  assert.equal(cartola.lineas[1].cargo, 39_604);
  assert.equal(cartola.saldoFinal, 100_396);
  assert.equal(cartola.saldoCalculado, 100_396);
  assert.equal(cartola.cuadra, true);
});

test("mantiene las páginas en orden aunque repitan coordenadas verticales", () => {
  const item = { str: "una fila", width: 30, transform: [1, 0, 0, 1, 20, 700] };
  const paginaUno = filasDeItems([item], 0);
  const paginaDos = filasDeItems([item], 10_000);

  assert.ok(paginaUno[0].y < paginaDos[0].y);
});
