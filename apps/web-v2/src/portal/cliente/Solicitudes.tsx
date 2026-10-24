import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

type Solicitud = { id: string; titulo: string; detalle: string | null; estado: "nueva" | "en_curso" | "lista"; creado_en: string; respuesta: string | null; responsable: string | null; en_curso_en: string | null; lista_en: string | null };
const ESTADOS = { nueva: "Recibida", en_curso: "En curso", lista: "Lista" } as const;
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

/**
 * «Pedir un cambio» (24-oct-2026): el cliente deja lo que necesita y ve en qué va. Al equipo le aparece en el Panel.
 * Los ajustes menores van incluidos en el plan; lo grande se cotiza antes (política del sitio).
 */
export function Solicitudes() {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function cargar() {
    const { data: c } = await sb.from("clientes").select("id").limit(1).maybeSingle();
    setClienteId(c?.id ?? null);
    if (c?.id) {
      const { data } = await sb.from("solicitudes").select("*").eq("cliente_id", c.id).order("creado_en", { ascending: false });
      setLista((data ?? []) as Solicitud[]);
    }
  }
  useEffect(() => { void cargar(); }, []);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!clienteId || titulo.trim().length < 3) { setError("Cuéntanos qué necesitas cambiar."); return; }
    setEnviando(true); setError("");
    const { error: e } = await sb.from("solicitudes").insert({ cliente_id: clienteId, titulo: titulo.trim(), detalle: detalle.trim() || null });
    setEnviando(false);
    if (e) { setError("No pudimos enviarla. Escríbenos por WhatsApp."); return; }
    setTitulo(""); setDetalle(""); setOk(true); window.setTimeout(() => setOk(false), 3500); void cargar();
  }

  return (
    <>
      <div className="barra"><h1>Pedir un cambio</h1></div>
      <div className="cuerpo">
        <form className="bloque" onSubmit={enviar}>
          <h3>Qué necesitas</h3>
          <div className="solicitud-form">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: cambiar el horario de atención" maxLength={120} />
            <textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Cuéntanos los detalles, si quieres (textos, fotos, enlaces)" maxLength={1200} />
            <div className="solicitud-pie">
              <small>Los ajustes menores van incluidos en tu plan. Si es algo más grande, te lo cotizamos antes de empezar.</small>
              <button className="btn solido" disabled={enviando || !clienteId}>{enviando ? "Enviando…" : "Enviar"}</button>
            </div>
            {error && <p className="aviso-error" role="alert">{error}</p>}
            {ok && <p className="solicitud-ok" role="status">Listo, la recibimos. Te respondemos pronto.</p>}
          </div>
        </form>

        <section className="bloque">
          <h3>Tus solicitudes</h3>
          {lista.length === 0 ? <p className="vacio-linea">Todavía no has pedido nada.</p> : (
            <ul className="solicitud-lista">
              {lista.map((s) => (
                <li key={s.id} className="solicitud-item">
                  <div className="solicitud-fila">
                    <div><b>{s.titulo}</b>{s.detalle && <small>{s.detalle.slice(0, 120)}</small>}</div>
                    <span className={`solicitud-estado ${s.estado}`}>{ESTADOS[s.estado]}</span>
                  </div>
                  <ol className="solicitud-pasos" aria-label="Avance">
                    <li className="hecho"><i />Recibida <small>{dia(s.creado_en)}</small></li>
                    <li className={s.en_curso_en || s.estado === "lista" ? "hecho" : ""}><i />En curso{s.responsable ? ` con ${s.responsable}` : ""} {s.en_curso_en && <small>{dia(s.en_curso_en)}</small>}</li>
                    <li className={s.estado === "lista" ? "hecho" : ""}><i />Lista {s.lista_en && <small>{dia(s.lista_en)}</small>}</li>
                  </ol>
                  {s.respuesta && <p className="solicitud-respuesta"><b>Cóndor:</b> {s.respuesta}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
