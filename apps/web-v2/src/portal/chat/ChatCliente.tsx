import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Conversacion } from "./Conversacion";

/** «Chat con Cóndor» en el portal del cliente (24-oct-2026; reemplaza a «Pedir un cambio»). */
export function ChatCliente() {
  const email = useSesion().email;
  const [cliente, setCliente] = useState<{ id: string; nombre: string | null; negocio: string | null } | null | undefined>(undefined);
  useEffect(() => {
    void sb.from("clientes").select("id,nombre,negocio").limit(1).maybeSingle().then(({ data }) => setCliente(data ?? null));
  }, []);

  return (
    <>
      <div className="barra"><h1>Chat con Cóndor</h1></div>
      <div className="cuerpo chat-pagina">
        {cliente === undefined ? <p className="vacio">Cargando…</p>
          : cliente === null ? <p className="vacio">Tu cuenta todavía no tiene un plan asociado. Escríbenos a contacto@teamcondorcl.com y lo activamos.</p>
          : <Conversacion clienteId={cliente.id} soyEquipo={false} yo={email} nombreYo={cliente.nombre || cliente.negocio || "Cliente"}
              titulo="Equipo Cóndor" subtitulo="Te respondemos acá mismo, normalmente el mismo día hábil." />}
      </div>
    </>
  );
}
