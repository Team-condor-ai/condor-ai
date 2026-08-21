import { useEffect, useMemo, useState } from "react";
import { sb, plata, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorProducto } from "./EditorProducto";
import type { Cobro, Producto } from "./tipos";
import { useCambio } from "../lib/cambio";

type Estado = "todos" | "activo" | "borrador" | "descontinuado";

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<Estado>("todos");
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);
  const cambio = useCambio();

  async function cargar() {
    setCargando(true);
    const [p, c] = await Promise.all([
      sb.from("productos").select("*").order("orden").order("nombre"),
      sb.from("cobros").select("*"),
    ]);
    if (p.error) setError(p.error.message);
    else setError("");
    setProductos((p.data ?? []) as Producto[]);
    setCobros((c.data ?? []) as Cobro[]);
    setCargando(false);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const rendimiento = useMemo(() => {
    const mapa = new Map<string, { clientes: number; mrr: number }>();
    for (const p of productos) {
      const suyos = cobros.filter(
        (c) =>
          c.producto_id === p.id &&
          !["anulado", "cancelada"].includes(c.estado),
      );
      mapa.set(p.id, {
        clientes: new Set(suyos.map((c) => c.cliente_id)).size,
        mrr: suyos
          .filter((c) => c.tipo === "mensual" && c.estado === "activa")
          .reduce(
            (t, c) =>
              t +
              cambio.aCLP(c.monto, c.moneda) /
                Math.max(1, p.frecuencia_meses || 1),
            0,
          ),
      });
    }
    return mapa;
  }, [productos, cobros, cambio]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter((p) => {
      const e = p.estado ?? (p.activo ? "activo" : "descontinuado");
      return (
        (estado === "todos" || e === estado) &&
        (!q ||
          [p.nombre, p.codigo, p.familia, p.resumen, p.descripcion].some((x) =>
            String(x ?? "")
              .toLowerCase()
              .includes(q),
          ))
      );
    });
  }, [productos, busca, estado]);

  const totales = useMemo(() => {
    const activos = productos.filter(
      (p) => (p.estado ?? (p.activo ? "activo" : "descontinuado")) === "activo",
    );
    const mrr = activos.reduce(
      (t, p) => t + (rendimiento.get(p.id)?.mrr ?? 0),
      0,
    );
    const costo = activos.reduce(
      (t, p) =>
        t +
        (rendimiento.get(p.id)?.clientes ?? 0) *
          cambio.aCLP(p.costo_mensual ?? 0, p.moneda),
      0,
    );
    return {
      activos: activos.length,
      clientes: new Set(
        cobros
          .filter(
            (c) =>
              c.producto_id && !["anulado", "cancelada"].includes(c.estado),
          )
          .map((c) => c.cliente_id),
      ).size,
      mrr,
      margen: mrr > 0 ? ((mrr - costo) / mrr) * 100 : null,
    };
  }, [productos, cobros, rendimiento, cambio]);

  async function descontinuar(p: Producto) {
    if (
      !window.confirm(
        `¿Descontinuar “${p.nombre}”? Seguirá visible en clientes e historial, pero no se podrá asignar a nuevos cobros.`,
      )
    )
      return;
    const { error } = await sb
      .from("productos")
      .update({ estado: "descontinuado", activo: false })
      .eq("id", p.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <div>
          <h1>Productos</h1>
          <small className="subtitulo-barra">
            Catálogo, economía y adopción
          </small>
        </div>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>
          {Ico.mas({ t: 15 })} Nuevo producto
        </button>
      </div>
      <div className="cuerpo">
        {error && <p className="error">{error}</p>}
        <div className="kpis">
          <div className="kpi">
            <div className="tile">{Ico.producto({ t: 18 })}</div>
            <div className="cifra">
              <b>{totales.activos}</b>
            </div>
            <p>Productos vendibles</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.clientes({ t: 18 })}</div>
            <div className="cifra">
              <b>{totales.clientes}</b>
            </div>
            <p>Clientes con producto asignado</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(totales.mrr)}</b>
            </div>
            <p>Ingreso recurrente conectado</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.grafo({ t: 18 })}</div>
            <div className="cifra">
              <b>
                {totales.margen === null
                  ? "—"
                  : `${totales.margen.toFixed(1)}%`}
              </b>
            </div>
            <p>Margen recurrente estimado</p>
          </div>
        </div>
        <div className="barra-filtros">
          <div className="mini-busca">
            {Ico.buscar({ t: 15 })}
            <input
              placeholder="Buscar nombre, familia o código…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="chips sin-margen">
            {(["todos", "activo", "borrador", "descontinuado"] as Estado[]).map(
              (e) => (
                <button
                  key={e}
                  className={"chip" + (estado === e ? " on" : "")}
                  onClick={() => setEstado(e)}
                >
                  {e[0].toUpperCase() + e.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>
        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="vacio">No hay productos que coincidan.</p>
        ) : (
          <div className="tabla-caja scroll-x">
            <table className="tabla-productos">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Venta</th>
                  <th className="num">Costo directo</th>
                  <th className="num">Margen</th>
                  <th className="num">Clientes</th>
                  <th className="num">MRR</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const r = rendimiento.get(p.id) ?? { clientes: 0, mrr: 0 };
                  const margen =
                    (p.precio_mensual_sugerido ?? 0) > 0
                      ? (((p.precio_mensual_sugerido ?? 0) -
                          (p.costo_mensual ?? 0)) /
                          (p.precio_mensual_sugerido ?? 1)) *
                        100
                      : null;
                  const est =
                    p.estado ?? (p.activo ? "activo" : "descontinuado");
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="celda-prod">
                          <span className="av">
                            {p.nombre.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <b>{p.nombre}</b>
                            <small>
                              {p.codigo ||
                                p.familia ||
                                p.resumen ||
                                "Sin familia"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <b>{plata(p.precio_mensual_sugerido, p.moneda)}</b>
                        <small>
                          {p.precio_setup_sugerido
                            ? ` + ${plata(p.precio_setup_sugerido, p.moneda)} setup`
                            : " recurrente"}
                        </small>
                      </td>
                      <td className="num">
                        {plata(p.costo_mensual ?? 0, p.moneda)}
                      </td>
                      <td className="num">
                        <span
                          className={
                            "pill " + ((margen ?? 0) >= 40 ? "ok" : "warn")
                          }
                        >
                          {margen === null ? "—" : `${margen.toFixed(0)}%`}
                        </span>
                      </td>
                      <td className="num">{r.clientes}</td>
                      <td className="num">
                        <b>{plata(r.mrr)}</b>
                      </td>
                      <td>
                        <span
                          className={
                            "pill " +
                            (est === "activo"
                              ? "ok"
                              : est === "borrador"
                                ? "warn"
                                : "gris")
                          }
                        >
                          {est}
                        </span>
                      </td>
                      <td className="acciones">
                        <div className="acciones-inline">
                          {p.sitio_url && (
                            <a
                              className="icono-btn"
                              href={enlaceWeb(p.sitio_url)}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir demo"
                            >
                              {Ico.abrirWeb({ t: 15 })}
                            </a>
                          )}
                          <button
                            className="icono-btn"
                            onClick={() => setEditando(p)}
                            title="Editar"
                          >
                            {Ico.ajustes({ t: 15 })}
                          </button>
                          {est !== "descontinuado" && (
                            <button
                              className="icono-btn peligro"
                              onClick={() => descontinuar(p)}
                              title="Descontinuar"
                            >
                              {Ico.archivar({ t: 15 })}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <EditorProducto
          producto={editando === "nuevo" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
