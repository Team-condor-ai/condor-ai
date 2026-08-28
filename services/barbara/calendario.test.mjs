import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/* El calendario de publicación de Cóndor (26-ago-2026, tarde-noche, fijado
   por Joaquín): Lun/Mié/Vie, 13:00 Chile. Los 4 tipos de pieza rotan en
   orden fijo, pero por CONTADOR de piezas ya generadas -- no por día de la
   semana -- para que "se vaya rotando siempre uno" sin importar en qué día
   cae cada corrida (probó diario unas horas esa misma tarde, se revirtió a
   3x/semana).

   Se genera y manda a Telegram a las 13:00 Chile (barbara.yml) y se publica
   sola a las 16:00 Chile (barbara-publicar-automatico.yml), el mismo día,
   salvo que alguien la bloquee en Telegram en el medio.

   Se prueba leyendo los archivos y no importando barbara.mjs: ese módulo
   arranca haciendo trabajo (lee env, lee el log, resuelve la serie), así que
   importarlo en una prueba dispararía esa cadena.

   Lo que se protege es la CONSISTENCIA entre las piezas que tienen que decir
   lo mismo: los dos cron (mismos días), la rotación fija de 4 tipos, y que
   la cabecera del módulo no siga describiendo un calendario ya reemplazado. */

const mjs = readFileSync(new URL("./barbara.mjs", import.meta.url), "utf8");
const ymlGenerar = readFileSync(new URL("../../.github/workflows/barbara.yml", import.meta.url), "utf8");
const ymlPublicar = readFileSync(new URL("../../.github/workflows/barbara-publicar-automatico.yml", import.meta.url), "utf8");

test("se genera Lun/Mié/Vie a las 13:00 Chile (17:00 UTC)", () => {
  assert.match(ymlGenerar, /cron: '0 17 \* \* 1,3,5'/,
    "el cron de generación no es Lun/Mié/Vie a las 17:00 UTC");
});

// 28-ago-2026: Joaquín movió la publicación de 16:00 a 17:00 Chile, con lo que
// la ventana para escribir "bloquear barbara" pasó de 3h a 4h. El workflow se
// actualizó ese día pero este test no, y quedó fallando contra el cron viejo.
test("se publica sola los MISMOS días, 17:00 Chile (21:00 UTC), 4h después", () => {
  assert.match(ymlPublicar, /cron: '0 21 \* \* 1,3,5'/,
    "el cron de publicación automática no coincide con los días de generación");
});

test("la rotación es por CONTADOR de piezas, no por día de la semana", () => {
  assert.match(mjs, /function serieDeHoy\(log\)/,
    "serieDeHoy ya no recibe el log -- ¿volvió a decidir por día de la semana?");
  assert.match(mjs, /SERIES_ROTACION\[previas % 4\]/,
    "la rotación no se deriva de un contador módulo 4");
  assert.ok(!mjs.includes("CALENDARIO"),
    "quedó un CALENDARIO por día de la semana -- la rotación tiene que ser sólo por contador");
});

test("el contador de turno ignora los reels (tienen su propio calendario)", () => {
  assert.match(mjs, /!String\(e\.tipo \|\| ""\)\.startsWith\("reel-"\)/,
    "el filtro de reels desapareció del conteo de turno");
});

test("la rotación fija son 4 series: carrusel/anuncio de cada marca", () => {
  assert.match(mjs, /CARRUSELES_CONDOR\[semanaISO\(\) % 2\]/);
  assert.match(mjs, /"ad_condor"/);
  assert.match(mjs, /CARRUSELES_BARBARA\[semanaISO\(\) % 2\]/);
  assert.match(mjs, /"ad_barbara"/);
});

test("los 7 nombres de día siguen reconocidos (para etiquetar y para 'test')", () => {
  // `dia` ya no elige la serie, pero sigue etiquetando la pieza en el log y
  // viajando en los reintentos de Telegram -- si un nombre deja de
  // reconocerse, ese día cae al "test"/"" por error.
  for (const dia of ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]) {
    assert.ok(mjs.includes(`"${dia}"`), `"${dia}" no aparece como día reconocido en barbara.mjs`);
  }
});

test("la cabecera del modulo describe el calendario vigente (3x/semana, por contador)", () => {
  const cabecera = mjs.slice(0, 700).toLowerCase();
  assert.ok(cabecera.includes("3 piezas por semana") || cabecera.includes("lun/mié/vie") || cabecera.includes("lun/mie/vie"),
    "la cabecera no describe la cadencia vigente (3x/semana, Lun/Mié/Vie)");
  assert.ok(!cabecera.includes("1 pieza por día") && !cabecera.includes("todos los días,"),
    "la cabecera todavía describe la publicación diaria, ya reemplazada");
});
