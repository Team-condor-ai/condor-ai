/**
 * El saludo de entrada de Bárbara: la hora del día y el nombre de quien entra.
 *
 * Pedido de Joaquín (25-ago-2026): que sea como el de Claude —
 * "hola Matías, ¿cómo está tu tarde?"— en vez del "¡Hola! Soy Bárbara ✨"
 * fijo que había, que es el mismo texto para todo el mundo a toda hora.
 *
 * POR QUÉ ESTO NO SE RESUELVE CON UN random()
 * ---------------------------------------------------------------------------
 * Un saludo distinto en cada render es un saludo que PARPADEA: React vuelve a
 * pintar por cualquier motivo (llega el calendario, cambia una pestaña) y el
 * texto cambiaría bajo el cursor. La variedad tiene que venir del tiempo, no
 * del azar: `indiceEstable` deriva el índice de la fecha + la franja horaria,
 * así el saludo es EL MISMO durante toda la tarde y otro mañana. Determinista,
 * sin estado y sin efectos.
 */

export type Franja = "madrugada" | "mañana" | "tarde" | "noche";

export function franjaDe(hora: number): Franja {
  if (hora < 5) return "madrugada";
  if (hora < 12) return "mañana";
  if (hora < 20) return "tarde";
  return "noche";
}

/**
 * Un nombre de pila utilizable, o `null`.
 *
 * SER CONSERVADOR ACÁ ES LA DIFERENCIA ENTRE CÁLIDO Y ROBÓTICO. El portal
 * deriva el "nombre" del correo (`correo.split("@")[0]`), y eso da cosas como
 * "j.ignaciomunozsilva" o "maximilianopinocv". Saludar a alguien como
 * "Hola Maximilianopinocv" es peor que no saludarlo por su nombre: delata que
 * hay una máquina rellenando un hueco.
 *
 * Entonces: se usa el nombre real cuando existe (`admins.nombre`,
 * `clientes.nombre` — de ahí salen "Joaquín", "Alejandro", con tilde y todo),
 * y del correo solo se acepta un primer segmento que PAREZCA un nombre de
 * pila. Si no, se devuelve `null` y el saludo se arma sin nombre, que sigue
 * sonando natural.
 */
export function nombreDePila(nombre?: string | null): string | null {
  const crudo = (nombre || "").trim();
  if (!crudo) return null;

  // Un nombre real ya viene limpio: se toma su primera palabra y listo.
  const primera = crudo.split(/[\s.]+/)[0] || "";
  if (!primera) return null;

  // Solo letras (con tildes y ñ). Un correo tipo "ventas2024" no es nadie.
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(primera)) return null;

  // 3 a 14 letras. Bajo 3 es una inicial ("j."); sobre 14 es un correo
  // pegado sin separadores ("maximilianopinocv"), no un nombre.
  if (primera.length < 3 || primera.length > 14) return null;

  return primera[0].toLocaleUpperCase("es") + primera.slice(1);
}

/** Las variantes por franja. La primera de cada lista es la más neutra. */
const SALUDOS: Record<Franja, ((n: string | null) => string)[]> = {
  madrugada: [
    (n) => (n ? `Hola ${n}, ¿trasnochando?` : "Hola, ¿trasnochando?"),
    (n) => (n ? `Buenas noches ${n}, todavía en pie` : "Buenas noches, todavía en pie"),
    (n) => (n ? `Hola ${n}, ¿cómo va la madrugada?` : "Hola, ¿cómo va la madrugada?"),
  ],
  mañana: [
    (n) => (n ? `Buenos días ${n}` : "Buenos días"),
    (n) => (n ? `Hola ${n}, ¿cómo amaneciste?` : "Hola, ¿cómo amaneciste?"),
    (n) => (n ? `Buenos días ${n}, ¿empezamos?` : "Buenos días, ¿empezamos?"),
  ],
  tarde: [
    (n) => (n ? `Hola ${n}, ¿cómo está tu tarde?` : "Hola, ¿cómo está tu tarde?"),
    (n) => (n ? `Buenas tardes ${n}` : "Buenas tardes"),
    (n) => (n ? `Hola ${n}, ¿qué tal va el día?` : "Hola, ¿qué tal va el día?"),
  ],
  noche: [
    (n) => (n ? `Buenas noches ${n}` : "Buenas noches"),
    (n) => (n ? `Hola ${n}, ¿cómo estuvo el día?` : "Hola, ¿cómo estuvo el día?"),
    (n) => (n ? `Hola ${n}, cerrando el día` : "Hola, cerrando el día"),
  ],
};

/**
 * Índice estable dentro del día y la franja: mismo saludo toda la tarde,
 * otro mañana. Ver el porqué en el encabezado del archivo.
 */
export function indiceEstable(fecha: Date, franja: Franja, total: number): number {
  const dias = Math.floor(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000,
  );
  const orden = ["madrugada", "mañana", "tarde", "noche"].indexOf(franja);
  return (((dias * 4 + orden) % total) + total) % total;
}

/** El saludo listo para mostrar. `ahora` es inyectable para poder probarlo. */
export function saludo(nombre?: string | null, ahora: Date = new Date()): string {
  const franja = franjaDe(ahora.getHours());
  const opciones = SALUDOS[franja];
  return opciones[indiceEstable(ahora, franja, opciones.length)](nombreDePila(nombre));
}

/**
 * La línea de abajo. Cambia con la franja igual que el saludo: a las 3 AM
 * ofrecer "planifiquemos tu semana" suena a formulario; a las 9 AM, no.
 */
export function subtituloSaludo(negocio: string, ahora: Date = new Date()): string {
  const franja = franjaDe(ahora.getHours());
  if (franja === "madrugada")
    return `Estoy acá si quieres adelantar algo de ${negocio}.`;
  if (franja === "mañana")
    return `¿Armamos el contenido de ${negocio} para hoy?`;
  if (franja === "noche")
    return `¿Dejamos listo algo de ${negocio} para mañana?`;
  return `¿En qué te ayudo con ${negocio}?`;
}
