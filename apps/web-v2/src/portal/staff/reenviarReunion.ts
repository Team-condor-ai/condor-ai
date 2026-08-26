import { sb } from "../lib/supabase";
import type { Reunion } from "./tipos";

export type Destinatario = { nombre: string; email: string };

/**
 * A quién le llega el correo de una reunión.
 *
 * Son dos fuentes y ninguna sirve sola: el equipo vive en la tabla puente
 * `reuniones_admins` (hay que resolver el perfil para sacar el correo) y el
 * invitado externo viaja en la propia reunión, porque quien reserva desde la
 * web no tiene perfil de admin. Antes solo se consideraba el equipo y el
 * cliente que había pedido la reunión nunca recibía nada.
 */
export async function destinatariosDeReunion(reunion: Reunion): Promise<Destinatario[]> {
  const { data: participantes } = await sb
    .from("reuniones_admins").select("admin_id").eq("reunion_id", reunion.id);
  const ids = (participantes ?? []).map((fila) => String(fila.admin_id));
  const { data: perfiles } = ids.length
    ? await sb.from("admin_profiles").select("id,email,nombre").in("id", ids)
    : { data: [] };

  return [
    ...(perfiles ?? [])
      .filter((p) => p.email)
      .map((p) => ({ nombre: String(p.nombre || p.email), email: String(p.email) })),
    ...(reunion.email
      ? [{ nombre: reunion.contacto || reunion.cliente || "Invitado", email: reunion.email }]
      : []),
  ];
}

/**
 * Reenvía el aviso de una reunión que ya existe, sin tocar sus datos.
 *
 * Va con `motivo: "recordatorio"` para que el correo no diga "nueva reunión
 * agendada": quien lo recibe ya la tiene en el calendario y ese texto le haría
 * agendarla dos veces.
 */
export async function reenviarAvisoReunion(
  reunion: Reunion,
  destinatarios: Destinatario[],
) {
  const { error } = await sb.functions.invoke("reunion-notificar", {
    body: {
      motivo: "recordatorio",
      titulo: reunion.titulo,
      descripcion: reunion.descripcion ?? "",
      fecha_hora: reunion.fecha_hora,
      ocurrencias: [reunion.fecha_hora],
      duracion_min: reunion.duracion_min ?? 60,
      cliente: reunion.cliente ?? "",
      meet_url: reunion.meet_url ?? "",
      invitados: destinatarios.map((d) => d.nombre),
      invitados_email: destinatarios,
    },
  });
  if (error) throw new Error(error.message);
}

/** "3 personas" / "1 persona": aparece en la confirmación y en el resultado. */
export const contarPersonas = (n: number) =>
  `${n} persona${n === 1 ? "" : "s"}`;
