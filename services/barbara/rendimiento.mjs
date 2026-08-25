/**
 * Evidencia agregada para aprendizaje global.
 *
 * Extrae rasgos de FORMA sin enviar texto, marca ni ids al modelo. Sólo
 * devuelve contrastes con muestra multi-marca; el LLM puede redactar una
 * recomendación, pero no inventar qué diferencia estadística observó.
 */

import { createHash } from "node:crypto";

const palabras = (s = "") => String(s).trim().split(/\s+/).filter(Boolean).length;
const promedio = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const bucket = (n, cortes, nombres) => nombres[cortes.findIndex((c) => n <= c)] || nombres[nombres.length - 1];

export function extraerRasgos(pieza = {}) {
  const contenido = pieza.contenido || {};
  const slides = Array.isArray(contenido.slides) ? contenido.slides : [];
  const titulares = slides.map((s) => palabras(s.titular));
  const cuerpos = slides.map((s) => String(s.cuerpo || "").length);
  const caption = String(contenido.caption || "");
  const ultimo = slides[slides.length - 1] || {};
  const rasgos = {
    tipo: pieza.tipo || "desconocido",
    pilar: pieza.pilar || "sin_pilar",
    caption: bucket(caption.length, [180, 500], ["corta", "media", "larga"]),
    hashtags: bucket((caption.match(/#[\p{L}\p{N}_]+/gu) || []).length, [2, 5], ["0-2", "3-5", "6+"]),
  };
  if (slides.length) {
    rasgos.slides = bucket(slides.length, [1, 5, 7], ["1", "2-5", "6-7", "8+"]);
    rasgos.titular = bucket(promedio(titulares), [6, 9], ["corto", "medio", "largo"]);
    rasgos.cuerpo = bucket(promedio(cuerpos), [45, 100], ["breve", "medio", "denso"]);
    rasgos.cierre_pregunta = /\?\s*$/.test(`${ultimo.titular || ""} ${ultimo.cuerpo || ""}`.trim()) ? "si" : "no";
  }
  return rasgos;
}

function tasaSuavizada(ok, n) { return (ok + 1) / (n + 2); }

export function construirContrastes(piezas = [], {
  minGrupo = 4, minMarcas = 3, minDelta = 0.15,
} = {}) {
  const cerradas = piezas.filter((p) => typeof p.aprobada_sin_cambios === "boolean").map((p) => ({
    ...p, rasgos: extraerRasgos(p), ok: p.aprobada_sin_cambios === true,
  }));
  const claves = ["tipo", "pilar", "slides", "titular", "cuerpo", "cierre_pregunta", "caption", "hashtags"];
  const contrastes = [];
  for (const clave of claves) {
    const valores = [...new Set(cerradas.map((p) => p.rasgos[clave]).filter((v) => v !== undefined))];
    for (const valor of valores) {
      const grupo = cerradas.filter((p) => p.rasgos[clave] === valor);
      const resto = cerradas.filter((p) => p.rasgos[clave] !== valor);
      const marcas = new Set(grupo.map((p) => p.barbara_cliente_id)).size;
      if (grupo.length < minGrupo || resto.length < minGrupo || marcas < minMarcas) continue;
      const ok = grupo.filter((p) => p.ok).length;
      const okResto = resto.filter((p) => p.ok).length;
      const tasa = tasaSuavizada(ok, grupo.length);
      const tasaResto = tasaSuavizada(okResto, resto.length);
      const delta = tasa - tasaResto;
      if (Math.abs(delta) < minDelta) continue;
      contrastes.push({
        id: `${clave}:${valor}`,
        rasgo: clave,
        valor,
        direccion: delta > 0 ? "mejor" : "peor",
        muestras: grupo.length,
        marcas,
        aprobadas: ok,
        tasa: Number(tasa.toFixed(3)),
        tasa_resto: Number(tasaResto.toFixed(3)),
        delta: Number(delta.toFixed(3)),
      });
    }
  }
  return contrastes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.muestras - a.muestras || a.id.localeCompare(b.id));
}

export function huellaEvidencia(piezas = []) {
  const canon = piezas.map((p) => ({
    id: p.id,
    ok: p.aprobada_sin_cambios,
    correcciones: p.correcciones_pedidas || 0,
    rasgos: extraerRasgos(p),
  })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return createHash("sha256").update(JSON.stringify(canon)).digest("hex");
}

export function materialAnonimo(contrastes = []) {
  return contrastes.map((c) =>
    `[${c.id}] ${c.direccion}: ${c.aprobadas}/${c.muestras} aprobadas, ` +
    `${c.marcas} marcas, tasa ajustada ${Math.round(c.tasa * 100)}% vs ` +
    `${Math.round(c.tasa_resto * 100)}% en el resto (delta ${Math.round(c.delta * 100)} pts).`,
  ).join("\n");
}
