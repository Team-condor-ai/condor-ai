import { useState } from "react";
import { sb } from "../../lib/supabase";
import type { Cuenta } from "./tipos";

export function EditorCuenta({
  cuenta,
  cerrar,
  guardado,
}: {
  cuenta?: Cuenta | null;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [f, setF] = useState({
    codigo: cuenta?.codigo ?? "",
    nombre: cuenta?.nombre ?? "",
    tipo: cuenta?.tipo ?? "activo",
    corriente: cuenta?.corriente ?? true,
    liquida: cuenta?.liquida ?? false,
  });
  const [error, setError] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const fila = {
      ...f,
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      liquida: f.tipo === "activo" && f.liquida,
    };
    const q = cuenta
      ? sb.from("cuentas").update(fila).eq("id", cuenta.id)
      : sb.from("cuentas").insert(fila);
    const { error } = await q;
    if (error) setError(error.message);
    else guardado();
  }
  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <h2>{cuenta ? "Editar cuenta" : "Nueva cuenta contable"}</h2>
        </header>
        <div className="contenido">
          <div className="dos">
            <label className="campo-lbl">
              Código
              <input
                className="campo"
                required
                autoFocus
                value={f.codigo}
                onChange={(e) => setF({ ...f, codigo: e.target.value })}
                placeholder="Ej: 1104"
              />
            </label>
            <label className="campo-lbl">
              Tipo
              <select
                className="campo"
                value={f.tipo}
                onChange={(e) =>
                  setF({
                    ...f,
                    tipo: e.target.value as typeof f.tipo,
                    liquida: e.target.value === "activo" ? f.liquida : false,
                  })
                }
              >
                {["activo", "pasivo", "patrimonio", "ingreso", "gasto"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label className="campo-lbl">
            Nombre
            <input
              className="campo"
              required
              value={f.nombre}
              onChange={(e) => setF({ ...f, nombre: e.target.value })}
              placeholder="Ej: Cuenta corriente Banco Estado"
            />
          </label>
          <label className="fila-check">
            <input
              type="checkbox"
              checked={f.corriente}
              onChange={(e) => setF({ ...f, corriente: e.target.checked })}
            />
            <span>
              <b>Corriente</b>
              <small>Se realiza, consume o paga dentro de 12 meses.</small>
            </span>
          </label>
          {f.tipo === "activo" && (
            <label className="fila-check">
              <input
                type="checkbox"
                checked={f.liquida}
                onChange={(e) => setF({ ...f, liquida: e.target.checked })}
              />
              <span>
                <b>Dinero disponible</b>
                <small>Se suma a la liquidez visible en el resumen.</small>
              </span>
            </label>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido">Guardar cuenta</button>
        </footer>
      </form>
    </div>
  );
}
