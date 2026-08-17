import { useState } from "react";
import { sb } from "../lib/supabase";
import { MONEDAS, type Producto } from "./tipos";

type Props = {
  producto: Producto | null;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Alta y edición de un producto del catálogo. `producto === null` = "nuevo".
 *
 * "GENERAR CON IA" NO GUARDA SOLO — mismo patrón que `BrandBookEditor.tsx`:
 * llama a la Edge Function `sugerir-producto` (Claude Sonnet) y PRELLENA el
 * formulario. Staff revisa y edita antes de apretar "Guardar".
 */
export function EditorProducto({ producto, cerrar, guardado }: Props) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [caracteristicas, setCaracteristicas] = useState(
    (producto?.caracteristicas ?? []).join("\n"),
  );
  const [setup, setSetup] = useState(producto?.precio_setup_sugerido ?? 0);
  const [mensual, setMensual] = useState(producto?.precio_mensual_sugerido ?? 0);
  const [moneda, setMoneda] = useState(producto?.moneda ?? "CLP");
  const [activo, setActivo] = useState(producto?.activo ?? true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [contexto, setContexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const [errorIA, setErrorIA] = useState("");

  async function generarConIA() {
    if (!nombre.trim()) {
      setErrorIA("Escribe primero el nombre del producto.");
      return;
    }
    setGenerando(true);
    setErrorIA("");
    try {
      const { data, error } = await sb.functions.invoke("sugerir-producto", {
        body: { nombre, contexto: contexto.trim() || null },
      });
      if (error) throw error;
      const propuesta = (
        data as {
          propuesta?: {
            descripcion?: string;
            caracteristicas?: string[];
            precio_setup_sugerido?: number;
            precio_mensual_sugerido?: number;
          };
        }
      ).propuesta;
      if (!propuesta) throw new Error("La IA no devolvió una propuesta.");
      // Prellena — NO guarda. Staff revisa y edita antes de "Guardar".
      if (propuesta.descripcion) setDescripcion(propuesta.descripcion);
      if (propuesta.caracteristicas?.length)
        setCaracteristicas(propuesta.caracteristicas.join("\n"));
      if (typeof propuesta.precio_setup_sugerido === "number")
        setSetup(propuesta.precio_setup_sugerido);
      if (typeof propuesta.precio_mensual_sugerido === "number")
        setMensual(propuesta.precio_mensual_sugerido);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorIA(
        /not found|404|failed to send/i.test(msg)
          ? "Falta desplegar la Edge Function `sugerir-producto`."
          : msg,
      );
    } finally {
      setGenerando(false);
    }
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");

    const fila = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      caracteristicas: caracteristicas
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      precio_setup_sugerido: Number(setup) || 0,
      precio_mensual_sugerido: Number(mensual) || 0,
      moneda,
      activo,
    };

    const q = producto
      ? sb.from("productos").update(fila).eq("id", producto.id)
      : sb.from("productos").insert(fila);
    const { error } = await q;
    setGuardando(false);
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
          <h2>{producto ? "Editar producto" : "Nuevo producto"}</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Nombre
            <input
              className="campo"
              required
              placeholder="Ej: Bárbara"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          <div className="aviso" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <b>Generar con IA</b>
            <small>
              Con el nombre (y algo de contexto, opcional) Claude redacta una
              descripción, características y precio sugerido. Revisa y edita
              antes de guardar — no se guarda solo.
            </small>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="campo"
                placeholder="Contexto opcional: qué hace, para quién…"
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={generarConIA}
                disabled={generando}
              >
                {generando ? "Generando…" : "Generar"}
              </button>
            </div>
            {errorIA && <p className="error">{errorIA}</p>}
          </div>

          <label className="campo-lbl">
            Descripción
            <textarea
              className="campo"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Características (una por línea)
            <textarea
              className="campo"
              rows={4}
              value={caracteristicas}
              onChange={(e) => setCaracteristicas(e.target.value)}
            />
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Setup sugerido
              <input
                className="campo"
                type="number"
                min={0}
                value={setup}
                onChange={(e) => setSetup(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Mensual sugerido
              <input
                className="campo"
                type="number"
                min={0}
                value={mensual}
                onChange={(e) => setMensual(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              Moneda
              <select
                className="campo"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Estado
              <select
                className="campo"
                value={activo ? "activo" : "inactivo"}
                onChange={(e) => setActivo(e.target.value === "activo")}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
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
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
