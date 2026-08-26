import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { ChatVisor } from "./ChatVisor";

/** Conversación de apoyo: preguntar nunca cambia una pieza ni consume una
 * corrección. Los ajustes viven en Entregas y siempre apuntan a una pieza. */
export function BarbaraChat({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("barbara-chat-expandido", expandido);
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setExpandido(false);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.classList.remove("barbara-chat-expandido");
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [expandido]);

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    setEnviando(true); setAviso(null);
    const { data, error } = await sb.functions.invoke("barbara-chat", {
      body: { accion: "chat", barbara_cliente_id: barbaraClienteId, mensaje },
    });
    setEnviando(false);
    if (error) {
      setAviso({ tipo: "error", texto: (data as { error?: string } | null)?.error || error.message });
      return;
    }
    setTexto(""); setVersion((v) => v + 1);
    const r = data as { respuesta?: string } | null;
    setAviso({ tipo: "ok", texto: r?.respuesta || "Bárbara respondió en la conversación." });
  }

  return (
    <section className={"barbara-chat" + (expandido ? " expandido" : "")} aria-label="Chat con Bárbara">
      <header className="barbara-chat-cabecera">
        <div className="barbara-chat-identidad">
          <img src="/assets/barbara/avatar.png" alt="" aria-hidden="true" />
          <span>
            <b>Bárbara</b>
            <small>Tu agente de contenido</small>
          </span>
        </div>
        <span className="barbara-chat-estado"><i /> Disponible</span>
      </header>

      <div className="barbara-chat-conversacion">
        <ChatVisor key={version} barbaraClienteId={barbaraClienteId} />
      </div>

      <footer className="barbara-chat-compositor">
        {aviso && (
          <p className={aviso.tipo === "error" ? "error" : "ok-msg"} role="status">
            {aviso.texto}
          </p>
        )}
        <div className="barbara-chat-caja">
          <textarea
            className="campo"
            aria-label="Mensaje para Bárbara"
            placeholder="Escríbele a Bárbara…"
            value={texto}
            rows={1}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <div className="barbara-chat-acciones">
            <button
              type="button"
              className="btn barbara-chat-expandir"
              aria-label={expandido ? "Restaurar tamaño del chat" : "Expandir chat a pantalla completa"}
              title={expandido ? "Restaurar chat" : "Expandir chat"}
              aria-pressed={expandido}
              onClick={() => setExpandido((valor) => !valor)}
            >
              {expandido ? Ico.contraer({ t: 18 }) : Ico.expandir({ t: 18 })}
            </button>
            <button
              type="button"
              className="btn solido barbara-chat-enviar"
              aria-label="Enviar mensaje"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? <span className="barbara-chat-enviando" aria-hidden="true" /> : Ico.enviar({ t: 18, g: 2 })}
            </button>
          </div>
        </div>
        <small className="barbara-chat-ayuda">Enter para enviar · Shift + Enter para una nueva línea</small>
      </footer>
    </section>
  );
}
