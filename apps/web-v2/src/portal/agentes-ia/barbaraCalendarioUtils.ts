export type ReglaSemanalContenido = { dia: number; hora: string };

export const DIAS_CONTENIDO = [
  { dia: 1, corto: "Lun", nombre: "lunes" },
  { dia: 2, corto: "Mar", nombre: "martes" },
  { dia: 3, corto: "Mié", nombre: "miércoles" },
  { dia: 4, corto: "Jue", nombre: "jueves" },
  { dia: 5, corto: "Vie", nombre: "viernes" },
  { dia: 6, corto: "Sáb", nombre: "sábado" },
  { dia: 0, corto: "Dom", nombre: "domingo" },
] as const;

const dos = (n: number) => String(n).padStart(2, "0");

export function fechaLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

export function sumarMeses(fecha: string, meses: number) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return fechaLocal(new Date(anio, mes - 1 + meses, dia, 12));
}

export function partesEnZona(fecha: Date, zona: string) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const get = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"), second: get("second"),
  };
}

export function paredAUTC(valor: string, zona: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!m) return null;
  const objetivo = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let candidata = objetivo;
  for (let i = 0; i < 3; i++) {
    const p = partesEnZona(new Date(candidata), zona);
    candidata += objetivo - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return new Date(candidata);
}

export function inputEnZona(iso: string, zona: string) {
  const p = partesEnZona(new Date(iso), zona);
  return `${p.year}-${dos(p.month)}-${dos(p.day)}T${dos(p.hour)}:${dos(p.minute)}`;
}

export function fechaEnZona(iso: string, zona: string) {
  return inputEnZona(iso, zona).slice(0, 10);
}

export function crearOcurrenciasContenido({
  repite,
  fecha,
  hora,
  desde,
  hasta,
  reglas,
  zonaHoraria,
  limite = 64,
}: {
  repite: boolean;
  fecha: string;
  hora: string;
  desde: string;
  hasta: string;
  reglas: ReglaSemanalContenido[];
  zonaHoraria: string;
  limite?: number;
}) {
  const valores: string[] = [];
  if (!repite) {
    const instante = paredAUTC(`${fecha}T${hora}`, zonaHoraria);
    if (!instante || Number.isNaN(instante.getTime())) throw new Error("Elige una fecha y una hora válidas.");
    return [instante.toISOString()];
  }
  if (!reglas.length) throw new Error("Selecciona al menos un día de la semana.");
  if (hasta < desde) throw new Error("La fecha final debe ser igual o posterior a la inicial.");

  const [anioI, mesI, diaI] = desde.split("-").map(Number);
  const [anioF, mesF, diaF] = hasta.split("-").map(Number);
  const cursor = new Date(anioI, mesI - 1, diaI, 12);
  const fin = new Date(anioF, mesF - 1, diaF, 12);
  const porDia = new Map(reglas.map((r) => [r.dia, r.hora]));
  while (cursor <= fin) {
    const horaDelDia = porDia.get(cursor.getDay());
    if (horaDelDia) {
      const instante = paredAUTC(`${fechaLocal(cursor)}T${horaDelDia}`, zonaHoraria);
      if (!instante || Number.isNaN(instante.getTime())) throw new Error("Una hora de la serie no es válida.");
      valores.push(instante.toISOString());
      if (valores.length > limite) throw new Error(`La serie supera el límite de ${limite} publicaciones.`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!valores.length) throw new Error("No hay días seleccionados dentro del rango indicado.");
  return valores;
}

export function resumenReglas(reglas: ReglaSemanalContenido[]) {
  return reglas
    .slice()
    .sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7))
    .map((r) => `${DIAS_CONTENIDO.find((d) => d.dia === r.dia)?.nombre} a las ${r.hora}`)
    .join(" y ");
}
