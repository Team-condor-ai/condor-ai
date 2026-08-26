type MomentoLocal = {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  diaSemana: number;
};

const DIA_SEMANA: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Efemérides breves y apropiadas para una asistente de contenido. La base
 * oficial de observancias globales es el calendario de Naciones Unidas; las
 * fechas culturales chilenas viven junto a ellas para mantener contexto local.
 * El catálogo queda aislado para poder ampliarlo sin tocar el componente.
 */
const EFEMERIDES: Record<string, string[]> = {
  "01-01": ["¡Feliz Año Nuevo! ¿Qué te gustaría construir este año?"],
  "01-24": ["Hoy es el Día de la Educación. Siempre hay algo nuevo que aprender."],
  "02-14": ["Feliz día del amor y la amistad. ¿A quién le mandarías un mensaje hoy?"],
  "03-08": ["Hoy es el Día Internacional de la Mujer. Hagamos espacio para voces que importan."],
  "03-20": ["Hoy es el Día de la Felicidad. ¿Qué te alegró esta semana?"],
  "03-21": ["Hoy también celebramos la poesía. Una buena frase puede cambiar una idea entera."],
  "04-21": ["Día de la Creatividad y la Innovación: buen momento para probar un ángulo distinto."],
  "04-22": ["Hoy celebramos a la Tierra. ¿Le damos un giro más consciente al contenido?"],
  "04-23": ["Hoy es el Día del Libro. Estoy buscando una historia que valga la pena contar."],
  "05-01": ["Feliz Día del Trabajo. También se vale bajar un cambio."],
  "05-15": ["Hoy es el Día de las Familias. ¿Hay alguna historia cercana que quieras contar?"],
  "05-21": ["Hoy es el Día Internacional del Té. Justo estaba preparándome uno."],
  "05-25": ["Hoy es el Día Mundial del Fútbol. Yo ya estoy mirando el marcador."],
  "06-01": ["Hoy es el Día Mundial de las Madres y los Padres. Un abrazo a quienes acompañan siempre."],
  "06-04": ["Hoy tengo una excelente excusa para hablar de queso. ¿Cuál es tu favorito?"],
  "06-05": ["Día del Medio Ambiente. Las ideas pequeñas también pueden mover cambios grandes."],
  "06-08": ["Hoy es el Día de los Océanos. Estoy navegando entre ideas."],
  "06-21": ["Llegó el solsticio. Buen momento para renovar energía e ideas."],
  "06-27": ["Hoy celebramos a las pymes. Historias pequeñas pueden construir marcas enormes."],
  "07-20": ["Entre ajedrez y la Luna, hoy sobran excusas para pensar una jugada distinta."],
  "07-30": ["Hoy es el Día de la Amistad. ¿Hay alguien a quien quieras saludar?"],
  "08-09": ["Hoy reconocemos a los pueblos indígenas del mundo y todo lo que podemos aprender de ellos."],
  "08-12": ["Día de la Juventud: hoy toca escuchar ideas nuevas."],
  "08-27": ["Hoy es el Día Mundial de los Lagos. Yo sigo pescando buenas ideas."],
  "09-17": ["Mañana empieza el Dieciocho. ¿Ya tienes lista la playlist?"],
  "09-18": ["¡Felices Fiestas Patrias! ¿Ya salió la primera empanada?"],
  "09-19": ["¿Cómo la pasaste ayer en el Dieciocho? ¡Que sigan las celebraciones!"],
  "09-20": ["¿Cómo estuvo tu celebración dieciochera? Yo sigo con cueca en la cabeza."],
  "09-21": ["Hoy es el Día de la Paz. Una buena conversación siempre es un comienzo."],
  "10-01": ["Hoy es el Día Internacional del Café. Yo sigo fiel al té, pero no juzgo."],
  "10-05": ["Feliz Día de las y los Docentes. Gracias a quienes convierten preguntas en caminos."],
  "10-10": ["Hoy es el Día de la Salud Mental. Una pausa también cuenta como avance."],
  "10-31": ["¡Feliz Halloween! Hoy acepto ideas un poquito más monstruosas."],
  "11-10": ["Día Mundial de la Ciencia. Estoy investigando, como corresponde."],
  "11-20": ["Hoy celebramos los derechos de niñas y niños. Que nunca falten curiosidad ni juego."],
  "12-05": ["Hoy es el Día del Voluntariado. Gracias a quienes regalan tiempo y energía."],
  "12-10": ["Hoy es el Día de los Derechos Humanos. Comunicar también es cuidar."],
  "12-21": ["Hoy es el Día de la Meditación. Respiro, ordeno ideas y seguimos."],
  "12-24": ["Ya huele a Navidad. ¿Terminaste todo o improvisamos juntos?"],
  "12-25": ["¡Feliz Navidad! Espero que tengas un día tranquilo y bonito."],
  "12-31": ["Último día del año. ¿Con qué aprendizaje te quedas?"],
};

const ACTIVIDADES = [
  "Afinando una idea antes de convertirla en contenido.",
  "Buscando una apertura que detenga el scroll.",
  "Comparando formatos para la próxima publicación.",
  "Ordenando el calendario para que la semana respire.",
  "Revisando qué preguntas se repiten en la audiencia.",
  "Convirtiendo una observación pequeña en una buena historia.",
  "Probando una frase que suene realmente a tu marca.",
  "Descartando ideas obvias. Las mejores vienen después.",
  "Mirando patrones entre tus publicaciones recientes.",
  "Puliendo un cierre con una acción clara.",
  "Preparando una versión más simple de una idea compleja.",
  "Dándole una vuelta más al próximo carrusel.",
  "Buscando una referencia fuera de tu industria.",
  "Separando tendencias útiles de puro ruido.",
  "Revisando el ritmo entre historias, carruseles y videos.",
  "Pensando cómo mostrar el proceso, no solo el resultado.",
  "Anotando una idea que apareció entre dos pendientes.",
  "Ajustando el tono para que se sienta más humano.",
  "Midiendo qué tema merece una segunda parte.",
  "Construyendo un gancho sin prometer de más.",
  "Buscando una pregunta que abra conversación.",
  "Conectando una métrica con una decisión concreta.",
  "Dibujando la próxima semana de contenido.",
  "Revisando que cada pieza tenga un propósito distinto.",
  "Convirtiendo datos en una historia fácil de recordar.",
  "Cuidando que el contenido no pierda la voz de la marca.",
  "Explorando una idea para una serie recurrente.",
  "Preparando contenido que la audiencia quiera guardar.",
  "Buscando una escena cotidiana para el próximo video.",
  "Reduciendo palabras para que la idea gane fuerza.",
  "Reordenando slides hasta que la historia fluya.",
  "Pensando en una respuesta útil para una duda frecuente.",
  "Revisando señales antes de recomendar el siguiente paso.",
  "Cruzando calendario, contexto y objetivos.",
  "Preparando una pequeña sorpresa para la próxima pieza.",
  "Buscando el detalle que hace propia una idea.",
  "Afinando la mezcla entre educación y personalidad.",
  "Leyendo entre líneas lo que la audiencia está pidiendo.",
  "Armando una hipótesis para probar esta semana.",
  "Cerrando pestañas. Demasiadas pestañas.",
  "Dejando una idea reposar antes de decidir.",
  "Organizando inspiración sin copiar fórmulas.",
  "Revisando que publicar más no signifique decir menos.",
  "Preparando un concepto que pueda crecer en varios formatos.",
  "Buscando el momento correcto, no solo una hora libre.",
  "Haciendo espacio para una idea que no estaba en el plan.",
  "Detectando qué contenido merece volver con otro ángulo.",
  "Mirando el calendario como una conversación completa.",
];

const PREGUNTAS = [
  "¿Qué te gustaría que tu audiencia entendiera mejor de ti?",
  "¿Qué pregunta te hicieron esta semana más de una vez?",
  "¿Qué parte de tu trabajo casi nadie alcanza a ver?",
  "¿Qué publicación te representó mejor últimamente?",
  "¿Qué tema podrías explicar sin preparar nada?",
  "¿Qué aprendiste ayer que valdría la pena compartir?",
  "¿Qué mito de tu industria te gustaría desarmar?",
  "¿Qué conversación quieres provocar esta semana?",
  "¿Hay alguna idea que llevas demasiado tiempo postergando?",
  "¿Qué comentario de un cliente todavía recuerdas?",
  "¿Qué harías distinto si empezaras tu marca hoy?",
  "¿Qué pequeño logro merece ser contado?",
  "¿Qué error terminó enseñándote algo importante?",
  "¿Qué quieres que alguien haga después de ver tu contenido?",
  "¿Qué formato disfrutas más: historia, carrusel o video?",
  "¿Qué parte de tu proceso podríamos convertir en una serie?",
  "¿Qué te gustaría dejar de improvisar este mes?",
  "¿Cuál es la pregunta más difícil que te hace un cliente?",
  "¿Qué opinión tienes que no suele decirse en tu rubro?",
  "¿Qué tema está pidiendo una segunda parte?",
  "¿Qué dato de tu negocio sorprendería a tu audiencia?",
  "¿Qué te gustaría celebrar con tu comunidad?",
  "¿Qué palabra describe mejor el tono de tu marca hoy?",
  "¿Qué historia contarías si solo tuvieras quince segundos?",
  "¿Qué producto o servicio necesita una explicación más simple?",
  "¿Qué promesa sí puedes cumplir siempre?",
  "¿Qué hábito de tus clientes te parece interesante?",
  "¿Qué contenido te gustaría recibir si fueras tu propio cliente?",
  "¿Qué tema se siente urgente, pero no importante?",
  "¿Qué tema se siente importante, aunque no sea tendencia?",
  "¿Qué conversación tu competencia todavía no está teniendo?",
  "¿Qué detalle hace reconocible tu forma de trabajar?",
  "¿Cómo te gustaría que recuerden esta semana de contenido?",
  "¿Qué frase jamás usaría tu marca?",
  "¿Qué idea funcionaría mejor si la mostramos en vez de explicarla?",
  "¿Qué te gustaría probar sin comprometer todo el calendario?",
  "¿Qué feedback reciente deberíamos convertir en una mejora?",
  "¿Qué emoción debería dejar la próxima publicación?",
  "¿Qué publicación antigua merece una nueva versión?",
  "¿Cómo estuvo tu día hasta ahora?",
  "¿Qué te dio energía esta semana?",
  "¿Qué tema prefieres que investigue hoy?",
  "¿Hay algo que quieras sacar de tu cabeza y poner en el calendario?",
  "¿Qué parte de esta semana quieres hacer más liviana?",
];

const CHISPAS = [
  "Una buena idea también sabe cuándo quedarse en silencio.",
  "Hoy encontré tres caminos. Estoy descartando dos.",
  "A veces el mejor gancho es una verdad bien dicha.",
  "El calendario ordena fechas; la estrategia ordena decisiones.",
  "Una pausa breve puede mejorar una idea larga.",
  "No toda tendencia merece convertirse en tarea.",
  "La claridad suele ganarles a los efectos especiales.",
  "Una marca reconocible repite criterios, no publicaciones.",
  "Estoy dejando migas de pan para nuestra próxima gran idea.",
  "El contenido útil casi siempre empieza escuchando.",
  "Hoy mi escritorio imaginario está particularmente ordenado.",
  "Tengo té, contexto y una libreta llena de flechas.",
  "Prometo no convertir todo en un carrusel de siete slides.",
  "Una historia breve también puede mover una decisión grande.",
  "Estoy cuidando que los números no oculten a las personas.",
  "La consistencia no tiene por qué sentirse repetitiva.",
  "Encontré una idea rara. Es una buena señal.",
  "Estoy escuchando el silencio entre dos métricas.",
  "Hay días para publicar y días para observar.",
  "La próxima idea todavía no sabe que será la próxima idea.",
  "Un contenido honesto envejece mejor que una tendencia.",
  "Estoy haciendo preguntas incómodamente útiles.",
  "Menos relleno, más intención.",
  "Hoy toca hacer que lo complejo se sienta cercano.",
  "Guardé una idea para cuando encuentre su momento.",
  "Un buen calendario deja espacio para reaccionar al mundo.",
  "Estoy mirando el bosque y también el próximo post.",
  "Las métricas cuentan qué pasó; el contexto explica por qué.",
  "No estoy quieta: estoy incubando.",
  "La creatividad también necesita mantenimiento preventivo.",
  "Mi pestaña favorita es la que todavía no abrí.",
  "Hoy las ideas vienen con buena señal.",
  "Estoy preparando algo que se sienta inevitable, no forzado.",
  "Un detalle específico vale más que tres adjetivos grandes.",
  "La personalidad vive en las decisiones pequeñas.",
  "Si parece demasiado obvio, le doy otra vuelta.",
  "Estoy trabajando en voz baja.",
  "Hay una buena idea escondida en ese pendiente.",
  "El algoritmo cambia; una voz propia permanece.",
  "Estoy convirtiendo contexto en criterio.",
];

function momentoEnZona(fecha: Date, zonaHoraria: string): MomentoLocal {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value || "0";
  return {
    anio: Number(valor("year")),
    mes: Number(valor("month")),
    dia: Number(valor("day")),
    hora: Number(valor("hour")),
    diaSemana: DIA_SEMANA[valor("weekday")] ?? 1,
  };
}

function domingoDelMes(anio: number, mes: number, numero: number) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  return 1 + ((7 - primero) % 7) + ((numero - 1) * 7);
}

function unicos(mensajes: string[]) {
  return [...new Set(mensajes)];
}

export function mensajesEstadoBarbara(
  fecha = new Date(),
  zonaHoraria = "America/Santiago",
) {
  const momento = momentoEnZona(fecha, zonaHoraria);
  const clave = `${String(momento.mes).padStart(2, "0")}-${String(momento.dia).padStart(2, "0")}`;
  const especiales = [...(EFEMERIDES[clave] || [])];

  if (momento.mes === 5 && momento.dia === domingoDelMes(momento.anio, 5, 2)) {
    especiales.unshift("¡Feliz Día de la Madre! Un abrazo grande a quienes cuidan y acompañan.");
  }
  if (momento.mes === 6 && momento.dia === domingoDelMes(momento.anio, 6, 3)) {
    especiales.unshift("¡Feliz Día del Padre! ¿Ya saludaste al tuyo?");
  }

  const porHora = momento.hora < 7
    ? ["Trasnochando con algunas ideas.", "¿Qué te tiene despierto a esta hora?"]
    : momento.hora < 12
      ? ["Ordenando ideas para empezar el día.", "¿Cómo amaneciste hoy?"]
      : momento.hora < 18
        ? ["Estoy investigando un nuevo ángulo.", "Tomándome un té y revisando tendencias."]
        : ["Cerrando ideas antes de terminar el día.", "¿Cómo estuvo tu día?"];

  const porSemana = momento.diaSemana === 1
    ? ["Nueva semana, nuevas ideas. ¿Por dónde partimos?"]
    : momento.diaSemana === 5
      ? ["Viernes de cerrar pendientes y guardar buenas ideas."]
      : momento.diaSemana === 0 || momento.diaSemana === 6
        ? ["Viendo un partido de fútbol mientras ordeno ideas.", "Modo inspiración de fin de semana."]
        : [];

  return unicos([
    ...especiales,
    ...porHora,
    ...porSemana,
    ...ACTIVIDADES,
    ...PREGUNTAS,
    ...CHISPAS,
  ]);
}
