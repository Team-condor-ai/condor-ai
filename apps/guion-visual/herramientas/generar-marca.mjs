/**
 * Marca condor.ai · guion visual "Claro"
 *
 *   npm run marca   →  assets/marca/*.svg  +  assets/marca-datos.js
 *
 * Todas las piezas se FORJAN igual que se construye el logo de Medula:
 *   1. un esqueleto de trazos gruesos con remates redondos,
 *   2. un cierre morfológico que funde las uniones con curvas cóncavas suaves,
 *   3. potrace → un solo path limpio, en un color (currentColor).
 *
 * La firma de la familia es el "nodo con collar": un punto redondo separado
 * del cuerpo por un anillo vacío. En el cóndor es la cabeza con su collar
 * blanco; en cada producto es su señal (clic, aviso, siguiente dato…).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import potrace from "potrace";
import opentype from "opentype.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "assets/marca");
fs.rmSync(salida, { recursive: true, force: true });
fs.mkdirSync(salida, { recursive: true });
const r1 = (n) => Math.round(n * 10) / 10;

// ── Forja ──────────────────────────────────────────────────────────────────
async function forjar(esqueleto, { w, h, escala = 4, cierre = 7, suave = 4 }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * escala}" height="${h * escala}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${esqueleto}</g></svg>`;
  let img = await sharp(Buffer.from(svg)).greyscale().png().toBuffer();
  const s = (k) => Math.max(0.3, k * escala * 0.5);
  img = await sharp(img).blur(s(cierre)).threshold(245).png().toBuffer();
  img = await sharp(img).blur(s(cierre)).threshold(10).png().toBuffer();
  img = await sharp(img).blur(s(suave)).threshold(128).blur(1.2).png().toBuffer();
  const d = await new Promise((ok, mal) =>
    potrace.trace(img, { threshold: 128, turdSize: 60, optTolerance: 0.3, alphaMax: 1.15 }, (e, out) =>
      e ? mal(e) : ok(out.match(/ d="([^"]+)"/)[1]),
    ),
  );
  return d.replace(NUM, (m) => " " + r1(+m / escala));
}
const NUM = /-?(?:\d+\.?\d*|\.\d+)/g;
/** Caja exacta del dibujo (renderiza y recorta). */
async function caja(d, w, h) {
  const k = 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><path d="${d}"/></svg>`;
  const { info } = await sharp(Buffer.from(svg)).flatten({ background: "#fff" }).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  return { x: -info.trimOffsetLeft / k, y: -info.trimOffsetTop / k, w: info.width / k, h: info.height / k };
}
/** Mueve el path para que su caja empiece en (pad, pad). */
function mover(d, dx, dy) {
  let i = 0;
  // ojo: opentype escribe ".8" sin cero inicial → el patrón acepta ambos
  return d.replace(NUM, (m) => " " + r1(+m + (i++ % 2 === 0 ? dx : dy)));
}
async function normalizar(d, w, h, pad = 0) {
  const c = await caja(d, w, h);
  return { d: mover(d, pad - c.x, pad - c.y), w: r1(c.w + pad * 2), h: r1(c.h + pad * 2), dx: r1(pad - c.x), dy: r1(pad - c.y) };
}

// ── Isotipo: cóndor planeando, visto desde abajo ───────────────────────────
// Alas anchas, tres plumas dedo curvadas hacia arriba, cabeza con collar.
function condorEsqueleto() {
  const borde = 210, g = 50, curva = 40, cab = 37, collar = 16, cy = 204;
  const dedos = [[700, 200, 800, 112], [716, 228, 850, 170], [714, 256, 846, 238]];
  const lado = (s) => {
    const X = (x) => 500 + s * (x - 500);
    const ala = `<path stroke="none" d="M${X(500)} ${borde} C${X(600)} ${borde - 4} ${X(690)} ${borde - 18} ${X(728)} ${borde - 22} L${X(742)} ${borde + 70} C${X(670)} ${borde + 84} ${X(610)} ${borde + 106} ${X(500)} ${borde + 128} Z"/>`;
    const ds = dedos
      .map(([x1, y1, x2, y2], i) => {
        const qx = (x1 + x2) / 2 + 20, qy = (y1 + y2) / 2 + curva * 0.8;
        return `<path fill="none" stroke-width="${g - i * 3}" d="M${X(x1)} ${y1} Q${X(qx)} ${qy} ${X(x2)} ${y2 - curva * 0.4}"/>`;
      })
      .join("");
    return ala + ds;
  };
  return (
    lado(1) + lado(-1) +
    `<circle cx="500" cy="${cy}" r="${cab + collar}" fill="#fff" stroke="none"/>` +
    `<circle cx="500" cy="${cy}" r="${cab}" stroke="none"/>`
  );
}

// ── Productos (lienzo 240×240, trazo 34, nodo r≈19) ────────────────────────
const collar = (cx, cy, r = 19, gap = 11) =>
  `<circle cx="${cx}" cy="${cy}" r="${r + gap}" fill="#fff" stroke="none"/><circle cx="${cx}" cy="${cy}" r="${r}" stroke="none"/>`;
const PRODUCTOS = {
  sites: {
    nombre: "Sites", que: "Sitios y landings",
    color: "#3A5CFF",
    esq: `<path stroke-width="22" d="M70 56 L70 176 L100 150 L121 194 L146 183 L125 140 L166 138 Z"/>` + collar(176, 64),
  },
  ecommerce: {
    nombre: "Ecommerce", que: "Tiendas que se operan solas",
    color: "#7B5CFF",
    esq: `<path fill="none" stroke-width="18" d="M90 104 V80 a30 30 0 0 1 60 0 V104"/><path stroke-width="22" d="M62 98 H178 L168 196 H72 Z"/>` + collar(184, 98, 18, 11),
  },
  media: {
    nombre: "Media", que: "Video y contenido con IA",
    color: "#FF4F8B",
    esq: `<path stroke-width="44" d="M78 66 L78 178 L166 122 Z"/>` + collar(184, 58, 18, 0),
  },
  track: {
    nombre: "Track", que: "Campañas y datos en vivo",
    color: "#10C2A2",
    esq: `<path fill="none" stroke-width="38" d="M44 180 L92 124 L128 154 L160 116"/>` + collar(194, 74, 20, 0),
  },
  agents: {
    nombre: "Agents", que: "Agentes que atienden y venden",
    color: "#FF8A3D",
    esq: `<circle cx="114" cy="118" r="68" stroke="none"/><path stroke-width="18" d="M64 150 L46 196 L104 178 Z"/>` + collar(180, 62, 19, 11),
  },
  barbara: {
    nombre: "Barbara", que: "Redes en piloto automático",
    color: "#D14BFF",
    esq: `<path stroke-width="14" d="M112 40 C118 98 128 108 184 116 C128 124 118 134 112 192 C106 134 96 124 40 116 C96 108 106 98 112 40 Z"/>` + collar(188, 50, 16, 0),
  },
};

// ── Wordmark ───────────────────────────────────────────────────────────────
const fuenteDe = (archivo) =>
  opentype.parse(fs.readFileSync(path.join(raiz, "node_modules/@fontsource", archivo)).buffer.slice(0));
const F600 = fuenteDe("inter-tight/files/inter-tight-latin-600-normal.woff");
const F500 = fuenteDe("inter-tight/files/inter-tight-latin-500-normal.woff");
const TAM = 200;
function contornos(f, texto, x, tracking) {
  let c = x;
  const ds = [];
  const gl = f.stringToGlyphs(texto);
  gl.forEach((g, i) => {
    ds.push({ d: g.getPath(c, 0, TAM).toPathData(1), ch: texto[i], x: c, adv: (g.advanceWidth / f.unitsPerEm) * TAM });
    const kern = i < gl.length - 1 ? f.getKerningValue(g, gl[i + 1]) : 0;
    c += ((g.advanceWidth + kern) / f.unitsPerEm) * TAM + tracking * TAM;
  });
  return { partes: ds, fin: c };
}
const xh = (F600.tables.os2.sxHeight / F600.unitsPerEm) * TAM;
// Wordmark: "condor" en Inter Tight 600 a −4 %, ".ai" con el punto como nodo
// redondo perfecto (mismo lenguaje del isotipo) y "ai" en 500.
function wordmark() {
  const a = contornos(F600, "condor", 0, -0.04);
  const rp = xh * 0.15;
  const px = a.fin + rp + TAM * 0.035;
  // círculo con cúbicas absolutas (mover() suma a pares x,y: nada de arcos ni relativos)
  const k = rp * 0.5523, cy = -rp;
  const punto =
    `M${r1(px + rp)} ${r1(cy)}C${r1(px + rp)} ${r1(cy + k)} ${r1(px + k)} ${r1(cy + rp)} ${r1(px)} ${r1(cy + rp)}` +
    `C${r1(px - k)} ${r1(cy + rp)} ${r1(px - rp)} ${r1(cy + k)} ${r1(px - rp)} ${r1(cy)}` +
    `C${r1(px - rp)} ${r1(cy - k)} ${r1(px - k)} ${r1(cy - rp)} ${r1(px)} ${r1(cy - rp)}` +
    `C${r1(px + k)} ${r1(cy - rp)} ${r1(px + rp)} ${r1(cy - k)} ${r1(px + rp)} ${r1(cy)}Z`;
  const b = contornos(F500, "ai", px + rp + TAM * 0.035, -0.02);
  // la "i": se reemplaza su punto (el subtrazo más alto) por un nodo circular del mismo tamaño que el "."
  const iParte = b.partes[1];
  const subs = iParte.d.split(/(?=M)/).filter(Boolean);
  const cajaSub = (t) => { const n = t.match(NUM).map(Number); const ys = n.filter((_, k) => k % 2); const xs = n.filter((_, k) => !(k % 2)); return { y0: Math.min(...ys), y1: Math.max(...ys), x0: Math.min(...xs), x1: Math.max(...xs) }; };
  const cajas = subs.map(cajaSub);
  const ti = cajas.reduce((m, c, k) => (c.y0 < cajas[m].y0 ? k : m), 0);
  const tc = cajas[ti];
  const ix = (tc.x0 + tc.x1) / 2, iy = (tc.y0 + tc.y1) / 2;
  const nodo = (cx, cyy, r) => { const kk = r * 0.5523; return `M${r1(cx + r)} ${r1(cyy)}C${r1(cx + r)} ${r1(cyy + kk)} ${r1(cx + kk)} ${r1(cyy + r)} ${r1(cx)} ${r1(cyy + r)}C${r1(cx - kk)} ${r1(cyy + r)} ${r1(cx - r)} ${r1(cyy + kk)} ${r1(cx - r)} ${r1(cyy)}C${r1(cx - r)} ${r1(cyy - kk)} ${r1(cx - kk)} ${r1(cyy - r)} ${r1(cx)} ${r1(cyy - r)}C${r1(cx + kk)} ${r1(cyy - r)} ${r1(cx + r)} ${r1(cyy - kk)} ${r1(cx + r)} ${r1(cyy)}Z`; };
  const iD = subs.filter((_, k) => k !== ti).join("") + nodo(ix, iy, rp);
  const d = a.partes.map((p) => p.d).join("") + punto + b.partes[0].d + iD;
  return { d, ancho: b.fin };
}

// ── Armado ─────────────────────────────────────────────────────────────────
const svg = (vb, cuerpo, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor"${extra}>${cuerpo}</svg>\n`;
const ARIA = ' role="img" aria-label="condor.ai"';

const condorD = await forjar(condorEsqueleto(), { w: 1000, h: 440, cierre: 7, suave: 4 });
const iso = await normalizar(condorD, 1000, 440);
const W = wordmark();
// caja del wordmark: lo trasladamos a coordenadas positivas para medirlo
const wordPos = mover(W.d, 10, TAM);
const wc = await caja(wordPos, W.ancho + 40, TAM * 1.4);
const word = { d: mover(wordPos, -wc.x, -wc.y), w: r1(wc.w), h: r1(wc.h) };

// Lockup horizontal: alto del isotipo = 1,25 × alto de la "d" del wordmark,
// separación = alto de x. El cóndor se centra ópticamente en el x-height.
function lockupH() {
  const H = word.h * 1.2;
  const s = H / iso.h;
  const isoW = iso.w * s;
  const gap = xh * 0.85;
  const top = 0;
  const wy = (H - word.h) / 2 + word.h * 0.06;
  return {
    vb: `0 ${top} ${r1(isoW + gap + word.w)} ${r1(H)}`,
    cuerpo: `<path fill-rule="evenodd" transform="scale(${s.toFixed(4)})" d="${iso.d}"/><path transform="translate(${r1(isoW + gap)} ${r1(wy)})" d="${word.d}"/>`,
  };
}
function lockupV() {
  const isoW = word.w * 0.78;
  const s = isoW / iso.w;
  const isoH = iso.h * s;
  const gap = xh * 0.9;
  return {
    vb: `0 0 ${r1(word.w)} ${r1(isoH + gap + word.h)}`,
    cuerpo: `<path fill-rule="evenodd" transform="translate(${r1((word.w - isoW) / 2)} 0) scale(${s.toFixed(4)})" d="${iso.d}"/><path transform="translate(0 ${r1(isoH + gap)})" d="${word.d}"/>`,
  };
}
const LH = lockupH(), LV = lockupV();

const base = {
  "condor-isotipo": svg(`0 0 ${iso.w} ${iso.h}`, `<path fill-rule="evenodd" d="${iso.d}"/>`, ARIA),
  "condor-wordmark": svg(`0 0 ${word.w} ${word.h}`, `<path d="${word.d}"/>`, ARIA),
  "condor-logo-horizontal": svg(LH.vb, LH.cuerpo, ARIA),
  "condor-logo-vertical": svg(LV.vb, LV.cuerpo, ARIA),
};

const SOLIDOS = { azul: "#3A5CFF", grafito: "#0B0C12", blanco: "#FFFFFF" };
const GRADIENTES = {
  ionosfera: ["#9DB4FF", "#3A5CFF", "#13225F"],
  aurora: ["#FFB3D1", "#C69BFF", "#6F8BFF"],
  hielo: ["#FFFFFF", "#DCE4FF", "#9DB4FF"],
};
function conGradiente(contenido, stops) {
  const vb = contenido.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const def = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${vb[0]}" y1="${vb[1]}" x2="${vb[0] + vb[2]}" y2="${vb[1] + vb[3]}">${stops
    .map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`)
    .join("")}</linearGradient></defs>`;
  return contenido.replace('fill="currentColor"', 'fill="url(#g)"').replace(/(<svg[^>]*>)/, `$1${def}`);
}
let n = 0;
for (const [nombre, contenido] of Object.entries(base)) {
  fs.writeFileSync(path.join(salida, `${nombre}.svg`), contenido); n++;
  for (const [c, hex] of Object.entries(SOLIDOS)) { fs.writeFileSync(path.join(salida, `${nombre}-${c}.svg`), contenido.replace('fill="currentColor"', `fill="${hex}"`)); n++; }
  for (const [c, st] of Object.entries(GRADIENTES)) { fs.writeFileSync(path.join(salida, `${nombre}-${c}.svg`), conGradiente(contenido, st)); n++; }
}

// Productos: marca sola (currentColor) + versión en su color
const productos = {};
for (const [id, p] of Object.entries(PRODUCTOS)) {
  const d0 = await forjar(p.esq, { w: 240, h: 240, escala: 6, cierre: 2.5, suave: 2 });
  const c = await caja(d0, 240, 240);
  // centrado en un cuadro de 240 conservando la escala común de la familia
  const dx = (240 - c.w) / 2 - c.x, dy = (240 - c.h) / 2 - c.y;
  const d = mover(d0, dx, dy);
  productos[id] = { nombre: p.nombre, que: p.que, color: p.color, d };
  const cont = svg("0 0 240 240", `<path fill-rule="evenodd" d="${d}"/>`, ` role="img" aria-label="condor ${p.nombre.toLowerCase()}"`);
  fs.writeFileSync(path.join(salida, `producto-${id}.svg`), cont);
  fs.writeFileSync(path.join(salida, `producto-${id}-color.svg`), cont.replace('fill="currentColor"', `fill="${p.color}"`));
  n += 2;
}

const datos = {
  iso: { d: iso.d, w: iso.w, h: iso.h, dx: iso.dx, dy: iso.dy },
  esqueleto: condorEsqueleto(),
  word: { d: word.d, w: word.w, h: word.h },
  lockupH: LH,
  lockupV: LV,
  productos,
};
fs.writeFileSync(
  path.join(raiz, "assets/marca-datos.js"),
  `// Generado por herramientas/generar-marca.mjs — no editar a mano.\nwindow.CONDOR_MARCA = ${JSON.stringify(datos)};\n`,
);
console.log(`${n} SVG · isotipo ${iso.w}×${iso.h} · wordmark ${word.w}×${word.h} · x-height ${r1(xh)}`);
