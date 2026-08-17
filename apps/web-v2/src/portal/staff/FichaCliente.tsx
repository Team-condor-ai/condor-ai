import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb, plata, fecha, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorCliente } from "./EditorCliente";
import type { Cliente, Pago } from "./tipos";

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="dato">
      <small>{k}</small>
      <b>{v || "—"}</b>
    </div>
  );
}

export function FichaCliente() {
  const { id } = useParams();
  const [c, setC] = useState<Cliente | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("clientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) setError(error.message);
    else setC(data as Cliente | null);

    const { data: p } = await sb
      .from("pagos")
      .select("*")
      .eq("cliente_id", id)
      .order("creado_en", { ascending: false });
    setPagos((p ?? []) as Pago[]);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (cargando) return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;
  if (error) return <div className="cuerpo"><p className="error">{error}</p></div>;
  if (!c)
    return (
      <div className="cuerpo">
        <p className="vacio">Ese cliente no existe o no tienes acceso.</p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <Link to="/acceso/clientes" className="icono-btn" title="Volver">
          {Ico.volver({ t: 16 })}
        </Link>
        <h1>{c.negocio || c.email}</h1>
        <button className="btn" onClick={() => setEditando(true)}>
          Editar
        </button>
      </div>

      <div className="cuerpo">
        <section className="bloque">
          <h3>Datos</h3>
          <div className="rejilla-datos">
            <Dato k="Correo" v={c.email} />
            <Dato k="Negocio" v={c.negocio} />
            <Dato k="Plan" v={c.plan} />
            <Dato k="Cliente desde" v={fecha(c.creado_en)} />
            <Dato
              k="Web entregada"
              v={
                c.web_url ? (
                  <a href={enlaceWeb(c.web_url)} target="_blank" rel="noreferrer">
                    {c.web_url}
                  </a>
                ) : null
              }
            />
            <Dato k="Estado" v={c.archivado ? "Archivado" : "Activo"} />
          </div>
        </section>

        <section className="bloque">
          <h3>Servicio contratado</h3>
          <p className="parrafo">{c.concepto || "Sin descripción todavía."}</p>
        </section>

        <section className="bloque">
          <h3>Cobros</h3>
          <div className="rejilla-datos">
            <Dato k="Setup" v={`${plata(c.setup_monto, c.moneda)} · ${c.setup_estado ?? "—"}`} />
            <Dato
              k="Mensualidad"
              v={`${plata(c.mensual_monto, c.moneda)} · ${(c.mensual_estado ?? "—").replace("_", " ")}`}
            />
            <Dato k="Próximo cobro" v={fecha(c.proximo_cobro)} />
          </div>
        </section>

        <section className="bloque">
          <h3>Historial de pagos</h3>
          {pagos.length === 0 ? (
            <p className="vacio">
              Todavía no hay pagos registrados. Se llenan solos cuando el
              webhook de MercadoPago confirme uno.
            </p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th className="num">Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td>{fecha(p.creado_en)}</td>
                      <td>{p.tipo ?? "—"}</td>
                      <td className="num">{plata(p.monto, c.moneda)}</td>
                      <td>
                        <span
                          className={
                            "pill " + (p.estado === "pagado" ? "ok" : "warn")
                          }
                        >
                          {p.estado ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editando && (
        <EditorCliente
          cliente={c}
          cerrar={() => setEditando(false)}
          guardado={() => {
            setEditando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
