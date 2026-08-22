import { createClient } from "@supabase/supabase-js";

// La anon key es pública por diseño: viaja en el navegador y no da acceso a
// nada por sí sola. Lo que protege los datos es RLS — ver `portal_admin.sql`.
// Nunca poner acá la service_role key.
//
// SE LEE DE `VITE_*` PERO CON RESPALDO, Y ES A PROPÓSITO
// ---------------------------------------------------------------------------
// El repo usa variables `VITE_*` para configuración (ver `.env.example`), y
// se respeta esa convención. Pero `condorai.cl` NO se despliega desde Vercel
// sino desde el workflow `deploy-web.yml`, que hoy no pasa ninguna variable
// al build. Con una env var pura, el portal saldría a producción sin URL y
// fallaría en blanco, sin un error que explique por qué.
//
// Por eso el valor conocido queda como respaldo: la variable sirve para
// apuntar a otra instancia sin tocar código, y si nadie la setea el portal
// igual funciona. No se pierde nada por tenerla acá — es pública de todos
// modos, como aclara el propio `.env.example`.
// 21-ago-2026: apuntado al proyecto nuevo (org "Condor AI",
// ylsqvmggycfijzfvguzq) para ver el portal visualmente contra el nuevo
// backend mientras se completan los secretos reales. Ver
// memoria "migracion_supabase_nuevo_proyecto_2026_08_21" para el detalle
// y lo que todavía falta antes de que esto sea el corte definitivo.
const URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  "https://ylsqvmggycfijzfvguzq.supabase.co";
const ANON =
  (import.meta.env.VITE_SUPABASE_ANON as string | undefined)?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsc3F2bWdneWNmaWp6ZnZndXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjE3OTgsImV4cCI6MjEwMjkzNzc5OH0.w1LABnzrOIgJ-UHelPF2A2kXCqDzDYPQK-5oV_o6VPk";

export const sb = createClient(URL, ANON);
export const FUNCIONES = URL + "/functions/v1";

/** Plata con formato chileno: 36990 -> "$36.990".
 *
 * `moneda` acepta null porque la columna lo permite: pedir `string|undefined`
 * obligaba a poner `?? "CLP"` en cada llamada, y basta olvidarlo una vez para
 * que se caiga la compilación por un dato que la base considera normal. */
export function plata(n: number | null | undefined, moneda?: string | null) {
  const v = Number(n || 0);
  const s = "$" + v.toLocaleString("es-CL");
  return moneda && moneda !== "CLP" ? `${s} ${moneda}` : s;
}

/**
 * Normaliza una URL guardada a mano por el staff para que sirva como `href`.
 * Sin esto, "tecnobox.cl" (sin protocolo) se interpreta como ruta RELATIVA
 * al portal — el link "funciona" pero te deja adentro de condorai.cl en vez
 * de llevarte al sitio real.
 */
export function enlaceWeb(url: string | null | undefined) {
  const u = (url ?? "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** Fecha corta y legible: "2026-08-13" -> "13 ago 2026". */
export function fecha(f: string | null | undefined) {
  if (!f) return "—";
  const d = new Date(f.length <= 10 ? f + "T12:00:00" : f);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
