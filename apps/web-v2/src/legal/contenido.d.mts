// Tipos de contenido.mjs (es .mjs para que también lo lea el generador del sitio, que corre en Node sin TypeScript).
export type ServicioId = "sites" | "ecommerce" | "crm";
export type PaisId = "cl" | "pe" | "co" | "mx" | "ar";
export type Seccion = { n: number; titulo: string; parrafos: string[] };
export type Documento = { id: string; titulo: string; bajada: string; secciones: Seccion[] };

export const VERSION: string;
export const VIGENTE_DESDE: string;
export const CAMBIOS: Record<string, string[]>;
export const EMPRESA: {
  razonSocial: string; rut: string; domicilio: string; correo: string;
  whatsapp: string; whatsappVisible: string; web: string; portal: string;
};
export const SERVICIOS: Record<ServicioId, { nombre: string; corto: string }>;
export const PAISES: Record<PaisId, { nombre: string; moneda: string; monedaNombre: string }>;
export const GENERALES: Documento;
export const CONTRATOS: Record<ServicioId, Documento>;
export const ANEXOS: Record<PaisId, Documento>;
export function paisDeMoneda(moneda: string | null | undefined): PaisId;
export function servicioDeLinea(linea: string | null | undefined): ServicioId;
export function resumen(servicio: ServicioId): [string, string][];
export function documentosDe(servicio: ServicioId, pais: PaisId): Documento[];
export function textoPlano(docs: Documento[]): string;
