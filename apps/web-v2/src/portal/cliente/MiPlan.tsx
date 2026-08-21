import { useEffect, useMemo, useState } from "react";
import { sb, plata, fecha, enlaceWeb } from "../lib/supabase";
import { nombreCobro, type Cliente, type Cobro, type Pago } from "../staff/tipos";

/**
 * Lo que el cliente ve de lo que tiene contratado.
 *
 * Las consultas NO filtran por email: las políticas RLS (`cliente_ve_lo_suyo`,
 * `cliente_ve_sus_cobros`) ya limitan cada tabla a lo suyo. Filtrar acá además
 * daría una falsa sensación de que el front es lo que protege — y si alguien
 * borra el filtro, la base sigue sin entregar nada ajeno.
 *
 * YA NO HAY "UN PLAN" (21-ago-2026)
 * ---------------------------------------------------------------------------
 * Esta pantalla mostraba una mensualidad y su próximo cobro, porque eso era
 * todo lo que la ficha del cliente sabía guardar. Ahora un cliente puede tener
 * varios cobros — dos trabajos puntuales y una mensualidad, por ejemplo — así
 * que se listan todos, cada uno con lo que pagó de él.
 */
export function MiPlan() {
  const [c, setC] = useState<Cliente | null>(null);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("clientes").select("*").limit(1).maybeSingle();
      setC(data as Cliente | null);
      if (data) {
        const [{ data: co }, { data: p }] = await Promise.all([
          sb.from("cobros").select("*").order("numero"),
          sb.from("pagos").select("*").order("creado_en", { ascending: false }),
        ]);
        setCobros((co ?? []) as Cobro[]);
        setPagos((p ?? []) as Pago[]);
      }
      setCargando(false);
    })();
  }, []);

  const pagadoDe = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagos) {
      if (p.estado !== "pagado" || !p.cobro_id) continue;
      m.set(p.cobro_id, (m.get(p.cobro_id) ?? 0) + (p.monto ?? 0));
    }
    return m;
  }, [pagos]);

  if (cargando) return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  if (!c)
    return (
      <div className="cuerpo">
        <p className="vacio">
          Tu cuenta todavía no tiene un plan asociado. Escríbenos y lo activamos.
        </p>
      </div>
    );

  // Lo que sigue vivo arriba; lo cerrado o anulado no le interesa al cliente en
  // esta lista — su rastro queda en el historial de pagos de más abajo.
  const vigentes = cobros.filter(
    (x) => x.estado === "pendiente" || x.estado === "activa" || x.estado === "pausada",
  );

  return (
    <>
      <div className="barra">
        <h1>Mi plan</h1>
      </div>

      <div className="cuerpo">
        <section className="bloque">
          <h3>Qué incluye</h3>
          <p className="parrafo">
            {c.concepto || "Escríbenos y te detallamos tu plan."}
          </p>
          {c.web_url && (
            <p className="parrafo">
              Tu sitio:{" "}
              <a href={enlaceWeb(c.web_url)} target="_blank" rel="noreferrer">
                {c.web_url}
              </a>
            </p>
          )}
        </section>

        <section className="bloque">
          <h3>Lo que tienes contratado</h3>
          {vigentes.length === 0 ? (
            <p className="vacio">No tienes cobros abiertos ahora mismo.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="num">Monto</th>
                    <th>Cuándo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {vigentes.map((x) => {
                    const pagado = pagadoDe.get(x.id) ?? 0;
                    const falta = Math.max(0, (x.monto ?? 0) - pagado);
                    return (
                      <tr key={x.id}>
                        <td>
                          <b>{nombreCobro(x)}</b>
                          {x.tipo === "unico" && pagado > 0 && falta > 0 && (
                            <>
                              <br />
                              <span className="conteo">
                                Abonado {plata(pagado, x.moneda)} · faltan{" "}
                                {plata(falta, x.moneda)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="num">
                          {plata(x.monto, x.moneda)}
                          {x.tipo === "mensual" && <span className="conteo"> /mes</span>}
                        </td>
                        <td>
                          {x.tipo === "mensual"
                            ? x.estado === "activa"
                              ? `Se cobra solo · próximo ${fecha(x.proximo_cobro)}`
                              : x.estado === "pausada"
                                ? "En pausa"
                                : "Falta que lo actives"
                            : x.estado === "pendiente"
                              ? "Pendiente de pago"
                              : "—"}
                        </td>
                        <td className="acciones">
                          {/* El link se guarda al generarlo, así que el cliente
                              puede volver a pagarlo sin pedir uno nuevo. */}
                          {x.link && x.estado === "pendiente" && (
                            <a className="btn solido" href={x.link} target="_blank" rel="noreferrer">
                              {x.tipo === "mensual" ? "Activar" : "Pagar"}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                      <td>{fecha(p.fecha ?? p.creado_en)}</td>
                      {/* El detalle trae el nombre real del cobro. El respaldo
                          por tipo es para las filas viejas, de cuando un pago
                          solo podía ser "setup" o "mensual". */}
                      <td>
                        {p.detalle ||
                          (p.tipo === "setup" ? "Puesta en marcha" : "Mensualidad")}
                        {p.periodo && <span className="conteo"> · {fecha(p.periodo)}</span>}
                      </td>
                      <td className="num">{plata(p.monto, c.moneda)}</td>
                      <td>
                        <span className={"pill " + (p.estado === "pagado" ? "ok" : "warn")}>
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
            <a href="mailto:contacto@teamcondorcl.com">contacto@teamcondorcl.com</a>.
          </p>
        </section>
      </div>
    </>
  );
}
