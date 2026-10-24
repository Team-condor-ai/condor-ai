/** Tipos y reglas de los leads en etapas (24-oct-2026). La etapa «manda» en la base; acá solo se leen y se muestran. */

export type EtapaLead = "nuevo" | "contactado" | "reunion" | "propuesta" | "ganado" | "sin_respuesta" | "perdido";

export type Lead = {
  id: number;
  negocio: string | null;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  web: string | null;
  instagram: string | null;
  tipo: string | null;
  clientes_mes: string | null;
  origen: string | null;
  campana: string | null;
  pais: string | null;
  problema: string | null;
  diagnostico: string | null;
  problemas: unknown;
  recomendacion: string | null;
  como_cerrar: string | null;
  intencion: string | null;
  categoria: string | null;
  prioridad: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  fue_whatsapp: boolean | null;
  reunion_id: string | null;
  pago_estado: string | null;
  creado_en: string;
  etapa: EtapaLead;
  etapa_en: string;
  responsable: string | null;
  valor_estimado: number | null;
  servicio_interes: "sites" | "ecommerce" | "crm" | null;
  requiere_humano: boolean;
  motivo_perdida: string | null;
  proxima_accion: string | null;
  proxima_accion_en: string | null;
};

export type EventoLead = {
  id: string;
  lead_id: number;
  tipo: "etapa" | "nota" | "llamada" | "whatsapp" | "correo" | "reunion" | "sistema";
  texto: string;
  de_etapa: string | null;
  a_etapa: string | null;
  autor: string | null;
  creado_en: string;
};

/** Las cinco columnas del tablero, en el orden del camino del cliente. */
export const ETAPAS_TABLERO: { id: EtapaLead; texto: string; ayuda: string }[] = [
  { id: "nuevo", texto: "Nuevo", ayuda: "Llegó y nadie le ha escrito" },
  { id: "contactado", texto: "Contactado", ayuda: "Ya hablamos con él" },
  { id: "reunion", texto: "Reunión agendada", ayuda: "Tiene hora con nosotros" },
  { id: "propuesta", texto: "Propuesta enviada", ayuda: "Espera nuestra cotización o la está viendo" },
  { id: "ganado", texto: "Ganado", ayuda: "Aceptó y pasa a cliente" },
];

/** Lo que sale del tablero: nadie tiene que hacer nada hoy (idea del «Limbo» del CRM de Neisstech). */
export const ETAPAS_CAJON: { id: EtapaLead; texto: string; ayuda: string }[] = [
  { id: "sin_respuesta", texto: "Sin respuesta", ayuda: "Dejó de contestar" },
  { id: "perdido", texto: "Perdido", ayuda: "Dijo que no o eligió otra opción" },
];

export const SERVICIOS_LEAD = [
  { id: "sites", texto: "Sites" },
  { id: "ecommerce", texto: "Ecommerce" },
  { id: "crm", texto: "CRM" },
] as const;


/** Cómo se llama un lead en pantalla: el negocio; si no lo dejó, la parte inicial de su correo; si no, su rubro. */
export function nombreLead(l: Pick<Lead, "negocio" | "nombre" | "email" | "tipo" | "whatsapp">): string {
  const n = (l.negocio ?? "").trim() || (l.nombre ?? "").trim();
  if (n) return n;
  const c = (l.email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (c) return c.charAt(0).toUpperCase() + c.slice(1);
  return (l.tipo ?? "").trim() || (l.whatsapp ?? "").trim() || "Sin nombre";
}

export const inicialesLead = (l: Parameters<typeof nombreLead>[0]) => {
  const p = nombreLead(l).split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
};

const PALETA = ["#014CFD", "#7A3CFF", "#0A8FE0", "#E5602B", "#147A42", "#C77A00", "#D6336C", "#0F766E"];
export const colorLead = (id: number) => PALETA[Math.abs(id) % PALETA.length];

/** Frío: lleva más de tres semanas en una etapa sin avance. No «pide atención»: se ofrece mandarlo a «Sin respuesta». */
export const DIAS_FRIO = 21;
export const esFrio = (l: Lead) => ["nuevo", "contactado", "propuesta"].includes(l.etapa) && diasEnEtapa(l) >= DIAS_FRIO && !l.reunion_id;

export const textoEtapa = (e: string) =>
  [...ETAPAS_TABLERO, ...ETAPAS_CAJON].find((x) => x.id === e)?.texto ?? e;

const MS_DIA = 86400000;
export const diasEnEtapa = (l: Pick<Lead, "etapa_en">) => Math.max(0, Math.floor((Date.now() - new Date(l.etapa_en).getTime()) / MS_DIA));

export const hace = (d: number) => (d === 0 ? "Hoy" : d === 1 ? "1 día" : `${d} días`);

export const dinero = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

/**
 * ¿Este lead pide atención? Devuelve el motivo corto o null.
 * Tiempos máximos por etapa (mismo criterio que los seguimientos de Prospección: más avanzado, más paciencia):
 * Nuevo 1 día · Contactado 3 · Propuesta 5. En Reunión se mira la hora: si ya pasó y nadie marcó el resultado,
 * es lo mismo que «Ya pasaron: falta marcar el resultado» del tablero de Neisstech.
 */
export function atrasoLead(l: Lead, reunion?: { fecha_hora: string; asistio: boolean | null }): string | null {
  if (["ganado", "perdido", "sin_respuesta"].includes(l.etapa)) return null;
  if (esFrio(l)) return null;
  if (l.requiere_humano) return "Lo espera una persona";
  const d = diasEnEtapa(l);
  if (l.etapa === "reunion") {
    if (reunion && reunion.asistio == null && new Date(reunion.fecha_hora).getTime() + 90 * 60000 < Date.now()) return "Falta marcar el resultado";
    return null;
  }
  const limite = l.etapa === "nuevo" ? 1 : l.etapa === "contactado" ? 3 : 5;
  if (d >= limite) return l.etapa === "nuevo" ? "Sin atender" : "Toca seguimiento";
  if (l.proxima_accion_en && new Date(l.proxima_accion_en + "T23:59:59").getTime() < Date.now()) return "Acción vencida";
  return null;
}
