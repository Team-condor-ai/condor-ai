import { useEffect, useState } from "react";
import { sb, fecha } from "../lib/supabase";
import type { BarbaraChat } from "./tipos";

const ETIQUETA: Record<BarbaraChat["remitente"], string> = {
  cliente: "Cliente",
  barbara: "Bárbara",
  staff: "Staff",
};

/**
 * Espejo del chat de Telegram, solo lectura.
 *
 * Lo usan tanto staff (revisa cualquier cliente) como el propio cliente
 * (revisa el suyo) — por eso vive en `agentes-ia/` y no en `staff/` ni en
 * `cliente/`. La consulta SIEMPRE filtra por `barbaraClienteId`: del lado
 * cliente esto es cinturón y tirantes (RLS ya limita la tabla a lo suyo),
 * pero la UI no debe depender solo de eso.
 */
export function ChatVisor({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [mensajes, setMensajes] = useState<BarbaraChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    sb.from("barbara_chats")
      .select("*")
      .eq("barbara_cliente_id", barbaraClienteId)
      .order("creado_en", { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setError(error.message);
        else setMensajes((data ?? []) as BarbaraChat[]);
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [barbaraClienteId]);

  if (cargando) return <p className="vacio">Cargando conversación…</p>;
  if (error) return <p className="error">{error}</p>;
  if (mensajes.length === 0)
    return (
      <p className="vacio">
        Todavía no hay mensajes. Acá va a aparecer la conversación de
        Telegram apenas empiece.
      </p>
    );

  return (
    <div className="barbara-chat-historial" aria-label="Conversación con Bárbara">
      {mensajes.map((m) => (
        <div key={m.id} className={"barbara-chat-mensaje " + m.remitente}>
          <b>{ETIQUETA[m.remitente]} <small>· {fecha(m.creado_en)}</small></b>
          <p>{m.mensaje}</p>
        </div>
      ))}
    </div>
  );
}
