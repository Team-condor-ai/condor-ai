import { useMemo, useState } from "react";
import { sb, plata } from "../../lib/supabase";
import { lineasDe, type Cuenta } from "./tipos";

/**
 * Registrar una entrada o una salida de plata.
 *
 * DOS CAMPOS ARRIBA, PARTIDA DOBLE ABAJO
 * ---------------------------------------------------------------------------
 * Quien carga un gasto escribe qué fue y cuánto. El asiento lo arma esto:
 *
 *   Egreso  → Gasto al DEBE, la cuenta de donde salió la plata al HABER.
 *   Ingreso → la cuenta donde entró al DEBE, Ingreso al HABER.
 *
 * Pedirle a alguien que elija "debe" y "haber" para anotar el arriendo es la
 * forma más rápida de que nadie vuelva a anotar nada. La contabilidad correcta
 * tiene que estar abajo, no en el formulario.
 *
 * EL NOMBRE ES OPCIONAL
 * ---------------------------------------------------------------------------
 * Se pidió poder anotar una salida "sin nombre". Si se deja vacío queda como
 * "Egreso sin detalle" con su fecha y su cuenta: sigue siendo un movimiento
 * contable completo, solo que sin glosa. Un gasto sin nombre registrado es
 * infinitamente mejor que un gasto no registrado.
 */
export function RegistrarMovimiento({
  tipo,
  cuentas,
  cerrar,
  guardado,
}: {
  tipo: "ingreso" | "egreso";
  cuentas: Cuenta[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const esEgreso = tipo === "egreso";

  const contrapartes = useMemo(
    () => cuentas.filter((c) => (esEgreso ? c.tipo === "gasto" : c.tipo === "ingreso")),
    [cuentas, esEgreso],
  );
  const liquidas = useMemo(() => cuentas.filter((c) => c.liquida), [cuentas]);

  const [glosa, setGlosa] = useState("");
  const [monto, setMonto] = useState(0);
  const [f, setF] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState(contrapartes[0]?.id ?? "");
  const [medio, setMedio] = useState(liquidas[0]?.id ?? "");
  const [documento, setDocumento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!monto || monto <= 0) { setError("Ponle un monto."); return; }
    if (!categoria || !medio) { setError("Faltan cuentas: corre la migración de contabilidad."); return; }
    setGuardando(true);
    setError("");

    const { data: asiento, error: e1 } = await sb.from("asientos").insert({
      fecha: f,
      glosa: glosa.trim() || (esEgreso ? "Egreso sin detalle" : "Ingreso sin detalle"),
      origen: "manual",
      documento: documento.trim() || null,
    }).select().single();

    if (e1 || !asiento) { setGuardando(false); setError(e1?.message ?? "No se pudo crear el asiento"); return; }

    const m = Math.round(Number(monto) || 0);
    const lineas = esEgreso
      ? lineasDe(categoria, medio, m)   // gasto al debe, la plata sale del medio
      : lineasDe(medio, categoria, m);  // la plata entra al medio, ingreso al haber

    const { error: e2 } = await sb.from("asiento_lineas")
      .insert(lineas.map((l) => ({ ...l, asiento_id: asiento.id })));

    if (e2) {
      // Un asiento con una sola pata descuadra el libro. Si las líneas fallan,
      // el asiento se va con ellas.
      await sb.from("asientos").delete().eq("id", asiento.id);
      setGuardando(false);
      setError(e2.message);
      return;
    }

    setGuardando(false);
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>{esEgreso ? "Registrar egreso" : "Registrar ingreso"}</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Qué fue <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <input
              className="campo"
              autoFocus
              placeholder={esEgreso ? "Ej: arriendo de agosto" : "Ej: pago de Tecnobox"}
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
            />
            <small>Si lo dejas vacío queda como "{esEgreso ? "Egreso" : "Ingreso"} sin detalle".</small>
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Monto
              <input
                className="campo" type="number" min={0} required
                value={monto} onChange={(e) => setMonto(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Fecha
              <input className="campo" type="date" value={f} onChange={(e) => setF(e.target.value)} />
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              {esEgreso ? "Tipo de gasto" : "Tipo de ingreso"}
              <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {contrapartes.map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              {esEgreso ? "De dónde salió" : "Dónde entró"}
              <select className="campo" value={medio} onChange={(e) => setMedio(e.target.value)}>
                {liquidas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="campo-lbl">
            Documento <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <input
              className="campo" placeholder="N.º de boleta o factura"
              value={documento} onChange={(e) => setDocumento(e.target.value)}
            />
          </label>

          {monto > 0 && categoria && medio && (
            <p className="conteo" style={{ lineHeight: 1.6 }}>
              <b>Se va a anotar así:</b><br />
              {esEgreso ? (
                <>
                  <b>{cuentas.find((c) => c.id === categoria)?.nombre}</b> al debe {plata(monto)} ·{" "}
                  <b>{cuentas.find((c) => c.id === medio)?.nombre}</b> al haber {plata(monto)}
                </>
              ) : (
                <>
                  <b>{cuentas.find((c) => c.id === medio)?.nombre}</b> al debe {plata(monto)} ·{" "}
                  <b>{cuentas.find((c) => c.id === categoria)?.nombre}</b> al haber {plata(monto)}
                </>
              )}
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
