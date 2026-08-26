import { useEffect, useRef, useState } from "react";
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
  const historial = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
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

  useEffect(() => {
    if (!cargando && mensajes.length) {
      const elemento = historial.current;
      if (elemento) elemento.scrollTop = elemento.scrollHeight;
    }
  }, [cargando, mensajes.length]);

  if (cargando) return <p className="vacio">Cargando conversación…</p>;
  if (error) return <p className="error">{error}</p>;
  if (mensajes.length === 0) return (
    <div className="barbara-chat-vacio">
      <img src="/assets/barbara/avatar.png" alt="" aria-hidden="true" />
      <div>
        <b>¿En qué trabajamos hoy?</b>
        <p>Pídeme ideas, revisa el estado de una pieza o conversemos sobre tu calendario.</p>
      </div>
    </div>
  );

  return (
    <div ref={historial} className="barbara-chat-historial" role="log" aria-live="polite" aria-label="Conversación con Bárbara">
      {mensajes.map((m) => (
        <article key={m.id} className={"barbara-chat-mensaje " + m.remitente}>
          <div className="barbara-chat-remitente" aria-hidden="true">
            {m.remitente === "barbara"
              ? <img src="/assets/barbara/avatar.png" alt="" />
              : <span>{m.remitente === "staff" ? "C" : "T"}</span>}
          </div>
          <div className="barbara-chat-mensaje-cuerpo">
            <b>{ETIQUETA[m.remitente]} <small>· {fecha(m.creado_en)}</small></b>
            <p>{m.mensaje}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
