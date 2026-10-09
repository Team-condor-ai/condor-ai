/**
 * Marca condor.ai · guion visual v2 (puerta P3)
 *
 *   npm run marca   →  assets/marca/*.svg  +  assets/marca-datos.js
 *
 * Piezas aprobadas:
 *   - Cóndor: `oficial` de condor.mjs (B7 cuello lleno · corte 3,4 · plumas romas).
 *   - Letras: Inter Display Semibold en vector propio (tipo.mjs).
 * Salen el isotipo, el wordmark, el logo horizontal y el vertical, cada uno en
 * currentColor y en las tres tintas (negro, blanco, azul), y el ícono de app.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { path as condorPath, piezas as piezasCondor, VARIANTES, ANCHO, ALTO } from "./condor.mjs";
import { componer, XH, BL } from "./tipo.mjs";
import { PRODUCTOS, ESTILOS, svgIcono } from "./iconos.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "assets/marca");
fs.rmSync(salida, { recursive: true, force: true });
fs.mkdirSync(salida, { recursive: true });
const r2 = (n) => Math.round(n * 100) / 100;

export const TINTAS = { negro: "#151517", blanco: "#FFFFFF", azul: "#014CFD" };

/** Caja exacta de un path (renderiza a 4× y recorta lo blanco). */
async function caja(d, vb) {
  const k = 4, [x, y, w, h] = vb;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="${vb.join(" ")}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><path fill-rule="evenodd" d="${d}"/></svg>`;
  const { info } = await sharp(Buffer.from(svg)).flatten({ background: "#fff" }).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  return { x: x - info.trimOffsetLeft / k, y: y - info.trimOffsetTop / k, w: info.width / k, h: info.height / k };
}

// ── Piezas ─────────────────────────────────────────────────────────────────
const condor = condorPath(VARIANTES.oficial);
const cC = await caja(condor, [-10, -10, ANCHO + 20, ALTO + 20]);       // caja real del cóndor
const W = componer("semibold");
const wordD = W.letras.map((l) => l.d).join("");
const wTop = W.top;                                                       // tope de la d
const usar = (d, s, dx, dy) => `<path fill-rule="evenodd" transform="translate(${r2(dx)} ${r2(dy)}) scale(${r2(s)})" d="${d}"/>`;

// Horizontal: el cóndor mide 1,8 alto de x; su base cae 4 bajo la línea base; separación 0,34 alto de x.
const H = (() => {
  const hC = Number(process.env.HC || 1.8) * XH, s = hC / cC.h, wC = cC.w * s, gap = 0.34 * XH;
  const yC = BL + 4 - hC, top = Math.min(yC, wTop), bot = BL + 4;
  const cuerpo = usar(condor, s, -cC.x * s, yC - cC.y * s) + `<path transform="translate(${r2(wC + gap)} 0)" d="${wordD}"/>`;
  // para animar: dónde va el cóndor (transform) y dónde parte el nombre
  const anim = { condor: `translate(${r2(-cC.x * s)} ${r2(yC - cC.y * s)}) scale(${r2(s)})`, palabraX: r2(wC + gap) };
  return { vb: [0, r2(top), r2(wC + gap + W.w), r2(bot - top)], cuerpo, isoAncho: r2(wC), sep: r2(gap), anim };
})();
// Vertical: el cóndor centrado, de 0,46 del ancho del nombre; separación 0,55 alto de x.
const Vt = (() => {
  const wC = 0.5 * W.w, s = wC / cC.w, hC = cC.h * s, gap = 0.5 * XH;
  const dyW = hC + gap - wTop;                                            // baja el nombre bajo el cóndor
  const cuerpo = usar(condor, s, (W.w - wC) / 2 - cC.x * s, -cC.y * s) + `<path transform="translate(0 ${r2(dyW)})" d="${wordD}"/>`;
  return { vb: [0, 0, r2(W.w), r2(hC + gap + (BL - wTop) + 2)], cuerpo };
})();
const ISO = { vb: [r2(cC.x), r2(cC.y), r2(cC.w), r2(cC.h)], cuerpo: `<path fill-rule="evenodd" d="${condor}"/>` };
const WORD = { vb: [0, r2(wTop), W.w, r2(BL - wTop + 2)], cuerpo: `<path d="${wordD}"/>` };

// Ícono de app: squircle continuo (superelipse n = 5), cóndor al 62 % del ancho.
function squircle(t = 512, n = 5) {
  const pts = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    pts.push(`${r2(t / 2 + (t / 2) * Math.sign(c) * Math.abs(c) ** (2 / n))} ${r2(t / 2 + (t / 2) * Math.sign(s) * Math.abs(s) ** (2 / n))}`);
  }
  return `M${pts.join("L")}Z`;
}
const ICONOS = { azul: ["#014CFD", "#FFFFFF"], blanco: ["#FFFFFF", "#014CFD"], tinta: ["#151517", "#FFFFFF"] };
function icono(fondo, tinta) {
  const t = 512, wC = 0.66 * t, s = wC / cC.w, hC = cC.h * s;
  const dx = (t - wC) / 2 - cC.x * s - 0.02 * t, dy = (t - hC) / 2 - cC.y * s + 0.01 * t;   // centro óptico
  const borde = fondo === "#FFFFFF" ? `<path d="${squircle(t)}" fill="none" stroke="#151517" stroke-opacity=".08" stroke-width="2"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" role="img" aria-label="condor.ai"><path d="${squircle(t)}" fill="${fondo}"/>${borde}<g fill="${tinta}">${usar(condor, s, dx, dy)}</g></svg>\n`;
}

// ── Archivos ───────────────────────────────────────────────────────────────
const svg = (p) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.vb.join(" ")}" fill="currentColor" role="img" aria-label="condor.ai">${p.cuerpo}</svg>\n`;
const piezas = { "condor-isotipo": ISO, "condor-wordmark": WORD, "condor-logo-horizontal": H, "condor-logo-vertical": Vt };
let n = 0;
for (const [nombre, p] of Object.entries(piezas)) {
  const base = svg(p);
  fs.writeFileSync(path.join(salida, `${nombre}.svg`), base); n++;
  for (const [t, hex] of Object.entries(TINTAS)) { fs.writeFileSync(path.join(salida, `${nombre}-${t}.svg`), base.replace('fill="currentColor"', `fill="${hex}"`)); n++; }
}
for (const [nombre, [fondo, tinta]] of Object.entries(ICONOS)) { fs.writeFileSync(path.join(salida, `icono-${nombre}.svg`), icono(fondo, tinta)); n++; }
// íconos de producto (P4): el oficial es el estilo blanco (elegido 9-oct); los otros quedan como variantes
for (const id of Object.keys(PRODUCTOS)) {
  fs.writeFileSync(path.join(salida, `producto-${id}.svg`), svgIcono(id, "blanco", `p-${id}`) + "\n"); n++;
  for (const e of ESTILOS) { fs.writeFileSync(path.join(salida, `producto-${id}-${e}.svg`), svgIcono(id, e, `p-${id}-${e}`) + "\n"); n++; }
}

const datos = {
  tintas: TINTAS,
  iso: { vb: ISO.vb, d: condor, piezas: piezasCondor(VARIANTES.oficial) },   // piezas = [ala, cuerpo]
  word: { vb: WORD.vb, letras: W.letras.map(({ ch, d, e, p }) => ({ ch, d, e, p })), V: W.V },
  lockupH: { vb: H.vb, cuerpo: H.cuerpo, isoAncho: H.isoAncho, sep: H.sep, anim: H.anim },
  lockupV: { vb: Vt.vb, cuerpo: Vt.cuerpo },
  medidas: { altoX: XH, lineaBase: BL },
  productos: Object.fromEntries(Object.entries(PRODUCTOS).map(([id, p]) => [id, { nombre: p.nombre, que: p.que, color: p.color }])),
};
fs.writeFileSync(path.join(raiz, "assets/marca-datos.js"), `// Generado por herramientas/generar-marca.mjs — no editar a mano.\nwindow.CONDOR_MARCA = ${JSON.stringify(datos)};\n`);
console.log(`${n} SVG · horizontal ${H.vb[2]}×${H.vb[3]} · vertical ${Vt.vb[2]}×${Vt.vb[3]}`);
