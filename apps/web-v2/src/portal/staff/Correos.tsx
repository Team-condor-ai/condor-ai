import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import type { Cliente } from "./tipos";

/**
 * Correos a varios clientes a la vez.
 *
 * NO SE MANDA DESDE EL NAVEGADOR
 * ---------------------------------------------------------------------------
 * Enviar con Resend requiere su API key, y una key en el front es una key
 * pública: cualquiera podría mandar correos firmados como Cóndor. Por eso el
 * envío vive en una Edge Function (`enviar-correos`), que valida que quien
 * llama sea admin y guarda la key del lado del servidor.
 *
 * Mientras esa función no exista, el módulo NO finge que envió: arma el
 * mensaje, muestra a quién iría y avisa que falta desplegarla. Un botón que
 * dice "enviado" sin enviar es peor que uno que no está.
 */
const VARIABLES = [
  { v: "{{negocio}}", d: "Nombre del negocio" },
  { v: "{{plan}}", d: "Plan contratado" },
  { v: "{{monto}}", d: "Mensualidad" },
];

export function Correos() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    sb.from("clientes")
      .select("*")
      .order("negocio")
      .then(({ data }) =>
        setClientes(((data ?? []) as Cliente[]).filter((c) => !c.archivado)),
      );
  }, []);

  const destinatarios = useMemo(
    () => clientes.filter((c) => sel.has(c.id)),
    [clientes, sel],
  );

  function alternar(id: string) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  }

  function render(txt: string, c: Cliente) {
    return txt
      .replaceAll("{{negocio}}", c.negocio || "")
      .replaceAll("{{plan}}", c.plan || "")
      .replaceAll("{{monto}}", String(c.mensual_monto ?? 0));
  }

  async function enviar() {
    setError("");
    setResultado("");
    if (!destinatarios.length) return setError("Elige al menos un cliente.");
    if (!asunto.trim()) return setError("Falta el asunto.");
    setEnviando(true);
    try {
      const { data, error } = await sb.functions.invoke("enviar-correos", {
        body: {
          asunto,
          mensajes: destinatarios.map((c) => ({
            para: c.email,
            asunto: render(asunto, c),
            cuerpo: render(cuerpo, c),
          })),
        },
      });
      if (error) throw error;
      setResultado(`Enviados: ${(data as { enviados?: number })?.enviados ?? destinatarios.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /not found|404|failed to send/i.test(msg)
          ? "Falta desplegar la Edge Function `enviar-correos`. El mensaje NO se envió."
          : msg,
      );
    } finally {
      setEnviando(false);
    }
  }

  const previa = destinatarios[0];

  return (
    <>
      <div className="barra">
        <h1>Correos</h1>
        <span className="conteo">{sel.size} elegidos</span>
      </div>

      <div className="cuerpo">
        <div className="dos-cols">
          <section className="bloque">
            <h3>Destinatarios</h3>
            <div className="chips">
              <button
                className="chip"
                onClick={() => setSel(new Set(clientes.map((c) => c.id)))}
              >
                Todos
              </button>
              <button className="chip" onClick={() => setSel(new Set())}>
                Ninguno
              </button>
              <button
                className="chip"
                onClick={() =>
                  setSel(
                    new Set(
                      clientes
                        .filter((c) => c.mensual_estado === "vencido")
                        .map((c) => c.id),
                    ),
                  )
                }
              >
                Solo vencidos
              </button>
            </div>
            <div className="lista-sel">
              {clientes.map((c) => (
                <label key={c.id} className="fila-sel">
                  <input
                    type="checkbox"
                    checked={sel.has(c.id)}
                    onChange={() => alternar(c.id)}
                  />
                  <span>
                    <b>{c.negocio || c.email}</b>
                    <small>{c.email}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="bloque">
            <h3>Mensaje</h3>
            <label className="campo-lbl">
              Asunto
              <input
                className="campo"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
            </label>
            <label className="campo-lbl" style={{ marginTop: 12 }}>
              Cuerpo
              <textarea
                className="campo"
                rows={9}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
              />
            </label>

            <div className="chips" style={{ marginTop: 10 }}>
              {VARIABLES.map((v) => (
                <button
                  key={v.v}
                  className="chip"
                  title={v.d}
                  onClick={() => setCuerpo((t) => t + v.v)}
                >
                  {v.v}
                </button>
              ))}
            </div>

            {previa && (
              <div className="caja-previa">
                <small>Así lo recibe {previa.negocio || previa.email}:</small>
                <b>{render(asunto, previa) || "(sin asunto)"}</b>
                <p>{render(cuerpo, previa) || "(sin cuerpo)"}</p>
              </div>
            )}

            {error && <p className="error">{error}</p>}
            {resultado && <p className="ok-msg">{resultado}</p>}

            <button
              className="btn solido"
              style={{ marginTop: 14 }}
              onClick={enviar}
              disabled={enviando}
            >
              {Ico.correos({ t: 15 })}
              {enviando ? "Enviando…" : `Enviar a ${sel.size}`}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
