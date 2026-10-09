/* Plan del guion: una sola fuente para el dock, las migas, el índice y ⌘K.
   Cada sección existe en index.html con el mismo id. */
export const CAPITULOS = [
  { id: "identidad", n: "I", nombre: "Identidad", que: "El cóndor, el logo, las letras y los productos." },
  { id: "material", n: "II", nombre: "Material", que: "Vidrio líquido que refracta de verdad." },
  { id: "movimiento", n: "III", nombre: "Marca en movimiento", que: "El cóndor se arma, espera, trabaja y vuela." },
  { id: "fundamentos", n: "IV", nombre: "Fundamentos", que: "Color, tipografía, forma y curvas." },
  { id: "kit", n: "V", nombre: "Kit", que: "Las piezas que usa todo." },
  { id: "formularios", n: "VI", nombre: "Formularios", que: "Campos y pasos para pedir datos sin fricción." },
  { id: "patrones", n: "VII", nombre: "Patrones", que: "Navegar, desplazarse y leer datos." },
  { id: "aplicaciones", n: "VIII", nombre: "Aplicaciones", que: "Donde se posa la marca." },
];

export const SECCIONES = [
  { id: "inicio", nombre: "Inicio", cap: "identidad" },
  { id: "condor", nombre: "El cóndor", cap: "identidad" },
  { id: "logo", nombre: "Logo", cap: "identidad" },
  { id: "letras", nombre: "Letras", cap: "identidad" },
  { id: "productos", nombre: "Productos", cap: "identidad" },
  { id: "vidrio", nombre: "Vidrio líquido", cap: "material" },
  { id: "superficies", nombre: "Superficies", cap: "material" },
  { id: "firmas", nombre: "Firmas", cap: "movimiento" },
  { id: "carga", nombre: "La carga", cap: "movimiento" },
  { id: "vuelo", nombre: "Vuelo con scroll", cap: "movimiento" },
  { id: "momentos", nombre: "Momentos de marca", cap: "movimiento" },
  { id: "color", nombre: "Color", cap: "fundamentos" },
  { id: "tipografia", nombre: "Tipografía", cap: "fundamentos" },
  { id: "forma", nombre: "Forma y curvas", cap: "fundamentos" },
  { id: "botones", nombre: "Botones", cap: "kit" },
  { id: "controles", nombre: "Controles", cap: "kit" },
  { id: "estados", nombre: "Carga y estados", cap: "kit" },
  { id: "avisos", nombre: "Avisos", cap: "kit" },
  { id: "popups", nombre: "Menús y popups", cap: "kit" },
  { id: "campos", nombre: "Campos", cap: "formularios" },
  { id: "pasos", nombre: "Stepper", cap: "formularios" },
  { id: "navegacion", nombre: "Navegación", cap: "patrones" },
  { id: "scrollers", nombre: "Scrollers", cap: "patrones" },
  { id: "datos", nombre: "Datos", cap: "patrones" },
  { id: "preguntas", nombre: "Preguntas", cap: "patrones" },
  { id: "sitio", nombre: "Sitio", cap: "aplicaciones" },
  { id: "piezas", nombre: "Redes y papelería", cap: "aplicaciones" },
  { id: "archivos", nombre: "Archivos", cap: "aplicaciones" },
];

export const capituloDe = (idSeccion) => CAPITULOS.find((c) => c.id === SECCIONES.find((s) => s.id === idSeccion)?.cap);
export const seccionesDe = (idCap) => SECCIONES.filter((s) => s.cap === idCap);
