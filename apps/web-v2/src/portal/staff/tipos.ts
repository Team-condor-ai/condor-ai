/** Las columnas reales de `public.clientes` (ver portal_schema.sql). */
export type Cliente = {
  id: string;
  email: string;
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
  creado_en: string | null;
};

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
  creado_en: string | null;
};

export const CATEGORIAS_BIBLIOTECA = [
  "presentacion",
  "propuesta",
  "marca",
  "otro",
] as const;

export const PLANES = ["Esencial", "Pro", "Premium"];
export const MONEDAS = ["CLP", "COP", "PEN", "USD"];
export const ESTADOS_SETUP = ["pendiente", "pagado"];
export const ESTADOS_MENSUAL = ["pendiente", "al_dia", "vencido"];
