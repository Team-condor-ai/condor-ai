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
  actualizado_en: string | null;
};

export type BarbaraChat = {
  id: string;
  barbara_cliente_id: string;
  remitente: "cliente" | "barbara" | "staff";
  mensaje: string;
  telegram_message_id: string | null;
  creado_en: string | null;
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

export const TIPOS_CONTENIDO = [
  { id: "ugc", texto: "UGC" },
  { id: "informativo", texto: "Informativo" },
  { id: "educativo", texto: "Educativo" },
  { id: "promocional", texto: "Promocional" },
  { id: "detras_camara", texto: "Detrás de cámara" },
] as const;

/** Máximo de colores en la paleta de marca — pedido explícito: "hasta ~6". */
export const MAX_COLORES_PALETA = 6;
