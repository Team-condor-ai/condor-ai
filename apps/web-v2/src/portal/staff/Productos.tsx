import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { quitarAcceso } from "../lib/accesos";
import { EditorCliente } from "./EditorCliente";
import { PanelCliente } from "./PanelCliente";
import { Resumen, type PagoResumen } from "./Resumen";
import { IngresoEcommerce, CLIENTES_ECOMMERCE, LogoShopify } from "./contabilidad/IngresoEcommerce";
import type { Cliente, Cobro } from "./tipos";
import type { IngresoCliente } from "./contabilidad/tipos";

type Linea = "sites" | "ecommerce" | "crm";

const LINEAS: { id: Linea; texto: string; logo: string }[] = [
  { id: "sites", texto: "Cóndor Sites", logo: "/condor/marca/producto-sites.svg" },
  { id: "ecommerce", texto: "Cóndor Ecommerce", logo: "/condor/marca/producto-ecommerce.svg" },
  { id: "crm", texto: "Cóndor CRM", logo: "/condor/marca/producto-crm.svg" },
];

/**
 * "Clientes" pasó a ser "Productos" (2-sept-2026, pedido de Joaquín): una
 * pantalla por línea de negocio (Sites/Ecommerce/Track), cada una con su
 * propio resumen arriba y la cartera de esa línea abajo — en vez de una
 * sola lista mezclando todo.
 *
 * "PRODUCTOS" ES SOLO LA CATEGORÍA DEL MENÚ, NO UNA PANTALLA PROPIA
 * ---------------------------------------------------------------------------
 * Corrección el mismo 2-sept, mismo día del pedido original: Sites,
 * Ecommerce y Track son 3 entradas del menú lateral, cada una con su ruta
 * (`/acceso/productos/sites`, etc.) — no pestañas internas de un módulo
 * "Productos" que además apareciera como cuarta entrada redundante. Este
 * componente ya no guarda la línea activa en estado propio: la lee de la
 * URL (`useParams`), así que el link del menú y lo que se ve nunca pueden
 * desincronizarse.
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
  const { linea: lineaUrl } = useParams<{ linea: string }>();
  const linea: Linea = LINEAS.some((l) => l.id === lineaUrl) ? (lineaUrl as Linea) : "sites";
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<PagoResumen[]>([]);
  const [ingresos, setIngresos] = useState<IngresoCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Enlaces viejos de Cobros/Panel/Mapa siguen apuntando a
  // `/acceso/clientes?ver=<id>` sin saber a qué línea pertenece ese
  // cliente -- por eso esto se lee sin importar la línea activa, y abre el
  // panel igual (PanelCliente solo necesita el id, no la línea).
  const confirmar = useConfirmacion();
  const [params] = useSearchParams();
  const [viendo, setViendo] = useState<string | null>(() => params.get("ver"));
  const [editando, setEditando] = useState<Cliente | "nuevo" | null>(null);

  async function archivar(c: Cliente) {
    if (!(await confirmar(`Archivar a ${c.negocio || c.nombre}`, "Deja de aparecer en la lista y pierde el acceso al portal, pero se conservan sus pagos y su historia. Se puede recuperar.", "Archivar"))) return;
    const { error: e } = await sb.from("clientes").update({ archivado: true }).eq("id", c.id).select("id");
    if (e) setError("No se pudo archivar: " + e.message); else void cargar(true);
  }
  async function eliminar(c: Cliente) {
    const nc = cobros.filter((x) => x.cliente_id === c.id).length;
    const np = pagos.filter((x) => x.cliente_id === c.id).length;
    const nombre = c.negocio || c.nombre || "este cliente";
    if (!(await confirmar(`Eliminar a ${nombre} para siempre`, `Se borran su ficha, ${nc} cobro${nc === 1 ? "" : "s"} y ${np} pago${np === 1 ? "" : "s"} registrados, y pierde el acceso al portal. Esto NO se puede deshacer. Si solo quieres sacarlo de la lista, usa «Archivar».`, "Eliminar"))) return;
    const { data, error: e } = await sb.from("clientes").delete().eq("id", c.id).select("id");
    if (e || !data?.length) { setError(e ? "No se pudo eliminar: " + e.message : "La base no permitió eliminarlo."); return; }
    if (c.email) void quitarAcceso(c.email);
    void cargar(true);
  }

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

  const idsDe = (lista: Cliente[]) => new Set(lista.map((c) => c.id));
  const cobrosDe = (lista: Cliente[]) => { const ids = idsDe(lista); return cobros.filter((c) => ids.has(c.cliente_id)); };
  const pagosDe = (lista: Cliente[]) => { const ids = idsDe(lista); return pagos.filter((p) => ids.has(p.cliente_id)); };

  const recibidoDe = (clienteId: string) =>
    pagos.filter((p) => p.cliente_id === clienteId && p.estado === "pagado").reduce((t, p) => t + (p.monto ?? 0), 0);

  const infoLinea = LINEAS.find((l) => l.id === linea);
  const tituloLinea = infoLinea?.texto ?? "Productos";

  return (
    <>
      <div className="barra">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {infoLinea && (
            <img src={infoLinea.logo} alt="" width={34} height={34}
              style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", boxShadow: "0 6px 12px -6px rgba(21,22,26,.45)" }} />
          )}
          {tituloLinea}
        </h1>
        {linea !== "ecommerce" && (
          <button className="btn solido" onClick={() => setEditando("nuevo")}>
            {Ico.mas({ t: 15 })} Nuevo cliente
          </button>
        )}
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

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
              const lista = deLinea(linea);
              return (
                <>
                  {lista.length > 0 && <Resumen clientes={lista} cobros={cobrosDe(lista)} pagos={pagosDe(lista)} />}
                  {lista.length === 0 ? (
                    <p className="vacio">
                      Todavía no hay clientes de {tituloLinea} clasificados
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
                                <button className="icono-btn" title="Archivar (se puede recuperar)" onClick={() => void archivar(c)}>{Ico.archivar({ t: 15 })}</button>
                                <button className="icono-btn peligro" title="Eliminar para siempre" onClick={() => void eliminar(c)}>{Ico.eliminar({ t: 15 })}</button>
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
