import { useState } from "react";
import { sb } from "../lib/supabase";
import { ESTADOS_PAGO, METODOS_PAGO } from "./tipos";

type Props = {
  clienteId: string;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Anota un cobro puntual: un trabajo suelto que no es ni setup ni mensualidad.
 *
 * Es el caso de los encargos que llegan cada tanto y se cobran contra boleta
 * de garantía o por transferencia — nada de eso pasa por Mercado Pago, así que
 * no hay webhook que lo registre solo. Se anota a mano y queda en el mismo
 * historial de pagos que todo lo demás.
 */
export function EditorCobro({ clienteId, cerrar, guardado }: Props) {
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState(METODOS_PAGO[0]);
  const [estado, setEstado] = useState("pagado");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");

    const { error } = await sb.from("pagos").insert({
      cliente_id: clienteId,
      tipo: "puntual",
      detalle: detalle.trim(),
      monto: Number(monto) || 0,
      fecha: fecha || null,
      metodo,
      estado,
    });

    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Anotar cobro</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Qué se hizo
            <input
              className="campo"
              required
              placeholder="Ej: landing para campaña de septiembre"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Monto
              <input
                className="campo"
                type="number"
                min={0}
                required
                value={monto}
                onChange={(e) => setMonto(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Fecha
              <input
                className="campo"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              Cómo se cobra
              <select
                className="campo"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Estado
              <select
                className="campo"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADOS_PAGO.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Anotar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
