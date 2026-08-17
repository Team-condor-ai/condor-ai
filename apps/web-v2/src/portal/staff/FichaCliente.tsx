import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb, plata, fecha, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorCliente } from "./EditorCliente";
import { EditorCobro } from "./EditorCobro";
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
  const [anotando, setAnotando] = useState(false);

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

        {/* Solo se muestra lo que este cliente efectivamente cobra: para uno
            de encargos sueltos, un bloque con "Setup $0 · pendiente" no dice
            nada y encima confunde. */}
        {(c.cobra_setup ?? true) || (c.cobra_mensual ?? true) ? (
          <section className="bloque">
            <h3>Cobros</h3>
            <div className="rejilla-datos">
              {(c.cobra_setup ?? true) && (
                <Dato k="Setup" v={`${plata(c.setup_monto, c.moneda)} · ${c.setup_estado ?? "—"}`} />
              )}
              {(c.cobra_mensual ?? true) && (
                <>
                  <Dato
                    k="Mensualidad"
                    v={`${plata(c.mensual_monto, c.moneda)} · ${(c.mensual_estado ?? "—").replace("_", " ")}`}
                  />
                  <Dato k="Próximo cobro" v={fecha(c.proximo_cobro)} />
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="bloque">
            <h3>Cobros</h3>
            <p className="parrafo">
              Sin cobro fijo. Cada trabajo se anota abajo con su monto y forma de pago.
            </p>
          </section>
        )}

        {c.notas && (
          <section className="bloque">
            <h3>Notas internas</h3>
            <p className="parrafo">{c.notas}</p>
          </section>
        )}

        <section className="bloque">
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <h3 style={{ margin: 0 }}>Historial de pagos</h3>
            <button className="btn" onClick={() => setAnotando(true)}>
              {Ico.mas({ t: 14 })} Anotar cobro
            </button>
          </div>
          {pagos.length === 0 ? (
            <p className="vacio">
              Todavía no hay pagos registrados. Los de MercadoPago entran solos por
              webhook; los que se cobran por transferencia o boleta se anotan acá.
            </p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Detalle</th>
                    <th>Cómo</th>
                    <th className="num">Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      {/* `fecha` es la del cobro real (la que se anota a mano);
                          `creado_en` solo dice cuándo se registró. Para los pagos
                          que entran por webhook solo existe la segunda. */}
                      <td>{fecha(p.fecha ?? p.creado_en)}</td>
                      <td>{p.detalle || p.tipo || "—"}</td>
                      <td>{p.metodo ?? "—"}</td>
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

      {anotando && (
        <EditorCobro
          clienteId={c.id}
          cerrar={() => setAnotando(false)}
          guardado={() => {
            setAnotando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
