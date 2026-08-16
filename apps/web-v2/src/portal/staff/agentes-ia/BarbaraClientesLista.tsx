import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { AgregarBarbaraCliente } from "./AgregarBarbaraCliente";
import type { BarbaraClienteFila } from "../../agentes-ia/tipos";

/**
 * Lista de clientes de Bárbara: negocio, rubro, plan, activo/inactivo y si
 * está bloqueado por reintentos (join a `barbara_correcciones.bloqueado`).
 */
export function BarbaraClientesLista() {
  const [filas, setFilas] = useState<BarbaraClienteFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [agregando, setAgregando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("barbara_clientes")
      .select("*, clientes(negocio,email), barbara_correcciones(bloqueado)")
      .order("creado_en", { ascending: false });
    if (error) setError(error.message);
    else {
      setFilas((data ?? []) as unknown as BarbaraClienteFila[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <div className="fila-busca" style={{ justifyContent: "flex-end" }}>
        <button className="btn solido" onClick={() => setAgregando(true)}>
          {Ico.mas({ t: 15 })} Agregar
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="vacio">Cargando…</p>}

      {!cargando && filas.length === 0 && !error && (
        <p className="vacio">
          Todavía no hay clientes en Bárbara. Agrega el primero.
        </p>
      )}

      {!cargando && filas.length > 0 && (
        <div className="tabla-caja">
          <table>
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Rubro</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Alta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const bloqueado = Boolean(f.barbara_correcciones?.[0]?.bloqueado);
                return (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/acceso/agentes-ia/${f.id}`} className="enlace-tabla">
                        <b>{f.clientes?.negocio || f.clientes?.email || "—"}</b>
                        <small>{f.clientes?.email}</small>
                      </Link>
                    </td>
                    <td>{f.rubro || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{f.plan}</td>
                    <td>
                      <span className={"pill " + (f.activo ? "ok" : "gris")}>
                        {f.activo ? "Activo" : "Inactivo"}
                      </span>
                      {bloqueado && (
                        <span className="pill mal" style={{ marginLeft: 6 }}>
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td>{fecha(f.creado_en)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {agregando && (
        <AgregarBarbaraCliente
          cerrar={() => setAgregando(false)}
          guardado={() => {
            setAgregando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
