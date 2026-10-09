/**
 * Íconos de producto · condor ecommerce, track y agents (puerta P4, v2).
 *
 * Sistema del ícono de condor sites (el favorito del equipo):
 *   1. baldosa squircle (la misma del ícono de app) en el color del producto;
 *   2. dos láminas de acrílico en abanico, esquina izquierda redondeada, filo de
 *      luz arriba; se oscurecen hacia abajo a la izquierda;
 *   3. resplandor blanco al centro;
 *   4. una ESCENA blanca que cuenta qué hace el producto.
 * Hilo de la familia: el cursor de sites aparece haciendo el trabajo
 * (clic en la bolsa, arrastra la tarjeta del cliente). En agents no hay cursor:
 * ahí trabaja la IA (burbuja que responde + destello).
 * Colores saturados, sin oscuros embarrados: los fondos profundos son índigo,
 * azul océano o carmesí, nunca café ni oliva. Lienzo de 512.
 */
const r2 = (n) => Math.round(n * 100) / 100;

export const PRODUCTOS = {
  ecommerce: {
    nombre: "ecommerce", que: "Tu tienda online, administrada",
    color: "#7A3CFF",
    baldosa: ["#A780FF", "#6A2CF0"], lamina1: ["#4E22D6", "#2A0F8C"], lamina2: ["#FF5DB0", "#3A0E9C"],
    brillo: "#F1E8FF", contorno: "#26105E", detalle: "#7A3CFF",
  },
  track: {
    nombre: "track", que: "Un CRM a la medida de tu negocio",
    color: "#0A8FE0",
    baldosa: ["#3ADCEB", "#0A86D6"], lamina1: ["#0B63C8", "#073A85"], lamina2: ["#2FE3A6", "#0A3F86"],
    brillo: "#E4FBFF", contorno: "#06295C", detalle: "#0A86D6", acento: "#14C98C",
  },
  agents: {
    nombre: "agents", que: "Agentes de IA que atienden y venden",
    color: "#FF5A1F",
    baldosa: ["#FFB25C", "#FF6A1A"], lamina1: ["#FF4A1F", "#C01A14"], lamina2: ["#FF3D8B", "#86103C"],
    brillo: "#FFF2E2", contorno: "#5E1209", detalle: ["#FF6A1A", "#FF4A5E", "#FF3D8B"],
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

// ── Piezas de las escenas ─────────────────────────────────────────────────
/** Cursor clásico (como el de sites), punta en (x, y). */
const CURSOR = "M0 0L0 104L25 80L42 117L61 109L44 72L80 72Z";
function cursor(x, y, s, ids, P, clic = false) {
  const rayos = clic
    ? `<g stroke="${P.contorno}" stroke-width="${7 / s}" stroke-linecap="round"><path d="M-10 -16L-18 -36"/><path d="M-17 -9L-37 -16"/><path d="M-19 1L-38 4"/></g>`
    : "";
  return `<g transform="translate(${x} ${y}) scale(${s})">${rayos}<path d="${CURSOR}" fill="url(#${ids}-blanco)" stroke="${P.contorno}" stroke-width="${7 / s}" stroke-linejoin="round"/></g>`;
}
/** Pieza blanca con volumen: relleno degradado, contorno fino oscuro. */
const blanca = (d, ids, P, extra = "") => `<path d="${d}" fill="url(#${ids}-blanco)" stroke="${P.contorno}" stroke-width="7" stroke-linejoin="round"${extra}/>`;
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const estrella = (cx, cy, r) => `M${cx} ${cy - r}C${cx + r * 0.12} ${cy - r * 0.12} ${cx + r * 0.12} ${cy - r * 0.12} ${cx + r} ${cy}C${cx + r * 0.12} ${cy + r * 0.12} ${cx + r * 0.12} ${cy + r * 0.12} ${cx} ${cy + r}C${cx - r * 0.12} ${cy + r * 0.12} ${cx - r * 0.12} ${cy + r * 0.12} ${cx - r} ${cy}C${cx - r * 0.12} ${cy - r * 0.12} ${cx - r * 0.12} ${cy - r * 0.12} ${cx} ${cy - r}Z`;

const ESCENAS = {
  // Bolsa tipo Shopify (frente + fuelle) y el cursor haciendo clic.
  ecommerce: (ids, P) => `<g transform="translate(2 -24)">
    <path d="M200 248V220a40 40 0 0 1 80 0V248" fill="none" stroke="${P.contorno}" stroke-width="27" stroke-linecap="round"/>
    <path d="M200 248V220a40 40 0 0 1 80 0V248" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
    <path d="M326 242L358 258L366 398Q367 414 352 418L320 418Z" fill="#C9CFE3" stroke="${P.contorno}" stroke-width="7" stroke-linejoin="round"/>
    ${blanca("M156 242H326L338 398Q339 418 319 418H164Q144 418 145 398Z", ids, P)}
    <path d="M200 300Q226 326 252 300" fill="none" stroke="${P.detalle}" stroke-width="12" stroke-linecap="round"/>
    ${cursor(312, 360, 0.98, ids, P, true)}
  </g>`,
  // Tarjeta de cliente sobre otra (el embudo) y el cursor arrastrándola.
  track: (ids, P) => `<g transform="translate(-4 -6)">
    <path d="${rr(206, 170, 176, 116, 26)}" fill="#fff" fill-opacity=".5" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
    ${blanca(rr(142, 214, 212, 140, 28), ids, P)}
    <circle cx="194" cy="266" r="27" fill="${P.detalle}"/>
    <circle cx="194" cy="258" r="9.5" fill="#fff"/><path d="M176 285a18 15 0 0 1 36 0Z" fill="#fff"/>
    <rect x="234" y="248" width="94" height="14" rx="7" fill="#C6CEDF"/>
    <rect x="234" y="272" width="62" height="14" rx="7" fill="#DCE2EE"/>
    <rect x="164" y="314" width="78" height="24" rx="12" fill="${P.acento}"/>
    ${cursor(318, 322, 0.92, ids, P)}
  </g>`,
  // La IA responde: burbuja con "escribiendo…", el mensaje del cliente detrás y un destello.
  agents: (ids, P) => `<g transform="translate(0 4)">
    <path d="${rr(232, 150, 150, 92, 40)}" fill="#fff" fill-opacity=".5" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
    ${blanca("M190 212H304A56 56 0 0 1 360 268V306A56 56 0 0 1 304 362H214L168 396V354A56 56 0 0 1 134 306V268A56 56 0 0 1 190 212Z", ids, P)}
    ${P.detalle.map((c, i) => `<circle cx="${207 + i * 40}" cy="287" r="14" fill="${c}"/>`).join("")}
    <path d="${estrella(156, 196, 34)}" fill="#fff" stroke="${P.contorno}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${estrella(118, 150, 15)}" fill="#fff" opacity=".9"/>
  </g>`,
};

/** Ícono completo (contenido interno de un <svg viewBox="0 0 512 512">). `p` = prefijo de ids. */
export function icono(id, p = id) {
  const P = PRODUCTOS[id], T = 512;
  const g = (nom, [a, b], [x1, y1, x2, y2] = [0, 0, 0, T]) => `<linearGradient id="${p}-${nom}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const defs = `<defs>` +
    g("baldosa", P.baldosa) + g("l1", P.lamina1, [40, 160, 512, 260]) + g("l2", P.lamina2, [500, 300, 90, 520]) +
    `<linearGradient id="${p}-blanco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6EAF4"/></linearGradient>` +
    `<radialGradient id="${p}-brillo" cx="0.47" cy="0.5" r="0.38"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".2" stop-color="${P.brillo}" stop-opacity=".75"/><stop offset=".6" stop-color="${P.brillo}" stop-opacity=".18"/><stop offset="1" stop-color="${P.brillo}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${p}-filo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".08" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${p}-velo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${p}-clip"><path d="${squircle(T)}"/></clipPath>` +
    `<filter id="${p}-sombra" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="${P.contorno}" flood-opacity=".45"/></filter>` +
    `</defs>`;
  const lamina = (y, giro, grad, cls) =>
    `<g class="${cls}" transform="rotate(${giro} 256 256)"><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-${grad})"/><rect x="34" y="${y}" width="620" height="700" rx="86" fill="url(#${p}-filo)"/></g>`;
  return defs +
    `<g clip-path="url(#${p}-clip)">` +
    `<rect width="${T}" height="${T}" fill="url(#${p}-baldosa)"/>` +
    lamina(104, 4, "l1", "lam lam1") +
    lamina(292, -7, "l2", "lam lam2") +
    `<rect class="brillo" width="${T}" height="${T}" fill="url(#${p}-brillo)"/>` +
    `<rect width="${T}" height="${T}" fill="url(#${p}-velo)"/>` +
    `</g>` +
    `<path d="${squircle(T)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>` +
    `<g class="escena" filter="url(#${p}-sombra)">${ESCENAS[id](p, P)}</g>`;
}

export function svgIcono(id, p = id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="condor ${PRODUCTOS[id].nombre}">${icono(id, p)}</svg>`;
}
