import assert from "node:assert/strict";
import { test } from "node:test";
import {
  franjaDe,
  indiceEstable,
  nombreDePila,
  saludo,
  saludoHora,
  subtituloSaludo,
} from "./saludo.ts";

/** Una fecha local con la hora pedida — la franja se calcula con getHours(). */
function alas(hora: number, dia = 25): Date {
  return new Date(2026, 7, dia, hora, 30, 0);
}

test("las franjas cortan donde tienen que cortar", () => {
  assert.equal(franjaDe(0), "madrugada");
  assert.equal(franjaDe(4), "madrugada");
  assert.equal(franjaDe(5), "mañana");
  assert.equal(franjaDe(11), "mañana");
  assert.equal(franjaDe(12), "tarde");
  assert.equal(franjaDe(19), "tarde");
  assert.equal(franjaDe(20), "noche");
  assert.equal(franjaDe(23), "noche");
});

test("usa el nombre real cuando lo hay", () => {
  assert.equal(nombreDePila("Joaquín"), "Joaquín");
  assert.equal(nombreDePila("Alejandro"), "Alejandro");
  // Nombre completo: se queda con el de pila.
  assert.equal(nombreDePila("Maximiliano Pino"), "Maximiliano");
  // Del correo, cuando el primer segmento sí parece un nombre.
  assert.equal(nombreDePila("joaquin.munoz"), "Joaquin");
});

test("NO inventa un nombre cuando el correo no da uno", () => {
  // Estos son correos reales de la base. Saludar con ellos sería peor que
  // no saludar por el nombre: delata que hay una máquina rellenando.
  assert.equal(nombreDePila("j.ignaciomunozsilva"), null); // inicial suelta
  assert.equal(nombreDePila("maximilianopinocv"), null); // pegado, 17 letras
  assert.equal(nombreDePila("alejandrotobarq"), null); // pegado, 15 letras
  assert.equal(nombreDePila("ventas2024"), null); // no es una persona
  assert.equal(nombreDePila("contacto"), "Contacto"); // caso límite aceptado
  assert.equal(nombreDePila(""), null);
  assert.equal(nombreDePila(null), null);
  assert.equal(nombreDePila(undefined), null);
});

test("el saludo nombra a la persona y calza con la hora", () => {
  const t = saludo("Joaquín", alas(15));
  assert.match(t, /Joaquín/);
  assert.doesNotMatch(t, /undefined|null/);

  const m = saludo("Matías", alas(8));
  assert.match(m, /Matías/);
});

test("sin nombre usable, el saludo igual suena natural", () => {
  const t = saludo("maximilianopinocv", alas(15));
  assert.doesNotMatch(t, /maximilianopinocv/i);
  assert.doesNotMatch(t, /undefined|null/);
  assert.match(t, /^Hola|^Buenas/);
});

test("es estable dentro de la franja y cambia de un día a otro", () => {
  // Lo importante: dos renders seguidos a horas distintas de la MISMA tarde
  // dan el mismo texto. Si esto falla, el saludo parpadea bajo el cursor
  // cada vez que React vuelve a pintar.
  assert.equal(saludo("Joaquín", alas(13)), saludo("Joaquín", alas(19)));

  // Y a lo largo de una semana no se queda pegado en la misma frase.
  const variantes = new Set(
    [25, 26, 27, 28, 29, 30].map((d) => saludo("Joaquín", alas(15, d))),
  );
  assert.ok(variantes.size > 1, "el saludo debería variar entre días");
});

test("el índice estable nunca se sale del rango", () => {
  for (const dia of [1, 15, 25, 31]) {
    for (const f of ["madrugada", "mañana", "tarde", "noche"] as const) {
      const i = indiceEstable(alas(12, dia), f, 3);
      assert.ok(i >= 0 && i < 3, `índice fuera de rango: ${i}`);
    }
  }
});

test("el subtítulo cambia con la franja y nombra el negocio", () => {
  assert.match(subtituloSaludo("Tecnobox", alas(9)), /Tecnobox/);
  const madrugada = subtituloSaludo("Tecnobox", alas(2));
  const manana = subtituloSaludo("Tecnobox", alas(9));
  const noche = subtituloSaludo("Tecnobox", alas(22));
  assert.notEqual(madrugada, manana);
  assert.notEqual(manana, noche);
});

/* La regla que pidió Max: SIEMPRE fórmula de la hora y SIEMPRE un nombre.
   Son las dos mitades del pedido y se prueban por separado, porque cada una
   se rompió por su cuenta: el titular decía "Hola, cerrando el día" —sin
   hora reconocible y sin nombre— aunque el calendario justo al lado ya
   saludaba bien. */
test("saludoHora usa la fórmula de la franja", () => {
  assert.match(saludoHora("Carmen", "Tecnobox", alas(9)), /^Buenos días, Carmen$/);
  assert.match(saludoHora("Carmen", "Tecnobox", alas(15)), /^Buenas tardes, Carmen$/);
  assert.match(saludoHora("Carmen", "Tecnobox", alas(22)), /^Buenas noches, Carmen$/);
});

test("la madrugada saluda buenas noches, no buenos días", () => {
  // A las 3 AM "buenos días" suena a error; en español no hay fórmula propia.
  assert.match(saludoHora("Carmen", "Tecnobox", alas(3)), /^Buenas noches, Carmen$/);
});

test("sin nombre de pila utilizable, cae al negocio en vez de quedarse sin nombre", () => {
  // `nombreDePila` devuelve null a propósito ante un correo pegado; el
  // negocio siempre existe y siempre se puede leer en voz alta.
  assert.equal(saludoHora("maximilianopinocv", "Cóndor.AI", alas(15)), "Buenas tardes, Cóndor.AI");
  assert.equal(saludoHora(null, "Tecnobox", alas(9)), "Buenos días, Tecnobox");
});

test("sin nombre ni respaldo no deja una coma colgando", () => {
  assert.equal(saludoHora(null, null, alas(15)), "Buenas tardes");
  assert.equal(saludoHora("", "  ", alas(22)), "Buenas noches");
});
