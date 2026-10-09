// Hoja comparativa del cóndor (puerta P1).
// node herramientas/hoja-condor.mjs  →  hojas/p1-condor.svg (+ .png si se pasa una ruta)
import fs from "node:fs";
import sharp from "sharp";
import { path, VARIANTES, ANCHO, ALTO } from "./condor.mjs";

const AZUL = "#014CFD", TINTA = "#151517", LINEA = "#DDDDDF", GRIS = "#636368";
const png = fs.readFileSync("assets/antes/logo-v2.png").toString("base64");
const HOJAS = {
  p1: { titulo: "P1 · El cóndor", sub: "El original redibujado en vector. Elige una dirección: A, B o C (o una mezcla).", cols: [
    { id: "original", t: "Original", s: "PNG de hoy" },
    { id: "fiel", t: "A · Fiel", s: "El original en vector, puntas suaves, la luz del pecho como hueco" },
    { id: "ritmo", t: "B · Ritmo", s: "Plumas ordenadas: ranuras que se abren igual, pecho como hoja" },
    { id: "solido", t: "C · Sólido", s: "Sin hueco. Para 16–24 px, bordado y sellos" },
  ] },
  p1b: { titulo: "P1b · B Ritmo: el hueco del pecho", sub: "Mismas plumas de B. Solo cambia cómo se separan el ala y el cuerpo.", cols: [
    { id: "ritmo", t: "B1 · Hoja", s: "La de antes: astilla larga hasta la cola" },
    { id: "canal", t: "B2 · Canal", s: "Ranura de ancho parejo; el ala pasa por delante del cuerpo" },
    { id: "cerrada", t: "B3 · Luz cerrada", s: "El hombro llega al collar; la luz queda adentro" },
    { id: "corta", t: "B4 · Corta", s: "El hueco se cierra a media altura del pecho" },
    { id: "muesca", t: "B5 · Muesca", s: "Solo una V donde el ala toca el cuello" },
  ] },
  p1c: { titulo: "P1c · B Ritmo con tajo", sub: "Un corte delgado por todo el cuerpo, siguiendo la curva del ala. El cuello queda intacto.", cols: [
    { id: "ritmo", t: "B1 · Hoja (antes)", s: "Referencia: la cuña ancha" },
    { id: "pasante-fino", t: "B6 · Pasante fino", s: "Corte de 3,4: sale por abajo, ala y cuerpo son dos piezas" },
    { id: "pasante", t: "B6 · Pasante", s: "Igual, con corte de 5" },
    { id: "lleno-fino", t: "B7 · Cuello lleno fino", s: "Corte de 3,4; el cuerpo sigue al ala hasta arriba, cuello ancho y sin muesca" },
    { id: "lleno", t: "B7 · Cuello lleno", s: "Igual, con corte de 5" },
    { id: "solido-cabeza", t: "B8 · Sólido con cabeza", s: "Sin corte; muesca baja entre ala y cabeza, copete visible" },
    { id: "solido-cabeza-hondo", t: "B8 · …muesca honda", s: "Igual, la muesca baja un poco más" },
  ] },
  p1d: { titulo: "P1d · B7: juegos de alas", sub: "Mismo cuerpo, cuello y corte fino de B7. Solo cambian las plumas.", cols: [
    { id: "lleno-fino", t: "Actual · 4 plumas", s: "Referencia" },
    { id: "b7-tres", t: "W2 · Tres plumas", s: "Menos y más anchas: más simple, se lee mejor chico" },
    { id: "b7-cinco", t: "W3 · Cinco plumas", s: "Abanico fino, puntas sobre un arco" },
    { id: "b7-curvas", t: "W4 · Curvas", s: "Bordes arqueados hacia arriba: el ala barre" },
    { id: "b7-romas", t: "W5 · Romas", s: "Puntas muy redondeadas, como hojas" },
  ] },
};
const cual = process.argv[3] || "p1";
const { titulo, sub, cols } = HOJAS[cual];
const W = Math.max(1600, cols.length * 280), X0 = 50, GAP = 20, CW = (W - 2 * X0 - GAP * (cols.length - 1)) / cols.length;
const pajaro = (id, x, y, w, color) => {
  const h = (w * ALTO) / ANCHO;
  if (id === "original") return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 285 248" preserveAspectRatio="xMidYMid meet"><image width="900" height="248" href="data:image/png;base64,${png}"/></svg>`;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${ANCHO} ${ALTO}"><path fill="${color}" fill-rule="evenodd" d="${path(VARIANTES[id])}"/></svg>`;
};
let s = "";
const txt = (x, y, t, size = 15, color = TINTA, peso = 400) => `<text x="${x}" y="${y}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${peso}" fill="${color}">${t}</text>`;
s += txt(X0, 56, titulo, 30, TINTA, 600);
s += txt(X0, 84, sub, 16, GRIS);
let y = 120;
const HC = ((CW - 72) * ALTO) / ANCHO + 72;   // alto de la tarjeta grande
// fila 1: negro grande
cols.forEach((c, i) => {
  const x = X0 + i * (CW + GAP);
  s += `<rect x="${x}" y="${y}" width="${CW}" height="${HC}" rx="20" fill="#fff" stroke="${LINEA}"/>`;
  s += pajaro(c.id, x + 36, y + 36, CW - 72, TINTA);
  s += txt(x, y + HC + 32, c.t, 18, TINTA, 600);
  s += `<foreignObject x="${x}" y="${y + HC + 42}" width="${CW}" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="font:14px Inter,Segoe UI,Arial;color:${GRIS};line-height:1.35">${c.s}</div></foreignObject>`;
});
y += HC + 110;
// fila 2: azul sobre blanco y blanco sobre tinta
const vivas = cols.map((c, i) => ({ c, i })).filter(({ c }) => c.id !== "original");
vivas.forEach(({ c, i }) => {
  const x = X0 + i * (CW + GAP);
  s += `<rect x="${x}" y="${y}" width="${(CW - 10) / 2}" height="150" rx="16" fill="#fff" stroke="${LINEA}"/>`;
  s += pajaro(c.id, x + 22, y + 22, (CW - 10) / 2 - 44, AZUL);
  s += `<rect x="${x + (CW + 10) / 2}" y="${y}" width="${(CW - 10) / 2}" height="150" rx="16" fill="${TINTA}"/>`;
  s += pajaro(c.id, x + (CW + 10) / 2 + 22, y + 22, (CW - 10) / 2 - 44, "#fff");
});
y += 180;
// fila 3: tamaños reales
vivas.forEach(({ c, i }) => {
  let x = X0 + i * (CW + GAP);
  for (const t of [64, 32, 16]) { s += pajaro(c.id, x, y + 8 + (64 - (t * ALTO) / ANCHO) / 2, t, TINTA); x += t + 28; }
  x += 10;
  for (const t of [16]) { s += pajaro(c.id, x, y + 8 + (64 - (t * ALTO) / ANCHO) / 2, t, AZUL); x += t + 22; }
});
y += 100;
const hoja = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="${W}" height="${y}" fill="#fff"/>${s}</svg>`;
fs.mkdirSync("hojas", { recursive: true });
fs.writeFileSync(`hojas/${cual}-condor.svg`, hoja);
if (process.argv[2]) await sharp(Buffer.from(hoja)).png().toFile(process.argv[2]);
console.log(`hojas/${cual}-condor.svg`);
