import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import "./correo-tecnobox.css";

/**
 * Bandeja de ecommerce@tecnoboxchile.cl (26-sept-2026, pedido de Joaquín).
 *
 * La casilla vive en el servidor propio de Tecnobox. La Edge Function `correo-tecnobox` la lee por IMAP
 * cada 2 minutos (pg_cron) y copia los correos a `correo_tecnobox` (solo lectura para el equipo, RLS
 * es_admin). Responder sale por SMTP COMO ecommerce@tecnoboxchile.cl: el cliente nunca ve otra dirección,
 * y la respuesta queda también en Enviados de la casilla (se ve en Roundcube).
 * En el servidor nada se marca como leído: "leído" es solo del Portal.
 */
type Correo = {
  id: number; uid: number; de_nombre: string | null; de_email: string | null; asunto: string | null;
  fecha: string; texto: string | null; html: string | null; leido: boolean;
  respondido_en: string | null; respondido_por: string | null;
};

const AUTOMATICOS = /resend\.com|notificaciones\.tecnoboxchile\.cl|no-?reply|mailer-daemon/i;

function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function CorreoTecnobox() {
  const [correos, setCorreos] = useState<Correo[]>([]);
  const [elegido, setElegido] = useState<Correo | null>(null);
  const [soloClientes, setSoloClientes] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    const { data, error } = await sb.from("correo_tecnobox")
      .select("id, uid, de_nombre, de_email, asunto, fecha, texto, html, leido, respondido_en, respondido_por")
      .order("fecha", { ascending: false }).limit(300);
    if (error) setError(error.message);
    else setCorreos((data || []) as Correo[]);
    setCargando(false);
  }
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, []);

  async function actualizar() {
    setActualizando(true); setError("");
    const { error } = await sb.functions.invoke("correo-tecnobox", { body: { accion: "sincronizar" } });
    if (error) setError("No se pudo revisar la casilla: " + error.message);
    await cargar(); setActualizando(false);
  }

  async function abrir(c: Correo) {
    setElegido(c); setRespuesta(""); setAviso("");
    if (!c.leido) {
      await sb.from("correo_tecnobox").update({ leido: true }).eq("id", c.id);
      setCorreos((xs) => xs.map((x) => (x.id === c.id ? { ...x, leido: true } : x)));
    }
  }

  async function responder() {
    if (!elegido || !respuesta.trim()) return;
    setEnviando(true); setError(""); setAviso("");
    const { data, error } = await sb.functions.invoke("correo-tecnobox", { body: { accion: "responder", id: elegido.id, cuerpo: respuesta } });
    setEnviando(false);
    if (error || data?.error) { setError("No se envió: " + (data?.error || error?.message)); return; }
    setAviso(`Respuesta enviada a ${elegido.de_email} desde ecommerce@tecnoboxchile.cl.`);
    setRespuesta("");
    await cargar();
    setElegido((e) => (e ? { ...e, respondido_en: new Date().toISOString() } : e));
  }

  const lista = useMemo(() => correos.filter((c) => !soloClientes || !AUTOMATICOS.test(c.de_email || "")), [correos, soloClientes]);
  const sinLeer = correos.filter((c) => !c.leido && !AUTOMATICOS.test(c.de_email || "")).length;

  return (
    <div className="correo-tb">
      <header className="correo-tb-cabecera">
        <div>
          <h1>Correo Tecnobox</h1>
          <p>ecommerce@tecnoboxchile.cl · {sinLeer ? `${sinLeer} sin leer` : "al día"} · se revisa cada 2 minutos</p>
        </div>
        <div className="correo-tb-acciones">
          <label><input type="checkbox" checked={soloClientes} onChange={(e) => setSoloClientes(e.target.checked)} /> Solo clientes (ocultar avisos automáticos)</label>
          <button type="button" onClick={actualizar} disabled={actualizando}>{actualizando ? "Revisando…" : "Revisar ahora"}</button>
        </div>
      </header>
      {error && <p className="correo-tb-error">{error}</p>}
      <div className="correo-tb-cuerpo">
        <aside className="correo-tb-lista">
          {cargando ? <p className="vacio">Cargando…</p> : !lista.length ? <p className="vacio">No hay correos.</p> :
            lista.map((c) => (
              <button type="button" key={c.id} className={`correo-tb-item${elegido?.id === c.id ? " activo" : ""}${c.leido ? "" : " nuevo"}`} onClick={() => abrir(c)}>
                <span className="de">{c.de_nombre || c.de_email}</span>
                <time>{cuando(c.fecha)}</time>
                <span className="asunto">{c.asunto}</span>
                <span className="extracto">{(c.texto || "").replace(/\s+/g, " ").slice(0, 110)}</span>
                {c.respondido_en && <span className="respondido">Respondido</span>}
              </button>
            ))}
        </aside>
        <section className="correo-tb-lectura">
          {!elegido ? <p className="vacio">Elige un correo para leerlo y responderlo.</p> : (
            <>
              <div className="correo-tb-meta">
                <h2>{elegido.asunto}</h2>
                <p><b>{elegido.de_nombre || elegido.de_email}</b> &lt;{elegido.de_email}&gt; · {new Date(elegido.fecha).toLocaleString("es-CL")}</p>
                {elegido.respondido_en && <p className="respondido-txt">Respondido el {new Date(elegido.respondido_en).toLocaleString("es-CL")}{elegido.respondido_por ? ` por ${elegido.respondido_por}` : ""}</p>}
              </div>
              {elegido.html
                ? <iframe className="correo-tb-html" title="Contenido del correo" sandbox="" srcDoc={elegido.html} />
                : <pre className="correo-tb-texto">{elegido.texto}</pre>}
              {!AUTOMATICOS.test(elegido.de_email || "") && (
                <div className="correo-tb-responder">
                  <textarea rows={6} value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
                    placeholder={`Responder a ${elegido.de_nombre || elegido.de_email}… (sale como ecommerce@tecnoboxchile.cl y firma "Equipo Tecnobox")`} />
                  <div>
                    {aviso && <span className="ok">{aviso}</span>}
                    <button type="button" onClick={responder} disabled={enviando || !respuesta.trim()}>
                      <Ico.enviar /> {enviando ? "Enviando…" : "Responder como ecommerce@"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
