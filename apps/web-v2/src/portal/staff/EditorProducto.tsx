import { useMemo, useState } from "react";
import { sb, plata } from "../lib/supabase";
import { MONEDAS, type Producto } from "./tipos";

type Props = {
  producto: Producto | null;
  cerrar: () => void;
  guardado: () => void;
};

export function EditorProducto({ producto, cerrar, guardado }: Props) {
  const [f, setF] = useState({
    nombre: producto?.nombre ?? "",
    codigo: producto?.codigo ?? "",
    familia: producto?.familia ?? "",
    estado:
      producto?.estado ??
      (producto?.activo === false ? "descontinuado" : "activo"),
    resumen: producto?.resumen ?? "",
    descripcion: producto?.descripcion ?? "",
    caracteristicas: (producto?.caracteristicas ?? []).join("\n"),
    setup: producto?.precio_setup_sugerido ?? 0,
    mensual: producto?.precio_mensual_sugerido ?? 0,
    costoSetup: producto?.costo_setup ?? 0,
    costoMensual: producto?.costo_mensual ?? 0,
    moneda: producto?.moneda ?? "CLP",
    frecuencia: producto?.frecuencia_meses ?? 1,
    repo: producto?.repo_url ?? "",
    sitio: producto?.sitio_url ?? "",
    docs: producto?.docs_url ?? "",
    notas: producto?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const margen = useMemo(() => {
    const venta = Number(f.mensual) || 0,
      costo = Number(f.costoMensual) || 0;
    return venta > 0 ? ((venta - costo) / venta) * 100 : null;
  }, [f.mensual, f.costoMensual]);
  const set = (k: keyof typeof f, v: string | number) =>
    setF((p) => ({ ...p, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) return setError("El producto necesita un nombre.");
    setGuardando(true);
    setError("");
    const fila = {
      nombre: f.nombre.trim(),
      codigo: f.codigo.trim() || null,
      familia: f.familia.trim() || null,
      estado: f.estado,
      activo: f.estado === "activo",
      resumen: f.resumen.trim() || null,
      descripcion: f.descripcion.trim() || null,
      caracteristicas: f.caracteristicas
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      precio_setup_sugerido: Math.round(Number(f.setup) || 0),
      precio_mensual_sugerido: Math.round(Number(f.mensual) || 0),
      costo_setup: Math.round(Number(f.costoSetup) || 0),
      costo_mensual: Math.round(Number(f.costoMensual) || 0),
      moneda: f.moneda,
      frecuencia_meses: Number(f.frecuencia) || 1,
      repo_url: f.repo.trim() || null,
      sitio_url: f.sitio.trim() || null,
      docs_url: f.docs.trim() || null,
      notas: f.notas.trim() || null,
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
        className="panel-modal panel-producto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <div>
            <h2>{producto ? "Editar producto" : "Nuevo producto"}</h2>
            <small>Catálogo, precio, costo y entrega</small>
          </div>
        </header>
        <div className="contenido">
          <div className="form-seccion">
            <b>Identidad comercial</b>
            <span>Cómo se encuentra y presenta en el catálogo.</span>
          </div>
          <div className="dos">
            <label className="campo-lbl">
              Nombre
              <input
                className="campo"
                autoFocus
                required
                value={f.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Ej: Bárbara Go"
              />
            </label>
            <label className="campo-lbl">
              Código / SKU
              <input
                className="campo"
                value={f.codigo}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="BAR-GO-M"
              />
            </label>
          </div>
          <div className="dos">
            <label className="campo-lbl">
              Familia
              <input
                className="campo"
                value={f.familia}
                onChange={(e) => set("familia", e.target.value)}
                placeholder="Contenido con IA"
              />
            </label>
            <label className="campo-lbl">
              Estado
              <select
                className="campo"
                value={f.estado}
                onChange={(e) => set("estado", e.target.value)}
              >
                <option value="borrador">Borrador</option>
                <option value="activo">Activo · se puede vender</option>
                <option value="descontinuado">Descontinuado</option>
              </select>
            </label>
          </div>
          <label className="campo-lbl">
            Resumen
            <input
              className="campo"
              value={f.resumen}
              onChange={(e) => set("resumen", e.target.value)}
              maxLength={120}
              placeholder="Una frase para reconocerlo en la lista"
            />
          </label>
          <label className="campo-lbl">
            Descripción
            <textarea
              className="campo"
              rows={3}
              value={f.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Incluye · un ítem por línea
            <textarea
              className="campo"
              rows={4}
              value={f.caracteristicas}
              onChange={(e) => set("caracteristicas", e.target.value)}
              placeholder={
                "Estrategia mensual\n12 piezas\nReporte de resultados"
              }
            />
          </label>

          <div className="form-seccion">
            <b>Economía del producto</b>
            <span>Precio y costo directo para calcular margen real.</span>
          </div>
          <div className="tres-campos">
            <label className="campo-lbl">
              Setup · venta
              <input
                className="campo"
                type="number"
                min={0}
                value={f.setup}
                onChange={(e) => set("setup", Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Setup · costo
              <input
                className="campo"
                type="number"
                min={0}
                value={f.costoSetup}
                onChange={(e) => set("costoSetup", Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Moneda
              <select
                className="campo"
                value={f.moneda}
                onChange={(e) => set("moneda", e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="tres-campos">
            <label className="campo-lbl">
              Recurrente · venta
              <input
                className="campo"
                type="number"
                min={0}
                value={f.mensual}
                onChange={(e) => set("mensual", Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Recurrente · costo
              <input
                className="campo"
                type="number"
                min={0}
                value={f.costoMensual}
                onChange={(e) => set("costoMensual", Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Cada
              <select
                className="campo"
                value={f.frecuencia}
                onChange={(e) => set("frecuencia", Number(e.target.value))}
              >
                <option value={1}>1 mes</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
              </select>
            </label>
          </div>
          <div
            className={
              "margen-preview " + ((margen ?? 0) >= 40 ? "sano" : "alerta")
            }
          >
            <span>Margen recurrente estimado</span>
            <b>{margen === null ? "—" : `${margen.toFixed(1)}%`}</b>
            <small>
              {plata(
                (Number(f.mensual) || 0) - (Number(f.costoMensual) || 0),
                f.moneda,
              )}{" "}
              de contribución por ciclo
            </small>
          </div>

          <div className="form-seccion">
            <b>Entrega y operación</b>
            <span>Accesos internos que acompañan al producto.</span>
          </div>
          <label className="campo-lbl">
            Repositorio
            <input
              className="campo"
              value={f.repo}
              onChange={(e) => set("repo", e.target.value)}
              placeholder="github.com/…"
            />
          </label>
          <div className="dos">
            <label className="campo-lbl">
              Sitio / demo
              <input
                className="campo"
                value={f.sitio}
                onChange={(e) => set("sitio", e.target.value)}
              />
            </label>
            <label className="campo-lbl">
              Documentación
              <input
                className="campo"
                value={f.docs}
                onChange={(e) => set("docs", e.target.value)}
              />
            </label>
          </div>
          <label className="campo-lbl">
            Notas internas
            <textarea
              className="campo"
              rows={2}
              value={f.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar producto"}
          </button>
        </footer>
      </form>
    </div>
  );
}
