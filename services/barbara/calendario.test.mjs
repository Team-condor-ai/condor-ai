import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/* El calendario de publicación de Cóndor (26-ago-2026 TARDE, fijado por
   Joaquín): TODOS los días, rotando 4 tipos de pieza en orden fijo --
   lunes carrusel Cóndor, martes anuncio Cóndor, miércoles carrusel Bárbara,
   jueves anuncio Bárbara, y se repite (viernes=carrusel Cóndor, ...).

   Se genera y manda a Telegram a las 13:00 Chile (barbara.yml) y se publica
   sola a las 16:00 Chile (barbara-publicar-automatico.yml) salvo que alguien
   la bloquee en Telegram en el medio.

   Se prueba leyendo los archivos y no importando barbara.mjs: ese módulo
   arranca haciendo trabajo (lee env, resuelve el día, arma clientes), así que
   importarlo en una prueba dispararía esa cadena.

   Lo que se protege es la CONSISTENCIA entre las piezas que tienen que decir
   lo mismo: los dos cron, la lista de días válidos, el CALENDARIO de series y
   el orden fijo de rotación. Si alguien toca una y se olvida de las otras,
   ese día corre y no encuentra qué generar -- o peor, no corre y nadie se
   entera, o publica el tipo de pieza equivocado. */

const mjs = readFileSync(new URL("./barbara.mjs", import.meta.url), "utf8");
const ymlGenerar = readFileSync(new URL("../../.github/workflows/barbara.yml", import.meta.url), "utf8");
const ymlPublicar = readFileSync(new URL("../../.github/workflows/barbara-publicar-automatico.yml", import.meta.url), "utf8");

const ORDEN_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const NOMBRES_DIA_GETUTCDAY = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

test("se genera todos los días a las 13:00 Chile (17:00 UTC)", () => {
  assert.match(ymlGenerar, /cron: '0 17 \* \* \*'/,
    "el cron de generación no es diario a las 17:00 UTC");
});

test("se publica sola todos los días a las 16:00 Chile (20:00 UTC), 3h después", () => {
  assert.match(ymlPublicar, /cron: '0 20 \* \* \*'/,
    "el cron de publicación automática no es diario a las 20:00 UTC");
});

test("NOMBRES_DIA sigue el orden de getUTCDay() (domingo=0)", () => {
  assert.ok(mjs.includes(JSON.stringify(NOMBRES_DIA_GETUTCDAY).replace(/,/g, ", ")) ||
    mjs.includes('["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]'),
    "NOMBRES_DIA no coincide con el orden de getUTCDay() -- el día calculado quedaría desalineado");
});

test("los 7 días de la semana son válidos (ninguno cae al 'else' de un calendario viejo)", () => {
  for (const dia of ORDEN_SEMANA) {
    assert.ok(mjs.includes(`"${dia}"`), `"${dia}" no aparece como día reconocido en barbara.mjs`);
  }
});

test("CALENDARIO se construye sobre ORDEN_SEMANA (lunes primero) y no al revés de NOMBRES_DIA", () => {
  assert.match(mjs, /ORDEN_SEMANA\s*=\s*\[\s*"lunes"/,
    "ORDEN_SEMANA no arranca en lunes -- el índice %4 de la rotación quedaría corrido");
});

test("la rotación fija son 4 series: carrusel/anuncio de cada marca", () => {
  assert.match(mjs, /CARRUSELES_CONDOR\[semanaISO\(\) % 2\]/);
  assert.match(mjs, /"ad_condor"/);
  assert.match(mjs, /CARRUSELES_BARBARA\[semanaISO\(\) % 2\]/);
  assert.match(mjs, /"ad_barbara"/);
});

test("no quedan restos del calendario viejo restringido a 4 días", () => {
  // El diseño anterior filtraba `dia` contra una lista de solo 4 nombres
  // (lunes/miercoles/jueves/sabado). Si vuelve esa lista, martes/viernes/
  // domingo dejan de reconocerse y caen al fallback silenciosamente.
  assert.ok(!mjs.includes('["lunes", "miercoles", "jueves", "sabado"].includes(dia)'),
    "sigue la lista vieja de 4 días válidos -- el resto de la semana quedaría sin serie");
});

test("la cabecera del modulo describe el calendario vigente (diario)", () => {
  const cabecera = mjs.slice(0, 700).toLowerCase();
  assert.ok(cabecera.includes("todos los días") || cabecera.includes("1 pieza por día"),
    "la cabecera no describe la publicación diaria vigente");
  assert.ok(!cabecera.includes("4 piezas por semana ("),
    "la cabecera todavía describe el calendario semanal viejo como vigente");
});
