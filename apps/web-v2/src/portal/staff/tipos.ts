/** Las columnas reales de `public.clientes` (ver portal_schema.sql). */
export type Cliente = {
  id: string;
  /** Opcional a propósito: sin correo el cliente no entra al portal, pero
   *  igual se administra desde acá. Ver 20260817_cliente_nombre.sql. */
  email: string | null;
  nombre: string | null;
  /** La columna existe desde 20260814_portal_telefono_y_baja.sql; el editor
   *  del equipo nunca la tuvo hasta el 21-ago. */
  telefono: string | null;
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

/**
 * Un cobro: qué se le cobra a un cliente. Ver 20260821_cobros.sql.
 *
 * Reemplaza a `clientes.setup_monto`/`mensual_monto`, que solo daban para un
 * trato por cliente. Un cliente puede tener los cobros que haga falta, o
 * ninguno.
 */
export type Cobro = {
  id: string;
  cliente_id: string;
  /** Estable dentro del cliente. Es el nombre cuando `titulo` va vacío. */
  numero: number;
  tipo: "unico" | "mensual";
  /** Libre y opcional; sin título se muestra "Cobro N". */
  titulo: string | null;
  monto: number;
  moneda: string;
  /** único: pendiente|pagado|anulado · mensual: pendiente|activa|pausada|cancelada */
  estado: string;
  /** Solo mensual. */
  proximo_cobro: string | null;
  /** Solo mensual: la suscripción real en Mercado Pago. */
  mp_preapproval_id: string | null;
  /** Solo pago único: la preferencia de Checkout Pro que originó el link. */
  mp_preference_id?: string | null;
  mp_cuenta_id?: string | null;
  mp_checkout_creado_en?: string | null;
  mp_ultima_sincronizacion?: string | null;
  link: string | null;
  ultimo_recordatorio_en: string | null;
  creado_por: string | null;
  creado_en: string | null;
};

/** Cómo se llama un cobro en pantalla: su título, o "Cobro N" si no tiene. */
export const nombreCobro = (c: Pick<Cobro, "titulo" | "numero">) =>
  c.titulo?.trim() || `Cobro ${c.numero}`;

export const ESTADOS_COBRO_UNICO = ["pendiente", "pagado", "anulado"];
export const ESTADOS_COBRO_MENSUAL = ["pendiente", "activa", "pausada", "cancelada"];

/** Filas de `public.pagos`. */
export type Pago = {
  id: string;
  cliente_id: string;
  /** A qué cobro pertenece. Null solo en pagos huérfanos de un cobro borrado. */
  cobro_id: string | null;
  tipo: string | null;
  /** Mes cobrado, solo en los mensuales. Evita duplicar el mes en un reintento. */
  periodo: string | null;
  monto: number | null;
  estado: string | null;
  mp_id: string | null;
  mp_status_detail?: string | null;
  mp_payment_type?: string | null;
  mp_payment_method_id?: string | null;
  mp_fee_amount?: number | null;
  mp_net_received?: number | null;
  mp_refunded_amount?: number | null;
  mp_ultima_sincronizacion?: string | null;
  mp_notificado_en?: string | null;
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
  serie_id: string | null;
  recurrencia_reglas: Array<{ dia: number; hora: string }> | null;
  recurrencia_desde: string | null;
  recurrencia_hasta: string | null;
};

/** Perfiles del equipo, para elegir invitados (ver reuniones.sql). */
export type PerfilAdmin = {
  id: string;
  email: string;
  nombre: string;
};

/** Datos de cuentas, accesos y notas rápidas del equipo — Organización > Notas internas. */
export type NotaInterna = {
  id: string;
  titulo: string;
  contenido: string | null;
  categoria: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  archivo_peso_bytes: number | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
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

/**
 * Lo que ya vendemos, agrupado por producto.
 *
 * El campo "Plan o servicio" sigue siendo LIBRE: esto es un atajo, no una
 * jaula. Los tres planes fijos de antes (Esencial/Pro/Premium) nunca calzaron
 * con lo que de verdad se vende, y por eso están fuera.
 *
 * ⚠️ Los nombres de "Página web" salieron del funnel de captación. Si el
 * comercial los llama distinto, se corrigen ACÁ y cambian en todo el portal.
 */
export const CATALOGO_PLANES: { grupo: string; planes: string[] }[] = [
  { grupo: "Bárbara", planes: ["Bárbara", "Bárbara Go", "Bárbara Plus"] },
  { grupo: "Página web", planes: ["Landing", "Completa", "A medida"] },
];

/** Filas de `public.suscriptores_ratia`. Ver 20260821_suscriptores_ratia.sql. */
export type SuscriptorRatia = {
  id: string;
  nombre: string;
  email: string | null;
  telegram: string | null;
  telefono: string | null;
  notas: string | null;
  plan: string | null;
  monto: number;
  moneda: string;
  estado: string;
  inicio: string | null;
  proximo_cobro: string | null;
  flow_subscription_id: string | null;
  creado_por: string | null;
  creado_en: string | null;
};

/** Un ingreso de Rat.IA tal como lo escribe el Worker de Flow. */
export type IngresoRatia = {
  id: string;
  monto_bruto: number;
  tipo: string;
  plan: string | null;
  flow_subscription_id: string | null;
  creado_en: string | null;
};

/** Los planes con que se vende Rat.IA. Es un producto propio, no un servicio
 *  de agencia: sus suscriptores viven aparte de `clientes`. */
export const PLANES_RATIA = [
  { id: "fundador", nombre: "Fundador", monto: 2990 },
  { id: "regular", nombre: "Regular", monto: 4990 },
];

/** Todos en una lista plana, para sugerencias y validaciones. */
export const PLANES = CATALOGO_PLANES.flatMap((g) => g.planes);
export const MONEDAS = ["CLP", "COP", "PEN", "USD"];
export const ESTADOS_SETUP = ["pendiente", "pagado"];
export const ESTADOS_MENSUAL = ["pendiente", "al_dia", "vencido"];
