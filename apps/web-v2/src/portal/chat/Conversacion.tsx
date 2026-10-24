import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ico } from "../disenio/iconos";
import { enlaceAdjunto, type Mensaje, useConversacion } from "./datos";

const ESTADOS = { nueva: "Pedido recibido", en_curso: "En curso", lista: "Listo" } as const;
const SIGUIENTE = { nueva: "en_curso", en_curso: "lista", lista: "nueva" } as const;

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
function dia(iso: string) {
  const d = new Date(iso), hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}
const peso = (b: number | null) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const enlaces = (t: string) => t.split(/(https?:\/\/[^\s]+)/g).map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : p));

/** Un adjunto: las imágenes se ven dentro del globo; lo demás es una ficha para descargar. */
function Adjunto({ m }: { m: Mensaje }) {
  const [url, setUrl] = useState<string | null>(null);
  const imagen = (m.adjunto_tipo ?? "").startsWith("image/");
  useEffect(() => { if (m.adjunto_ruta && imagen && !m.pendiente) void enlaceAdjunto(m.adjunto_ruta).then(setUrl); }, [m.adjunto_ruta, imagen, m.pendiente]);
  if (!m.adjunto_ruta) return null;
  if (imagen) return url ? <a href={url} target="_blank" rel="noreferrer" className="chat-img"><img src={url} alt={m.adjunto_nombre ?? ""} loading="lazy" /></a> : <span className="chat-img cargando" />;
  return (
    <button className="chat-archivo" onClick={async () => { const u = await enlaceAdjunto(m.adjunto_ruta!, m.adjunto_nombre ?? undefined); if (u) window.open(u, "_blank", "noopener"); }}>
      {Ico.documentos({ t: 18 })}<span><b>{m.adjunto_nombre}</b><small>{peso(m.adjunto_bytes)} · Descargar</small></span>
    </button>
  );
}

/**
 * La conversación con un cliente (24-oct-2026). La usan el equipo (bandeja de Chat y ficha del cliente) y el
 * cliente (su página «Chat con Cóndor»). Enter envía, Shift+Enter baja de línea; se puede adjuntar, arrastrar
 * o pegar una imagen. El equipo puede marcar un mensaje del cliente como pedido y moverlo de estado.
 */
export function Conversacion({ clienteId, soyEquipo, yo, nombreYo, titulo, subtitulo, acciones, equipo = [] }: {
  clienteId: string; soyEquipo: boolean; yo: string | null; nombreYo: string;
  titulo: string; subtitulo?: string; acciones?: React.ReactNode; equipo?: string[];
}) {
  const c = useConversacion(clienteId, soyEquipo, yo, nombreYo);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const alFondo = useRef(true);

  // Baja al último mensaje si uno ya estaba abajo (si estaba leyendo más arriba, no lo mueve).
  useLayoutEffect(() => {
    const l = lista.current; if (!l) return;
    if (alFondo.current) l.scrollTop = l.scrollHeight;
  }, [c.mensajes, c.escribiendo]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { alFondo.current = true; setTexto(""); setArchivo(null); }, [clienteId]);

  async function mandar() {
    if (enviando || (!texto.trim() && !archivo)) return;
    setEnviando(true); alFondo.current = true;
    const t = texto, a = archivo;
    setTexto(""); setArchivo(null);
    await c.enviar(t, a);
    setEnviando(false);
    caja.current?.focus();
  }

  const ms = c.mensajes ?? [];
  let diaPrevio = "";
  return (
    <div className={`chat${arrastrando ? " soltar" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastrando(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastrando(false); }}
      onDrop={(e) => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files?.[0]; if (f) setArchivo(f); }}>
      <header className="chat-cab">
        <span className="chat-av" aria-hidden="true">{soyEquipo ? (titulo[0] ?? "C").toUpperCase() : <img src="/condor/marca/condor-favicon.svg" alt="" />}</span>
        <div><b>{titulo}</b><small>{c.escribiendo ? <em>{c.escribiendo} está escribiendo…</em> : subtitulo}</small></div>
        {acciones && <span className="chat-cab-acc">{acciones}</span>}
      </header>

      <div className="chat-lista" ref={lista} onScroll={(e) => { const l = e.currentTarget; alFondo.current = l.scrollHeight - l.scrollTop - l.clientHeight < 80; }}>
        {c.mensajes === null ? <p className="chat-vacio">Cargando…</p> : ms.length === 0 ? (
          <div className="chat-vacio">
            <span>{Ico.chat({ t: 26 })}</span>
            <b>{soyEquipo ? "Todavía no hay mensajes con este cliente" : "Escríbenos lo que necesites"}</b>
            <small>{soyEquipo ? "Escríbele para partir la conversación; lo ve en su portal." : "Cambios en tu sitio, dudas, ideas o lo que sea. Te respondemos acá mismo."}</small>
          </div>
        ) : ms.map((m) => {
          const d = dia(m.creado_en); const sep = d !== diaPrevio; diaPrevio = d;
          const mio = m.de_equipo === soyEquipo;
          return (
            <div key={m.id} className="chat-bloque">
              {sep && <p className="chat-dia"><span>{d}</span></p>}
              <div className={`chat-msg${mio ? " mio" : ""}${m.pendiente ? " pendiente" : ""}`}>
                <div className="chat-globo">
                  {!mio && m.de_equipo && <span className="chat-autor">{m.autor} · Cóndor</span>}
                  <Adjunto m={m} />
                  {m.texto && <p>{enlaces(m.texto)}</p>}
                  <span className="chat-hora">
                    {hora(m.creado_en)}
                    {mio && <i className={m.leido_en ? "leido" : ""} title={m.pendiente ? "Enviando" : m.leido_en ? `Leído ${hora(m.leido_en)}` : "Enviado"}>{m.pendiente ? "·" : m.leido_en ? "✓✓" : "✓"}</i>}
                  </span>
                </div>
                {!m.de_equipo && (m.pedido_estado || soyEquipo) && (
                  <div className="chat-pedido">
                    {m.pedido_estado ? (
                      soyEquipo ? (
                        <>
                          <button className={`chat-chip ${m.pedido_estado}`} onClick={() => void c.cambiarPedido(m, { pedido_estado: SIGUIENTE[m.pedido_estado!] })} title="Cambiar estado">{ESTADOS[m.pedido_estado]}</button>
                          <select value={m.pedido_responsable ?? ""} onChange={(e) => void c.cambiarPedido(m, { pedido_responsable: e.target.value || null })} aria-label="Quién lo toma">
                            <option value="">Sin responsable</option>
                            {equipo.map((p) => <option key={p}>{p}</option>)}
                          </select>
                          <button className="chat-quitar" onClick={() => void c.cambiarPedido(m, { pedido_estado: null, pedido_responsable: null })} title="No es un pedido">{Ico.cerrar({ t: 12 })}</button>
                        </>
                      ) : <span className={`chat-chip ${m.pedido_estado}`}>{ESTADOS[m.pedido_estado]}{m.pedido_responsable && m.pedido_estado !== "lista" ? ` con ${m.pedido_responsable}` : ""}</span>
                    ) : (
                      <button className="chat-marcar" onClick={() => void c.cambiarPedido(m, { pedido_estado: "nueva" })}>+ Es un pedido</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {c.escribiendo && <div className="chat-msg"><div className="chat-globo escribe" aria-label={`${c.escribiendo} está escribiendo`}><i /><i /><i /></div></div>}
      </div>

      {c.error && <p className="aviso-error chat-error">{c.error}</p>}
      {archivo && (
        <div className="chat-adjunto-listo">
          {Ico.documentos({ t: 15 })}<span>{archivo.name} · {peso(archivo.size)}</span>
          <button onClick={() => setArchivo(null)} aria-label="Quitar archivo">{Ico.cerrar({ t: 13 })}</button>
        </div>
      )}
      <form className="chat-escribir" onSubmit={(e) => { e.preventDefault(); void mandar(); }}>
        <button type="button" className="chat-clip" onClick={() => input.current?.click()} title="Adjuntar archivo" aria-label="Adjuntar archivo">{Ico.subir({ t: 18 })}</button>
        <input ref={input} type="file" hidden onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <textarea ref={caja} rows={1} value={texto} placeholder={soyEquipo ? "Escríbele al cliente…" : "Escribe tu mensaje…"}
          onChange={(e) => { setTexto(e.target.value); c.avisarEscribiendo(); const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void mandar(); } }}
          onPaste={(e) => { const f = [...e.clipboardData.files][0]; if (f) { e.preventDefault(); setArchivo(f); } }} />
        <button className="chat-enviar" disabled={enviando || (!texto.trim() && !archivo)} aria-label="Enviar">{Ico.enviar({ t: 18 })}</button>
      </form>
      {arrastrando && <div className="chat-soltar">Suelta el archivo para adjuntarlo</div>}
    </div>
  );
}
