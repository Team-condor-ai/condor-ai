import { useMemo, useState } from "react";
import { sb, plata } from "../../lib/supabase";
import type { Cuenta } from "./tipos";

type Linea = {
  cuenta_id: string;
  debe: number;
  haber: number;
  detalle: string;
};
const vacia = (cuenta = ""): Linea => ({
  cuenta_id: cuenta,
  debe: 0,
  haber: 0,
  detalle: "",
});
export function EditorAsiento({
  cuentas,
  cerrar,
  guardado,
}: {
  cuentas: Cuenta[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [glosa, setGlosa] = useState("");
  const [documento, setDocumento] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([
    vacia(cuentas[0]?.id),
    vacia(cuentas[1]?.id ?? cuentas[0]?.id),
  ]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const total = useMemo(
    () => ({
      debe: lineas.reduce((t, l) => t + (Number(l.debe) || 0), 0),
      haber: lineas.reduce((t, l) => t + (Number(l.haber) || 0), 0),
    }),
    [lineas],
  );
  const set = (i: number, k: keyof Linea, v: string | number) =>
    setLineas((p) => p.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!glosa.trim()) return setError("Escribe una glosa.");
    const validas = lineas.filter(
      (l) => l.cuenta_id && l.debe > 0 !== l.haber > 0,
    );
    if (validas.length < 2 || total.debe !== total.haber || total.debe <= 0)
      return setError(
        "El asiento necesita al menos dos líneas y el debe debe ser igual al haber.",
      );
    setGuardando(true);
    const { data: a, error: e1 } = await sb
      .from("asientos")
      .insert({
        fecha,
        glosa: glosa.trim(),
        documento: documento.trim() || null,
        origen: "manual-contador",
      })
      .select()
      .single();
    if (e1 || !a) {
      setGuardando(false);
      return setError(e1?.message ?? "No se pudo crear el asiento");
    }
    const { error: e2 } = await sb
      .from("asiento_lineas")
      .insert(
        validas.map((l) => ({
          asiento_id: a.id,
          cuenta_id: l.cuenta_id,
          debe: Math.round(l.debe),
          haber: Math.round(l.haber),
          detalle: l.detalle.trim() || null,
        })),
      );
    if (e2) {
      await sb.from("asientos").delete().eq("id", a.id);
      setGuardando(false);
      setError(e2.message);
    } else guardado();
  }
  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal asiento-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <div>
            <h2>Asiento contable manual</h2>
            <small>
              Partida doble para ajustes, activos, pasivos y patrimonio
            </small>
          </div>
        </header>
        <div className="contenido">
          <div className="dos">
            <label className="campo-lbl">
              Fecha
              <input
                className="campo"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="campo-lbl">
              Documento
              <input
                className="campo"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Factura, comprobante…"
              />
            </label>
          </div>
          <label className="campo-lbl">
            Glosa
            <input
              className="campo"
              autoFocus
              required
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              placeholder="Descripción del hecho económico"
            />
          </label>
          <div className="asiento-lineas">
            <div className="asiento-head">
              <span>Cuenta</span>
              <span>Detalle</span>
              <span>Debe</span>
              <span>Haber</span>
              <span />
            </div>
            {lineas.map((l, i) => (
              <div className="asiento-linea" key={i}>
                <select
                  className="campo"
                  value={l.cuenta_id}
                  onChange={(e) => set(i, "cuenta_id", e.target.value)}
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className="campo"
                  value={l.detalle}
                  onChange={(e) => set(i, "detalle", e.target.value)}
                  placeholder="Opcional"
                />
                <input
                  className="campo num"
                  type="number"
                  min={0}
                  value={l.debe || ""}
                  onChange={(e) => {
                    set(i, "debe", Number(e.target.value));
                    if (e.target.value) set(i, "haber", 0);
                  }}
                />
                <input
                  className="campo num"
                  type="number"
                  min={0}
                  value={l.haber || ""}
                  onChange={(e) => {
                    set(i, "haber", Number(e.target.value));
                    if (e.target.value) set(i, "debe", 0);
                  }}
                />
                <button
                  type="button"
                  className="icono-btn peligro"
                  onClick={() => setLineas((p) => p.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn chico"
            onClick={() => setLineas((p) => [...p, vacia(cuentas[0]?.id)])}
          >
            + Línea
          </button>
          <div
            className={
              "asiento-cuadre " +
              (total.debe === total.haber && total.debe > 0 ? "ok" : "mal")
            }
          >
            <span>
              Debe <b>{plata(total.debe)}</b>
            </span>
            <span>
              Haber <b>{plata(total.haber)}</b>
            </span>
            <strong>
              {total.debe === total.haber && total.debe > 0
                ? "Cuadrado"
                : `Diferencia ${plata(Math.abs(total.debe - total.haber))}`}
            </strong>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Registrar asiento"}
          </button>
        </footer>
      </form>
    </div>
  );
}
