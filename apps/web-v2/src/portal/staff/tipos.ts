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

export const PLANES = ["Esencial", "Pro", "Premium"];
export const MONEDAS = ["CLP", "COP", "PEN", "USD"];
export const ESTADOS_SETUP = ["pendiente", "pagado"];
export const ESTADOS_MENSUAL = ["pendiente", "al_dia", "vencido"];
