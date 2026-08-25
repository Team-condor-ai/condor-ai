/**
 * Bárbara · recuperación de memoria con presupuesto y prioridad.
 *
 * Una lista ordenada de notas no es un cerebro: termina mandando al prompt
 * datos viejos, duplicados o irrelevantes. Este módulo decide qué contexto
 * privado y qué patrones globales pueden influir en UNA pieza.
 *
 * Invariantes:
 * - La entrada pertenece a un solo cliente; jamás busca ni acepta memoria de
 *   otro cliente.
 * - Las reglas y el perfil privado pesan más que gustos/datos.
 * - Un patrón global sólo entra si ya fue activado por el equipo.
 * - El contexto tiene presupuesto de caracteres: no se llena el prompt con
 *   una enciclopedia ni se corta texto a mitad de una instrucción.
 */

const MAX_PRIVADA = 6000;
const MAX_GLOBAL = 1800;

export function normalizar(texto = "") {
  return String(texto).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function diasDesde(fecha, ahora) {
  const t = Date.parse(fecha || "");
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (ahora.getTime() - t) / 86_400_000);
}

function recencia(fecha, ahora) {
  // Una preferencia recién confirmada gana un poco; una regla repetida no se
  // vuelve irrelevante sólo por ser antigua, por eso el piso queda en 0.
  return Math.max(0, 14 - Math.min(14, diasDesde(fecha, ahora) / 14));
}

function puntajeRegla(r, ahora) {
  return 110 + Math.min(30, Math.log2(Math.max(1, r.veces_reforzada || 1)) * 9) + recencia(r.actualizado_en || r.creado_en, ahora);
}

function puntajeNodo(n, ahora) {
  const base = n.tipo === "perfil" ? 105 : n.tipo === "gusto" ? 66 : 60;
  return base + Math.min(25, Math.max(0, n.peso || 1) * 3) + recencia(n.actualizado_en || n.creado_en, ahora);
}

function sinDuplicados(items) {
  const vistos = new Set();
  return items.filter((x) => {
    const clave = normalizar(x.clave || x.texto);
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function dentroDePresupuesto(items, maxChars) {
  let usados = 0;
  const salida = [];
  for (const x of items) {
    const largo = x.texto.length + 3;
    if (usados + largo > maxChars) continue;
    usados += largo;
    salida.push(x);
  }
  return salida;
}

/** Devuelve contexto privado compacto y explicable, sin tocar datos. */
export function seleccionarPrivada({ reglas = [], nodos = [], ahora = new Date(), maxChars = MAX_PRIVADA } = {}) {
  const candidatas = [
    ...reglas.filter((r) => r.activa !== false && r.regla).map((r) => ({
      clase: "regla", texto: String(r.regla).trim(), clave: String(r.regla).trim(), puntaje: puntajeRegla(r, ahora),
      detalle: r.veces_reforzada > 1 ? `reforzada ${r.veces_reforzada} veces` : "regla explícita",
    })),
    ...nodos.filter((n) => n.activo !== false && n.contenido).map((n) => ({
      clase: n.tipo || "dato", texto: `[${n.tipo || "dato"}] ${n.titulo || "sin título"}: ${String(n.contenido).trim()}`,
      clave: String(n.contenido).trim(),
      puntaje: puntajeNodo(n, ahora), detalle: n.origen || "memoria privada",
    })),
  ].sort((a, b) => b.puntaje - a.puntaje || a.texto.localeCompare(b.texto, "es"));

  const seleccionadas = dentroDePresupuesto(sinDuplicados(candidatas), maxChars);
  return {
    seleccionadas,
    descartadas: Math.max(0, candidatas.length - seleccionadas.length),
    texto: seleccionadas.map((x) => `- ${x.texto}`).join("\n"),
  };
}

/** Los patrones globales sólo son consejos anonimizados previamente aprobados. */
export function seleccionarGlobales(patrones = [], { maxChars = MAX_GLOBAL } = {}) {
  const candidatas = patrones
    .filter((p) => p.activo === true && p.patron)
    .map((p) => ({ texto: String(p.patron).trim(), puntaje: Math.max(0, p.muestras || 0) }))
    .sort((a, b) => b.puntaje - a.puntaje || a.texto.localeCompare(b.texto, "es"));
  const seleccionadas = dentroDePresupuesto(sinDuplicados(candidatas), maxChars);
  return { seleccionadas, texto: seleccionadas.map((x) => `- ${x.texto}`).join("\n") };
}

/** Un único objeto auditable que el generador puede registrar o imprimir. */
export function prepararMemoria({ reglas, nodos, patrones, ahora, maxPrivada, maxGlobal } = {}) {
  const privada = seleccionarPrivada({ reglas, nodos, ahora, maxChars: maxPrivada });
  const global = seleccionarGlobales(patrones, { maxChars: maxGlobal });
  return {
    privada,
    global,
    diagnostico: {
      privada_usada: privada.seleccionadas.length,
      privada_descartada: privada.descartadas,
      global_usada: global.seleccionadas.length,
    },
  };
}
