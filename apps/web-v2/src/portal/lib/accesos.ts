import { sb } from "./supabase";

export type ResultadoAcceso = { clave: string; nuevo: boolean };

/**
 * Le da acceso al portal a alguien (o se lo restablece) con la clave inicial común.
 * La función de la base verifica que quien llama sea del equipo. Al entrar, la persona elige su propia clave.
 */
export async function darAcceso(email: string, rol: "equipo" | "cliente", nombre?: string): Promise<ResultadoAcceso> {
  const { data, error } = await sb.functions.invoke("crear-acceso", { body: { email, rol, nombre, accion: "crear" } });
  if (error) {
    let detalle = error.message;
    try { const j = await (error as unknown as { context?: Response }).context?.json(); if (j?.error) detalle = j.error; } catch { /* sin cuerpo */ }
    throw new Error(detalle);
  }
  return { clave: (data as { clave: string }).clave, nuevo: Boolean((data as { nuevo?: boolean }).nuevo) };
}

export async function verClaveInicial(): Promise<string> {
  const { data, error } = await sb.functions.invoke("crear-acceso", { body: { accion: "ver_clave" } });
  if (error) throw new Error(error.message);
  return (data as { clave: string }).clave;
}

/** Borra el usuario de acceso de un cliente eliminado (la función se niega si el correo es del equipo). */
export async function quitarAcceso(email: string): Promise<void> {
  await sb.functions.invoke("crear-acceso", { body: { email, rol: "cliente", accion: "quitar" } });
}
