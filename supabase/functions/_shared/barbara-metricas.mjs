/**
 * Normalización y hitos de rendimiento de Bárbara.
 *
 * Este módulo no conoce proveedores: Meta, TikTok o un importador manual
 * pueden entregar nombres distintos y acá se convierten al mismo contrato.
 * Sólo se conservan contadores agregados; nunca audiencia, comentarios ni
 * identificadores personales.
 */

const CAMPOS = [
  "me_gusta", "comentarios", "compartidos", "guardados", "alcance",
  "impresiones", "reproducciones", "clics", "seguidores",
];

const ALIAS = {
  me_gusta: ["me_gusta", "likes", "like_count", "reactions"],
  comentarios: ["comentarios", "comments", "comment_count"],
  compartidos: ["compartidos", "shares", "share_count"],
  guardados: ["guardados", "saves", "saved", "save_count"],
  alcance: ["alcance", "reach", "accounts_reached"],
  impresiones: ["impresiones", "impressions"],
  reproducciones: ["reproducciones", "views", "plays", "video_views"],
  clics: ["clics", "clicks", "link_clicks"],
  seguidores: ["seguidores", "follows", "followers_gained"],
};

export const UMBRALES_HITOS = Object.freeze({
  me_gusta: [100, 500, 1_000, 5_000, 10_000],
  alcance: [1_000, 5_000, 10_000, 50_000, 100_000],
  reproducciones: [1_000, 5_000, 10_000, 50_000, 100_000],
  guardados: [50, 100, 500, 1_000],
  compartidos: [50, 100, 500, 1_000],
});

function enteroSeguro(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.min(Math.trunc(numero), Number.MAX_SAFE_INTEGER);
}

function buscar(objeto, nombres) {
  for (const nombre of nombres) {
    if (objeto?.[nombre] !== undefined && objeto?.[nombre] !== null) return objeto[nombre];
  }
  return 0;
}

export function normalizarMetricas(entrada = {}) {
  const raiz = entrada?.metrics && typeof entrada.metrics === "object" ? entrada.metrics : entrada;
  const normalizadas = {};
  for (const campo of CAMPOS) normalizadas[campo] = enteroSeguro(buscar(raiz, ALIAS[campo]));
  normalizadas.interacciones = normalizadas.me_gusta + normalizadas.comentarios
    + normalizadas.compartidos + normalizadas.guardados + normalizadas.clics;
  normalizadas.tasa_interaccion = normalizadas.alcance > 0
    ? Number((normalizadas.interacciones / normalizadas.alcance).toFixed(6))
    : null;
  return normalizadas;
}

/**
 * Devuelve como máximo un hito nuevo por métrica: si el primer snapshot llega
 * con 1.200 likes, avisa 1.000 y no bombardea además con 100 y 500.
 */
export function hitosNuevos(metricas, hitosExistentes = []) {
  const existentes = new Set(hitosExistentes.map((h) => `${h.metrica}:${Number(h.umbral)}`));
  const nuevos = [];
  for (const [metrica, umbrales] of Object.entries(UMBRALES_HITOS)) {
    const valor = enteroSeguro(metricas?.[metrica]);
    const alcanzados = umbrales.filter((umbral) => valor >= umbral && !existentes.has(`${metrica}:${umbral}`));
    if (alcanzados.length) nuevos.push({ metrica, umbral: Math.max(...alcanzados), valor });
  }
  return nuevos;
}

export function textoHito({ negocio = "tu marca", plataforma = "redes", angulo = "tu publicación", metrica, umbral, valor }) {
  const nombres = {
    me_gusta: "me gusta", alcance: "personas alcanzadas", reproducciones: "reproducciones",
    guardados: "guardados", compartidos: "compartidos",
  };
  const numero = new Intl.NumberFormat("es-CL").format(Number(umbral || valor || 0));
  return `🚀 ${negocio}: “${angulo}” superó ${numero} ${nombres[metrica] || metrica} en ${plataforma}. `
    + "Va avanzando bien; Bárbara seguirá observando su rendimiento.";
}



