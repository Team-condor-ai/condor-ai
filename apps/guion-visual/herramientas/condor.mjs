/**
 * El cóndor de condor.ai, redibujado en vector.
 *
 * Calco: assets/antes/logo-v2.png (grilla de 285 × 248). No se traza el PNG: se
 * leen sus puntos y se reconstruye con intención —rectas y curvas Bézier— y cada
 * esquina se redondea con un arco exacto de radio propio (puntas generosas,
 * fondos de ranura apenas suavizados).
 *
 * Anatomía (se recorre en sentido horario desde la punta de la pluma alta):
 *   ala:    pluma 1 → borde alto → hombro curvo → fondo de la cuña del pecho
 *   cuerpo: línea del pecho → collar → cabeza y pico → borde bajo del cuerpo
 *   cola:   espolón → muesca → base de la cola → pluma baja
 *   plumas: pluma 3 → ranura 2 → pluma 2 → ranura 1 → pluma 1
 *
 * Cada nodo: { p: [x, y], r: radio de la esquina, c: [c1, c2] controles del
 * tramo que LLEGA a este nodo (si es curva) }.
 */

function r1(n) { return Math.round(n * 100) / 100; }

// ── Variantes ──────────────────────────────────────────────────────────────
// A · Fiel: proporciones del original, la cuña del pecho como hueco (la "luz").
const FIEL = [
  { p: [1, 1], r: 3 },                                              // punta pluma 1
  { p: [157, 93], r: 6 },                                           // fin del borde alto
  { p: [175, 140], c: [[167, 104], [175, 121]], r: 0 },             // hombro
  { p: [160, 201], c: [[175, 163], [170, 184]], r: 1.6 },           // fondo de la cuña
  { p: [209, 129], r: 2.5 },                                        // tope del pecho
  { p: [196, 117], r: 2 },                                          // collar
  { p: [241, 117], r: 0 },                                          // nuca
  { p: [254, 120.5], c: [[247, 117], [251, 118]], r: 0 },           // coronilla
  { p: [259, 126], c: [[256.5, 122.5], [257.5, 124.5]], r: 0 },     // ceja (leve quiebre)
  { p: [274, 148], c: [[268, 130], [273.5, 137]], r: 1.4 },         // punta del pico
  { p: [262, 144], r: 1.5 },                                        // mandíbula
  { p: [249, 146], r: 2.5 },                                        // garganta
  { p: [110, 247], r: 1.8 },                                        // espolón
  { p: [119, 221], r: 1.4 },                                        // muesca
  { p: [78, 247], c: [[103, 233], [93, 246]], r: 0 },               // base de la cola
  { p: [33, 247], r: 3 },                                           // punta de la cola
  { p: [123, 181], r: 1.6 },                                        // fondo ranura baja
  { p: [40, 129], r: 3 },                                           // punta pluma 3
  { p: [118, 139], r: 1.4 },                                        // fondo ranura 2
  { p: [38, 108], r: 4 },                                           // talón pluma 2
  { p: [12, 64], r: 3 },                                            // punta pluma 2
  { p: [117, 110], r: 1.4 },                                        // fondo ranura 1
  { p: [22, 48], r: 4 },                                            // talón pluma 1
];

// B · Ritmo: el mismo pájaro con las plumas ordenadas. Las puntas caen sobre un
// arco, los fondos de las ranuras sobre una recta y las ranuras se abren igual.
// Fondos de ranura sobre x = 118; las dos ranuras se abren 14° cada una.
const RITMO = FIEL.map((n) => ({ ...n }));
const tg = (g) => Math.tan((g * Math.PI) / 180);
/** Cambia el nodo que en FIEL está en `en` (se busca por posición, no por índice). */
const fijar = (arr, en, p, extra = {}) => {
  const n = arr.find((x, i) => FIEL[i].p[0] === en[0] && FIEL[i].p[1] === en[1]);
  Object.assign(n, { p }, extra);
};
const S1 = [118, 110], S2 = [118, 140];
fijar(RITMO, [117, 110], S1);
fijar(RITMO, [118, 139], S2);
fijar(RITMO, [123, 181], [120, 180]);
// pluma 1: su borde bajo baja a 32,9° hasta S1 → pluma 2 sube a 18,9°
fijar(RITMO, [12, 64], [10, r1(S1[1] - 108 * tg(18.9))]);
// pluma 2: su borde bajo llega a S2 a 21,8° → pluma 3 a 7,8°
fijar(RITMO, [38, 108], [38, r1(S2[1] - 80 * tg(21.8))]);
fijar(RITMO, [40, 129], [36, r1(S2[1] - 82 * tg(7.8))]);
// cuña del pecho más larga y afilada, como una hoja
fijar(RITMO, [175, 140], [174, 142], { c: [[166, 104], [174, 122]] });
fijar(RITMO, [160, 201], [153, 210], { c: [[174, 168], [166, 192]] });

// C · Sólido: sin hueco en el pecho. Para tamaños chicos (16–24 px) y bordados.
const SOLIDO = [
  ...FIEL.slice(0, 2),
  { p: [196, 117], c: [[176, 103], [190, 110]], r: 2 },             // hombro que llega al collar
  ...FIEL.slice(6),
];

// ── B: formas del hueco del pecho (puerta P1b) ────────────────────────────
// Todas comparten las plumas de RITMO; solo cambia el tramo hombro → pecho → collar.
const alas = RITMO.slice(0, 2);          // punta pluma 1 + fin del borde alto
const cabezaYCola = RITMO.slice(5);      // desde el collar hasta el talón de la pluma 1
const conHueco = (tramo) => [...alas, ...tramo, ...cabezaYCola];

// B2 · Canal: ranura de ancho parejo (≈7) que sigue la curva del ala; arriba se
// abre hacia el cuello. Lee como un ala que pasa por delante del cuerpo.
const CANAL = conHueco([
  { p: [174, 142], c: [[166, 104], [174, 122]], r: 0 },
  { p: [151, 205], c: [[174, 166], [165, 188]], r: 3.4 },       // fondo del canal (lado ala)
  { p: [157.5, 209], r: 3.4 },                                   // fondo del canal (lado cuerpo)
  { p: [181, 146], c: [[171, 193], [181, 170]], r: 0 },
  { p: [209, 129], c: [[181, 134], [196, 129]], r: 2.5 },        // se abre hacia el collar
]);

// B3 · Luz cerrada: el hombro sube hasta el collar y la luz del pecho queda
// adentro, como una hoja cerrada (el brillo del original, en negativo).
const CERRADA = {
  contorno: [...alas, { p: [196, 117], c: [[176, 103], [190, 110]], r: 2 }, ...RITMO.slice(6)],
  huecos: [[
    // una gota: tope redondo bajo el collar, punta hacia la cola
    { p: [175, 150], r: 0 },                                     // lado del ala
    { p: [200, 138], c: [[175, 133], [195, 128]], r: 0 },        // tope en arco
    { p: [157, 205], c: [[202, 146], [170, 186]], r: 0.8 },      // borde del pecho, baja a la punta
    { p: [175, 150], c: [[166, 192], [175, 170]], r: 0 },        // vuelve por la curva del ala
  ].slice(0, 3)],
};

// B4 · Corta: el hueco se cierra a media altura del pecho.
const CORTA = conHueco([
  { p: [176, 138], c: [[166, 104], [176, 121]], r: 0 },
  { p: [171, 176], c: [[176, 152], [175, 165]], r: 1.4 },
  { p: [209, 129], r: 2.5 },
]);

// B5 · Muesca: solo una V donde el ala se encuentra con el cuello.
const MUESCA = conHueco([
  { p: [184, 146], c: [[168, 104], [180, 126]], r: 1.4 },
  { p: [209, 129], r: 2.5 },
]);

// ── B6 · Tajo: un corte delgado que recorre todo el cuerpo (puerta P1c) ───
// Sigue la curva del ala desde el cuello hasta abajo. El cuello no se toca:
// el collar y el tope del pecho quedan donde están, así no se ve débil.
//   g: ancho del corte · pasante: si sale por el borde de abajo (dos piezas)
const BASE_Y = (x) => 146 + (249 - x) * (101 / 139);   // borde bajo del cuerpo (garganta → espolón)
function tajo({ g = 4.5, pasante = true, lleno = false, plumas = RITMO.slice(16), alto = alas, cola = RITMO.slice(12, 16) } = {}) {
  const dx = g * 1.08;                                  // la curva es casi vertical: corrimiento ≈ ancho
  const xw = pasante ? 146 : 148.5, xb = xw + dx;       // dónde termina el corte (lado ala / lado cuerpo)
  const yw = pasante ? BASE_Y(xw) : BASE_Y(xw) - 6, yb = pasante ? BASE_Y(xb) : yw + 2.2;
  const hombro = { p: [174, 142], c: [[166, 104], [174, 122]], r: 0 };
  const bajaAla = { p: [xw, yw], c: [[174, 170], [162, 198]], r: pasante ? 0.8 : g / 2 };
  const subeCuerpo = lleno
    ? [ // el cuerpo sigue la curva del ala hasta arriba y la nuca baja recta al corte: cuello ancho, sin muesca
        { p: [xb, yb], r: 0.8 },
        { p: [174 + dx, 142], c: [[162 + dx, 198], [174 + dx, 170]], r: 0 },
        { p: [171 + dx, 124], c: [[174 + dx, 135], [173 + dx, 129]], r: 0 },
        { p: [196, 117], r: 2 },                                        // collar → nuca
      ]
    : [
        { p: [xb, yb], r: pasante ? 0.8 : g / 2 },
        { p: [174 + dx, 142], c: [[162 + dx, 198], [174 + dx, 170]], r: 0 },
        { p: [209, 129], c: [[174 + dx, 131], [192, 127]], r: 2.5 },   // tope del pecho, con la muesca del collar
      ];
  const desde = lleno ? 6 : 5;                                          // con cuello lleno el collar ya está puesto
  const ala = [...alto, hombro, bajaAla, ...cola, ...plumas];          // pluma 1 … espolón … talón
  const cuerpo = [...subeCuerpo, ...RITMO.slice(desde, 12)];          // collar … garganta
  if (pasante) return { contorno: ala, huecos: [cuerpo] };            // dos piezas (evenodd no las cruza)
  return [...alto, hombro, bajaAla, ...subeCuerpo, ...RITMO.slice(desde, 12), ...cola, ...plumas];
}

// ── Juegos de alas para B7 (puerta P1d) ────────────────────────────────────
// Cada juego reemplaza el tramo "fondo de la ranura baja → talón de la pluma 1"
// (sentido horario: de abajo hacia arriba) y, si hace falta, la punta de la pluma 1.
// Una pluma = punta (arriba-izquierda), talón (abajo-izquierda, opcional) y el
// fondo de la ranura que la separa de la siguiente.
const PLUMAS = {
  // Tres plumas: dos ranuras, plumas anchas
  tres: [
    { p: [122, 182], r: 1.4 },                    // fondo ranura baja
    { p: [44, 130], r: 4 },                       // talón pluma 2
    { p: [14, 82], r: 3 },                        // punta pluma 2
    { p: [118, 120], r: 1.4 },                    // fondo ranura 1
    { p: [22, 48], r: 4 },                        // talón pluma 1
  ],
  // Cinco plumas: cuatro ranuras, puntas sobre un arco
  cinco: [
    { p: [121, 186], r: 1.4 },
    { p: [34, 140], r: 2.5 },                     // punta pluma 4 (sin talón)
    { p: [119, 152], r: 1.2 },
    { p: [36, 128], r: 3 },                       // talón pluma 3
    { p: [18, 100], r: 2.5 },                     // punta pluma 3
    { p: [118, 128], r: 1.2 },
    { p: [27, 91], r: 3 },                        // talón pluma 2
    { p: [8, 55], r: 2.5 },                       // punta pluma 2
    { p: [117, 104], r: 1.2 },
    { p: [20, 44], r: 3.5 },                      // talón pluma 1
  ],
};
// Romas: las mismas plumas de RITMO con puntas y talones muy redondeados
PLUMAS.romas = RITMO.slice(16).map((n) => (n.r >= 2.5 ? { ...n, r: 9, cap: 14 } : { ...n }));
const ALTO_ROMAS = [{ ...alas[0], r: 10, cap: 16 }, alas[1]];

/** Curvas: arquea hacia arriba cada borde largo de pluma (no los cortes de punta). */
function curvar(nodos, k = 6, saltar = new Set()) {
  return nodos.map((n, i) => {
    if (i === 0 || n.c || saltar.has(i)) return { ...n };
    const P0 = nodos[i - 1].p, Q = n.p, d = [Q[0] - P0[0], Q[1] - P0[1]];
    let up = [d[1], -d[0]]; const l = Math.hypot(...up); up = [up[0] / l, up[1] / l];
    if (up[1] > 0) up = [-up[0], -up[1]];
    const at = (t) => [P0[0] + d[0] * t + up[0] * k, P0[1] + d[1] * t + up[1] * k];
    return { ...n, c: [at(1 / 3), at(2 / 3)] };
  });
}
// en RITMO.slice(16): 0 ranura baja · 1 punta3 · 2 ranura2 · 3 talón2 · 4 punta2 · 5 ranura1 · 6 talón1
// los tramos talón2→punta2 (i=4) son cortes de punta: no se curvan
PLUMAS.curvas = curvar([RITMO[15], ...RITMO.slice(16)], 4.5, new Set([1, 5])).slice(1);
const ALTO_CURVAS = [alas[0], { ...alas[1], c: [[54, 26], [106, 57]] }];   // borde alto apenas abombado (hacia arriba)

export const B7 = (opc = {}) => tajo({ g: 3.4, pasante: true, lleno: true, ...opc });

// ── B8 · Sólido con cabeza: sin corte en el cuerpo, pero el hombro del ala
// baja antes que la cabeza y deja la muesca del original. El copete de la nuca
// (collar) sobresale hacia atrás y la cabeza se lee entera. La muesca es baja
// (≈15) para que el cuello no se vea flaco.
const SOLIDO_CABEZA = (fondo = 134) => [
  ...alas,
  { p: [177, fondo], c: [[166, 104], [176, fondo - 15]], r: 0 },     // el hombro baja hasta el fondo de la muesca
  { p: [184, fondo + 1.5], c: [[178, fondo + 2], [181, fondo + 1.5]], r: 0 },
  { p: [209, 129], c: [[195, fondo + 1.5], [203, 131]], r: 2.5 },    // sube a la base de la cabeza
  ...RITMO.slice(5),                                                  // collar (copete) … talón
];

export const VARIANTES = {
  "solido-cabeza": SOLIDO_CABEZA(134),
  "solido-cabeza-hondo": SOLIDO_CABEZA(142),
  fiel: FIEL, ritmo: RITMO, solido: SOLIDO, canal: CANAL, cerrada: CERRADA, corta: CORTA, muesca: MUESCA,
  "pasante-fino": tajo({ g: 3.4, pasante: true }),
  "pasante": tajo({ g: 5, pasante: true }),
  "lleno-fino": tajo({ g: 3.4, pasante: true, lleno: true }),
  "b7-tres": B7({ plumas: PLUMAS.tres }),
  "b7-cinco": B7({ plumas: PLUMAS.cinco, alto: [{ ...alas[0], p: [2, 2] }, alas[1]] }),
  "b7-curvas": B7({ plumas: PLUMAS.curvas, alto: ALTO_CURVAS }),
  "b7-romas": B7({ plumas: PLUMAS.romas, alto: ALTO_ROMAS }),
  // ★ ELEGIDO por Max (9-oct): B7 cuello lleno · corte 3,4 · plumas romas.
  // La cola y el espolón llevan el mismo redondeo que las plumas.
  oficial: B7({
    plumas: PLUMAS.romas, alto: ALTO_ROMAS,
    cola: RITMO.slice(12, 16).map((n, i) => (i === 0 ? { ...n, r: 4, cap: 8 } : i === 3 ? { ...n, r: 9, cap: 14 } : { ...n })),
  }),
  "lleno": tajo({ g: 5, pasante: true, lleno: true }),
};
export const ANCHO = 275, ALTO = 248;

// ── Construcción del path ──────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => { const l = len(v); return [v[0] / l, v[1] / l]; };
const add = (a, v, k) => [a[0] + v[0] * k, a[1] + v[1] * k];
const P = (p) => `${r1(p[0])} ${r1(p[1])}`;

/**
 * Path cerrado con esquinas redondeadas por arcos exactos.
 * Compensación: en una esquina aguda el arco "retrocede" la punta, así que el
 * vértice se empuja hacia afuera por la bisectriz para que el arco toque justo
 * el punto dibujado. Puntas y fondos de ranura quedan donde están en el original.
 */
function contorno(nodos) {
  const N = nodos.length;
  const esq = nodos.map((n, i) => {
    const prev = nodos[(i - 1 + N) % N], sig = nodos[(i + 1) % N];
    const desde = n.c ? n.c[1] : prev.p;                 // de dónde llega la tangente
    const hacia = sig.c ? sig.c[0] : sig.p;              // hacia dónde sale
    if (!n.r) return { a: n.p, b: n.p, arco: null };
    const u1 = norm(sub(desde, n.p)), u2 = norm(sub(hacia, n.p));
    const cos = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
    const th = Math.acos(cos);
    if (th < 0.01 || th > Math.PI - 0.05) return { a: n.p, b: n.p, arco: null };
    const w = norm([u1[0] + u2[0], u1[1] + u2[1]]);      // bisectriz, hacia adentro del ángulo
    let r = n.r;
    // en ángulos casi cerrados (la punta de la cuña) la compensación se dispara:
    // se limita a 3 unidades achicando el radio
    const k = 1 / Math.sin(th / 2) - 1;
    // el radio no puede pedir más tramo del que hay (se decide antes de compensar)
    const l0 = Math.min(len(sub(desde, n.p)), len(sub(hacia, n.p))) * 0.4;
    r = Math.min(r, l0 * Math.tan(th / 2));
    const tope = n.cap ?? 3;
    if (r * k > tope) r = tope / k;
    const v = add(n.p, w, -r * k);                       // vértice compensado
    let t = r / Math.tan(th / 2);
    const lmax = Math.min(len(sub(desde, v)), len(sub(hacia, v))) * 0.45;
    if (t > lmax) { t = lmax; r = t * Math.tan(th / 2); }
    const a = add(v, u1, t), b = add(v, u2, t);
    const din = sub(n.p, desde), dout = sub(hacia, n.p);
    const giro = din[0] * dout[1] - din[1] * dout[0] > 0 ? 1 : 0; // y hacia abajo: producto cruz positivo = giro horario
    return { a, b, arco: `A${r1(r)} ${r1(r)} 0 0 ${giro} ${P(b)}` };
  });
  let d = `M${P(esq[0].b)}`;
  for (let k = 1; k <= N; k++) {
    const i = k % N, n = nodos[i], e = esq[i];
    d += n.c ? `C${P(n.c[0])} ${P(n.c[1])} ${P(e.a)}` : `L${P(e.a)}`;
    if (e.arco) d += e.arco;
  }
  return d + "Z";
}

export function svg(variante = "fiel", color = "currentColor") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" fill="${color}"><path fill-rule="evenodd" d="${path(VARIANTES[variante])}"/></svg>`;
}

/** Path de una variante: un contorno, o un contorno con huecos (usar fill-rule="evenodd"). */
export function path(v) {
  if (Array.isArray(v)) return contorno(v);
  return contorno(v.contorno) + v.huecos.map(contorno).join("");
}

/** Piezas separadas de una variante: [contorno, ...huecos]. En `oficial` = [ala, cuerpo]. */
export function piezas(v) {
  if (Array.isArray(v)) return [contorno(v)];
  return [contorno(v.contorno), ...v.huecos.map(contorno)];
}
