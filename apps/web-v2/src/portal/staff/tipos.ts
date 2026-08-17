/** Las columnas reales de `public.clientes` (ver portal_schema.sql). */
export type Cliente = {
  id: string;
  /** Opcional a propósito: sin correo el cliente no entra al portal, pero
   *  igual se administra desde acá. Ver 20260817_cliente_nombre.sql. */
  email: string | null;
  nombre: string | null;
  negocio: string | null;
  plan: string | null;
  concepto: string | null;
  setup_monto: number | null;
  mensual_monto: number | null;
  moneda: string | null;
  setup_estado: string | null;
  mensual_estado: string | null;
  proximo_cobro: string | null;
  link_setup: string | null;
  link_mensual: string | null;
  link_paypal: string | null;
  web_url: string | null;
  archivado: boolean | null;
  cobra_setup: boolean | null;
  cobra_mensual: boolean | null;
  notas: string | null;
  creado_en: string | null;
};

/** Filas de `public.pagos`. */
export type Pago = {
  id: string;
  cliente_id: string;
  tipo: string | null;
  monto: number | null;
  estado: string | null;
  mp_id: string | null;
  detalle: string | null;
  fecha: string | null;
  metodo: string | null;
  /** `init_point` de Mercado Pago, guardado para poder reenviarlo sin generar
   *  un cobro nuevo. Ver 20260817_pagos_link.sql. */
  link: string | null;
  creado_en: string | null;
};

/** Cómo entra la plata. No todo pasa por Mercado Pago. */
export const METODOS_PAGO = [
  "Transferencia",
  "Mercado Pago",
  "PayPal",
  "Boleta de garantía",
  "Efectivo",
  "Otro",
];

export const ESTADOS_PAGO = ["pendiente", "pagado", "rechazado"];

/** Las columnas reales de `public.productos` (ver 20260817_productos.sql). */
export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  caracteristicas: string[] | null;
  precio_setup_sugerido: number | null;
  precio_mensual_sugerido: number | null;
  moneda: string | null;
  activo: boolean | null;
  repo_url: string | null;
  sitio_url: string | null;
  docs_url: string | null;
  creado_en: string | null;
};

/** Filas de `public.reuniones` (ver reuniones.sql + reuniones_fix.sql). */
export type Reunion = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_hora: string;
  duracion_min: number | null;
  cliente: string | null;
  meet_url: string | null;
  creado_por: string | null;
  created_at: string | null;
};

/** Perfiles del equipo, para elegir invitados (ver reuniones.sql). */
export type PerfilAdmin = {
  id: string;
  email: string;
  nombre: string;
};

/** Archivos subidos a `public.biblioteca`. */
export type ArchivoBiblioteca = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  peso_bytes: number | null;
  mime: string | null;
  carpeta_id: string | null;
  creado_en: string | null;
};

/** Planes de suscripción con link compartido de Mercado Pago. */
export type PlanSuscripcion = {
  id: string;
  grupo: string;
  nombre: string;
  descripcion: string | null;
  monto: number;
  moneda: string;
  frecuencia_meses: number;
  mp_plan_id: string | null;
  init_point: string | null;
  activo: boolean;
  creado_en: string | null;
};

/** Quien se suscribió por el link. Los crea el webhook solo, al pagar. */
export type Suscriptor = {
  id: string;
  plan_id: string | null;
  email: string;
  nombre: string | null;
  telegram: string | null;
  mp_preapproval_id: string | null;
  estado: string;
  monto: number | null;
  moneda: string | null;
  ultimo_pago: string | null;
  proximo_cobro: string | null;
  creado_en: string | null;
};

/** Carpetas de la biblioteca. `padre_id` null = está en la raíz. */
export type CarpetaBiblioteca = {
  id: string;
  nombre: string;
  padre_id: string | null;
  creado_en: string | null;
};

export const PLANES = ["Esencial", "Pro", "Premium"];
export const MONEDAS = ["CLP", "COP", "PEN", "USD"];
export const ESTADOS_SETUP = ["pendiente", "pagado"];
export const ESTADOS_MENSUAL = ["pendiente", "al_dia", "vencido"];
