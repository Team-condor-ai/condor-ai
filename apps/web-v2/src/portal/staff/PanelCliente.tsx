import { useRef, useState } from "react";
import { PanelLateral } from "../disenio/PanelLateral";
import { ContenidoCliente } from "./FichaCliente";
import { ExtrasCliente } from "./ExtrasCliente";
import { Conversacion } from "../chat/Conversacion";
import { FichaContrato } from "../legal/FichaContrato";
import { useSesion } from "../auth/sesion";
import { useEquipo, useYo } from "./personas";
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
/** Pestañas de la ficha (24-oct-2026): antes era todo apilado y había que bajar harto para llegar a los cobros. */
type Pestana = "resumen" | "cobros" | "chat" | "contrato" | "tareas" | "boveda" | "reuniones";
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "cobros", texto: "Cobros" },
  { id: "chat", texto: "Chat" },
  { id: "contrato", texto: "Contrato" },
  { id: "tareas", texto: "Tareas" },
  { id: "boveda", texto: "Bóveda" },
  { id: "reuniones", texto: "Reuniones" },
];

export function PanelCliente({
  id,
  cerrar,
  cambiado,
}: {
  id: string;
  cerrar: () => void;
  cambiado?: () => void;
}) {
  const [c, setC] = useState<Cliente | null>(null);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const email = useSesion().email;
  const apodo = useYo(email)?.completo ?? (email ?? "").split("@")[0];
  const equipo = useEquipo().map((p) => p.nombre);
  const primeraCarga = useRef(true);
  const nombre = c ? c.negocio || c.nombre || c.email || "Sin nombre" : "Cargando…";

  function recibir(cliente: Cliente | null) {
    setC(cliente);
    if (primeraCarga.current) primeraCarga.current = false;
    else cambiado?.();
  }

  return (
    <PanelLateral
      titulo={nombre}
      bajada={`${c?.plan || "Sin plan"}${c?.email ? ` · ${c.email}` : ""}`}
      cerrar={cerrar}
    >
      <div className="ficha-pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} className={pestana === p.id ? "on" : ""} onClick={() => setPestana(p.id)}>{p.texto}</button>
        ))}
      </div>
      <ContenidoCliente id={id} alCargar={recibir} vista={pestana === "resumen" ? "datos" : pestana === "cobros" ? "cobros" : "nada"} />
      {pestana === "resumen" && <ExtrasCliente id={id} negocio={c?.negocio ?? null} vista="acceso" />}
      {pestana === "chat" && <div className="ficha-chat"><Conversacion clienteId={id} soyEquipo yo={email} nombreYo={apodo} equipo={equipo} titulo={nombre} subtitulo={c?.email ?? "Sin correo: no puede entrar al portal"} /></div>}
      {pestana === "contrato" && <FichaContrato clienteId={id} proximoCobro={c?.proximo_cobro ?? null} />}
      {(pestana === "tareas" || pestana === "boveda" || pestana === "reuniones") && <ExtrasCliente id={id} negocio={c?.negocio ?? null} vista={pestana} />}
    </PanelLateral>
  );
}
