import { useState } from "react";
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

  return <div className="barbara-chat">
    <div className="barbara-chat-caja">
      <textarea className="campo" placeholder="Pregúntale una idea, una duda o el estado de tu contenido…" value={texto} rows={2}
        onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
        }} />
      <button className="btn solido barbara-chat-enviar" onClick={enviar} disabled={enviando || !texto.trim()}>
        {enviando ? "…" : Ico.mas({ t: 16 })}
      </button>
    </div>
    {aviso && <p className={aviso.tipo === "error" ? "error" : "ok-msg"}>{aviso.texto}</p>}
    <div style={{ marginTop: 14 }}><ChatVisor key={version} barbaraClienteId={barbaraClienteId} /></div>
  </div>;
}
