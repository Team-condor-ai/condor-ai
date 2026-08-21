// Prueba de la corrección dirigida de Bárbara. No gasta un peso: intercepta
// `fetch` para la API de Anthropic y usa una base de datos de mentira.
//
//     node services/barbara/test-correccion.mjs
//
// QUÉ PROTEGE
// ---------------------------------------------------------------------------
// Que un reintento corrija LO QUE SE PIDIÓ. Antes del 21-ago-2026 el motor
// regeneraba a ciegas: no leía el pedido del cliente ni tenía la pieza
// anterior. Si alguien vuelve a dejar el reintento sin esas dos cosas, o
// afloja la verificación, estas comprobaciones se caen.

import {
  piezaAnterior, leerPedido, extraerCambios, instrucciones, verificar, faltantes,
} from "./correccion.mjs";

let fallos = 0;
const ok = (t, cond, detalle = "") => {
  if (cond) console.log("   " + t);
  else { console.log("❌ " + t + (detalle ? " — " + detalle : "")); fallos++; }
};

/* ── Base de datos de mentira ──────────────────────────────────────────── */
const PIEZA = {
  id: "pieza-1",
  fecha: "2026-08-20",
  angulo: "El error de tomar colágeno con el estómago lleno",
  creado_en: "2026-08-20T14:00:00Z",
  contenido: {
    angulo: "El error de tomar colágeno con el estómago lleno",
    slides: [
      { titular: "El error que arruina tu colágeno", cuerpo: "Lo tomas después de comer y no se absorbe." },
      { titular: "Tómalo en ayunas, siempre", cuerpo: "Media hora antes del desayuno es la ventana buena." },
    ],
    caption: "Si tomas colágeno y no ves nada, quizá no es el producto…",
  },
};

const CHATS = [
  // Anterior a la pieza: NO debe entrar como corrección de ella.
  { mensaje: "hola, cuándo llega el contenido de esta semana?", creado_en: "2026-08-19T09:00:00Z" },
  // Posteriores: sí.
  { mensaje: "el titular del slide 1 muy largo, más corto", creado_en: "2026-08-20T15:00:00Z" },
  { mensaje: "y el caption ponlo más directo porfa", creado_en: "2026-08-20T15:02:00Z" },
];

const db = {
  async get(path) {
    if (path.startsWith("barbara_memoria")) return [PIEZA];
    if (path.startsWith("barbara_chats")) {
      const m = path.match(/creado_en=gt\.([^&]+)/);
      const desde = m ? decodeURIComponent(m[1]) : null;
      const filas = CHATS.filter((c) => !desde || c.creado_en > desde);
      return filas.slice().reverse();   // el endpoint devuelve desc
    }
    return [];
  },
};

/* ── Anthropic de mentira ──────────────────────────────────────────────── */
let respuestaClaude = null;
let llamadas = 0;
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("anthropic.com")) {
    llamadas++;
    const cuerpo = JSON.parse(opt.body);
    const salida = typeof respuestaClaude === "function"
      ? respuestaClaude(cuerpo, llamadas) : respuestaClaude;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: JSON.stringify(salida) }] }) };
  }
  throw new Error("fetch inesperado a " + url);
};

/* ── 1. Leer el pedido ─────────────────────────────────────────────────── */
console.log("\nLEER EL PEDIDO");
console.log("─".repeat(72));
const previa = await piezaAnterior(db, "cli-1", "carrusel");
ok("encuentra la pieza anterior con su contenido", !!previa?.contenido?.slides);

const mensajes = await leerPedido(db, "cli-1", previa.creado_en);
ok("toma solo los mensajes posteriores a la pieza", mensajes.length === 2,
   `tomó ${mensajes.length}: ${JSON.stringify(mensajes)}`);
ok("descarta el mensaje anterior a la pieza",
   !mensajes.some((m) => m.includes("cuándo llega")),
   "un mensaje viejo se coló como corrección de una pieza que no existía todavía");
ok("los devuelve en orden cronológico", mensajes[0].includes("titular"));

/* ── 2. Extraer los cambios ────────────────────────────────────────────── */
console.log("\nEXTRAER LOS CAMBIOS");
console.log("─".repeat(72));
respuestaClaude = {
  es_correccion: true,
  cambios: [
    { id: 1, que: "titular del slide 1", accion: "acortarlo", alcance: "texto" },
    { id: 2, que: "el caption", accion: "hacerlo más directo", alcance: "tono" },
  ],
};
const { cambios, es_correccion } = await extraerCambios("fake-key", mensajes, previa);
ok("reconoce que es una corrección", es_correccion === true);
ok("saca los dos cambios pedidos", cambios.length === 2, `sacó ${cambios.length}`);

llamadas = 0;
respuestaClaude = { es_correccion: false, cambios: [] };
const nada = await extraerCambios("fake-key", ["gracias, quedó buenísimo!"], previa);
ok("un agradecimiento NO es una corrección", nada.cambios.length === 0 && !nada.es_correccion);

const vacio = await extraerCambios("fake-key", [], previa);
ok("sin mensajes no llama al modelo", vacio.cambios.length === 0 && llamadas === 1,
   `llamó ${llamadas} veces`);

/* ── 3. Las instrucciones que se le pasan al modelo ────────────────────── */
console.log("\nLAS INSTRUCCIONES");
console.log("─".repeat(72));
const ins = instrucciones(cambios, previa);
ok("nombra cada cambio pedido",
   ins.includes("titular del slide 1") && ins.includes("el caption"));
ok("prohíbe tocar lo demás", /NADA MÁS/.test(ins),
   "sin esta regla el modelo 'aprovecha' y cambia todo, que es lo que hacía antes");
ok("incluye la versión anterior para que edite y no rehaga",
   ins.includes("El error que arruina tu colágeno"),
   "sin la versión anterior no hay nada que corregir");
ok("sin cambios, no agrega instrucciones", instrucciones([], previa) === "");

/* ── 4. Verificar ──────────────────────────────────────────────────────── */
console.log("\nVERIFICAR");
console.log("─".repeat(72));
respuestaClaude = {
  resultados: [
    { id: 1, cumplido: true, motivo: "" },
    { id: 2, cumplido: false, motivo: "el caption quedó igual de largo" },
  ],
  cambio_de_mas: "",
};
const nuevaVersion = { slides: [{ titular: "El error del colágeno", cuerpo: "…" }], caption: "…" };
const v = await verificar("fake-key", cambios, previa.contenido, nuevaVersion);
ok("devuelve un resultado por cada cambio", v.resultados.length === 2);

const falta = faltantes(cambios, v.resultados);
ok("detecta el punto que NO se cumplió", falta.length === 1 && falta[0].id === 2,
   JSON.stringify(falta));
ok("el faltante trae el motivo", (falta[0]?.motivo || "").includes("igual de largo"));

respuestaClaude = {
  resultados: cambios.map((c) => ({ id: c.id, cumplido: true, motivo: "" })),
  cambio_de_mas: "",
};
const vTodo = await verificar("fake-key", cambios, previa.contenido, nuevaVersion);
ok("si se cumple todo, no queda nada faltante",
   faltantes(cambios, vTodo.resultados).length === 0);

/* ── 5. La trampa: "quedó mejor" no es "se hizo lo que pedí" ───────────── */
console.log("\nLA TRAMPA QUE ESTO VINO A EVITAR");
console.log("─".repeat(72));
respuestaClaude = (cuerpo) => {
  const esVerificador = String(cuerpo.system || "").includes("Compruebas");
  return esVerificador
    ? { resultados: [{ id: 1, cumplido: false, motivo: "cambió el tema entero, el titular sigue largo" },
                     { id: 2, cumplido: false, motivo: "otro caption, igual de largo" }],
        cambio_de_mas: "reescribió los 6 slides con otro ángulo" }
    : {};
};
const vRehecha = await verificar("fake-key", cambios, previa.contenido,
  { slides: [{ titular: "Otro tema completamente distinto y largo", cuerpo: "…" }], caption: "…" });
ok("una pieza REHECHA no pasa como corregida",
   faltantes(cambios, vRehecha.resultados).length === 2,
   "el verificador dio por bueno un cambio de tema — así se cuela el bug viejo");
ok("avisa cuando cambió algo que nadie pidió", !!vRehecha.cambio_de_mas);

console.log("\n" + "─".repeat(72));
if (fallos) { console.log(`❌ ${fallos} fallos`); process.exit(1); }
console.log("✅ TODO BIEN — el reintento corrige lo pedido y no pasa por alto lo que falta");
