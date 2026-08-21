import { useState } from "react";
import { PanelLateral } from "../disenio/PanelLateral";
import { ContenidoCliente } from "./FichaCliente";
import type { Cliente } from "./tipos";

/**
 * La ficha completa de un cliente, en el cajón de la derecha.
 *
 * POR QUÉ UN CAJÓN Y NO OTRA PÁGINA
 * ---------------------------------------------------------------------------
 * Mirar a un cliente es algo que se hace recorriendo la lista: entrar, volver,
 * entrar al siguiente. Cada ida y vuelta perdía el scroll, el filtro y la
 * búsqueda. El cajón deja la lista donde estaba — y por eso se abre con estado
 * local, sin tocar la URL: cambiarla volvía a montar la ruta entera y la
 * página saltaba al tope, que era exactamente lo que veníamos a evitar.
 *
 * Es el ÚNICO camino: no hay página del cliente. Dos formas de ver lo mismo
 * obligan a mantener las dos, y a la larga una queda atrás.
 */
export function PanelCliente({ id, cerrar }: { id: string; cerrar: () => void }) {
  const [c, setC] = useState<Cliente | null>(null);
  const nombre = c ? c.negocio || c.nombre || c.email || "Sin nombre" : "Cargando…";

  return (
    <PanelLateral
      titulo={nombre}
      bajada={`${c?.plan || "Sin plan"}${c?.email ? ` · ${c.email}` : ""}`}
      cerrar={cerrar}
    >
      <ContenidoCliente id={id} alCargar={setC} />
    </PanelLateral>
  );
}
