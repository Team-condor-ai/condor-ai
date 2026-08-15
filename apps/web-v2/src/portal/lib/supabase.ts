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
const URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  "https://ogmvdthxwcmvqjlxhpsr.supabase.co";
const ANON =
  (import.meta.env.VITE_SUPABASE_ANON as string | undefined)?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbXZkdGh4d2NtdnFqbHhocHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDEwMTksImV4cCI6MjA5NzIxNzAxOX0.wo6zSUlMejjYu1hSweZcWEBBdCvBgVNWg3xtLzFTIrI";

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
