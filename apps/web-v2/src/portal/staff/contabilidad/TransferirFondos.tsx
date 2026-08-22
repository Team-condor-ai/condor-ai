import { useMemo, useState } from "react";
import { sb, plata } from "../../lib/supabase";
import type { Cuenta } from "./tipos";

/**
 * Mueve plata entre dos cuentas líquidas con un solo asiento balanceado.
 *
 * No es un ingreso ni un egreso: la plata sigue perteneciendo a la empresa.
 * El RPC valida las cuentas y escribe asiento + líneas en una transacción, de
 * modo que nunca quede solo la salida o solo la entrada.
 */
export function TransferirFondos({
  cuentas,
  cerrar,
  guardado,
}: {
  cuentas: Cuenta[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const liquidas = useMemo(
    () => cuentas.filter((cuenta) => cuenta.liquida && cuenta.activa),
    [cuentas],
  );
  const [origen, setOrigen] = useState(
    liquidas.find((cuenta) => cuenta.codigo === "1103")?.id ?? liquidas[0]?.id ?? "",
  );
  const [destino, setDestino] = useState(
    liquidas.find((cuenta) => cuenta.codigo === "1102")?.id ?? liquidas[1]?.id ?? "",
  );
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [detalle, setDetalle] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cuentaOrigen = liquidas.find((cuenta) => cuenta.id === origen);
  const cuentaDestino = liquidas.find((cuenta) => cuenta.id === destino);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    const valor = Math.round(Number(monto) || 0);
    if (liquidas.length < 2) {
      setError("Se necesitan al menos dos cuentas líquidas activas.");
      return;
    }
    if (!origen || !destino || origen === destino) {
      setError("Elige dos cuentas distintas.");
      return;
    }
    if (valor <= 0) {
      setError("Ponle un monto mayor que cero.");
      return;
    }

    setGuardando(true);
    setError("");
    const { error: fallo } = await sb.rpc("registrar_traspaso_fondos", {
      p_origen: origen,
      p_destino: destino,
      p_monto: valor,
      p_fecha: fecha,
      p_glosa: detalle.trim() || null,
    });
    setGuardando(false);
    if (fallo) {
      setError(fallo.message);
      return;
    }
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Mover fondos</h2>
        </header>

        <div className="contenido">
          <p className="tenue" style={{ marginTop: 0 }}>
            Registra un traspaso interno sin inventar un egreso y otro ingreso.
          </p>

          <div className="dos">
            <label className="campo-lbl">
              Desde
              <select className="campo" value={origen} onChange={(e) => setOrigen(e.target.value)} autoFocus>
                {liquidas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Hacia
              <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
                {liquidas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              Monto
              <input
                className="campo"
                type="number"
                min={1}
                required
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Fecha
              <input className="campo" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>

          <label className="campo-lbl">
            Detalle <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <input
              className="campo"
              placeholder="Ej: retiro semanal de Mercado Pago"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </label>

          {monto > 0 && cuentaOrigen && cuentaDestino && origen !== destino && (
            <p className="conteo" style={{ lineHeight: 1.6 }}>
              <b>Se va a anotar así:</b><br />
              <b>{cuentaDestino.nombre}</b> al debe {plata(monto)} ·{" "}
              <b>{cuentaOrigen.nombre}</b> al haber {plata(monto)}
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando || liquidas.length < 2}>
            {guardando ? "Moviendo…" : "Mover fondos"}
          </button>
        </footer>
      </form>
    </div>
  );
}
