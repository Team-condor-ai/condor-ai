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
  /** "sites" | "track" | "media" | null (sin clasificar). Ver
   *  20260902_clientes_linea.sql. Ecommerce NO es un valor válido acá:
   *  esos clientes viven aparte, ligados a Shopify (ver
   *  contabilidad/IngresoEcommerce.tsx), no en esta tabla. */
  linea: string | null;
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
  /** Invitado externo: lo llena `agendar-publico` cuando reserva un lead. */
  contacto: string | null;
  email: string | null;
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

export type DatosCuentaInterna = {
  entidad?: string;
  titular?: string;
  usuario?: string;
  clave?: string;
  url?: string;
};

export type ArchivoInterno = {
  url: string;
  nombre: string;
  peso_bytes?: number | null;
  tipo?: string | null;
};

/** Datos sensibles y contexto operativo — Organización > Información interna. */
export type NotaInterna = {
  id: string;
  titulo: string;
  contenido: string | null;
  categoria: string;
  tipo: "nota" | "cuenta" | "archivo";
  cliente_id: string | null;
  datos_cuenta: DatosCuentaInterna | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  archivo_peso_bytes: number | null;
  archivos?: ArchivoInterno[] | null;
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

/** Un canal donde se encontró al prospecto, con cómo ubicarlo ahí (2-sept:
 *  Joaquín pidió guardar el @/usuario/nombre exacto, no solo marcar el
 *  canal — sin eso, "está en Instagram" no le sirve a nadie que necesite
 *  volver a escribirle). Un prospecto puede tener varios. */
export type CanalProspecto = { canal: string; handle: string };

/** Filas de `public.prospectos` — CRM de prospección (ver prospectos.sql). */
export type Prospecto = {
  id: string;
  linea: string;
  negocio: string;
  contacto: string | null;
  canales: CanalProspecto[];
  estado: string;
  notas: string | null;
  cerrado: boolean;
  creado_por_email: string | null;
  creado_por_nombre: string | null;
  ultima_actividad_en: string;
  creado_en: string;
};

/** Los canales donde se busca prospectos, con su color de marca. */
export const CANALES_PROSPECTO = [
  { id: "instagram", texto: "Instagram", color: "#E1306C" },
  { id: "facebook", texto: "Facebook", color: "#1877F2" },
  { id: "maps", texto: "Google Maps", color: "#34A853" },
  { id: "linkedin", texto: "LinkedIn", color: "#0A66C2" },
] as const;

/**
 * Los 8 estados del seguimiento, en orden, con cuántos días se espera antes
 * de avisar que hay que volver a escribirle. El espacio crece con cada
 * seguimiento — pedido explícito de Joaquín: "mientras más seguimiento, más
 * tiempo entre medio" — porque insistir todos los días a los 20 días de
 * silencio quema al prospecto más rápido de lo que lo convierte.
 *
 * `recien_contactado`, `cerrado` y `nunca_contesto` son los únicos por los
 * que un prospecto puede entrar o terminar; los `seguimiento_N` son pasos
 * intermedios. `cerrado`/`nunca_contesto` no generan más alertas — ya no hay
 * nada que seguir.
 */
export const ESTADOS_PROSPECTO: { id: string; texto: string; diasProximo: number | null }[] = [
  { id: "recien_contactado", texto: "Recién contactado", diasProximo: 3 },
  { id: "seguimiento_1", texto: "1er seguimiento", diasProximo: 5 },
  { id: "seguimiento_2", texto: "2do seguimiento", diasProximo: 7 },
  { id: "seguimiento_3", texto: "3er seguimiento", diasProximo: 10 },
  { id: "seguimiento_4", texto: "4to seguimiento", diasProximo: 14 },
  { id: "seguimiento_5", texto: "5to seguimiento", diasProximo: 14 },
  { id: "nunca_contesto", texto: "Nunca contestó", diasProximo: null },
  { id: "cerrado", texto: "Cerrado", diasProximo: null },
];

export const textoEstadoProspecto = (id: string) =>
  ESTADOS_PROSPECTO.find((e) => e.id === id)?.texto ?? id;

/**
 * Días que faltan para que un prospecto necesite seguimiento (negativo =
 * atrasado). `null` en un estado sin próximo paso (cerrado / nunca contestó).
 */
export function diasParaSeguimiento(p: Pick<Prospecto, "estado" | "ultima_actividad_en">): number | null {
  const cfg = ESTADOS_PROSPECTO.find((e) => e.id === p.estado);
  if (!cfg || cfg.diasProximo == null) return null;
  const desde = new Date(p.ultima_actividad_en).getTime();
  const limite = desde + cfg.diasProximo * 86400000;
  return Math.ceil((limite - Date.now()) / 86400000);
}

/**
 * El equipo real de Cóndor.ai: correo, nombre, rol (igual al que muestra
 * condorai.cl en "Nosotros"), foto (recortada de esa misma web pública, ver
 * `public/assets/avatares/`) y meta semanal de prospección (2-sept-2026,
 * pedido explícito de Joaquín — corrige la cifra inicial de "70 entre
 * Joaquín y Max": Alejandro también prospecta, con su propia meta).
 *
 * Se reusa en tres lugares: la tarjeta de usuario del menú lateral (foto +
 * rol en vez del correo crudo), la columna/carpeta de responsable en
 * Prospección, y el cálculo de cumplimiento diario/semanal.
 */
export const EQUIPO_CONDOR: { email: string; nombre: string; rol: string; foto: string; metaSemanal: number }[] = [
  { email: "j.ignaciomunozsilva@gmail.com", nombre: "Joaquín", rol: "Cofundador & CEO", foto: "/assets/avatares/joaquin-mini.jpg", metaSemanal: 50 },
  { email: "maximilianopinocv@gmail.com", nombre: "Maximiliano", rol: "Cofundador · Ing. Comercial y Desarrollo", foto: "/assets/avatares/maximiliano-mini.jpg", metaSemanal: 50 },
  { email: "alejandrotobarq@gmail.com", nombre: "Alejandro", rol: "Cofundador & Backend", foto: "/assets/avatares/alejandro-mini.jpg", metaSemanal: 30 },
  // Samuel se suma a prospección el 2-sept-2026 (pedido explícito de
  // Joaquín). Sin foto real todavía -- placeholder anónimo genérico
  // (mismo lenguaje visual que el "sin foto de perfil" de WhatsApp/otras
  // apps, no es el asset real de ninguna). `metaSemanal: 10` es
  // PROVISORIO: Joaquín solo dio un número para "esta semana" (ver
  // METAS_SEMANA_ESPECIAL) y no una meta de régimen normal -- se usa el
  // mismo valor acá hasta que confirme una meta de semana completa.
  { email: "samuelisaacospitiaquintero@gmail.com", nombre: "Samuel", rol: "Arquitecto de Software", foto: "/assets/avatares/samuel-mini.jpg", metaSemanal: 10 },
];

/** Compatibilidad: mismo contenido que se usaba antes bajo este nombre. */
export const METAS_SEMANALES_PROSPECCION = EQUIPO_CONDOR.map((p) => ({ email: p.email, nombre: p.nombre, meta: p.metaSemanal }));

/**
 * Metas semanales EXCEPCIONALES, por semana (clave = lunes de esa semana,
 * ISO). Pedido el 2-sept-2026 (miércoles): la semana ya iba a mitad de
 * camino cuando se armó el CRM, así que Joaquín fijó una meta más baja
 * SOLO para esa semana en vez de exigir la meta completa con medio plazo
 * -- "para que el viernes revisemos" con un número que sí es alcanzable.
 * `metaEfectiva()` usa esto si existe una entrada para la semana en
 * curso; si no, cae al `metaSemanal` de régimen normal de EQUIPO_CONDOR.
 */
export const METAS_SEMANA_ESPECIAL: { lunes: string; metas: Record<string, number> }[] = [
  {
    lunes: "2026-08-31",
    metas: {
      "j.ignaciomunozsilva@gmail.com": 20,
      "maximilianopinocv@gmail.com": 15,
      "alejandrotobarq@gmail.com": 10,
      "samuelisaacospitiaquintero@gmail.com": 10,
    },
  },
];

/** La meta que de verdad aplica esta semana: la excepción si existe, si no
 *  la de régimen normal. */
export function metaEfectiva(persona: { email: string; metaSemanal: number }, ahora: Date = new Date()): number {
  const lunes = semanaLaboral(ahora).inicio.toISOString().slice(0, 10);
  const especial = METAS_SEMANA_ESPECIAL.find((s) => s.lunes === lunes);
  return especial?.metas[persona.email] ?? persona.metaSemanal;
}

/**
 * La semana laboral de prospección: lunes 00:00 a viernes 20:00 -- el
 * corte que Joaquín fijó para la reunión comercial de los viernes
 * (ajustado de 19:00 a 20:00 el 2-sept-2026).
 */
export function semanaLaboral(ahora: Date = new Date()) {
  const dia = ahora.getDay(); // 0=domingo ... 5=viernes ... 6=sábado
  const diasDesdeLunes = (dia + 6) % 7;
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - diasDesdeLunes);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 4);
  fin.setHours(20, 0, 0, 0);
  return { inicio, fin };
}

/**
 * Qué fracción de la semana laboral ya pasó (0 a 1). Sirve para no exigirle
 * a alguien el 100% de la meta semanal un miércoles a mitad de tarde --el
 * caso real que motivó esto, 2-sept-2026: el CRM recién se construyó un
 * miércoles, así que la primera semana ya arrancaba con menos de la mitad
 * del tiempo disponible.
 */
export function fraccionSemanaTranscurrida(ahora: Date = new Date()): number {
  const { inicio, fin } = semanaLaboral(ahora);
  const t = ahora.getTime();
  if (t <= inicio.getTime()) return 0;
  if (t >= fin.getTime()) return 1;
  return (t - inicio.getTime()) / (fin.getTime() - inicio.getTime());
}

export const esViernesLaboral = (ahora: Date = new Date()) => ahora.getDay() === 5 && ahora < semanaLaboral(ahora).fin;

/* ══════════════════════════════════════════════════════════════════════
   MARKETING — calendario de contenido + seguimiento diario en Instagram
   (2-sept-2026, pedido de Joaquín)

   DOS TAREAS DISTINTAS, DOS TABLAS DISTINTAS
   ---------------------------------------------------------------------
   1. Contenido: 4 días de la semana (lun/mar/jue/vie) tienen un tema fijo
      y un responsable fijo -- se publica en Instagram, LinkedIn, TikTok y
      Facebook, y hay que poder marcar cada red por separado (no solo
      "publicado sí/no": puede quedar publicado en 3 de 4).
   2. Seguimiento: TODOS los días de la semana hay que seguir a 200
      cuentas desde @condor.ai (para que varias devuelvan el follow).
      Samuel lunes a jueves, Alejandro viernes a domingo.

   Por qué no se "crean" filas a mano como en Prospección: acá el
   calendario es fijo y se repite cada semana -- el frontend genera
   (upsert, sin pisar lo que ya existe) las filas de la semana en curso
   al entrar al módulo, y de ahí en más solo se marcan casilleros.

   EL CONTADOR "EN TIEMPO REAL" DE SEGUIDORES -- LO QUE SE INVESTIGÓ
   ---------------------------------------------------------------------
   Blotato NO tiene ningún endpoint de analíticas/seguidores hoy (está en
   su roadmap, confirmado en su propia documentación) -- no hay nada que
   conectar ahí todavía. La API oficial de Instagram (Graph API, cuentas
   Business/Creator) SÍ expone `followers_count` y `follows_count` de
   solo lectura con un token válido -- es el camino correcto el día que
   se quiera automatizar esto de verdad, pero necesita que la cuenta de
   Instagram de Cóndor.ai sea Business/Creator y un token de Meta, que
   Joaquín tiene que generar (no es algo que se pueda inventar acá).
   AUTOMATIZAR LA ACCIÓN DE SEGUIR SÍ está descartada: viola los términos
   de servicio de Instagram, mismo tipo de riesgo que ya se descartó con
   el scraping de Facebook para prospección.

   Mientras tanto, el conteo de "cuántas cuentas seguimos esta semana" SÍ
   es 100% real sin depender de ninguna API externa -- sale de sumar
   `cantidad` en `marketing_seguimiento_diario`, que es la propia acción
   que la persona ya registra. El total de seguidores de la cuenta
   (`marketing_seguidores_snapshot`) queda SIN un campo manual en la UI
   (se sacó el 2-sept-2026 a pedido de Joaquín): la tabla se deja lista
   para que, el día que exista el token de Meta, un job la llene solo
   -- no tiene sentido pedirle a alguien que lo anote a mano una sola vez
   para después reemplazarlo por algo automático. */

export type TemaContenido = "noticias_ia" | "carrusel_educativo" | "frase_motivacional" | "digitalizar_nicho";

export const TEMAS_CONTENIDO: Record<TemaContenido, string> = {
  noticias_ia: "Últimas 7 noticias de IA en el mundo",
  carrusel_educativo: "Carrusel educativo",
  frase_motivacional: "Frase motivacional",
  digitalizar_nicho: "Digitalizar algún nicho",
};

/** El calendario fijo de contenido, PARA SIEMPRE: día de la semana (JS:
 *  1=lunes...5=viernes) → tema + responsable. No es "de esta semana", es
 *  la regla permanente -- `generar-semana.mjs` (cron semanal, ver
 *  .github/workflows/marketing-generar-semana.yml) y `asegurarSemana()`
 *  en Marketing.tsx la leen para crear las filas de cada semana nueva. */
export const CALENDARIO_CONTENIDO: { dow: number; tema: TemaContenido; email: string }[] = [
  { dow: 1, tema: "noticias_ia", email: "maximilianopinocv@gmail.com" },
  { dow: 2, tema: "carrusel_educativo", email: "j.ignaciomunozsilva@gmail.com" },
  { dow: 4, tema: "frase_motivacional", email: "j.ignaciomunozsilva@gmail.com" },
  { dow: 5, tema: "digitalizar_nicho", email: "maximilianopinocv@gmail.com" },
];

/**
 * Excepciones puntuales al calendario de arriba, por semana (clave =
 * lunes ISO). Hoy solo tiene una: la semana del 31-ago-2026 arrancó
 * mitad de camino (el módulo se armó un miércoles en la noche), así que
 * lunes y martes de ESA semana no cuentan -- ya habían pasado sin que el
 * módulo existiera, y sería injusto marcarlos como incumplidos. Solo
 * jueves y viernes de esa semana generan tarea. Semanas futuras usan el
 * calendario completo salvo que se agregue una excepción nueva acá.
 */
export const EXCEPCIONES_CONTENIDO_SEMANA: { lunes: string; diasValidos: number[] }[] = [
  { lunes: "2026-08-31", diasValidos: [4, 5] },
];

/** Los `dow` de CALENDARIO_CONTENIDO que de verdad generan tarea para la
 *  semana cuyo lunes es `lunesIso` -- todos, salvo que haya una excepción. */
export function diasContenidoDeLaSemana(lunesIso: string): number[] {
  const excepcion = EXCEPCIONES_CONTENIDO_SEMANA.find((e) => e.lunes === lunesIso);
  return excepcion?.diasValidos ?? CALENDARIO_CONTENIDO.map((c) => c.dow);
}

export const CUENTAS_MARKETING = [
  { id: "instagram", texto: "Instagram" },
  { id: "linkedin", texto: "LinkedIn" },
  { id: "tiktok", texto: "TikTok" },
  { id: "facebook", texto: "Facebook" },
] as const;

/** Quién sigue cuentas hoy: Samuel lunes-jueves (1-4), Alejandro viernes-domingo (5,6,0). */
export function responsableSeguimiento(fecha: Date): string {
  const dow = fecha.getDay();
  return dow >= 1 && dow <= 4
    ? "samuelisaacospitiaquintero@gmail.com"
    : "alejandrotobarq@gmail.com";
}

export const META_SEGUIDOS_DIA = 200;
export const META_SEGUIDOS_SEMANA = 1200;
export const META_SEGUIDORES_NUEVOS_SEMANA = 150;

/** Filas de `public.marketing_contenido`. */
export type ContenidoMarketing = {
  id: string;
  fecha: string; // YYYY-MM-DD
  tema: TemaContenido;
  responsable_email: string;
  hecho: boolean;
  publicado_instagram: boolean;
  publicado_linkedin: boolean;
  publicado_tiktok: boolean;
  publicado_facebook: boolean;
  actualizado_en: string;
};

export const publicadoEnTodas = (c: Pick<ContenidoMarketing, "publicado_instagram" | "publicado_linkedin" | "publicado_tiktok" | "publicado_facebook">) =>
  c.publicado_instagram && c.publicado_linkedin && c.publicado_tiktok && c.publicado_facebook;

/** Filas de `public.marketing_seguimiento_diario`. */
export type SeguimientoDiario = {
  id: string;
  fecha: string;
  responsable_email: string;
  hecho: boolean;
  cantidad: number | null;
  actualizado_en: string;
};

/** Filas de `public.marketing_seguidores_snapshot`. */
export type SeguidoresSnapshot = {
  id: string;
  fecha: string;
  cantidad: number; // seguidores (followers_count)
  siguiendo: number | null; // a cuántas cuentas seguimos (follows_count) -- null en snapshots de antes del 3-sept
  creado_por: string | null;
  creado_en: string;
};
