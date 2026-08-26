import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/* El calendario de publicación de Cóndor (26-ago-2026, fijado por Joaquín):
   Lun carrusel Cóndor · Mié anuncio Cóndor · Jue carrusel Bárbara · Sáb anuncio Bárbara.

   Se prueba leyendo los archivos y no importando barbara.mjs: ese módulo
   arranca haciendo trabajo (lee env, resuelve el día, arma clientes), así que
   importarlo en una prueba dispararía esa cadena.

   Lo que se protege es la CONSISTENCIA entre las tres piezas que tienen que
   decir lo mismo: el cron del workflow, el mapeo número→día y el CALENDARIO
   de series. Si alguien toca una y se olvida de las otras, ese día corre y no
   encuentra qué generar — o peor, no corre y nadie se entera. */

const mjs = readFileSync(new URL("./barbara.mjs", import.meta.url), "utf8");
const yml = readFileSync(new URL("../../.github/workflows/barbara.yml", import.meta.url), "utf8");

const DIAS = { 1: "lunes", 3: "miercoles", 4: "jueves", 6: "sabado" };

test("el cron corre lunes, miercoles, jueves y sabado", () => {
  assert.match(yml, /cron: '0 13 \* \* 1,3,4,6'/,
    "el cron del workflow no coincide con el calendario acordado");
});

test("los dias del cron son exactamente los del CALENDARIO", () => {
  const cron = yml.match(/cron: '0 13 \* \* ([\d,]+)'/)[1].split(",");
  assert.deepEqual(cron, ["1", "3", "4", "6"]);
  for (const n of cron) {
    const dia = DIAS[n];
    assert.ok(dia, `el cron trae el día ${n}, que no está en el mapeo`);
    assert.ok(mjs.includes(`${dia}:`),
      `${dia} está en el cron pero no aparece en CALENDARIO`);
  }
});

test("el mapeo numero->dia calza con el cron", () => {
  assert.ok(mjs.includes('{ 1: "lunes", 3: "miercoles", 4: "jueves", 6: "sabado" }'),
    "el mapeo de getUTCDay() a nombre de día quedó desalineado del cron");
});

test("no quedan restos del calendario viejo (martes/viernes)", () => {
  // Martes y viernes ya no se publica. Un resto en la lista de días válidos
  // dejaría pasar un DIA=martes que después no encuentra serie y revienta.
  const validos = mjs.match(/if \(!\[([^\]]+)\]\.includes\(dia\)\)/)[1];
  assert.ok(!validos.includes("martes"), "martes sigue como día válido");
  assert.ok(!validos.includes("viernes"), "viernes sigue como día válido");
  for (const dia of Object.values(DIAS)) {
    assert.ok(validos.includes(dia), `${dia} falta en la lista de días válidos`);
  }
});

test("cada dia del calendario tiene una serie asignada", () => {
  for (const dia of Object.values(DIAS)) {
    assert.match(mjs, new RegExp(`${dia}:\\s*\\(\\)\\s*=>`),
      `${dia} no tiene serie asignada en CALENDARIO`);
  }
});

test("la cabecera del modulo describe el calendario vigente", () => {
  // El comentario de arriba de barbara.mjs es lo primero que lee alguien que
  // abre el archivo; si dice el calendario viejo, engaña.
  const cabecera = mjs.slice(0, 400).toLowerCase();
  assert.ok(!cabecera.includes("mar =") && !cabecera.includes("vie ="),
    "la cabecera todavía describe el calendario viejo (Mar/Vie)");
});
