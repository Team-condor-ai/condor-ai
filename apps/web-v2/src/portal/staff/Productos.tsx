import { useEffect, useMemo, useState } from "react";
import { sb, plata, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorProducto } from "./EditorProducto";
import type { Producto } from "./tipos";

export function Productos() {
  const [filas, setFilas] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("productos")
      .select("*")
      .order("creado_en", { ascending: false });
    if (error) setError(error.message);
    else {
      setFilas((data ?? []) as Producto[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((p) =>
      [p.nombre, p.descripcion].filter(Boolean).some((t) => String(t).toLowerCase().includes(q)),
    );
  }, [filas, busca]);

  async function eliminar(p: Producto) {
    const ok = window.confirm(
      `¿Eliminar "${p.nombre}" del catálogo? No se puede deshacer.`,
    );
    if (!ok) return;
    const { error } = await sb.from("productos").delete().eq("id", p.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <h1>Productos</h1>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>
          {Ico.mas({ t: 15 })} Nuevo producto
        </button>
      </div>

      <div className="fila-busca">
        <div className="mini-busca">
          {Ico.buscar({ t: 15 })}
          <input
            placeholder="Buscar producto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}
        {cargando && <p className="vacio">Cargando…</p>}

        {!cargando && visibles.length === 0 && (
          <p className="vacio">
            {filas.length === 0
              ? "Todavía no hay productos en el catálogo. Crea el primero."
              : "Ningún producto calza con esa búsqueda."}
          </p>
        )}

        {!cargando && visibles.length > 0 && (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Setup</th>
                  <th className="num">Mensual</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.nombre}</b>
                      {p.descripcion && <small>{p.descripcion}</small>}
                    </td>
                    <td className="num">{plata(p.precio_setup_sugerido, p.moneda)}</td>
                    <td className="num">{plata(p.precio_mensual_sugerido, p.moneda)}</td>
                    <td>
                      <span className={`pill ${p.activo ? "ok" : "gris"}`}>
                        {p.activo ? "activo" : "inactivo"}
                      </span>
                    </td>
                    <td className="acciones">
                      {p.repo_url && (
                        <a
                          className="icono-btn"
                          title="Abrir repositorio en GitHub"
                          href={enlaceWeb(p.repo_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {Ico.github({ t: 15 })}
                        </a>
                      )}
                      {p.sitio_url && (
                        <a
                          className="icono-btn"
                          title="Abrir sitio / demo"
                          href={enlaceWeb(p.sitio_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {Ico.abrirWeb({ t: 15 })}
                        </a>
                      )}
                      {p.docs_url && (
                        <a
                          className="icono-btn"
                          title="Abrir documentación"
                          href={enlaceWeb(p.docs_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {Ico.documentos({ t: 15 })}
                        </a>
                      )}
                      <button
                        className="icono-btn"
                        title="Editar"
                        onClick={() => setEditando(p)}
                      >
                        {Ico.ajustes({ t: 15 })}
                      </button>
                      <button
                        className="icono-btn peligro"
                        title="Eliminar"
                        onClick={() => eliminar(p)}
                      >
                        {Ico.eliminar({ t: 15 })}
                      </button>
                    </td>
                  </tr>
                ))}
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
