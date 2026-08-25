/** Calidad de señal antes de convertir resultados de piezas en aprendizaje. */
export function evaluarEvidencia({ aprobada_sin_cambios, correcciones_pedidas = 0, metricas = null, diasDesdePublicacion = 0 } = {}) {
  const tieneMetricas = metricas && Number.isFinite(metricas.alcance) && Number.isFinite(metricas.interacciones);
  // No convertir silencio reciente en "éxito": la pieza necesita ventana de
  // revisión o una aprobación explícita antes de producir aprendizaje global.
  if (aprobada_sin_cambios === null && diasDesdePublicacion < 3) return { apta: false, razon: "ventana de revisión abierta" };
  if (correcciones_pedidas > 0) return { apta: false, razon: "pieza corregida; no es señal limpia" };
  if (aprobada_sin_cambios !== true) return { apta: false, razon: "sin aprobación verificable" };
  if (!tieneMetricas) return { apta: true, confianza: 0.45, razon: "aprobación limpia sin métricas externas" };
  const tasa = metricas.alcance > 0 ? metricas.interacciones / metricas.alcance : 0;
  return { apta: true, confianza: Math.min(0.95, 0.55 + Math.min(0.4, tasa * 8)), razon: "aprobación y métricas reales", tasa_interaccion: tasa };
}
