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
  if (cierre > 0) {
    img = await sharp(img).blur(s(cierre)).threshold(245).png().toBuffer();
    img = await sharp(img).blur(s(cierre)).threshold(10).png().toBuffer();
  }
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

// ── Isotipo: el cóndor de siempre, refinado ────────────────────────────────
// Base: el redibujo fiel del logo original (30 vértices, grilla 275×248).
// Se trabaja ×4 para tener precisión en los redondeos.
const ISO_ORIGINAL =
  "M0 0L160 95L183 133L201 130L207 132.5L209 129L196 118L243 117C254 117.6 262 124 268 130.5C272 135 274.6 140 275 145L274.4 149.2L266 145L250 145.6L110 248L117.6 222.4L90 241C83 246 76 248 69 248L32 247L121.5 182.2L104 170L38.5 129.5L109 136.8L38.8 109.8L11 64.5L106.6 104.4L23 49.7L16.8 38.8Z";
// La franja de luz del original, convertida en un corte que separa ala y cuerpo.
const CORTE_ORIGINAL = "M178 120C188 152 181 189 150 222";
const K = 4;
function puntos(d) {
  const t = d.match(/[MLCZ]|-?(?:\d+\.?\d*|\.\d+)/g);
  const pts = [];
  let i = 0, c = "", cur = [0, 0];
  const n = () => +t[i++] * K;
  while (i < t.length) {
    if (/[MLCZ]/.test(t[i])) { c = t[i++]; continue; }
    if (c === "M" || c === "L") { cur = [n(), n()]; pts.push(cur); }
    else if (c === "C") {
      const a = [n(), n()], b = [n(), n()], e = [n(), n()];
      for (let k = 1; k <= 8; k++) {
        const u = k / 8, v = 1 - u;
        pts.push([v * v * v * cur[0] + 3 * v * v * u * a[0] + 3 * v * u * u * b[0] + u * u * u * e[0], v * v * v * cur[1] + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u * u * u * e[1]]);
      }
      cur = e;
    } else i++;
  }
  return pts;
}
/** Redondea cada vértice con un radio "rad" (limitado por el largo de sus lados). */
function redondear(pts, rad) {
  const L = pts.length;
  let d = "";
  for (let k = 0; k < L; k++) {
    const p = pts[(k - 1 + L) % L], v = pts[k], q = pts[(k + 1) % L];
    const lp = Math.hypot(p[0] - v[0], p[1] - v[1]), lq = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const r = Math.min(rad, lp / 2, lq / 2);
    const a = [v[0] + ((p[0] - v[0]) / lp) * r, v[1] + ((p[1] - v[1]) / lp) * r];
    const b = [v[0] + ((q[0] - v[0]) / lq) * r, v[1] + ((q[1] - v[1]) / lq) * r];
    d += (k === 0 ? "M" : "L") + r1(a[0]) + " " + r1(a[1]) + "Q" + r1(v[0]) + " " + r1(v[1]) + " " + r1(b[0]) + " " + r1(b[1]);
  }
  return d + "Z";
}
const ISO_PULIDO = redondear(puntos(ISO_ORIGINAL), 9);
const corteK = CORTE_ORIGINAL.replace(/-?\d+(\.\d+)?/g, (m) => String(+m * K));
const OJO = { x: 254 * K, y: 129.5 * K, r: 4.4 * K };

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

// ── Wordmark: letras construidas, sin tipografía ───────────────────────────
// Alto de x = 100, trazo = 22, círculos de radio 50 (interior 28). Ascendente
// a 46 sobre la x. El corte de la "c" y el remate de la "d" siguen el ángulo
// del ala del cóndor (30,7°). Los puntos son nodos de radio 13.
const XH = 100, TR = 22, RE = 50, RI = 28, RC = 39, ASC = 46, BASE = ASC + XH, RN = 13;
const ALA = 30.7;
const xh = XH;
const rad = (a) => (a * Math.PI) / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
const P = ([x, y]) => `${r1(x)} ${r1(y)}`;
const circ = (cx, cy, r, horario = true) =>
  `M${r1(cx - r)} ${r1(cy)}A${r} ${r} 0 1 ${horario ? 1 : 0} ${r1(cx + r)} ${r1(cy)}A${r} ${r} 0 1 ${horario ? 1 : 0} ${r1(cx - r)} ${r1(cy)}Z`;
const anillo = (cx, cy) => circ(cx, cy, RE, true) + circ(cx, cy, RI, false);
const sector = (cx, cy, a0, a1) => {
  const g = a1 - a0 > 180 ? 1 : 0;
  return `M${P(pol(cx, cy, RE, a0))}A${RE} ${RE} 0 ${g} 1 ${P(pol(cx, cy, RE, a1))}L${P(pol(cx, cy, RI, a1))}A${RI} ${RI} 0 ${g} 0 ${P(pol(cx, cy, RI, a0))}Z`;
};
const rect = (x, y, w, h) => `M${r1(x)} ${r1(y)}H${r1(x + w)}V${r1(y + h)}H${r1(x)}Z`;
const CY = ASC + XH / 2;
const caida = TR * Math.tan(rad(ALA));
// cada letra: forma rellena (d) + líneas centrales (t) para dibujarla en vivo
const LETRAS = {
  c: (x) => ({ w: RE + RE * Math.cos(rad(ALA)), d: sector(x + RE, CY, ALA, 360 - ALA),
    t: [`M${P(pol(x + RE, CY, RC, ALA))}A${RC} ${RC} 0 1 1 ${P(pol(x + RE, CY, RC, 360 - ALA))}`] }),
  o: (x) => ({ w: 2 * RE, d: anillo(x + RE, CY), t: [circ(x + RE, CY, RC)] }),
  n: (x) => ({ w: 2 * RE, d: rect(x, ASC, TR, XH) + sector(x + RE, CY, 180, 360) + rect(x + 2 * RE - TR, CY, TR, XH / 2),
    t: [`M${r1(x + TR / 2)} ${BASE}V${CY}A${RC} ${RC} 0 0 1 ${r1(x + 2 * RE - TR / 2)} ${CY}V${BASE}`] }),
  d: (x) => ({ w: 2 * RE, d: anillo(x + RE, CY) + `M${r1(x + 2 * RE - TR)} 0L${r1(x + 2 * RE)} ${r1(caida)}V${BASE}H${r1(x + 2 * RE - TR)}Z`,
    t: [circ(x + RE, CY, RC), `M${r1(x + 2 * RE - TR / 2)} ${r1(caida / 2)}V${BASE}`] }),
  r: (x) => ({ w: RE + RE * Math.cos(rad(300)), d: rect(x, ASC, TR, XH) + sector(x + RE, CY, 180, 300),
    t: [`M${r1(x + TR / 2)} ${BASE}V${CY}A${RC} ${RC} 0 0 1 ${P(pol(x + RE, CY, RC, 300))}`] }),
  ".": (x) => ({ w: 2 * RN, d: circ(x + RN, BASE - RN, RN), t: [], n: [x + RN, BASE - RN] }),
  a: (x) => ({ w: 2 * RE, d: anillo(x + RE, CY) + rect(x + 2 * RE - TR, ASC, TR, XH),
    t: [circ(x + RE, CY, RC), `M${r1(x + 2 * RE - TR / 2)} ${ASC}V${BASE}`] }),
  i: (x) => ({ w: TR, d: rect(x, ASC, TR, XH) + circ(x + TR / 2, ASC - 28, RN), t: [`M${r1(x + TR / 2)} ${BASE}V${ASC}`], n: [x + TR / 2, ASC - 28] }),
};
// aire óptico entre pares de letras
const AIRE = { co: 12, on: 12, nd: 14, do: 12, or: 14, "r.": 8, ".a": 10, ai: 16 };
function wordmark() {
  const txt = "condor.ai";
  let x = 0, d = "";
  const trazos = [], nodos = [];
  for (let k = 0; k < txt.length; k++) {
    const L = LETRAS[txt[k]](x);
    d += L.d;
    trazos.push(...L.t.map((t) => ({ d: t, letra: k })));
    if (L.n) nodos.push({ x: r1(L.n[0]), y: r1(L.n[1]), letra: k });
    x += L.w + (k < txt.length - 1 ? AIRE[txt[k] + txt[k + 1]] : 0);
  }
  return { d, w: r1(x), h: BASE, trazos, nodos, grosor: TR };
}

// ── Armado ─────────────────────────────────────────────────────────────────
const svg = (vb, cuerpo, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor"${extra}>${cuerpo}</svg>\n`;
const ARIA = ' role="img" aria-label="condor.ai"';

// Tres propuestas del isotipo sobre la misma silueta
const IW = 275 * K, IH = 248 * K;
const capa = `<path stroke="none" d="${ISO_PULIDO}"/>`;
const tajo = `<path fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" d="${corteK}"/>`;
const ojo = `<circle cx="${OJO.x}" cy="${OJO.y}" r="${OJO.r}" fill="#fff" stroke="none"/>`;
const variantes = {
  pulido: await forjar(capa, { w: IW, h: IH, escala: 1.5, cierre: 0, suave: 0.8 }),
  corte: await forjar(capa + tajo, { w: IW, h: IH, escala: 1.5, cierre: 0, suave: 1.6 }),
  ojo: await forjar(capa + tajo + ojo, { w: IW, h: IH, escala: 1.5, cierre: 0, suave: 1.2 }),
};
const isos = {};
for (const [k, d] of Object.entries(variantes)) isos[k] = await normalizar(d, IW, IH);
const iso = isos.corte; // propuesta principal
const W = wordmark();
const word = { d: W.d, w: W.w, h: W.h };

// Lockup horizontal: alto del isotipo = 1,25 × alto de la "d" del wordmark,
// separación = alto de x. El cóndor se centra ópticamente en el x-height.
function lockupH() {
  const H = word.h * 1.34;
  const s = H / iso.h;
  const isoW = iso.w * s;
  const gap = xh * 0.85;
  const top = 0;
  const wy = H - word.h; // base del wordmark = base del cóndor
  return {
    vb: `0 ${top} ${r1(isoW + gap + word.w)} ${r1(H)}`,
    cuerpo: `<path fill-rule="evenodd" transform="scale(${s.toFixed(4)})" d="${iso.d}"/><path transform="translate(${r1(isoW + gap)} ${r1(wy)})" d="${word.d}"/>`,
  };
}
function lockupV() {
  const isoW = word.w * 0.5;
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
base["condor-isotipo-pulido"] = svg(`0 0 ${isos.pulido.w} ${isos.pulido.h}`, `<path fill-rule="evenodd" d="${isos.pulido.d}"/>`, ARIA);
base["condor-isotipo-ojo"] = svg(`0 0 ${isos.ojo.w} ${isos.ojo.h}`, `<path fill-rule="evenodd" d="${isos.ojo.d}"/>`, ARIA);
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
  iso: { d: iso.d, w: iso.w, h: iso.h },
  isos: Object.fromEntries(Object.entries(isos).map(([k, v]) => [k, { d: v.d, w: v.w, h: v.h }])),
  word: { d: word.d, w: word.w, h: word.h, trazos: W.trazos, nodos: W.nodos, grosor: W.grosor },
  lockupH: LH,
  lockupV: LV,
  productos,
};
fs.writeFileSync(
  path.join(raiz, "assets/marca-datos.js"),
  `// Generado por herramientas/generar-marca.mjs — no editar a mano.\nwindow.CONDOR_MARCA = ${JSON.stringify(datos)};\n`,
);
console.log(`${n} SVG · isotipo ${iso.w}×${iso.h} · wordmark ${word.w}×${word.h} · x-height ${r1(xh)}`);
