// Un único contrato de capacidad para el motor. Los reintentos no entran a
// esta cuenta: corrigen una entrega existente y no consumen una pieza nueva.
export const LIMITES_PLAN = {
  barbara: { carrusel: 12, historia: 0, ugc: 0 },
  go: { carrusel: 12, historia: 20, ugc: 4 },
  plus: { carrusel: 12, historia: 20, ugc: 4 },
};

export function limitePlan(plan, tipo) {
  return LIMITES_PLAN[plan]?.[tipo] ?? LIMITES_PLAN.barbara[tipo] ?? 0;
}

export function inicioMesUTC(fecha = new Date()) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** No amontona la cuota al inicio: al día 15 de un mes de 30 solo permite
 * aproximadamente la mitad de las piezas de cada formato. */
export function metaAcumulada(limite, fecha = new Date()) {
  const dias = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.ceil((limite * fecha.getUTCDate()) / dias);
}
