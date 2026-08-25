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

// Palabras frecuentes que no ayudan a decidir qué recuerdo es pertinente.
// La recuperación sigue siendo local y determinista: no necesita embeddings
// ni una llamada adicional de IA para elegir el contexto de una pieza.
const STOPWORDS = new Set([
  "a", "al", "algo", "con", "como", "de", "del", "el", "en", "es", "esta",
  "este", "la", "las", "lo", "los", "mas", "para", "por", "que", "se", "sin",
  "su", "sus", "un", "una", "y",
]);

export function normalizar(texto = "") {
  return String(texto).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function terminos(texto = "") {
  return [...new Set(normalizar(texto).split(" ").filter((x) => x.length > 2 && !STOPWORDS.has(x)))];
}

function textoContexto(contexto = {}) {
  if (typeof contexto === "string") return contexto;
  return [contexto.consulta, contexto.tipo, contexto.pilar, contexto.rubro, ...(contexto.etiquetas || [])]
    .filter(Boolean).join(" ");
}

function relevancia(texto, consulta) {
  const q = terminos(consulta);
  if (!q.length) return { puntaje: 0, coincidencias: [] };
  const t = new Set(terminos(texto));
  const coincidencias = q.filter((x) => t.has(x));
  const cobertura = coincidencias.length / q.length;
  const precision = coincidencias.length / Math.max(1, Math.min(t.size, 12));
  return { puntaje: Math.min(55, cobertura * 42 + precision * 13), coincidencias };
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

function puntajeRegla(r, ahora, consulta) {
  const rel = relevancia([r.regla, ...(r.etiquetas || [])].join(" "), consulta);
  return {
    valor: 110 + Math.min(30, Math.log2(Math.max(1, r.veces_reforzada || 1)) * 9) + recencia(r.actualizado_en || r.creado_en, ahora) + rel.puntaje,
    coincidencias: rel.coincidencias,
  };
}

function puntajeNodo(n, ahora, consulta) {
  const base = n.tipo === "perfil" ? 105 : n.tipo === "gusto" ? 66 : 60;
  const rel = relevancia([n.titulo, n.contenido, ...(n.etiquetas || [])].join(" "), consulta);
  const confianza = Number.isFinite(Number(n.confianza)) ? Math.max(0, Math.min(1, Number(n.confianza))) : 1;
  return {
    valor: base + Math.min(25, Math.max(0, n.peso || 1) * 3) + recencia(n.actualizado_en || n.creado_en, ahora) + rel.puntaje - (1 - confianza) * 18,
    coincidencias: rel.coincidencias,
  };
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
export function seleccionarPrivada({
  reglas = [], nodos = [], relaciones = [], contexto = {}, ahora = new Date(), maxChars = MAX_PRIVADA,
} = {}) {
  const consulta = textoContexto(contexto);
  const candidatas = [
    ...reglas.filter((r) => r.activa !== false && r.regla).map((r) => {
      const p = puntajeRegla(r, ahora, consulta);
      return {
        id: r.id || null, clase: "regla", texto: String(r.regla).trim(), clave: String(r.regla).trim(), puntaje: p.valor,
        coincidencias: p.coincidencias,
        detalle: r.veces_reforzada > 1 ? `reforzada ${r.veces_reforzada} veces` : "regla explícita",
      };
    }),
    ...nodos.filter((n) => n.activo !== false && n.contenido).map((n) => {
      const p = puntajeNodo(n, ahora, consulta);
      return {
        id: n.id || null, clase: n.tipo || "dato", texto: `[${n.tipo || "dato"}] ${n.titulo || "sin título"}: ${String(n.contenido).trim()}`,
        clave: String(n.contenido).trim(), puntaje: p.valor, coincidencias: p.coincidencias,
        detalle: n.origen || "memoria privada",
      };
    }),
  ];

  // Expansión de un salto en el grafo. Una nota relacionada sólo recibe
  // impulso cuando la semilla coincide con el pedido; una nota simplemente
  // popular no puede llenar por sí sola el contexto.
  const porId = new Map(candidatas.filter((x) => x.id).map((x) => [String(x.id), x]));
  const semillas = new Set(candidatas.filter((x) => x.coincidencias.length > 0 && x.id).map((x) => String(x.id)));
  for (const r of relaciones.filter((x) => x.activa !== false)) {
    const a = String(r.origen_id || r.desde_id || "");
    const b = String(r.destino_id || r.hacia_id || "");
    const peso = Math.max(0, Math.min(1, Number(r.peso ?? 1))) * 24;
    if (semillas.has(a) && porId.has(b)) {
      porId.get(b).puntaje += peso;
      porId.get(b).detalle += ` · relacionada con ${a}`;
    }
    if (semillas.has(b) && porId.has(a)) {
      porId.get(a).puntaje += peso;
      porId.get(a).detalle += ` · relacionada con ${b}`;
    }
  }

  candidatas.sort((a, b) => b.puntaje - a.puntaje || a.texto.localeCompare(b.texto, "es"));

  const seleccionadas = dentroDePresupuesto(sinDuplicados(candidatas), maxChars);
  return {
    seleccionadas,
    descartadas: Math.max(0, candidatas.length - seleccionadas.length),
    texto: seleccionadas.map((x) => `- ${x.texto}`).join("\n"),
  };
}

/** Los patrones globales sólo son consejos anonimizados previamente aprobados. */
export function seleccionarGlobales(patrones = [], { maxChars = MAX_GLOBAL, contexto = {} } = {}) {
  const tipo = typeof contexto === "object" ? contexto.tipo : null;
  const candidatas = patrones
    .filter((p) => p.activo === true && p.patron && (!tipo || !p.tipo || p.tipo === "general" || p.tipo === tipo))
    .map((p) => ({
      texto: String(p.patron).trim(),
      puntaje: Math.max(0, p.muestras || 0) + Math.max(0, Number(p.confianza_numerica || 0)) * 50,
      evidencia_clave: p.evidencia_clave || null,
    }))
    .sort((a, b) => b.puntaje - a.puntaje || a.texto.localeCompare(b.texto, "es"));
  const seleccionadas = dentroDePresupuesto(sinDuplicados(candidatas), maxChars);
  return { seleccionadas, texto: seleccionadas.map((x) => `- ${x.texto}`).join("\n") };
}

/** Un único objeto auditable que el generador puede registrar o imprimir. */
export function prepararMemoria({ reglas, nodos, relaciones, patrones, contexto, ahora, maxPrivada, maxGlobal } = {}) {
  const privada = seleccionarPrivada({ reglas, nodos, relaciones, contexto, ahora, maxChars: maxPrivada });
  const global = seleccionarGlobales(patrones, { maxChars: maxGlobal, contexto });
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
