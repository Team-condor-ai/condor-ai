import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

/**
 * ¿Este cliente tiene Bárbara contratada y activa?
 *
 * Decide si el ítem "Bárbara" aparece en el menú lateral del cliente. La
 * consulta NO filtra por email a propósito: la policy `cliente_ve_su_barbara`
 * ya limita `barbara_clientes` a la fila del cliente dueño de la sesión —
 * mismo patrón que `MiPlan.tsx` usa para `clientes`.
 *
 * Si no tiene fila, o la tiene con `activo = false`, el ítem NO aparece —
 * no aparece deshabilitado, directamente no está (pedido explícito).
 */
export function useTieneBarbara() {
  const [tiene, setTiene] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    sb.from("barbara_clientes")
      .select("id,activo")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        setTiene(Boolean(data && data.activo));
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { tiene, cargando };
}
