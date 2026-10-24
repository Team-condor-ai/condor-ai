import { sb } from "../lib/supabase";

/**
 * Notas internas de un cliente (24-oct-2026). Viven en `clientes_notas`, que solo lee el equipo: en `clientes`
 * el propio cliente podía leerlas desde el navegador (la política le deja ver su fila completa).
 */
export async function leerNotas(clienteId: string): Promise<string | null> {
  const { data } = await sb.from("clientes_notas").select("notas").eq("cliente_id", clienteId).maybeSingle();
  return data?.notas ?? null;
}

export async function guardarNotas(clienteId: string, notas: string | null, yo: string | null): Promise<string | null> {
  const { error } = await sb.from("clientes_notas").upsert(
    { cliente_id: clienteId, notas: notas?.trim() || null, actualizado_en: new Date().toISOString(), actualizado_por: yo },
    { onConflict: "cliente_id" },
  );
  return error ? error.message : null;
}
