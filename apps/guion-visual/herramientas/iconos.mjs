/**
 * Íconos de producto · condor ecommerce, track y agents (puerta P4).
 *
 * Mismo sistema que el ícono de condor sites (el que más gusta al equipo):
 *   1. baldosa squircle (la misma del ícono de app) con el color del producto,
 *      más claro arriba;
 *   2. dos láminas de acrílico apiladas en abanico, con la esquina izquierda
 *      redondeada y un filo de luz arriba (el canto): una en el tono profundo
 *      del producto y otra en su acento, que se oscurece hacia abajo;
 *   3. un resplandor al centro;
 *   4. un pictograma de interfaz, blanco, con contorno oscuro fino y sombra,
 *      como el cursor de sites.
 * Lienzo de 512.
 */
const r2 = (n) => Math.round(n * 100) / 100;

export const PRODUCTOS = {
  ecommerce: {
    nombre: "ecommerce", que: "Tu tienda online, administrada",
    color: "#6A3BF5",
    baldosa: ["#9B7BFF", "#5A2BE8"], lamina1: ["#3C17C4", "#24108A"], lamina2: ["#FF4FA0", "#2A0E8F"], brillo: "#E4DCFF",
  },
  track: {
    nombre: "track", que: "Un CRM a la medida de tu negocio",
    color: "#0BA37F",
    baldosa: ["#3FE0B5", "#0A9C79"], lamina1: ["#057A5F", "#034D3D"], lamina2: ["#2E7BFF", "#03473A"], brillo: "#D6FFF3",
  },
  agents: {
    nombre: "agents", que: "Agentes de IA que atienden y venden",
    color: "#FF6A1A",
    baldosa: ["#FFAE5C", "#FF6A10"], lamina1: ["#D24A00", "#8F2E00"], lamina2: ["#FF2E6E", "#8A2400"], brillo: "#FFF0DC",
  },
};

/** Squircle continuo (superelipse n = 5), igual al del ícono de app. */
export function squircle(t = 512, n = 5) {
  const pts = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    pts.push(`${r2(t / 2 + (t / 2) * Math.sign(c) * Math.abs(c) ** (2 / n))} ${r2(t / 2 + (t / 2) * Math.sign(s) * Math.abs(s) ** (2 / n))}`);
  }
  return `M${pts.join("L")}Z`;
}

// Pictogramas: listas de piezas. "f" = relleno, "s" = trazo (grosor w). Todo se
// dibuja dos veces: primero el contorno oscuro (más grueso) y después en blanco.
const PICTOS = {
  ecommerce: [
    { s: "M206 222V188a50 50 0 0 1 100 0v34", w: 22 },                                          // asa
    { f: "M170 214H342L360 388Q362 410 340 410H172Q150 410 152 388Z", w: 14 },                 // cuerpo
    { f: "M218 270a38 38 0 0 0 76 0", w: 0, color: "acento", s2: 12 },                           // sonrisa (en color)
  ],
  track: [
    { f: "M256 146a58 58 0 1 1 0 116a58 58 0 1 1 0-116Z", w: 0 },                               // cabeza
    { f: "M150 398C150 330 196 290 256 290S362 330 362 398Q362 412 348 412H164Q150 412 150 398Z", w: 0 }, // hombros
  ],
  agents: [
    { f: "M196 158H316A54 54 0 0 1 370 212V292A54 54 0 0 1 316 346H232L178 392V340A54 54 0 0 1 142 292V212A54 54 0 0 1 196 158Z", w: 0 }, // burbuja
    { f: "M256 196C262 236 272 246 312 252C272 258 262 268 256 308C250 268 240 258 200 252C240 246 250 236 256 196Z", w: 0, color: "acento" }, // destello
  ],
};

/** Ícono completo (contenido interno de un <svg viewBox="0 0 512 512">). `p` = prefijo de ids. */
export function icono(id, p = id) {
  const P = PRODUCTOS[id], T = 512;
  // degradados en coordenadas de la baldosa (las láminas salen de ella)
  const g = (nom, [a, b], [x1, y1, x2, y2] = [0, 0, 0, T]) => `<linearGradient id="${p}-${nom}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const defs = `<defs>` +
    g("baldosa", P.baldosa) + g("l1", P.lamina1, [40, 160, 512, 260]) + g("l2", P.lamina2, [500, 300, 90, 520]) +
    `<radialGradient id="${p}-brillo" cx="0.45" cy="0.49" r="0.36"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".18" stop-color="${P.brillo}" stop-opacity=".85"/><stop offset=".55" stop-color="${P.brillo}" stop-opacity=".22"/><stop offset="1" stop-color="${P.brillo}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${p}-filo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".08" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${p}-velo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${p}-clip"><path d="${squircle(T)}"/></clipPath>` +
    `<filter id="${p}-sombra" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".32"/></filter>` +
    `</defs>`;
  // láminas: rectángulos que salen por la derecha y por abajo, esquina izquierda redondeada
  const lamina = (y, giro, grad, cls) =>
    `<g class="${cls}" transform="rotate(${giro} 256 256)"><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-${grad})"/><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-filo)"/></g>`;
  const acento = P.lamina2[0];
  const piezas = PICTOS[id];
  const pinta = (pz, oscuro) => {
    const col = oscuro ? P.lamina1[1] : pz.color === "acento" ? acento : "#fff";
    const extra = oscuro ? 9 : 0;
    if (pz.color === "acento" && oscuro) return "";                               // lo que va en color no lleva contorno propio
    if (pz.s) return `<path d="${pz.s}" fill="none" stroke="${col}" stroke-width="${pz.w + extra}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (pz.s2) return `<path d="${pz.f}" fill="none" stroke="${col}" stroke-width="${pz.s2}" stroke-linecap="round"/>`;
    return `<path d="${pz.f}" fill="${col}" stroke="${col}" stroke-width="${pz.w + extra}" stroke-linejoin="round"/>`;
  };
  // el pictograma ocupa ~40 % de la baldosa, como el cursor de sites
  const picto = `<g class="picto" filter="url(#${p}-sombra)" transform="translate(256 262) scale(0.74) translate(-256 -278)"><g opacity=".85">${piezas.map((pz) => pinta(pz, true)).join("")}</g>${piezas.map((pz) => pinta(pz, false)).join("")}</g>`;
  return defs +
    `<g clip-path="url(#${p}-clip)">` +
    `<rect width="${T}" height="${T}" fill="url(#${p}-baldosa)"/>` +
    lamina(104, 4, "l1", "lam lam1") +
    lamina(292, -7, "l2", "lam lam2") +
    `<rect class="brillo" width="${T}" height="${T}" fill="url(#${p}-brillo)"/>` +
    `<rect width="${T}" height="${T}" fill="url(#${p}-velo)"/>` +
    `</g>` +
    `<path d="${squircle(T)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>` +
    picto;
}

export function svgIcono(id, p = id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="condor ${PRODUCTOS[id].nombre}">${icono(id, p)}</svg>`;
}
