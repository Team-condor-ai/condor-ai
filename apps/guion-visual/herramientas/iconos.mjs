/**
 * Íconos de producto · condor ecommerce, track y agents (puerta P4, v3).
 *
 * Fondo (aprobado): baldosa squircle en
 * el color del producto, dos láminas de acrílico en abanico y un resplandor.
 *
 * Glifo: ya no se dibuja a mano. Sale de Phosphor Icons (MIT), que tiene
 * proporciones y trazo resueltos por diseñadores:
 *   ecommerce · handbag (silueta tipo Shopify) + insignia cursor
 *   track     · address-book (la libreta de clientes de un CRM)
 *   agents    · chat-circle-dots + insignia sparkle (la IA)
 * La insignia se recorta del glifo principal con un margen limpio (máscara),
 * sin contornos.
 *
 * Tres estilos de glifo para comparar: "blanco" (sólido, como Apple),
 * "vidrio" (acrílico: el fondo desenfocado a través del glifo, con canto de luz)
 * y "duotono" (blanco con su segunda capa translúcida).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r2 = (n) => Math.round(n * 100) / 100;

export const PRODUCTOS = {
  ecommerce: {
    nombre: "ecommerce", que: "Tu tienda online, administrada",
    color: "#7A3CFF",
    baldosa: ["#A780FF", "#6A2CF0"], lamina1: ["#4E22D6", "#2A0F8C"], lamina2: ["#FF5DB0", "#3A0E9C"],
    brillo: "#F1E8FF", profundo: "#26105E",
    glifo: "handbag", insignia: { nombre: "cursor", x: 132, y: 128, s: 0.56 },
  },
  track: {
    nombre: "track", que: "Un CRM a la medida de tu negocio",
    color: "#0A8FE0",
    baldosa: ["#3ADCEB", "#0A86D6"], lamina1: ["#0B63C8", "#073A85"], lamina2: ["#2FE3A6", "#0A3F86"],
    brillo: "#E4FBFF", profundo: "#06295C",
    glifo: "address-book",
  },
  agents: {
    nombre: "agents", que: "Agentes de IA que atienden y venden",
    color: "#FF5A1F",
    baldosa: ["#FFB25C", "#FF6A1A"], lamina1: ["#FF4A1F", "#C01A14"], lamina2: ["#FF3D8B", "#86103C"],
    brillo: "#FFF2E2", profundo: "#5E1209",
    glifo: "chat-circle-dots", insignia: { nombre: "sparkle", x: 146, y: -26, s: 0.52 },
  },
};
export const ESTILOS = ["blanco", "vidrio", "duotono"];

/** Contenido de un glifo de Phosphor (viewBox 256). */
function glifo(nombre, peso = "fill") {
  const f = path.join(raiz, "node_modules/@phosphor-icons/core/assets", peso, `${nombre}-${peso}.svg`);
  return fs.readFileSync(f, "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}
/** Solo la silueta (para máscaras y recortes): sin las capas translúcidas del duotono. */
const silueta = (nombre) => glifo(nombre, "fill");

/** Squircle continuo (superelipse n = 5), igual al del ícono de app. */
export function squircle(t = 512, n = 5) {
  const pts = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    pts.push(`${r2(t / 2 + (t / 2) * Math.sign(c) * Math.abs(c) ** (2 / n))} ${r2(t / 2 + (t / 2) * Math.sign(s) * Math.abs(s) ** (2 / n))}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Ícono completo (contenido interno de un <svg viewBox="0 0 512 512">). */
export function icono(id, estilo = "blanco", p = `${id}-${estilo}`) {
  const P = PRODUCTOS[id], T = 512;
  const g = (nom, [a, b], [x1, y1, x2, y2] = [0, 0, 0, T]) => `<linearGradient id="${p}-${nom}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const lamina = (y, giro, grad) =>
    `<g transform="rotate(${giro} 256 256)"><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-${grad})"/><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-filo)"/></g>`;
  // el fondo se define una vez y se usa dos veces (a la vista y, desenfocado, dentro del vidrio)
  const fondo = `<g id="${p}-fondo"><rect width="${T}" height="${T}" fill="url(#${p}-baldosa)"/>${lamina(104, 4, "l1")}${lamina(292, -7, "l2")}<rect width="${T}" height="${T}" fill="url(#${p}-brillo)"/></g>`;

  // glifo en su espacio de 256, ubicado al centro de la baldosa
  const tam = 248, G = `translate(${(T - tam) / 2} ${(T - tam) / 2 + 6}) scale(${r2(tam / 256)})`;
  const I = P.insignia;
  const enInsignia = (contenido) => (I ? `<g transform="translate(${I.x} ${I.y}) scale(${I.s})">${contenido}</g>` : "");
  // máscara: el glifo principal pierde un margen alrededor de la insignia
  const mascara = I
    ? `<mask id="${p}-recorte" maskUnits="userSpaceOnUse" x="-80" y="-80" width="420" height="420"><rect x="-80" y="-80" width="420" height="420" fill="#fff"/>${enInsignia(`<g fill="#000" stroke="#000" stroke-width="${r2(26 / I.s)}" stroke-linejoin="round">${silueta(I.nombre).replace(/opacity="[^"]*"/g, "")}</g>`)}</mask>`
    : "";
  const conRecorte = (contenido) => (I ? `<g mask="url(#${p}-recorte)">${contenido}</g>` : contenido);

  let pieza = "";
  if (estilo === "blanco") {
    const b = (n) => `<g fill="url(#${p}-blanco)">${silueta(n)}</g>`;
    pieza = I ? conRecorte(b(P.glifo)) + enInsignia(b(I.nombre)) : b(P.glifo);
  } else if (estilo === "duotono") {
    const d = (n) => `<g fill="#fff">${glifo(n, "duotone").replace(/opacity="0\.2"/g, 'opacity="0.42"')}</g>`;
    pieza = I ? conRecorte(d(P.glifo)) + enInsignia(d(I.nombre)) : d(P.glifo);
  } else {
    // vidrio: el fondo desenfocado visto a través del glifo, un velo claro y un canto de luz
    const clip = (n, k) => `<clipPath id="${p}-c${k}">${silueta(n)}</clipPath>`;
    const vidrio = (n, k, esc = 1) =>
      `<g clip-path="url(#${p}-c${k})">` +
      `<g transform="scale(${r2(1 / esc)})"><use href="#${p}-fondo" transform="${invertir(G, I && k === 1 ? I : null)}" filter="url(#${p}-blur)"/></g>` +
      `<rect x="-60" y="-60" width="400" height="400" fill="#fff" opacity=".42"/>` +
      `<rect x="-60" y="-60" width="400" height="400" fill="url(#${p}-reflejo)"/>` +
      `</g>` +
      `<g fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="${r2(5 / esc)}">${silueta(n).replace(/<path /g, `<path clip-path="url(#${p}-c${k})" `)}</g>`;
    pieza = (I ? `<defs>${clip(P.glifo, 0)}${clip(I.nombre, 1)}</defs>` : `<defs>${clip(P.glifo, 0)}</defs>`) +
      conRecorte(vidrio(P.glifo, 0)) + (I ? enInsignia(vidrio(I.nombre, 1, I.s)) : "");
  }

  const defs = `<defs>` +
    g("baldosa", P.baldosa) + g("l1", P.lamina1, [40, 160, 512, 260]) + g("l2", P.lamina2, [500, 300, 90, 520]) +
    `<radialGradient id="${p}-brillo" cx="0.47" cy="0.5" r="0.38"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".2" stop-color="${P.brillo}" stop-opacity=".75"/><stop offset=".6" stop-color="${P.brillo}" stop-opacity=".18"/><stop offset="1" stop-color="${P.brillo}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${p}-filo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".08" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${p}-velo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${p}-blanco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EDEFF7"/></linearGradient>` +
    `<linearGradient id="${p}-reflejo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<filter id="${p}-sombra" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${P.profundo}" flood-opacity=".42"/></filter>` +
    `<clipPath id="${p}-clip"><path d="${squircle(T)}"/></clipPath>` +
    fondo + mascara +
    `</defs>`;
  return defs +
    `<g clip-path="url(#${p}-clip)"><use href="#${p}-fondo"/><rect width="${T}" height="${T}" fill="url(#${p}-velo)"/></g>` +
    `<path d="${squircle(T)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>` +
    `<g class="glifo" filter="url(#${p}-sombra)" transform="${G}">${pieza}</g>`;
}

/** Transformación inversa: lleva el fondo (espacio de la baldosa) al espacio del glifo. */
function invertir(G, I) {
  const m = G.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
  const tx = +m[1], ty = +m[2], s = +m[3];
  // espacio del glifo = (baldosa - t) / s ; si hay insignia: además - (I.x, I.y) y / I.s (la escala la compensa el padre)
  let t = `scale(${r2(1 / s)}) translate(${-tx} ${-ty})`;
  if (I) t = `translate(${-I.x} ${-I.y}) ` + t;
  return t;
}

export function svgIcono(id, estilo = "blanco", p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="condor ${PRODUCTOS[id].nombre}">${icono(id, estilo, p)}</svg>`;
}
