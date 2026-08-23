import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { pegarLogoCondor, pegarPersonajeBarbara } from "./motor.mjs";

/* Un lienzo plano de un color, para poder medir qué queda después de componer. */
async function lienzo(color, w = 928, h = 1160) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

/* Un lienzo con una CAJA de otro color en la esquina superior izquierda:
   simula exactamente lo que el modelo dibuja de más en la zona reservada. */
async function lienzoConCaja(fondo, caja, w = 928, h = 1160) {
  const base = await lienzo(fondo, w, h);
  const rect = await sharp({
    create: { width: Math.round(w * 0.21), height: Math.round(h * 0.11), channels: 3, background: caja },
  }).png().toBuffer();
  return sharp(base).composite([{ input: rect, left: 0, top: 0 }]).png().toBuffer();
}

/* Porcentaje de píxeles casi blancos en la esquina superior izquierda. */
async function blancosEsquina(buf) {
  const m = await sharp(buf).metadata();
  const { data, info } = await sharp(buf)
    .extract({ left: 0, top: 0, width: Math.round(m.width * 0.28), height: Math.round(m.height * 0.16) })
    .raw().toBuffer({ resolveWithObject: true });
  let blancos = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) blancos++;
  }
  return blancos / total;
}

const NEGRO = { r: 10, g: 10, b: 10 };
const BLANCO = { r: 255, g: 255, b: 255 };
const CREMA = { r: 242, g: 239, b: 230 };

test("borra la caja que el modelo dibuja en la zona reservada", async () => {
  // El caso real del 23-ago-2026: el modelo dibujó un rectángulo BLANCO sobre
  // fondo negro ocupando el 43% de la esquina, pese a que el template le pide
  // dejarla continua con el fondo. Insistirle no sirve — se borra y listo.
  const roto = await lienzoConCaja(NEGRO, BLANCO);
  assert.ok(await blancosEsquina(roto) > 0.3, "el caso de prueba tiene que tener la caja");

  const arreglado = await pegarLogoCondor(roto, "izquierda");
  assert.ok(await blancosEsquina(arreglado) < 0.08,
    "después de componer no puede quedar la caja blanca");
});

test("la limpieza llega hasta el borde, no sólo alrededor del logo", async () => {
  // Un parche centrado en el logo dejaba el marco asomando arriba y a la
  // izquierda, porque la caja del modelo arranca en el pixel (0,0).
  const roto = await lienzoConCaja(NEGRO, BLANCO);
  const arreglado = await pegarLogoCondor(roto, "izquierda");

  const { data, info } = await sharp(arreglado)
    .extract({ left: 0, top: 0, width: 8, height: 8 }).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] < 100, `el pixel (0,0) quedó claro (${data[0]}): la caja sigue asomando`);
  assert.equal(info.width, 8);
});

test("no arruina un fondo limpio: el color se conserva", async () => {
  const limpio = await lienzo(NEGRO);
  const out = await pegarLogoCondor(limpio, "izquierda");
  const { data } = await sharp(out).extract({ left: 2, top: 2, width: 4, height: 4 })
    .raw().toBuffer({ resolveWithObject: true });
  assert.ok(Math.abs(data[0] - NEGRO.r) < 12, "el negro tiene que seguir siendo negro");
});

test("funciona igual sobre fondo crema (T_BARBARA_DATOS alterna)", async () => {
  const roto = await lienzoConCaja(CREMA, NEGRO);
  const out = await pegarLogoCondor(roto, "izquierda");
  const { data } = await sharp(out).extract({ left: 2, top: 2, width: 4, height: 4 })
    .raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 200, `la esquina quedó oscura (${data[0]}): no se limpió sobre crema`);
});

test("la posición 'centro' limpia todo el ancho", async () => {
  const roto = await lienzoConCaja(NEGRO, BLANCO);
  const out = await pegarLogoCondor(roto, "centro");
  assert.ok(await blancosEsquina(out) < 0.08);
});

test("el resultado conserva las dimensiones originales", async () => {
  const base = await lienzo(NEGRO, 800, 1000);
  const out = await pegarLogoCondor(base, "izquierda");
  const m = await sharp(out).metadata();
  assert.equal(m.width, 800);
  assert.equal(m.height, 1000);
});

test("el personaje se pega centrado y conserva el tamaño del lienzo", async () => {
  const base = await lienzo(NEGRO, 800, 1000);
  const out = await pegarPersonajeBarbara(base, 0);
  const m = await sharp(out).metadata();
  assert.equal(m.width, 800);
  assert.equal(m.height, 1000);

  // El centro ya no puede ser el fondo plano: ahí está Bárbara.
  const { data } = await sharp(out).extract({ left: 395, top: 495, width: 4, height: 4 })
    .raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 60, "el centro sigue siendo fondo: el personaje no se pegó");
});

test("las 3 poses son distintas entre sí", async () => {
  const base = await lienzo(NEGRO, 600, 750);
  const firmas = [];
  for (let i = 0; i < 3; i++) {
    const out = await pegarPersonajeBarbara(base, i);
    const { data } = await sharp(out).resize(16, 16).raw().toBuffer({ resolveWithObject: true });
    firmas.push(Buffer.from(data).toString("base64"));
  }
  assert.equal(new Set(firmas).size, 3, "las tres poses tienen que dar imágenes distintas");
});

test("la pose rota de forma determinista y ciclica", async () => {
  // Determinista: dos corridas con el mismo índice dan lo mismo, para que
  // repetir una generación sea reproducible.
  const base = await lienzo(NEGRO, 400, 500);
  const firma = async (i) => {
    const out = await pegarPersonajeBarbara(base, i);
    const { data } = await sharp(out).resize(12, 12).raw().toBuffer({ resolveWithObject: true });
    return Buffer.from(data).toString("base64");
  };
  assert.equal(await firma(0), await firma(0));
  assert.equal(await firma(0), await firma(3), "índice 3 vuelve a la pose 0");
  assert.equal(await firma(1), await firma(4));
});
