import { useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { ChatVisor } from "./ChatVisor";

/**
 * El chat REAL de Bárbara dentro del portal — no un espejo de solo lectura
 * como `ChatVisor` (que sigue existiendo para la ficha de staff). Escribir
 * acá dispara el MISMO mecanismo que responder por Telegram: la Edge
 * Conversar con Bárbara no consume una corrección. El usuario escoge de forma
 * explícita si quiere pedir una corrección de la pieza actual; sólo ese modo
 * destila una regla, cuenta el intento y dispara el reintento real.
 */
export function BarbaraChat({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"conversar" | "correccion">("conversar");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bloqueado" | "error"; texto: string } | null>(null);
  // Se usa para refrescar el ChatVisor de abajo tras enviar, sin re-montar
  // el componente entero (perdería el scroll).
  const [version, setVersion] = useState(0);

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    setEnviando(true);
    setAviso(null);
    const { data, error } = await sb.functions.invoke("barbara-chat", {
      body: { barbara_cliente_id: barbaraClienteId, mensaje, modo },
    });
    setEnviando(false);
    if (error) {
      const msg = (data as { error?: string } | null)?.error || error.message;
      setAviso({ tipo: "error", texto: msg });
      return;
    }
    setTexto("");
    setVersion((v) => v + 1);
    const r = data as { bloqueado?: boolean; respuesta?: string } | null;
    setAviso({ tipo: r?.bloqueado ? "bloqueado" : "ok", texto: r?.respuesta || "Enviado." });
  }

  return (
    <div className="barbara-chat">
      <div className="barbara-chat-caja">
        <textarea
          className="campo"
          placeholder={modo === "correccion" ? "Describe qué debe cambiar en la pieza actual…" : "Habla con Bárbara sobre tu negocio, ideas o próximos contenidos…"}
          value={texto}
          rows={2}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
          }}
        />
        <button className="btn solido barbara-chat-enviar" onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? "…" : Ico.mas({ t: 16 })}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className={"chip-toggle" + (modo === "conversar" ? " on" : "")} onClick={() => setModo("conversar")}>Conversar</button>
        <button className={"chip-toggle" + (modo === "correccion" ? " on" : "")} onClick={() => setModo("correccion")}>Corregir pieza</button>
      </div>
      {aviso && (
        <p className={aviso.tipo === "error" ? "error" : aviso.tipo === "bloqueado" ? "tenue" : "ok-msg"}>
          {aviso.texto}
        </p>
      )}
      <div style={{ marginTop: 14 }}>
        <ChatVisor key={version} barbaraClienteId={barbaraClienteId} />
      </div>
    </div>
  );
}
