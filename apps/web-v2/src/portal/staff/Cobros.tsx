import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb, plata, fecha } from "../lib/supabase";
import type { Cliente, Pago } from "./tipos";

/**
 * Cobros con MercadoPago.
 *
 * EL MONTO NO SE ESCRIBE ACÁ
 * ---------------------------------------------------------------------------
 * `crear-pago` toma el monto de la ficha del cliente, no del navegador. Es
 * deliberado y no conviene "mejorarlo": si el monto viajara desde el front,
 * cualquiera con la consola abierta podría cobrarse $1. Para cambiar lo que
 * se cobra hay que editar la ficha.
 *
 * La función además valida que quien llama sea admin y crea la fila en
 * `pagos` como pendiente; el webhook la pasa a pagada.
 */
export function Cobros() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargar() {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      sb.from("clientes").select("*").order("proximo_cobro"),
      sb.from("pagos").select("*").order("creado_en", { ascending: false }),
    ]);
    setClientes(((cs ?? []) as Cliente[]).filter((c) => !c.archivado));
    setPagos((ps ?? []) as Pago[]);
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  const resumen = useMemo(() => {
    const pagados = pagos.filter((p) => p.estado === "pagado");
    const mes = new Date().toISOString().slice(0, 7);
    return {
      recurrente: clientes
        .filter((c) => c.mensual_estado === "al_dia")
        .reduce((t, c) => t + (c.mensual_monto ?? 0), 0),
      esteMes: pagados
        .filter((p) => (p.creado_en ?? "").startsWith(mes))
        .reduce((t, p) => t + (p.monto ?? 0), 0),
      pendientes: pagos.filter((p) => p.estado === "pendiente").length,
      vencidos: clientes.filter((c) => c.mensual_estado === "vencido").length,
    };
  }, [clientes, pagos]);

  async function cobrar(c: Cliente, tipo: "setup" | "mensual", correo: boolean) {
    setError(""); setAviso(""); setTrabajando(c.id + tipo);
    try {
      const { data, error } = await sb.functions.invoke("crear-pago", {
        body: { cliente_id: c.id, tipo, enviar_correo: correo },
      });
      if (error) throw error;
      const link = (data as { init_point?: string })?.init_point;
      if (!link) throw new Error("La función no devolvió el link de pago.");
      setAviso(
        correo
          ? `Cobro enviado a ${c.email}.`
          : `Link listo para ${c.negocio || c.email}.`,
      );
      if (!correo) window.open(link, "_blank", "noopener");
      cargar();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(
        /not found|404/i.test(m)
          ? "Falta desplegar la Edge Function `crear-pago`. No se cobró nada."
          : m,
      );
    } finally {
      setTrabajando("");
    }
  }

  if (cargando)
    return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  return (
    <>
      <div className="barra">
        <h1>Cobros</h1>
      </div>

      <div className="cuerpo">
        <div className="rejilla-datos" style={{ marginBottom: 20 }}>
          <div className="dato">
            <small>Recurrente al mes</small>
            <b>{plata(resumen.recurrente)}</b>
          </div>
          <div className="dato">
            <small>Cobrado este mes</small>
            <b>{plata(resumen.esteMes)}</b>
          </div>
          <div className="dato">
            <small>Pagos pendientes</small>
            <b>{resumen.pendientes}</b>
          </div>
          <div className="dato">
            <small>Clientes vencidos</small>
            <b>{resumen.vencidos}</b>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok-msg">{aviso}</p>}

        <section className="bloque">
          <h3>Cobrar</h3>
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Setup</th>
                  <th className="num">Mensual</th>
                  <th>Próximo cobro</th>
                  <th>Cobrar</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/acceso/clientes/${c.id}`} className="enlace-tabla">
                        <b>{c.negocio || c.email}</b>
                        <small>{c.email}</small>
                      </Link>
                    </td>
                    <td className="num">
                      {plata(c.setup_monto, c.moneda)}
                      <br />
                      <span className={"pill " + (c.setup_estado === "pagado" ? "ok" : "warn")}>
                        {c.setup_estado ?? "—"}
                      </span>
                    </td>
                    <td className="num">
                      {plata(c.mensual_monto, c.moneda)}
                      <br />
                      <span className={"pill " + (c.mensual_estado === "al_dia" ? "ok" : c.mensual_estado === "vencido" ? "mal" : "warn")}>
                        {(c.mensual_estado ?? "—").replace("_", " ")}
                      </span>
                    </td>
                    <td>{fecha(c.proximo_cobro)}</td>
                    <td>
                      <div className="botonera">
                        {(["setup", "mensual"] as const).map((t) => (
                          <button
                            key={t}
                            className="btn chico"
                            disabled={!!trabajando}
                            onClick={() => cobrar(c, t, true)}
                            title={`Enviar el cobro de ${t} por correo`}
                          >
                            {trabajando === c.id + t ? "…" : t}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="parrafo" style={{ color: "var(--texto-3)", marginTop: 10 }}>
            El monto sale de la ficha del cliente, no de esta pantalla. Para
            cambiarlo, edita la ficha.
          </p>
        </section>

        <section className="bloque">
          <h3>Últimos movimientos</h3>
          {pagos.length === 0 ? (
            <p className="vacio">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th className="num">Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.slice(0, 25).map((p) => {
                    const c = clientes.find((x) => x.id === p.cliente_id);
                    return (
                      <tr key={p.id}>
                        <td>{fecha(p.creado_en)}</td>
                        <td>{c?.negocio || c?.email || "—"}</td>
                        <td>{p.tipo ?? "—"}</td>
                        <td className="num">{plata(p.monto, c?.moneda)}</td>
                        <td>
                          <span className={"pill " + (p.estado === "pagado" ? "ok" : p.estado === "rechazado" ? "mal" : "warn")}>
                            {p.estado ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
