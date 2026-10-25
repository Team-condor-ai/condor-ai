import { useCallback, useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { VERSION, documentosDe, paisDeMoneda, servicioDeLinea, textoPlano, type PaisId, type ServicioId } from "../../legal/contenido.mjs";

/**
 * Términos del cliente (25-oct-2026). El texto está en `src/legal/contenido.mjs`; acá se decide qué le toca
 * (servicio por su línea, país por su moneda) y si ya aceptó la versión vigente.
 */
export type Aceptacion = { version: string; servicio: ServicioId; pais: PaisId; huella: string; ip: string | null; navegador: string | null; aceptado_en: string };
export type Cancelacion = {
  id: number; cliente_id: string; canal: "portal" | "chat" | "correo" | "whatsapp"; motivo: string | null;
  solicitada_en: string; termina_el: string; registrada_por: string;
  confirmada_en: string | null; entregado_en: string | null; anulada_en: string | null;
};
type FichaCliente = { id: string; linea: string | null; moneda: string | null; plan: string | null; proximo_cobro: string | null; mensual_monto: number | null };

export type EstadoTerminos =
  | { estado: "cargando" }
  | { estado: "sin-cliente" }
  | { estado: "listo"; ficha: FichaCliente; servicio: ServicioId; pais: PaisId; ultima: Aceptacion | null; alDia: boolean; cancelacion: Cancelacion | null };

export function useTerminos() {
  const [e, setE] = useState<EstadoTerminos>({ estado: "cargando" });
  const cargar = useCallback(async () => {
    const { data: ficha } = await sb.from("clientes").select("id, linea, moneda, plan, proximo_cobro, mensual_monto").not("archivado", "is", true).limit(1).maybeSingle();
    if (!ficha) { setE({ estado: "sin-cliente" }); return; }
    const f = ficha as FichaCliente;
    const [{ data: ac }, { data: ca }] = await Promise.all([
      sb.from("terminos_aceptaciones").select("version, servicio, pais, huella, ip, navegador, aceptado_en").eq("cliente_id", f.id).order("aceptado_en", { ascending: false }).limit(1),
      sb.from("cancelaciones").select("*").eq("cliente_id", f.id).is("anulada_en", null).order("solicitada_en", { ascending: false }).limit(1),
    ]);
    const servicio = servicioDeLinea(f.linea), pais = paisDeMoneda(f.moneda);
    const ultima = ((ac ?? [])[0] as Aceptacion | undefined) ?? null;
    setE({
      estado: "listo", ficha: f, servicio, pais, ultima,
      // Al día = aceptó esta versión para su servicio y país actuales (si cambia de servicio o de país, se le vuelve a pedir).
      alDia: !!ultima && ultima.version === VERSION && ultima.servicio === servicio && ultima.pais === pais,
      cancelacion: ((ca ?? [])[0] as Cancelacion | undefined) ?? null,
    });
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);
  return { ...e, recargar: cargar } as EstadoTerminos & { recargar: () => Promise<void> };
}

/** SHA-256 del texto exacto que el cliente tuvo a la vista: prueba de qué aceptó. */
export async function huellaDe(servicio: ServicioId, pais: PaisId) {
  const bytes = new TextEncoder().encode(textoPlano(documentosDe(servicio, pais)));
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function aceptar(servicio: ServicioId, pais: PaisId) {
  const huella = await huellaDe(servicio, pais);
  const { error } = await sb.rpc("aceptar_terminos", { p_version: VERSION, p_servicio: servicio, p_pais: pais, p_huella: huella });
  if (error) throw new Error(error.message);
}

export async function cancelar(motivo: string) {
  const { data, error } = await sb.rpc("solicitar_cancelacion", { p_motivo: motivo });
  if (error) throw new Error(error.message);
  return data as Cancelacion;
}

/** Fecha límite de entrega: 10 días hábiles después del término (lunes a viernes; los festivos se informan aparte). */
export function entregaLimite(terminaEl: string) {
  const d = new Date(terminaEl + "T12:00:00");
  let n = 0;
  while (n < 10) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
  return d;
}

export const fechaLarga = (x: string | Date) =>
  (typeof x === "string" ? new Date(x.length === 10 ? x + "T12:00:00" : x) : x).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
