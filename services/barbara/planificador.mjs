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

function partesEnZona(fecha, zonaHoraria) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha);
  const get = (tipo) => Number(partes.find((p) => p.type === tipo)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

// Convierte una hora de pared de la marca a UTC. Se itera porque el offset
// cambia con horario de verano; depender del timezone del runner haría que
// "10:00 Chile" terminara como 06:00 o 14:00 según dónde corra GitHub Actions.
export function horaLocalAUTC({ year, month, day, hour, minute = 0 }, zonaHoraria = "America/Santiago") {
  const objetivo = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidata = objetivo;
  for (let i = 0; i < 3; i++) {
    const p = partesEnZona(new Date(candidata), zonaHoraria);
    const representada = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    candidata += objetivo - representada;
  }
  return new Date(candidata);
}

function separacionMinima(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

/**
 * `ocupadas` contiene Date/ISO de piezas programadas o ya publicadas. La
 * salida es siempre futura, laborable y separada de las demás piezas.
 */
export function proponerHorario({
  ahora = new Date(), ocupadas = [], horas = HORAS_BASE, minimoHoras = 18,
  permitirFinDeSemana = false, zonaHoraria = "America/Santiago",
} = {}) {
  const ocupacion = ocupadas.map((x) => new Date(x)).filter((x) => !Number.isNaN(x.getTime()));
  const localAhora = partesEnZona(ahora, zonaHoraria);
  const inicioCalendario = Date.UTC(localAhora.year, localAhora.month - 1, localAhora.day);

  for (let dia = 0; dia < 21; dia++) {
    const base = new Date(inicioCalendario + dia * 86_400_000);
    if (!permitirFinDeSemana && !DIAS_LABORABLES.has(base.getUTCDay())) continue;
    for (const hora of [...horas].sort((a, b) => a - b)) {
      const candidata = horaLocalAUTC({
        year: base.getUTCFullYear(), month: base.getUTCMonth() + 1,
        day: base.getUTCDate(), hour: hora,
      }, zonaHoraria);
      if (candidata <= ahora) continue;
      if (ocupacion.every((o) => separacionMinima(candidata, o) >= minimoHoras)) {
        return {
          programadaPara: candidata.toISOString(),
          zonaHoraria,
          razon: `primer horario futuro con separación suficiente en ${zonaHoraria}`,
        };
      }
    }
  }
  return { programadaPara: null, zonaHoraria, razon: "no hubo una ventana segura en los próximos 21 días" };
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
