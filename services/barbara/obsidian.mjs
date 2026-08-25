/** Puente determinista entre el cerebro privado y notas Markdown de Obsidian. */

import { createHash } from "node:crypto";

const TIPOS = new Set(["perfil", "gusto", "dato"]);
const escaparYaml = (s) => JSON.stringify(String(s ?? ""));

export function nombreNota(nodo = {}) {
  const base = String(nodo.titulo || "memoria").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "memoria";
  const sufijo = String(nodo.id || "sin-id").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return `${base}-${sufijo}`;
}

function linksDe(nodoId, relaciones, nombres) {
  const links = [];
  for (const r of relaciones.filter((x) => x.activa !== false)) {
    const otro = String(r.origen_id) === String(nodoId) ? r.destino_id
      : String(r.destino_id) === String(nodoId) ? r.origen_id : null;
    if (otro && nombres.has(String(otro))) links.push(`- [[${nombres.get(String(otro))}]] · ${r.tipo || "relacionada"} · peso ${Number(r.peso ?? 1)}`);
  }
  return [...new Set(links)].sort();
}

export function serializarCerebro({ nodos = [], relaciones = [], exportadoEn = new Date().toISOString() } = {}) {
  const nombres = new Map(nodos.map((n) => [String(n.id), nombreNota(n)]));
  const archivos = nodos.map((n) => {
    const name = nombres.get(String(n.id));
    const links = linksDe(n.id, relaciones, nombres);
    const tags = Array.isArray(n.etiquetas) ? n.etiquetas.map(String).filter(Boolean) : [];
    const texto = [
      "---",
      `name: ${name}`,
      `barbara_id: ${escaparYaml(n.id)}`,
      `tipo: ${escaparYaml(TIPOS.has(n.tipo) ? n.tipo : "dato")}`,
      `version: ${Math.max(1, Number(n.version) || 1)}`,
      `confianza: ${Math.max(0, Math.min(1, Number(n.confianza ?? 1)))}`,
      `activo: ${n.activo !== false}`,
      `etiquetas: ${JSON.stringify(tags)}`,
      `actualizado_en: ${escaparYaml(n.actualizado_en || n.creado_en || exportadoEn)}`,
      "---",
      "",
      `# ${String(n.titulo || "Memoria").trim()}`,
      "",
      String(n.contenido || "").trim(),
      "",
      "## Relaciones",
      "",
      ...(links.length ? links : ["- (sin relaciones)"]),
      "",
    ].join("\n");
    return { name, ruta: `${name}.md`, contenido: texto, sha256: createHash("sha256").update(texto).digest("hex") };
  }).sort((a, b) => a.ruta.localeCompare(b.ruta));
  const indice = [
    "# Cerebro privado de Bárbara",
    "",
    `Exportado: ${exportadoEn}`,
    "",
    ...archivos.map((a) => `- [[${a.name}]]`),
    "",
  ].join("\n");
  return { archivos, indice, manifest: { version: 1, exportado_en: exportadoEn, notas: archivos.map(({ name, ruta, sha256 }) => ({ name, ruta, sha256 })) } };
}

function valorYaml(lineas, clave) {
  const linea = lineas.find((l) => l.startsWith(`${clave}:`));
  if (!linea) return null;
  const raw = linea.slice(clave.length + 1).trim();
  try { return JSON.parse(raw); } catch { return raw; }
}

export function parsearNota(texto = "") {
  const limpio = String(texto).replace(/\r\n/g, "\n");
  if (!limpio.startsWith("---\n")) throw new Error("nota sin frontmatter");
  const fin = limpio.indexOf("\n---\n", 4);
  if (fin < 0 || fin > 5000) throw new Error("frontmatter inválido");
  const front = limpio.slice(4, fin).split("\n");
  const cuerpo = limpio.slice(fin + 5);
  const tituloMatch = cuerpo.match(/^#\s+(.+)$/m);
  const relaciones = cuerpo.indexOf("\n## Relaciones");
  const contenido = cuerpo.slice(tituloMatch ? tituloMatch.index + tituloMatch[0].length : 0, relaciones >= 0 ? relaciones : undefined).trim();
  const tipo = String(valorYaml(front, "tipo") || "dato");
  const etiquetasRaw = valorYaml(front, "etiquetas");
  const salida = {
    name: String(valorYaml(front, "name") || "").trim(),
    nodo_id: String(valorYaml(front, "barbara_id") || "").trim() || null,
    version: Math.max(1, Number(valorYaml(front, "version")) || 1),
    tipo: TIPOS.has(tipo) ? tipo : "dato",
    titulo: String(tituloMatch?.[1] || "Memoria importada").trim().slice(0, 120),
    contenido: contenido.slice(0, 1600),
    etiquetas: Array.isArray(etiquetasRaw) ? etiquetasRaw.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 12) : [],
  };
  if (!salida.name || !salida.contenido) throw new Error("nota sin name o contenido");
  if (salida.nodo_id && !/^[0-9a-f-]{36}$/i.test(salida.nodo_id)) throw new Error("barbara_id inválido");
  salida.hash = createHash("sha256").update(JSON.stringify({ tipo: salida.tipo, titulo: salida.titulo, contenido: salida.contenido, etiquetas: salida.etiquetas })).digest("hex");
  return salida;
}
