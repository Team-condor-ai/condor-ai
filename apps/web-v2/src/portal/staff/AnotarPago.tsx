import { useState } from "react";
import { sb } from "../lib/supabase";
import { ESTADOS_PAGO, METODOS_PAGO, nombreCobro, type Cobro } from "./tipos";

type Props = {
  clienteId: string;
  cobro: Cobro;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Anota a mano un pago de un cobro.
 *
 * Existe porque no toda la plata pasa por Mercado Pago: los encargos que se
 * cobran por transferencia o contra boleta de garantía no tienen webhook que
 * los registre solos. Se anotan acá y quedan en el mismo historial que el resto.
 *
 * VARIOS PAGOS DE UN MISMO COBRO ES LO NORMAL
 * ---------------------------------------------------------------------------
 * Un cobro único que se paga en dos transferencias son DOS pagos del mismo
 * cobro. Por eso no hay campo "abonado": el abono es un pago más, y la suma
 * sale sola del historial.
 */
export function AnotarPago({ clienteId, cobro, cerrar, guardado }: Props) {
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState(cobro.monto ?? 0);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState(METODOS_PAGO[0]);
  const [estado, setEstado] = useState("pagado");
  const [cerrarCobro, setCerrarCobro] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");

    const { error } = await sb.from("pagos").insert({
      cliente_id: clienteId,
      cobro_id: cobro.id,
      tipo: cobro.tipo,
      detalle: detalle.trim() || nombreCobro(cobro),
      monto: Math.round(Number(monto) || 0),
      fecha: fecha || null,
      metodo,
      estado,
    });

    if (error) { setGuardando(false); setError(error.message); return; }

    // Cerrar el cobro es una decisión del que anota, no una consecuencia
    // automática: un pago parcial deja el cobro abierto esperando el resto.
    // En un mensual no se ofrece — un mensual no se "termina" de pagar.
    if (estado === "pagado" && cerrarCobro && cobro.tipo === "unico") {
      await sb.from("cobros").update({ estado: "pagado" }).eq("id", cobro.id);
    }

    setGuardando(false);
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Anotar pago</h2>
        </header>

        <div className="contenido">
          <p className="tenue" style={{ marginTop: 0 }}>
            De <b>{nombreCobro(cobro)}</b>.
          </p>

          <label className="campo-lbl">
            Detalle <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <input
              className="campo"
              placeholder="Ej: primera cuota"
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
              Cómo se cobró
              <select className="campo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="campo-lbl">
              Estado
              <select className="campo" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS_PAGO.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {estado === "pagado" && cobro.tipo === "unico" && (
            <label className="chk">
              <input
                type="checkbox"
                checked={cerrarCobro}
                onChange={(e) => setCerrarCobro(e.target.checked)}
              />
              Dar el cobro por pagado
              <span className="tenue"> · desmárcalo si es un abono parcial</span>
            </label>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Anotar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
