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

/**
 * Llama a una Edge Function y devuelve el motivo REAL cuando falla.
 *
 * POR QUÉ EXISTE ESTO: "Edge Function returned a non-2xx status code"
 * ---------------------------------------------------------------------------
 * `sb.functions.invoke` no lee el cuerpo cuando el status no es 2xx: lanza un
 * `FunctionsHttpError` cuyo `.message` es siempre esa frase, y deja la Response
 * sin leer en `error.context`. Nuestras funciones sí explican qué pasó
 * ("Falta configurar MP_ACCESS_TOKEN", "cancela la suscripción activa antes de
 * crear otra"), pero ese texto se perdía y en pantalla salía la frase genérica.
 * El 22-ago un cobro no se pudo generar y el portal no supo decir por qué.
 *
 * Acá se abre `error.context` para rescatar el mensaje. Lo que devuelve la
 * función siempre gana; la frase genérica queda solo como último recurso.
 */
export async function invocar<T = unknown>(
  nombre: string,
  body?: Record<string, unknown>,
  opciones?: { method?: "GET" | "POST" },
): Promise<T> {
  const { data, error } = await sb.functions.invoke(nombre, {
    ...(body === undefined ? {} : { body }),
    ...(opciones?.method ? { method: opciones.method } : {}),
  });

  if (error) throw new Error(await motivoDeFuncion(error, nombre));
  // Una función puede responder 200 con `{ error }` adentro; también es fallo.
  if (data && typeof data === "object" && "error" in data) {
    const motivo = (data as { error?: unknown }).error;
    if (motivo) throw new Error(String(motivo));
  }
  return data as T;
}

/** Saca el texto útil de un error de `functions.invoke`. */
async function motivoDeFuncion(error: unknown, nombre: string): Promise<string> {
  const errorConContexto = error as { context?: unknown; message?: unknown };
  const respuesta: Response | undefined = errorConContexto.context instanceof Response
    ? errorConContexto.context
    : undefined;

  if (respuesta) {
    let cuerpo = "";
    try {
      cuerpo = await respuesta.clone().text();
    } catch { /* el cuerpo ya se consumió o no se pudo leer */ }

    let mensaje: string;
    try {
      const j = JSON.parse(cuerpo) as { error?: unknown; message?: unknown; msg?: unknown };
      mensaje = String(j.error || j.message || j.msg || "");
    } catch {
      mensaje = cuerpo.trim().slice(0, 300);
    }

    if (respuesta.status === 404 && /NOT_FOUND|not found/i.test(cuerpo || mensaje)) {
      return `Falta desplegar la Edge Function \`${nombre}\` en Supabase. No se cobró nada.`;
    }
    if (mensaje) return mensaje;
    return `La función \`${nombre}\` respondió ${respuesta.status} sin explicar el motivo.`;
  }

  return typeof errorConContexto.message === "string" && errorConContexto.message
    ? errorConContexto.message
    : `No se pudo llamar a \`${nombre}\`.`;
}
