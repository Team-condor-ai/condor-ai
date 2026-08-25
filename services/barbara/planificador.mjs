/**
 * Bárbara · planificador determinista de publicaciones.
 *
 * Propone una hora; no publica. Separar esas dos responsabilidades evita que
 * una sugerencia de calendario se convierta accidentalmente en una acción en
 * Instagram. El cliente siempre puede mover la propuesta mediante la RPC del
 * calendario.
 */

const DIAS_LABORABLES = new Set([1, 2, 3, 4, 5]);
const HORAS_BASE = [10, 13, 18];

function fechaHora(base, hora) {
  const d = new Date(base);
  d.setHours(hora, 0, 0, 0);
  return d;
}

function separacionMinima(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

/**
 * `ocupadas` contiene Date/ISO de piezas programadas o ya publicadas. La
 * salida es siempre futura, laborable y separada de las demás piezas.
 */
export function proponerHorario({ ahora = new Date(), ocupadas = [], horas = HORAS_BASE, minimoHoras = 18, permitirFinDeSemana = false } = {}) {
  const ocupacion = ocupadas.map((x) => new Date(x)).filter((x) => !Number.isNaN(x.getTime()));
  const inicio = new Date(ahora);
  inicio.setMinutes(0, 0, 0);

  for (let dia = 0; dia < 21; dia++) {
    const base = new Date(inicio);
    base.setDate(base.getDate() + dia);
    if (!permitirFinDeSemana && !DIAS_LABORABLES.has(base.getDay())) continue;
    for (const hora of [...horas].sort((a, b) => a - b)) {
      const candidata = fechaHora(base, hora);
      if (candidata <= ahora) continue;
      if (ocupacion.every((o) => separacionMinima(candidata, o) >= minimoHoras)) {
        return { programadaPara: candidata.toISOString(), razon: "primer horario futuro con separación suficiente" };
      }
    }
  }
  return { programadaPara: null, razon: "no hubo una ventana segura en los próximos 21 días" };
}

/** Explica si una reprogramación humana respeta el mismo mínimo recomendado. */
export function evaluarReprogramacion({ propuesta, ocupadas = [], minimoHoras = 18 } = {}) {
  const p = new Date(propuesta);
  if (Number.isNaN(p.getTime())) return { valida: false, razon: "fecha inválida" };
  const conflicto = ocupadas.map((x) => new Date(x)).find((o) => !Number.isNaN(o.getTime()) && separacionMinima(p, o) < minimoHoras);
  return conflicto
    ? { valida: false, razon: "demasiado cerca de otra pieza", conflicto: conflicto.toISOString() }
    : { valida: true, razon: "separación suficiente" };
}
