import { useEffect, useMemo, useState } from "react";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorCliente } from "./EditorCliente";
import { PanelCliente } from "./PanelCliente";
import { Resumen, type PagoResumen } from "./Resumen";
import { IngresoEcommerce, CLIENTES_ECOMMERCE, LogoShopify } from "./contabilidad/IngresoEcommerce";
import type { Cliente, Cobro } from "./tipos";
import type { IngresoCliente } from "./contabilidad/tipos";

type Linea = "sites" | "ecommerce" | "track";

const LINEAS: { id: Linea; texto: string; icono: "sitesProducto" | "ecommerceProducto" | "trackProducto" }[] = [
  { id: "sites", texto: "Cóndor Sites", icono: "sitesProducto" },
  { id: "ecommerce", texto: "Cóndor Ecommerce", icono: "ecommerceProducto" },
  { id: "track", texto: "Cóndor Track", icono: "trackProducto" },
];

/**
 * "Clientes" pasó a ser "Productos" (2-sept-2026, pedido de Joaquín): una
 * pestaña por línea de negocio (Sites/Ecommerce/Track), cada una con su
 * propio resumen arriba y la cartera de esa línea abajo — en vez de una
 * sola lista mezclando todo.
 *
 * POR QUÉ ECOMMERCE NO USA `clientes` COMO LAS OTRAS DOS
 * ---------------------------------------------------------------------------
 * Tecnobox y Silver and Co no son filas de `public.clientes`: se cobran por
 * comisión en tiempo real desde Shopify y viven en `ingresos_clientes` (ver
 * `contabilidad/IngresoEcommerce.tsx`, que ya hacía exactamente este
 * resumen — se reusa tal cual en vez de duplicarlo). Forzarlos a la tabla de
 * clientes solo para que esta pantalla luzca uniforme habría sido peor:
 * dos fuentes de verdad para la misma plata.
 *
 * Rat.IA se sacó del todo de este archivo (y del menú) el mismo día: era un
 * producto B2C aparte, no una línea de Cóndor.ai, y ya tenía su propia
 * cartera de suscriptores en Organización/Metas, que también se retiró.
 */
export function Productos() {
  const [linea, setLinea] = useState<Linea>("sites");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<PagoResumen[]>([]);
  const [ingresos, setIngresos] = useState<IngresoCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [viendo, setViendo] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cliente | "nuevo" | null>(null);

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const [{ data: cl, error: ecl }, { data: co }, { data: pa }, { data: ing }] = await Promise.all([
      sb.from("clientes").select("*").order("creado_en", { ascending: false }),
      sb.from("cobros").select("*"),
      sb.from("pagos").select("cliente_id,cobro_id,monto,estado,fecha,creado_en"),
      sb.from("ingresos_clientes").select("*").order("mes"),
    ]);
    if (ecl) setError(ecl.message);
    else setError("");
    setClientes((cl ?? []) as Cliente[]);
    setCobros((co ?? []) as Cobro[]);
    setPagos((pa ?? []) as PagoResumen[]);
    setIngresos((ing ?? []) as IngresoCliente[]);
    if (!silencioso) setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, []);

  const deLinea = useMemo(
    () => (l: Linea) => clientes.filter((c) => c.linea === l && !c.archivado),
    [clientes],
  );
  const sites = deLinea("sites");
  const track = deLinea("track");

  const idsDe = (lista: Cliente[]) => new Set(lista.map((c) => c.id));
  const cobrosDe = (lista: Cliente[]) => { const ids = idsDe(lista); return cobros.filter((c) => ids.has(c.cliente_id)); };
  const pagosDe = (lista: Cliente[]) => { const ids = idsDe(lista); return pagos.filter((p) => ids.has(p.cliente_id)); };

  const recibidoDe = (clienteId: string) =>
    pagos.filter((p) => p.cliente_id === clienteId && p.estado === "pagado").reduce((t, p) => t + (p.monto ?? 0), 0);

  return (
    <>
      <div className="barra">
        <h1>Productos</h1>
        {linea !== "ecommerce" && (
          <button className="btn solido" onClick={() => setEditando("nuevo")}>
            {Ico.mas({ t: 15 })} Nuevo cliente
          </button>
        )}
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        <div className="subnav-organizacion">
          {LINEAS.map((l) => (
            <button key={l.id} className={linea === l.id ? "on" : ""} onClick={() => setLinea(l.id)}>
              {Ico[l.icono]({ t: 15 })} {l.texto}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : linea === "ecommerce" ? (
          <>
            <IngresoEcommerce ingresos={ingresos} />
            <h3 style={{ marginTop: 18 }}>Cartera Ecommerce</h3>
            <p className="conteo">
              Tecnobox y Silver and Co se administran ligados directamente a Shopify, no como fichas de cliente —
              por eso no tienen botón de editar acá.
            </p>
            <div className="tabla-caja">
              <table>
                <thead><tr><th>Cliente</th><th>Plataforma</th><th className="num">Ingreso este mes</th></tr></thead>
                <tbody>
                  {CLIENTES_ECOMMERCE.map((c) => {
                    const mesActual = new Date().toISOString().slice(0, 7);
                    const comision = ingresos
                      .filter((i) => i.cliente === c.clave && i.mes === mesActual)
                      .reduce((t, i) => t + i.comision_calculada, 0);
                    return (
                      <tr key={c.clave}>
                        <td><b>{c.nombre}</b></td>
                        <td>{c.plataforma === "shopify" ? <LogoShopify /> : <span className="conteo">—</span>}</td>
                        <td className="num">{plata(comision)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            {(() => {
              const lista = linea === "sites" ? sites : track;
              return (
                <>
                  {lista.length > 0 && <Resumen clientes={lista} cobros={cobrosDe(lista)} pagos={pagosDe(lista)} />}
                  {lista.length === 0 ? (
                    <p className="vacio">
                      Todavía no hay clientes de {linea === "sites" ? "Cóndor Sites" : "Cóndor Track"} clasificados
                      acá. Ábrelos y asígnales la línea desde "Configurar cliente".
                    </p>
                  ) : (
                    <div className="tabla-caja" style={{ marginTop: 14 }}>
                      <table>
                        <thead><tr><th>Negocio</th><th>Plan</th><th className="num">Recibido</th><th></th></tr></thead>
                        <tbody>
                          {lista.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <b>{c.negocio || c.nombre || "—"}</b>
                                <small style={{ display: "block", color: "var(--texto-3)" }}>
                                  {c.email || "sin correo · no entra al portal"}
                                </small>
                              </td>
                              <td>{c.plan || "—"}</td>
                              <td className="num">{plata(recibidoDe(c.id), c.moneda)}</td>
                              <td className="acciones">
                                <button className="btn chico" onClick={() => setViendo(c.id)}>Ver</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {viendo && (
        <PanelCliente id={viendo} cerrar={() => setViendo(null)} cambiado={() => void cargar(true)} />
      )}
      {editando && (
        <EditorCliente
          cliente={editando === "nuevo" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => { setEditando(null); void cargar(true); }}
        />
      )}
    </>
  );
}
