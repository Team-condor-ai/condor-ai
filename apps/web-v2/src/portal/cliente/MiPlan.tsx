import { useEffect, useState } from "react";
import { sb, plata, fecha } from "../lib/supabase";
import type { Cliente, Pago } from "../staff/tipos";

/**
 * Lo que ve el cliente de su suscripción.
 *
 * La consulta NO filtra por email: la política RLS `cliente_ve_lo_suyo` ya
 * limita la tabla a su propia fila. Filtrar acá además daría una falsa
 * sensación de que el front es lo que protege — y si alguien borra el filtro,
 * la base sigue sin entregar nada ajeno.
 */
export function MiPlan() {
  const [c, setC] = useState<Cliente | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("clientes").select("*").limit(1).maybeSingle();
      setC(data as Cliente | null);
      if (data) {
        const { data: p } = await sb
          .from("pagos")
          .select("*")
          .order("creado_en", { ascending: false });
        setPagos((p ?? []) as Pago[]);
      }
      setCargando(false);
    })();
  }, []);

  if (cargando)
    return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  if (!c)
    return (
      <div className="cuerpo">
        <p className="vacio">
          Tu cuenta todavía no tiene un plan asociado. Escríbenos y lo
          activamos.
        </p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <h1>Mi plan</h1>
      </div>

      <div className="cuerpo">
        <section className="bloque">
          <div className="rejilla-datos">
            <div className="dato">
              <small>Plan</small>
              <b>{c.plan || "—"}</b>
            </div>
            <div className="dato">
              <small>Mensualidad</small>
              <b>{plata(c.mensual_monto, c.moneda)}</b>
            </div>
            <div className="dato">
              <small>Próximo cobro</small>
              <b>{fecha(c.proximo_cobro)}</b>
            </div>
            <div className="dato">
              <small>Estado</small>
              <b>
                <span
                  className={
                    "pill " + (c.mensual_estado === "al_dia" ? "ok" : "warn")
                  }
                >
                  {(c.mensual_estado ?? "—").replace("_", " ")}
                </span>
              </b>
            </div>
          </div>
        </section>

        <section className="bloque">
          <h3>Qué incluye</h3>
          <p className="parrafo">
            {c.concepto || "Escríbenos y te detallamos tu plan."}
          </p>
          {c.web_url && (
            <p className="parrafo">
              Tu sitio:{" "}
              <a href={c.web_url} target="_blank" rel="noreferrer">
                {c.web_url}
              </a>
            </p>
          )}
        </section>

        <section className="bloque">
          <h3>Pagos</h3>
          {pagos.length === 0 ? (
            <p className="vacio">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th className="num">Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td>{fecha(p.creado_en)}</td>
                      <td>{p.tipo === "setup" ? "Puesta en marcha" : "Mensualidad"}</td>
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

        <section className="bloque">
          <h3>Contacto</h3>
          <p className="parrafo">
            ¿Necesitas cambiar algo de tu plan? Escríbenos a{" "}
            <a href="mailto:contacto@teamcondorcl.com">
              contacto@teamcondorcl.com
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
