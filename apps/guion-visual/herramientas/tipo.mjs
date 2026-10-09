/**
 * "condor.ai" · letras del wordmark (puerta P2c).
 *
 * Base: Inter Display (rsms/inter, licencia SIL OFL 1.1 — permite modificarla y
 * usarla en un logo). Es la alternativa abierta más cercana a SF Pro Display;
 * SF Pro no se puede usar para un logo por su licencia.
 *
 * Los contornos salen de la fuente y se pasan a paths propios: el logo no depende
 * de tener la fuente instalada. Se escalan para que el alto de x mida 100 y la
 * línea base caiga en y = 146 (la misma grilla del cóndor). Encima de eso:
 *   - espaciado propio por pares (aire óptico) y tracking de display,
 *   - un ESQUELETO por letra (líneas centrales de sus trazos, en orden de
 *     escritura) calculado sobre la caja real de cada glifo, para animarlas.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

export const XT = 46, BL = 146, XH = 100;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r2 = (n) => Math.round(n * 100) / 100;

export const PESOS = {
  medium: "InterDisplay-Medium.ttf",
  semibold: "InterDisplay-SemiBold.ttf",
  bold: "InterDisplay-Bold.ttf",
};
const cache = {};
function fuente(peso) {
  if (!cache[peso]) {
    const buf = fs.readFileSync(path.join(raiz, "assets/fuentes/inter-display", PESOS[peso]));
    cache[peso] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return cache[peso];
}

const P = (p) => `${r2(p[0])} ${r2(p[1])}`;
/** Arco de superelipse muestreado (para los esqueletos de las redondas). */
function arcoSE(cx, cy, a, b, t0, t1, n = 2.4, k = 40) {
  const pts = Array.from({ length: k + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / k, c = Math.cos(t), s = Math.sin(t);
    return [cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)];
  });
  return `M${P(pts[0])}` + pts.slice(1).map((p) => `L${P(p)}`).join("");
}

/** Esqueleto de cada letra a partir de su caja (x1,y1,x2,y2) y el grosor del asta V. */
function esqueleto(ch, c, V) {
  const { x1, y1, x2, y2 } = c, h = V / 2;
  const alto = (f) => XT + f * XH;
  switch (ch) {
    case "o": return { e: [arcoSE((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2 - h, (y2 - y1) / 2 - h, -Math.PI / 2, -Math.PI / 2 - 2 * Math.PI)] };
    case "c": return { e: [arcoSE((x1 + x2 + 6) / 2, (y1 + y2) / 2, (x2 - x1 + 6) / 2 - h, (y2 - y1) / 2 - h, -0.6, -(2 * Math.PI - 0.62))] };
    case "n": return { e: [`M${P([x1 + h, BL])}V${XT}`, `M${P([x1 + h, alto(0.42)])}C${P([x1 + h + 4, alto(0.05)])} ${P([x2 - h - 6, alto(0.02)])} ${P([x2 - h, alto(0.4)])}V${BL}`] };
    case "r": return { e: [`M${P([x1 + h, BL])}V${XT}`, `M${P([x1 + h, alto(0.45)])}C${P([x1 + h + 4, alto(0.1)])} ${P([x2 - 12, alto(0.06)])} ${P([x2, alto(0.08)])}`] };
    case "d": {
      const xs = x2 - h, bx2 = x2 - V;
      return { e: [arcoSE((x1 + bx2) / 2 + 2, (XT + BL) / 2, (bx2 - x1) / 2 - h + 4, XH / 2 - h, -0.3, -0.3 - 2 * Math.PI + 0.6), `M${P([xs, y1])}V${BL}`] };
    }
    case "a": {
      const xs = x2 - h, bx2 = x2 - V * 0.6, by1 = alto(0.42);
      return { e: [
        `M${P([x1 + h + 2, alto(0.3)])}C${P([x1 + 8, alto(0.02)])} ${P([xs, alto(0.0)])} ${P([xs, alto(0.36)])}V${BL}`,
        arcoSE((x1 + bx2) / 2, (by1 + y2) / 2, (bx2 - x1) / 2 - h, (y2 - by1) / 2 - h * 0.9, -0.15, -0.15 - 2 * Math.PI),
      ] };
    }
    case "i": { const d = x2 - x1; return { e: [`M${P([(x1 + x2) / 2, XT])}V${BL}`], p: [[(x1 + x2) / 2, y1 + d / 2, d / 2]] }; }
    case ".": return { e: [], p: [[(x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2]] };
    default: return { e: [] };
  }
}

// aire extra por par (en unidades del alto de x), además del kerning de la fuente
const AIRE = { "r.": 2, ".a": 1 };
export const TRACKING = -1.2;   // display: apenas más junto

/** Corre un path en x (comandos absolutos M L C Q H V Z). */
function correr(d, dx) {
  return d.replace(/([MLCQHVZ])([^MLCQHVZ]*)/g, (m, c, args) => {
    if (c === "Z" || c === "V") return m;
    if (c === "H") return `H${r2(+args - dx)}`;
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    return c + n.map((v, i) => r2(i % 2 === 0 ? v - dx : v)).join(" ");
  });
}

export function componer(peso = "semibold", txt = "condor.ai", { tracking = TRACKING } = {}) {
  const f = fuente(peso);
  const s = XH / f.tables.os2.sxHeight;              // escala: alto de x = 100
  const tam = f.unitsPerEm * s;
  const glifos = f.stringToGlyphs(txt);
  const bl = f.charToGlyph("l").getBoundingBox();
  const V = (bl.x2 - bl.x1) * s;                     // grosor del asta (la "l")
  let x = 0;
  const letras = glifos.map((g, k) => {
    const p = g.getPath(x, BL, tam);
    const caja = p.getBoundingBox();
    const ch = txt[k];
    const sk = esqueleto(ch, caja, V);
    const out = { ch, d: p.toPathData(2), e: sk.e, p: sk.p || [], caja };
    x += k < glifos.length - 1 ? (g.advanceWidth + f.getKerningValue(g, glifos[k + 1])) * s + tracking + (AIRE[ch + txt[k + 1]] || 0) : 0;
    return out;
  });
  // el wordmark empieza en el borde izquierdo de la primera letra
  const x0 = letras[0].caja.x1, x1 = letras[letras.length - 1].caja.x2;
  for (const l of letras) {
    l.d = correr(l.d, x0);
    l.e = l.e.map((e) => correr(e, x0));
    l.p = l.p.map(([cx, cy, r]) => [r2(cx - x0), r2(cy), r2(r)]);
  }
  const top = Math.min(...letras.map((l) => l.caja.y1));
  return { letras, w: r2(x1 - x0), top: r2(top), h: BL, V: r2(V) };
}
