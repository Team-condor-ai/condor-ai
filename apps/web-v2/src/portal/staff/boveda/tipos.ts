import { sb } from "../../lib/supabase";

export type Seccion = "claves" | "archivos";
export type Carpeta = { id: string; nombre: string; padre_id: string | null; orden: number; seccion: Seccion };
export type Item = {
  id: string; carpeta_id: string | null; titulo: string; usuario: string | null; url: string | null; notas: string | null;
  tipo: "cuenta" | "api" | "nota" | "archivo"; actualizado_en: string; actualizado_por: string | null;
  archivo_url: string | null; archivo_nombre: string | null; peso_bytes: number | null; mime: string | null; cliente_id: string | null;
};

/** El valor secreto (`clave`) NO está en esta lista: la base no lo entrega en listados, solo por `revelar_clave`. */
export const COLS_ITEM = "id,carpeta_id,titulo,usuario,url,notas,tipo,actualizado_en,actualizado_por,archivo_url,archivo_nombre,peso_bytes,mime,cliente_id";

export const tamano = (n: number | null) => (!n ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const COLORES = ["#014CFD", "#7A3CFF", "#0A8FE0", "#E5602B", "#147A42", "#C77A00", "#D6336C", "#0F766E"];
export const colorDe = (s: string) => COLORES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
export const iniciales = (t: string) => (t.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("") || "?").toUpperCase();

export function leerPref<T>(clave: string, defecto: T): T {
  try { const v = localStorage.getItem(clave); return v === null ? defecto : (JSON.parse(v) as T); } catch { return defecto; }
}
export function guardarPref(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
}

/** Sube un archivo al bucket privado `boveda` y lo registra. Devuelve la fila creada. */
export async function subirArchivo(a: File, extra: { carpeta_id: string | null; creado_por: string | null; cliente_id?: string | null; titulo?: string }) {
  const ruta = `${crypto.randomUUID()}/${a.name.replace(/[^\w.-]+/g, "_")}`;
  const { error: e1 } = await sb.storage.from("boveda").upload(ruta, a, { contentType: a.type || undefined });
  if (e1) throw new Error(/exceeded|too large/i.test(e1.message) ? "pesa más de 50 MB" : e1.message);
  const { error: e2 } = await sb.from("claves").insert({ tipo: "archivo", titulo: extra.titulo ?? a.name, archivo_url: ruta, archivo_nombre: a.name, peso_bytes: a.size, mime: a.type || null, carpeta_id: extra.carpeta_id, cliente_id: extra.cliente_id ?? null, creado_por: extra.creado_por, actualizado_por: extra.creado_por });
  if (e2) { await sb.storage.from("boveda").remove([ruta]); throw new Error(e2.message); }
}

export async function urlFirmada(ruta: string, descargar?: string) {
  const { data, error } = await sb.storage.from("boveda").createSignedUrl(ruta, 300, descargar ? { download: descargar } : undefined);
  if (error || !data) throw new Error(error?.message ?? "sin enlace");
  return data.signedUrl;
}

export type TipoArchivo = "imagen" | "pdf" | "video" | "planilla" | "documento" | "comprimido" | "otro";
export function tipoArchivo(mime: string | null, nombre: string | null): TipoArchivo {
  const m = mime ?? "", n = (nombre ?? "").toLowerCase();
  if (m.startsWith("image/")) return "imagen";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("video/")) return "video";
  if (/sheet|excel|csv/.test(m) || /\.(xlsx?|csv|numbers)$/.test(n)) return "planilla";
  if (/word|document|text|presentation/.test(m) || /\.(docx?|pptx?|txt|md|key|pages)$/.test(n)) return "documento";
  if (/zip|compressed|rar|7z/.test(m) || /\.(zip|rar|7z)$/.test(n)) return "comprimido";
  return "otro";
}
