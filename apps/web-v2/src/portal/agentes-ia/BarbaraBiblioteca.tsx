import { useEffect, useMemo, useState } from "react";
import { sb, fecha } from "../lib/supabase";
import { useConfirmacion } from "../disenio/Confirmacion";
import type { BarbaraPieza } from "./tipos";

const ETIQUETA_TIPO: Record<string, string> = { carrusel: "Carrusel", historia: "Historia", ugc: "Video UGC" };
const ESTADO: Record<BarbaraPieza["estado"], { texto: string; pill: string }> = {
  en_revision: { texto: "Por revisar", pill: "azul" }, requiere_ajuste: { texto: "Ajuste solicitado", pill: "warn" },
  aprobada: { texto: "Aprobada", pill: "ok" }, publicada: { texto: "Publicada", pill: "ok" }, historica: { texto: "Histórica", pill: "gris" },
};

/** El plan textual es la fuente real que el motor conserva. Mientras los
 * medios viven en Telegram, permite una revisión trazable y por versión. */
export function BarbaraBiblioteca({ barbaraClienteId, esStaff = false }: { barbaraClienteId: string; esStaff?: boolean }) {
  const confirmar = useConfirmacion();
  const [piezas, setPiezas] = useState<BarbaraPieza[]>([]);
  const [cargando, setCargando] = useState(true); const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState(""); const [abierta, setAbierta] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<string | null>(null); const [pedido, setPedido] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [canal, setCanal] = useState("Instagram");

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb.from("barbara_memoria")
      .select("id,barbara_cliente_id,fecha,tipo,angulo,contenido,estado,correcciones_pedidas,revision_comentario,revisada_en,canal_publicacion,publicacion_url,publicada_en,creado_en")
      .eq("barbara_cliente_id", barbaraClienteId).order("creado_en", { ascending: false }).limit(200);
    if (error) setError(error.message); else { setPiezas((data ?? []) as BarbaraPieza[]); setError(""); }
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, [barbaraClienteId]);
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? piezas.filter((p) => [p.angulo, p.tipo, p.contenido?.caption].some((v) => v?.toLowerCase().includes(q))) : piezas;
  }, [piezas, busqueda]);

  async function aprobar(pieza: BarbaraPieza) {
    if (!await confirmar("¿Aprobar esta pieza?", "Quedará marcada como aprobada. La publicación se controla por separado; nada se publica automáticamente.", "Aprobar")) return;
    setProcesando(pieza.id); setError("");
    const { data, error } = await sb.functions.invoke("barbara-chat", { body: { accion: "aprobar", barbara_cliente_id: barbaraClienteId, pieza_id: pieza.id } });
    setProcesando(null); if (error) setError((data as { error?: string } | null)?.error || error.message); else void cargar();
  }
  async function enviarAjuste(pieza: BarbaraPieza) {
    const mensaje = pedido.trim(); if (!mensaje) { setError("Describe qué cambiar de esta pieza."); return; }
    setProcesando(pieza.id); setError("");
    const { data, error } = await sb.functions.invoke("barbara-chat", { body: { accion: "correccion", barbara_cliente_id: barbaraClienteId, pieza_id: pieza.id, mensaje } });
    setProcesando(null);
    if (error) { setError((data as { error?: string } | null)?.error || error.message); return; }
    setPedido(""); setAjustando(null); void cargar();
  }
  async function marcarPublicada(pieza: BarbaraPieza) {
    if (!await confirmar("¿Registrar publicación?", `Se marcará como publicada en ${canal}. Esta acción registra un hecho; no publica en ninguna red por sí sola.`, "Registrar")) return;
    setProcesando(pieza.id); setError("");
    const { data, error } = await sb.functions.invoke("barbara-chat", { body: { accion: "publicar", barbara_cliente_id: barbaraClienteId, pieza_id: pieza.id, canal } });
    setProcesando(null); if (error) setError((data as { error?: string } | null)?.error || error.message); else void cargar();
  }

  return <div className="barbara-entregas">
    <div className="barbara-entregas-cabecera"><p className="barbara-subtitulo">Revisa el contenido, apruébalo o pide un ajuste puntual. Aprobar no publica nada automáticamente.</p><input className="campo" placeholder="Buscar una pieza…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
    {error && <p className="error">{error}</p>}
    {cargando ? <p className="vacio">Cargando entregas…</p> : filtradas.length === 0 ? <p className="vacio">Todavía no hay piezas para revisar.</p> : <div className="barbara-entregas-lista">
      {filtradas.map((pieza) => {
        const estado = ESTADO[pieza.estado] ?? ESTADO.historica; const contenido = pieza.contenido; const expandida = abierta === pieza.id;
        return <article className="barbara-entrega" key={pieza.id}>
          <button type="button" className="barbara-entrega-resumen" onClick={() => setAbierta(expandida ? null : pieza.id)} aria-expanded={expandida}>
            <span><b>{ETIQUETA_TIPO[pieza.tipo] || pieza.tipo}</b><small>{fecha(pieza.creado_en)} · {pieza.angulo || "Sin ángulo registrado"}</small></span>
            <span className="barbara-entrega-meta"><span className={"pill " + estado.pill}>{estado.texto}</span><span aria-hidden="true">{expandida ? "−" : "+"}</span></span>
          </button>
          {expandida && <div className="barbara-entrega-detalle">
            {contenido?.slides && <ol className="barbara-slides">{contenido.slides.map((slide, i) => <li key={i}><b>{slide.titular}</b>{slide.cuerpo && <p>{slide.cuerpo}</p>}</li>)}</ol>}
            {contenido?.texto_en_pantalla && <p className="barbara-entrega-hook">{contenido.texto_en_pantalla}</p>}
            {contenido?.clips && <p className="tenue">Video planificado en {contenido.clips.length} tomas. La versión audiovisual está en Telegram.</p>}
            {contenido?.caption && <details className="barbara-caption"><summary>Ver caption</summary><p>{contenido.caption}</p></details>}
            {pieza.revision_comentario && <p className="barbara-entrega-comentario">Último ajuste: {pieza.revision_comentario}</p>}
            {pieza.estado === "publicada" && <p className="barbara-entrega-publicada">Publicada en {pieza.canal_publicacion || "un canal registrado"}{pieza.publicacion_url ? " · enlace disponible" : ""}.</p>}
            {(pieza.estado === "en_revision" || pieza.estado === "requiere_ajuste") && <div className="barbara-entrega-acciones">
              {ajustando === pieza.id ? <div className="barbara-ajuste-form"><textarea className="campo" autoFocus rows={3} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ej: Acorta el titular del slide 2, sin cambiar el resto." /><div><button className="btn" type="button" onClick={() => { setAjustando(null); setPedido(""); }}>Cancelar</button><button className="btn solido" type="button" disabled={procesando === pieza.id} onClick={() => void enviarAjuste(pieza)}>{procesando === pieza.id ? "Enviando…" : "Enviar ajuste"}</button></div></div> : <><button className="btn" type="button" onClick={() => setAjustando(pieza.id)}>Pedir ajuste</button><button className="btn solido" type="button" disabled={procesando === pieza.id} onClick={() => void aprobar(pieza)}>{procesando === pieza.id ? "Aprobando…" : "Aprobar pieza"}</button></>}
            </div>}
            {esStaff && pieza.estado === "aprobada" && <div className="barbara-publicar-form"><select className="campo" value={canal} onChange={(e) => setCanal(e.target.value)}><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>Facebook</option></select><button className="btn solido" type="button" disabled={procesando === pieza.id} onClick={() => void marcarPublicada(pieza)}>{procesando === pieza.id ? "Registrando…" : "Registrar publicación"}</button></div>}
          </div>}
        </article>;
      })}
    </div>}
    <p className="tenue">Las imágenes y videos se mantienen en Telegram por ahora; aquí queda el contenido, su versión y la decisión de revisión.</p>
  </div>;
}
