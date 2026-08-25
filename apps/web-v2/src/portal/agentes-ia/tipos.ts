/**
 * Tipos del módulo "Agentes IA > Bárbara".
 *
 * Las columnas exactas salen de las migraciones:
 * `supabase/migrations/20260815141239_barbara_agentes_ia.sql` y
 * `20260815150000_barbara_memoria_y_chat.sql`. Estas tablas YA EXISTEN con su
 * RLS aplicado — este archivo solo describe su forma, no las toca.
 *
 * Los nombres de campo de `barbara_formulario` calzan EXACTO con lo que lee
 * `services/barbara/clientes.mjs` (el motor de generación): cambiar uno acá
 * sin cambiarlo allá rompe la generación de contenido en silencio.
 */

export type BarbaraCliente = {
  id: string;
  cliente_id: string;
  plan: string;
  rubro: string | null;
  activo: boolean | null;
  telegram_chat_id: string | null;
  creado_en: string | null;
};

/** Fila combinada para la lista: `barbara_clientes` + el negocio del cliente
 * (join a `clientes`) + si está bloqueado (join a `barbara_correcciones`). */
export type BarbaraClienteFila = BarbaraCliente & {
  clientes: { negocio: string | null; email: string } | null;
  barbara_correcciones: { bloqueado: boolean | null }[] | null;
};

export type ColorMarca = { hex: string; uso: string };

export type BarbaraBrandBook = {
  id: string;
  barbara_cliente_id: string;
  paleta_colores: ColorMarca[] | null;
  tipografia: string | null;
  logo_url: string | null;
  detalles: string | null;
  plantilla: string | null;
  actualizado_en: string | null;
};

/* Las plantillas de carrusel. Tienen que calzar con las de
   `services/barbara/plantillas.mjs` — si acá aparece una que allá no existe,
   el motor cae a la de por defecto sin avisar. */
export const PLANTILLAS_CARRUSEL = [
  { id: "editorial", nombre: "Editorial",
    descripcion: "Serif grande sobre fondo claro. Formal y con autoridad." },
  { id: "bloque", nombre: "Bloque",
    descripcion: "Color pleno de marca, titular enorme. Directo." },
  { id: "ficha", nombre: "Ficha",
    descripcion: "Tarjeta blanca con número. Para listas y pasos." },
  { id: "foto", nombre: "Foto",
    descripcion: "Fotografía de fondo con el texto encima." },
] as const;

export type BarbaraFormulario = {
  id: string;
  barbara_cliente_id: string;
  tipo_contenido: string[] | null;
  publico_objetivo: string | null;
  tono: string | null;
  restricciones: string | null;
  ejemplos_referencia: string | null;
  producto_destacar: string | null;
  /**
   * Mezcla de pilares de contenido, p.ej. {"educar":40,"mostrar":25}.
   * `null` = la marca no la definió y el motor usa MEZCLA_POR_DEFECTO.
   * Acepta pesos crudos o porcentajes: `services/barbara/pilares.mjs` los
   * normaliza igual, así que la UI puede pedir lo que le sea más natural.
   */
  pilares: Record<string, number> | null;
  actualizado_en: string | null;
};

/**
 * Los pilares de contenido. Tienen que coincidir EXACTO con las claves de
 * `PILARES` en `services/barbara/pilares.mjs`: una clave que no exista allá
 * la descarta el motor en silencio y el reparto queda distinto al que el
 * cliente vio en pantalla.
 */
export const PILARES_CONTENIDO = [
  { id: "educar", nombre: "Educar",
    ayuda: "Enseña algo útil del rubro sin vender. Es lo que hace que te sigan." },
  { id: "mostrar", nombre: "Mostrar / Vender",
    ayuda: "Producto, servicio u oferta concreta." },
  { id: "autoridad", nombre: "Autoridad / Prueba",
    ayuda: "Datos y resultados medibles que respalden lo que dice la marca." },
  { id: "comunidad", nombre: "Comunidad",
    ayuda: "Detrás de cámara, equipo, proceso. Hace que la marca se sienta humana." },
  { id: "prueba_social", nombre: "Prueba social",
    ayuda: "Testimonios y casos reales. Déjalo en 0 si aún no nos entregaste material: inventar un testimonio no es una opción." },
] as const;

/** Espejo de MEZCLA_POR_DEFECTO en pilares.mjs. */
export const MEZCLA_PILARES_DEFECTO: Record<string, number> = {
  educar: 40, mostrar: 25, autoridad: 20, comunidad: 15, prueba_social: 0,
};

export type BarbaraChat = {
  id: string;
  barbara_cliente_id: string;
  remitente: "cliente" | "barbara" | "staff";
  mensaje: string;
  telegram_message_id: string | null;
  creado_en: string | null;
};

export type BarbaraPieza = {
  id: string;
  barbara_cliente_id: string;
  fecha: string;
  tipo: string;
  angulo: string | null;
  contenido: { slides?: { titular: string; cuerpo: string }[]; clips?: { escena: string; duracion: number }[]; caption?: string; texto_en_pantalla?: string } | null;
  estado: "en_revision" | "requiere_ajuste" | "aprobada" | "publicada" | "historica";
  correcciones_pedidas: number | null;
  revision_comentario: string | null;
  revisada_en: string | null;
  canal_publicacion?: string | null;
  publicacion_url?: string | null;
  publicada_en?: string | null;
  creado_en: string;
};

export type BarbaraCorrecciones = {
  id: string;
  barbara_cliente_id: string;
  intentos_usados: number | null;
  bloqueado: boolean | null;
  desbloqueado_por: string | null;
  actualizado_en: string | null;
};

export const BARBARA_PLANES = ["barbara", "go", "plus"] as const;

/**
 * Cómo se muestra cada plan en toda la app — un solo lugar para el nombre,
 * el color del badge y la nota que lo distingue. Antes el plan se pintaba
 * como texto plano en minúscula (`barbara`/`go`/`plus`) y ni siquiera se
 * elegía al agregar un cliente: quedaba en "barbara" por defecto en
 * silencio. Acá se le da nombre propio y color a cada uno para que se vea
 * de un vistazo, sin tener que abrir la ficha.
 */
export const BARBARA_PLAN_INFO: Record<
  (typeof BARBARA_PLANES)[number],
  { nombre: string; pill: "gris" | "azul" | "ok"; nota?: string }
> = {
  barbara: { nombre: "Bárbara", pill: "gris" },
  go: { nombre: "Go", pill: "azul" },
  plus: { nombre: "Plus", pill: "ok", nota: "responde el chat" },
};

/** Capacidad mensual visible. El motor usa el mismo contrato en
 * `services/barbara/planes.mjs`; mantenerlos sincronizados es intencional. */
export const BARBARA_CUOTAS: Record<string, Record<"carrusel" | "historia" | "ugc", number>> = {
  barbara: { carrusel: 12, historia: 0, ugc: 0 },
  go: { carrusel: 12, historia: 20, ugc: 4 },
  plus: { carrusel: 12, historia: 20, ugc: 4 },
};

/** `plan` llega como `string` plano desde la base (no hay CHECK constraint).
 * Si algún día aparece un valor que no es de los 3 conocidos, esto evita que
 * la pantalla reviente — se muestra tal cual llegó, sin color asignado. */
export function infoPlan(plan: string) {
  return (
    BARBARA_PLAN_INFO[plan as keyof typeof BARBARA_PLAN_INFO] ?? {
      nombre: plan,
      pill: "gris" as const,
    }
  );
}

export const TIPOS_CONTENIDO = [
  { id: "ugc", texto: "UGC" },
  { id: "informativo", texto: "Informativo" },
  { id: "educativo", texto: "Educativo" },
  { id: "promocional", texto: "Promocional" },
  { id: "detras_camara", texto: "Detrás de cámara" },
] as const;

/** Máximo de colores en la paleta de marca — pedido explícito: "hasta ~6". */
export const MAX_COLORES_PALETA = 6;

/**
 * Los nodos de memoria del módulo "Memoria" (estilo Obsidian): gustos, datos
 * y el perfil sintetizado. Las CORRECCIONES viven aparte, en `barbara_reglas`
 * — esta tabla es para lo que no tenía casa todavía.
 */
export type BarbaraMemoriaNodo = {
  id: string;
  barbara_cliente_id: string;
  tipo: "gusto" | "dato" | "perfil";
  titulo: string;
  contenido: string;
  peso: number;
  activo: boolean;
  origen: string | null;
  creado_en: string;
  actualizado_en: string;
};

/** Un tipo de nodo del grafo de memoria, unificando las 3 fuentes reales:
 *  `barbara_reglas` (correcciones), `barbara_memoria_nodos` (gusto/dato/perfil)
 *  y `barbara_patrones` activos (patrón global). Coincide con la paleta que
 *  ya usa `ReglasAprendidas.tsx` para las categorías de una regla. */
export const TIPO_NODO_MEMORIA: Record<
  "correccion" | "gusto" | "dato" | "perfil" | "patron",
  { nombre: string; color: string }
> = {
  correccion: { nombre: "Corrección", color: "#5B8DEF" },
  gusto: { nombre: "Gusto", color: "#3FA45E" },
  dato: { nombre: "Dato", color: "#8A8F98" },
  perfil: { nombre: "Perfil", color: "#B36BE8" },
  patron: { nombre: "Patrón global", color: "#E9AC17" },
};
