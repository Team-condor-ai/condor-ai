import { useEffect, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { BarbaraAvatar } from "./BarbaraAvatar";
import { BarbaraMensaje } from "./BarbaraMensaje";
import { BarbaraIndicador } from "./BarbaraIndicador";

type MensajeSesion = {
  id: string;
  remitente: "cliente" | "barbara";
  mensaje: string;
};

/** Chat efímero: comienza limpio al montar y no consulta conversaciones previas. */
export function BarbaraChat({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [mensajes, setMensajes] = useState<MensajeSesion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [angosto, setAngosto] = useState(() => typeof window !== "undefined" && window.innerWidth <= 900);
  const historial = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const medir = () => setAngosto(window.innerWidth <= 900);
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /* La cápsula compacta no puede tener su propia barra de scroll: en móvil la
     caja mide menos que dos líneas de placeholder y el navegador dibujaba una
     barra encima del vidrio. El textarea crece hasta su tope y ahí sí desborda,
     pero para entonces ya es la superficie abierta. */
  useEffect(() => {
    const nodo = campo.current;
    if (!nodo) return;
    nodo.style.height = "auto";
    nodo.style.height = `${nodo.scrollHeight}px`;
  }, [texto, abierto, angosto]);

  useEffect(() => {
    if (!abierto) return;
    const elemento = historial.current;
    if (elemento) elemento.scrollTo({ top: elemento.scrollHeight, behavior: "smooth" });
  }, [abierto, enviando, mensajes]);

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    const historialSesion = mensajes.slice(-10).map((entrada) => ({
      remitente: entrada.remitente,
      mensaje: entrada.mensaje,
    }));
    const mensajeCliente: MensajeSesion = {
      id: `cliente-${Date.now()}`,
      remitente: "cliente",
      mensaje,
    };

    setAbierto(true);
    setTexto("");
    setError("");
    setEnviando(true);
    setMensajes((actuales) => [...actuales, mensajeCliente]);

    const { data, error: errorEnvio } = await sb.functions.invoke("barbara-chat", {
      body: {
        accion: "chat",
        barbara_cliente_id: barbaraClienteId,
        mensaje,
        historial: historialSesion,
      },
    });
    setEnviando(false);
    if (errorEnvio) {
      setError((data as { error?: string } | null)?.error || errorEnvio.message);
      return;
    }

    const respuesta = (data as { respuesta?: string } | null)?.respuesta;
    setMensajes((actuales) => [...actuales, {
      id: `barbara-${Date.now()}`,
      remitente: "barbara",
      mensaje: respuesta || "Recibí tu mensaje. ¿En qué parte quieres que trabajemos primero?",
    }]);
  }

  return (
    <section className={`barbara-chat ${abierto ? "abierto" : "compacto"}`} aria-label="Chat con Bárbara">
      <header className="barbara-chat-cabecera">
        <div className="barbara-chat-identidad">
          <BarbaraAvatar />
          <span><b>Bárbara</b><small>Tu agente de contenido</small></span>
        </div>
        <span className="barbara-chat-estado"><i /> Disponible</span>
      </header>

      <div className="barbara-chat-conversacion">
        <div ref={historial} className="barbara-chat-historial" role="log" aria-live="polite" aria-label="Conversación actual con Bárbara">
          {mensajes.map((entrada) => (
            <article key={entrada.id} className={`barbara-chat-mensaje ${entrada.remitente}`}>
              <div className="barbara-chat-remitente" aria-hidden="true">
                {entrada.remitente === "barbara" ? <BarbaraAvatar /> : <span>T</span>}
              </div>
              <div className="barbara-chat-mensaje-cuerpo">
                <b>{entrada.remitente === "barbara" ? "Bárbara" : "Tú"}</b>
                {entrada.remitente === "barbara"
                  ? <BarbaraMensaje texto={entrada.mensaje} />
                  : <p>{entrada.mensaje}</p>}
              </div>
            </article>
          ))}
          {enviando && (
            <article className="barbara-chat-mensaje barbara escribiendo" aria-label="Bárbara está escribiendo">
              <div className="barbara-chat-remitente" aria-hidden="true"><BarbaraAvatar /></div>
              <div className="barbara-chat-mensaje-cuerpo">
                <b>Bárbara</b>
                <span className="barbara-chat-pensando"><i /><i /><i /></span>
              </div>
            </article>
          )}
        </div>
      </div>

      <footer className="barbara-chat-compositor">
        {error && <p className="error" role="alert">{error}</p>}
        <div className="barbara-chat-caja">
          <BarbaraIndicador activo={enviando} />
          <textarea
            ref={campo}
            className="campo"
            aria-label="Mensaje para Bárbara"
            placeholder={abierto
              ? "Continúa la conversación…"
              : angosto
                ? "Pregúntale lo que quieras…"
                : "Pregúntale una idea, una duda o el estado de tu contenido…"}
            value={texto}
            rows={1}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && !evento.shiftKey) {
                evento.preventDefault();
                void enviar();
              }
            }}
          />
          <div className="barbara-chat-acciones">
            <button
              type="button"
              className="btn solido barbara-chat-enviar"
              aria-label="Enviar mensaje"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
            >
              {enviando
                ? <span className="barbara-chat-enviando" aria-hidden="true" />
                : abierto
                  ? Ico.enviar({ t: 17, g: 2 })
                  : Ico.mas({ t: 19, g: 1.8 })}
            </button>
          </div>
        </div>
        {abierto && <small className="barbara-chat-ayuda">{angosto
          ? "La conversación comienza limpia cada vez que entras"
          : "La conversación comienza limpia cada vez que entras · Shift + Enter crea una nueva línea"}</small>}
      </footer>
    </section>
  );
}
