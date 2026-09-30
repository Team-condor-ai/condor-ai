/**
 * Genera todos los SVG oficiales de la marca condor.ai (guion visual V1).
 *
 *   npm run marca   →  assets/marca/*.svg
 *
 * El isotipo es el redibujo geométrico del cóndor original (vectorizado del
 * PNG tricolor y limpiado a mano a 30 vértices sobre una grilla de 275×248).
 * El wordmark se convierte a contornos desde Clash Display Semibold, así los
 * SVG no dependen de que la fuente esté instalada.
 *
 * Todos los archivos base usan `currentColor`: el color lo decide quien los
 * usa. Las versiones de color (cobalto, tinta, blanco, gradientes) se
 * escriben aparte para quien necesite un archivo cerrado (imprenta, redes).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "assets/marca");
fs.mkdirSync(salida, { recursive: true });

// ── Isotipo ────────────────────────────────────────────────────────────────
export const ISO_W = 275;
export const ISO_H = 248;
export const ISO =
  "M0 0L160 95L183 133L201 130L207 132.5L209 129L196 118L243 117C254 117.6 262 124 268 130.5C272 135 274.6 140 275 145L274.4 149.2L266 145L250 145.6L110 248L117.6 222.4L90 241C83 246 76 248 69 248L32 247L121.5 182.2L104 170L38.5 129.5L109 136.8L38.8 109.8L11 64.5L106.6 104.4L23 49.7L16.8 38.8Z";
// Corte: la línea de luz del logo original, ahora como un tajo que separa ala y cuerpo.
export const CORTE = "M178 120C188 152 181 189 150 222";

// ── Wordmark ───────────────────────────────────────────────────────────────
const fuente = opentype.loadSync(path.join(raiz, "assets/fuentes/ClashDisplay-Semibold.ttf"));
const TAM = 200;
function contorno(texto, x = 0, tracking = -0.02) {
  let cursor = x;
  const partes = [];
  const glifos = fuente.stringToGlyphs(texto);
  glifos.forEach((g, i) => {
    partes.push(g.getPath(cursor, 0, TAM).toPathData(1));
    const kern = i < glifos.length - 1 ? fuente.getKerningValue(g, glifos[i + 1]) : 0;
    cursor += ((g.advanceWidth + kern) / fuente.unitsPerEm) * TAM + tracking * TAM;
  });
  return { d: partes.join(""), ancho: cursor - x };
}
const escala = TAM / fuente.unitsPerEm;
const xAlto = (fuente.tables.os2.sxHeight || 500) * escala;
const ascendente = (fuente.tables.os2.sCapHeight || 700) * escala;

const condor = contorno("condor");
const punto = contorno(".ai", condor.ancho);
const anchoWord = punto.ancho + condor.ancho;
// caja del wordmark: de la línea de ascendentes (d) a la base
const wordBox = { x: 0, y: -ascendente, w: anchoWord, h: ascendente };

const svg = (vb, cuerpo, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor"${extra}>${cuerpo}</svg>\n`;
const r = (n) => Math.round(n * 10) / 10;

const isoCuerpo = `<path d="${ISO}"/>`;
const isoCorteCuerpo =
  `<mask id="corte" maskUnits="userSpaceOnUse" x="0" y="0" width="${ISO_W}" height="${ISO_H}">` +
  `<rect width="${ISO_W}" height="${ISO_H}" fill="#fff"/>` +
  `<path d="${CORTE}" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round"/></mask>` +
  `<path d="${ISO}" mask="url(#corte)"/>`;
const wordCuerpo = `<path d="${condor.d}"/><path d="${punto.d}"/>`;

// Lockup horizontal: el isotipo mide 2.9 veces el x-height; separación = 0.9 x-height.
function lockupH(cuerpoIso) {
  const H = xAlto * 2.9;
  const s = H / ISO_H;
  const gap = xAlto * 0.9;
  const wx = ISO_W * s + gap;
  // base del wordmark alineada con 78 % de la altura del isotipo (línea del vientre)
  const base = H * 0.78;
  const top = Math.min(0, base - ascendente);
  const w = wx + anchoWord;
  return {
    vb: `0 ${r(top)} ${r(w)} ${r(H - top)}`,
    cuerpo: `<g transform="scale(${s.toFixed(4)})">${cuerpoIso}</g><g transform="translate(${r(wx)} ${r(base)})">${wordCuerpo}</g>`,
    ancho: w,
    alto: H - top,
  };
}
function lockupV(cuerpoIso) {
  const H = anchoWord * 0.62;
  const s = H / ISO_H;
  const isoW = ISO_W * s;
  const gap = xAlto * 1.1;
  const base = H + gap + ascendente;
  return {
    vb: `0 0 ${r(anchoWord)} ${r(base + 6)}`,
    cuerpo: `<g transform="translate(${r((anchoWord - isoW) / 2)} 0) scale(${s.toFixed(4)})">${cuerpoIso}</g><g transform="translate(0 ${r(base)})">${wordCuerpo}</g>`,
  };
}

const base = {
  "condor-isotipo.svg": svg(`0 0 ${ISO_W} ${ISO_H}`, isoCuerpo, ' role="img" aria-label="condor.ai"'),
  "condor-isotipo-corte.svg": svg(`0 0 ${ISO_W} ${ISO_H}`, isoCorteCuerpo, ' role="img" aria-label="condor.ai"'),
  "condor-wordmark.svg": svg(
    `${r(wordBox.x)} ${r(wordBox.y - 4)} ${r(wordBox.w)} ${r(wordBox.h + 4 + TAM * 0.06)}`,
    wordCuerpo,
    ' role="img" aria-label="condor.ai"',
  ),
};
const lh = lockupH(isoCuerpo);
const lv = lockupV(isoCuerpo);
base["condor-lockup-horizontal.svg"] = svg(lh.vb, lh.cuerpo, ' role="img" aria-label="condor.ai"');
base["condor-lockup-vertical.svg"] = svg(lv.vb, lv.cuerpo, ' role="img" aria-label="condor.ai"');

// ── Colores cerrados ───────────────────────────────────────────────────────
const SOLIDOS = { cobalto: "#2747FF", tinta: "#0A0F2C", blanco: "#FFFFFF" };
const GRADIENTES = {
  "gradiente-azul": ["#8FB2FF", "#2747FF", "#0B1A7A"],
  "rosa-puna": ["#FFC2DA", "#FF6FA8", "#8A5CFF"],
  aurora: ["#7CF5D8", "#2FB8FF", "#2747FF"],
  cromo: ["#FFFFFF", "#9AA6C8", "#3A4466"],
};
function conGradiente(archivo, stops) {
  const contenido = base[archivo];
  const vb = contenido.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const def =
    `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${vb[0]}" y1="${vb[1]}" x2="${vb[0] + vb[2]}" y2="${vb[1] + vb[3]}">` +
    stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join("") +
    `</linearGradient></defs>`;
  return contenido.replace('fill="currentColor"', 'fill="url(#g)"').replace(/(<svg[^>]*>)/, `$1${def}`);
}

let n = 0;
for (const [archivo, contenido] of Object.entries(base)) {
  fs.writeFileSync(path.join(salida, archivo), contenido);
  n++;
  const nombre = archivo.replace(".svg", "");
  for (const [color, hex] of Object.entries(SOLIDOS)) {
    fs.writeFileSync(path.join(salida, `${nombre}-${color}.svg`), contenido.replace('fill="currentColor"', `fill="${hex}"`));
    n++;
  }
  for (const [color, stops] of Object.entries(GRADIENTES)) {
    fs.writeFileSync(path.join(salida, `${nombre}-${color}.svg`), conGradiente(archivo, stops));
    n++;
  }
}

// Datos para el guion (paths en JS, sin volver a leer archivos en el navegador)
const datos = {
  iso: { w: ISO_W, h: ISO_H, d: ISO, corte: CORTE },
  word: { d: condor.d + punto.d, vb: base["condor-wordmark.svg"].match(/viewBox="([^"]+)"/)[1] },
  lockupH: { vb: lh.vb, cuerpo: lh.cuerpo },
  lockupV: { vb: lv.vb, cuerpo: lv.cuerpo },
};
fs.writeFileSync(
  path.join(raiz, "assets/marca-datos.js"),
  `// Generado por herramientas/generar-marca.mjs — no editar a mano.\nwindow.CONDOR_MARCA = ${JSON.stringify(datos)};\n`,
);
console.log(`${n} SVG escritos en assets/marca · x-height ${r(xAlto)} · wordmark ${r(anchoWord)}×${r(ascendente)}`);
