import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { useCambio } from "../lib/cambio";
import {
  nombreCobro,
  type Cliente,
  type Cobro,
  type Pago,
} from "./tipos";

type Tipo = "todos" | "unico" | "mensual";
type Estado = "todos" | "pagado" | "pendiente" | "rechazado";

export function Cobros() {
  const confirmar = useConfirmacion();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [estado, setEstado] = useState<Estado>("todos");
  const [desde, setDesde] = useState("");
  const [momentoCarga] = useState(() => Date.now());
  const cambio = useCambio();

  useEffect(() => {
    (async () => {
      const [pa, co, cl] = await Promise.all([
        sb.from("pagos").select("*").order("creado_en", { ascending: false }),
        sb.from("cobros").select("*"),
        sb.from("clientes").select("*"),
      ]);
      if (pa.error) setError(pa.error.message);
      setPagos((pa.data ?? []) as Pago[]);
      setCobros((co.data ?? []) as Cobro[]);
      setClientes((cl.data ?? []) as Cliente[]);
      setCargando(false);
    })();
  }, []);

  const cm = useMemo(() => new Map(cobros.map((x) => [x.id, x])), [cobros]);
  const clm = useMemo(
    () => new Map(clientes.map((x) => [x.id, x])),
    [clientes],
  );
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pagos.filter((p) => {
      const c = p.cobro_id ? cm.get(p.cobro_id) : undefined;
      const cli = clm.get(p.cliente_id);
      const cuando = p.fecha ?? p.creado_en ?? "";
      return (
        (tipo === "todos" || (c?.tipo ?? p.tipo) === tipo) &&
        (estado === "todos" || p.estado === estado) &&
        (!desde || cuando.slice(0, 10) >= desde) &&
        (!q ||
          [
            cli?.negocio,
            cli?.nombre,
            cli?.email,
            c ? nombreCobro(c) : p.detalle,
            p.mp_id,
            p.metodo,
          ].some((x) =>
            String(x ?? "")
              .toLowerCase()
              .includes(q),
          ))
      );
    });
  }, [pagos, cm, clm, tipo, estado, desde, busca]);

  const resumen = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const hace30 = new Date(momentoCarga - 30 * 86400000).toISOString();
    const pagados = pagos.filter((p) => p.estado === "pagado");
    const monto = (lista: Pago[]) =>
      lista.reduce((t, p) => {
        const co = p.cobro_id ? cm.get(p.cobro_id) : undefined;
        return t + cambio.aCLP(p.monto, co?.moneda);
      }, 0);
    const mesPagados = pagados.filter((p) =>
      (p.fecha ?? p.creado_en ?? "").startsWith(mes),
    );
    const procesados = pagos.filter((p) =>
      ["pagado", "rechazado"].includes(p.estado ?? ""),
    );
    return {
      mes: monto(mesPagados),
      mensualidades: monto(
        mesPagados.filter(
          (p) => (p.cobro_id ? cm.get(p.cobro_id)?.tipo : p.tipo) === "mensual",
        ),
      ),
      ultimos30: pagados.filter((p) => (p.creado_en ?? p.fecha ?? "") >= hace30)
        .length,
      exito: procesados.length
        ? (procesados.filter((p) => p.estado === "pagado").length /
            procesados.length) *
          100
        : null,
    };
  }, [pagos, cm, cambio, momentoCarga]);

  function exportar() {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const filas = visibles.map((p) => {
      const c = p.cobro_id ? cm.get(p.cobro_id) : undefined;
      const cli = clm.get(p.cliente_id);
      return [
        p.fecha ?? p.creado_en,
        cli?.negocio ?? cli?.nombre,
        c ? nombreCobro(c) : p.detalle,
        c?.tipo ?? p.tipo,
        p.periodo,
        p.metodo,
        p.mp_id,
        p.monto,
        p.mp_fee_amount,
        p.mp_net_received,
        p.mp_status_detail,
        c?.moneda ?? "CLP",
        p.estado,
      ]
        .map(esc)
        .join(",");
    });
    const csv = [
      "fecha,cliente,cobro,tipo,periodo,metodo,referencia,monto,comision,neto,detalle_mp,moneda,estado",
      ...filas,
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `cobros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function eliminarPendiente(pago: Pago) {
    if (pago.estado && pago.estado !== "pendiente") return;
    const cli = clm.get(pago.cliente_id);
    const ok = await confirmar(
      `¿Eliminar este pago pendiente de ${cli?.negocio || cli?.nombre || "el cliente"}?`,
      "Esto limpia el registro interno, pero no cancela un link o intento de cobro que siga activo en Mercado Pago.",
      "Eliminar",
    );
    if (!ok) return;
    const anterior = pagos;
    setPagos((lista) => lista.filter((x) => x.id !== pago.id));
    const { data: eliminado, error: fallo } = await sb
      .from("pagos")
      .delete()
      .eq("id", pago.id)
      .or("estado.is.null,estado.eq.pendiente")
      .select("id")
      .maybeSingle();
    if (fallo || !eliminado) {
      setPagos(anterior);
      setError(
        fallo
          ? "No se pudo eliminar el pago pendiente: " + fallo.message
          : "El pago ya no está pendiente y no se eliminó.",
      );
    }
  }

  return (
    <>
      <div className="barra">
        <div>
          <h1>Cobros</h1>
          <small className="subtitulo-barra">
            Historial de pagos y mensualidades; depura intentos pendientes
          </small>
        </div>
        <button className="btn" onClick={exportar} disabled={!visibles.length}>
          {Ico.descargar({ t: 15 })} Exportar CSV
        </button>
      </div>
      <div className="cuerpo">
        {error && <p className="error">{error}</p>}
        <div className="kpis">
          <div className="kpi">
            <div className="tile">{Ico.cobros({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(resumen.mes)}</b>
            </div>
            <p>Cobrado este mes</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(resumen.mensualidades)}</b>
            </div>
            <p>Mensualidades cobradas este mes</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.boletas({ t: 18 })}</div>
            <div className="cifra">
              <b>{resumen.ultimos30}</b>
            </div>
            <p>Pagos efectivos · últimos 30 días</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.cheque({ t: 18 })}</div>
            <div className="cifra">
              <b>
                {resumen.exito === null ? "—" : `${resumen.exito.toFixed(1)}%`}
              </b>
            </div>
            <p>Tasa histórica de pagos exitosos</p>
          </div>
        </div>
        <div className="filtros-cobros">
          <div className="mini-busca">
            {Ico.buscar({ t: 15 })}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, cobro, referencia…"
            />
          </div>
          <select
            className="campo compacto"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
          >
            <option value="todos">Todos los tipos</option>
            <option value="unico">Pagos únicos</option>
            <option value="mensual">Mensualidades</option>
          </select>
          <select
            className="campo compacto"
            value={estado}
            onChange={(e) => setEstado(e.target.value as Estado)}
          >
            <option value="todos">Todos los estados</option>
            <option value="pagado">Pagados</option>
            <option value="pendiente">Pendientes</option>
            <option value="rechazado">Rechazados</option>
          </select>
          <label className="filtro-fecha">
            Desde
            <input
              className="campo compacto"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </label>
        </div>
        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="vacio">
            No hay movimientos que coincidan con los filtros.
          </p>
        ) : (
          <div className="tabla-caja scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Cobro</th>
                  <th>Tipo</th>
                  <th>Medio y referencia</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  <th aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const c = p.cobro_id ? cm.get(p.cobro_id) : undefined;
                  const cli = clm.get(p.cliente_id);
                  const t = c?.tipo ?? p.tipo;
                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{fecha(p.fecha ?? p.creado_en)}</b>
                        {p.periodo && <small>Período {fecha(p.periodo)}</small>}
                      </td>
                      <td>
                        <Link
                          className="enlace-tabla"
                          to={`/acceso/clientes?ver=${p.cliente_id}`}
                        >
                          <b>
                            {cli?.negocio || cli?.nombre || "Cliente eliminado"}
                          </b>
                          <small>{cli?.email || "sin correo"}</small>
                        </Link>
                      </td>
                      <td>
                        <b>
                          {(c ? nombreCobro(c) : p.detalle) || "Cobro eliminado"}
                        </b>
                      </td>
                      <td>
                        <span
                          className={
                            "pill " + (t === "mensual" ? "azul" : "gris")
                          }
                        >
                          {t === "mensual" ? "mensualidad" : "pago único"}
                        </span>
                      </td>
                      <td>
                        {p.metodo || "—"}
                        <small>
                          {p.mp_id
                            ? `Ref. ${p.mp_id}`
                            : p.detalle || "sin referencia"}
                        </small>
                        {p.mp_status_detail && <small>{p.mp_status_detail}</small>}
                      </td>
                      <td className="num">
                        <b>{plata(p.monto, c?.moneda)}</b>
                        {p.mp_net_received != null && (
                          <small>
                            Neto {plata(p.mp_net_received, c?.moneda)}
                            {p.mp_fee_amount != null && ` · comisión ${plata(p.mp_fee_amount, c?.moneda)}`}
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            "pill " +
                            (p.estado === "pagado"
                              ? "ok"
                              : p.estado === "rechazado"
                                ? "mal"
                                : "warn")
                          }
                        >
                          {p.estado || "pendiente"}
                        </span>
                      </td>
                      <td className="acciones">
                        {(!p.estado || p.estado === "pendiente") && (
                          <button
                            className="icono-btn peligro"
                            onClick={() => void eliminarPendiente(p)}
                            title="Eliminar pago pendiente"
                            aria-label="Eliminar pago pendiente"
                          >
                            {Ico.eliminar({ t: 14 })}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota-auditoria">
          Los pagos efectivos y rechazados quedan como historial. Sólo los
          intentos que aún están pendientes se pueden eliminar; borrar uno no
          cancela su link en el proveedor de pago.
        </p>
      </div>
    </>
  );
}
