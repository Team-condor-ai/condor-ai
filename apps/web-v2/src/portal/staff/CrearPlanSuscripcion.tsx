import { useState } from "react";
import { sb } from "../lib/supabase";
import { MONEDAS } from "./tipos";

type Props = {
  grupoSugerido: string;
  gruposExistentes: string[];
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Crea un plan de suscripción en Mercado Pago y devuelve su link compartible.
 *
 * El plan se crea DE VERDAD en Mercado Pago, no solo en nuestra base: por eso
 * no se puede editar el monto después. Cambiar lo que se cobra significa crear
 * un plan nuevo y pausar el viejo — la gente que ya pagaba sigue en el suyo,
 * que es exactamente lo que corresponde.
 */
export function CrearPlanSuscripcion({ grupoSugerido, gruposExistentes, cerrar, guardado }: Props) {
  const [grupo, setGrupo] = useState(grupoSugerido || "Rat.IA");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState(0);
  const [moneda, setMoneda] = useState("CLP");
  const [frecuencia, setFrecuencia] = useState(1);

  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function crear(ev: React.FormEvent) {
    ev.preventDefault();
    setTrabajando(true);
    setError("");
    try {
      const { data, error } = await sb.functions.invoke("crear-plan-suscripcion", {
        body: {
          grupo: grupo.trim(),
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          monto,
          moneda,
          frecuencia_meses: frecuencia,
        },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; plan?: { init_point?: string }; error?: string };
      if (r?.error) throw new Error(r.error);
      if (!r?.plan?.init_point) throw new Error("Mercado Pago no devolvió un link.");
      setLink(r.plan.init_point);
      guardado();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(
        /not found|404/i.test(m)
          ? "Falta desplegar la Edge Function `crear-plan-suscripcion`. No se creó nada."
          : /MP_ACCESS_TOKEN/i.test(m)
            ? "Falta configurar MP_ACCESS_TOKEN en Supabase. No se creó nada."
            : m,
      );
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el link a mano.");
    }
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={crear}>
        <header>
          <h2>Nuevo plan de suscripción</h2>
        </header>

        <div className="contenido">
          {link ? (
            <>
              <p className="ok-msg">Plan creado. Este es el link para compartir:</p>
              <label className="campo-lbl">
                Link de suscripción
                <input className="campo" readOnly value={link} onFocus={(e) => e.target.select()} />
              </label>
              <div className="botonera">
                <button type="button" className="btn solido" onClick={copiar}>
                  {copiado ? "¡Copiado!" : "Copiar link"}
                </button>
                <a className="btn" href={link} target="_blank" rel="noreferrer">
                  Ver cómo lo ve el cliente
                </a>
              </div>
              <p className="conteo" style={{ marginTop: 10 }}>
                Mándaselo a quien quieras. Cada persona que lo pague queda registrada
                sola en Suscripciones y recibe un correo con el acceso a su portal.
              </p>
            </>
          ) : (
            <>
              <div className="dos">
                <label className="campo-lbl">
                  Carpeta
                  <input
                    className="campo"
                    list="lista-grupos"
                    required
                    placeholder="Rat.IA"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                  />
                  <datalist id="lista-grupos">
                    {gruposExistentes.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </label>
                <label className="campo-lbl">
                  Moneda
                  <select className="campo" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                    {MONEDAS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="campo-lbl">
                Nombre del plan
                <input
                  className="campo"
                  required
                  placeholder="Rat.IA · alertas de precio"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <small>Es lo que la persona ve al pagar y en su resumen de Mercado Pago.</small>
              </label>

              <label className="campo-lbl">
                Descripción
                <input
                  className="campo"
                  placeholder="Alertas de ofertas reales, todos los días"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
                <small>Solo para ustedes; no la ve el suscriptor.</small>
              </label>

              <div className="dos">
                <label className="campo-lbl">
                  Monto
                  <input
                    className="campo"
                    type="number"
                    min={1}
                    required
                    placeholder="2990"
                    value={monto || ""}
                    onChange={(e) => setMonto(Number(e.target.value))}
                  />
                </label>
                <label className="campo-lbl">
                  Se cobra cada
                  <select
                    className="campo"
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(Number(e.target.value))}
                  >
                    <option value={1}>1 mes</option>
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                  </select>
                </label>
              </div>

              <p className="conteo">
                El plan se crea en Mercado Pago y el monto no se puede editar después.
                Para cambiar el precio se crea un plan nuevo y se pausa este; quienes ya
                pagaban siguen en el suyo.
              </p>

              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            {link ? "Cerrar" : "Cancelar"}
          </button>
          {!link && (
            <button className="btn solido" disabled={trabajando || monto <= 0}>
              {trabajando ? "Creando…" : "Crear plan y generar link"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
