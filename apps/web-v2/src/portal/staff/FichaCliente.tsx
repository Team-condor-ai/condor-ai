import { useEffect, useMemo, useState } from "react";
import { sb, plata, fecha, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { CampoVivo } from "./CampoVivo";
import { EditorCobro } from "./EditorCobro";
import { AnotarPago } from "./AnotarPago";
import { CrearLinkCobro } from "./CrearLinkCobro";
import {
  CATALOGO_PLANES,
  MONEDAS,
  nombreCobro,
  type Cliente,
  type ClienteProducto,
  type Cobro,
  type Pago,
  type Producto,
} from "./tipos";

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="dato">
      <small>{k}</small>
      <b>{v || "—"}</b>
    </div>
  );
}

/** El color del estado según lo que significa, no según su nombre. */
function EstadoCobro({ c }: { c: Cobro }) {
  const mapa: Record<string, string> = {
    pagado: "ok",
    activa: "ok",
    pendiente: "warn",
    pausada: "gris",
    anulado: "gris",
    cancelada: "mal",
  };
  return (
    <span className={"pill " + (mapa[c.estado] ?? "gris")}>{c.estado}</span>
  );
}

/**
 * El contenido de la ficha de un cliente, SIN envoltorio.
 *
 * Lo usan dos pantallas: la página `/acceso/clientes/:id` y el panel lateral
 * que se abre desde la lista. Estaba escrito una sola vez para la pagina;
 * duplicarlo para el panel habría dejado dos fichas que se ven iguales y se
 * comportan distinto en cuanto alguien toque una.
 */
export function ContenidoCliente({
  id,
  alCargar,
}: {
  id: string;
  /** Avisa quién es el cliente, para que el encabezado de arriba lo muestre. */
  alCargar?: (c: Cliente | null) => void;
}) {
  const [c, setC] = useState<Cliente | null>(null);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [asignados, setAsignados] = useState<ClienteProducto[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [editandoCobro, setEditandoCobro] = useState<Cobro | null | "nuevo">(
    null,
  );
  const [anotandoEn, setAnotandoEn] = useState<Cobro | null>(null);
  const [cobrando, setCobrando] = useState<Cobro | null>(null);
  const [asignandoProducto, setAsignandoProducto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("clientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) setError(error.message);
    else {
      setC(data as Cliente | null);
      alCargar?.(data as Cliente | null);
    }

    const [
      { data: co, error: eco },
      { data: p },
      { data: pr },
      { data: ap, error: eap },
    ] =
      await Promise.all([
        sb.from("cobros").select("*").eq("cliente_id", id).order("numero"),
        sb
          .from("pagos")
          .select("*")
          .eq("cliente_id", id)
          .order("creado_en", { ascending: false }),
        sb.from("productos").select("*"),
        sb
          .from("cliente_productos")
          .select("*")
          .eq("cliente_id", id)
          .order("creado_en", { ascending: false }),
      ]);
    // Si la migración todavía no se corrió, la tabla no existe. Se avisa en vez
    // de mostrar una ficha vacía que parece un cliente sin cobros.
    if (eco) setError("No se pudieron cargar los cobros: " + eco.message);
    setCobros((co ?? []) as Cobro[]);
    setPagos((p ?? []) as Pago[]);
    setProductos((pr ?? []) as Producto[]);
    setAsignados((ap ?? []) as ClienteProducto[]);
    if (eap && !eco)
      setError(
        "No se pudieron cargar los productos asignados: " + eap.message,
      );
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pagosDe = useMemo(() => {
    const m = new Map<string, Pago[]>();
    for (const p of pagos) {
      const k = p.cobro_id ?? "__sueltos__";
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [pagos]);
  const productoDe = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );

  const recibido = (cobroId: string) =>
    (pagosDe.get(cobroId) ?? [])
      .filter((p) => p.estado === "pagado")
      .reduce((t, p) => t + (p.monto ?? 0), 0);

  const totalRecibido = useMemo(
    () =>
      pagos
        .filter((p) => p.estado === "pagado")
        .reduce((t, p) => t + (p.monto ?? 0), 0),
    [pagos],
  );

  // Un pago sin cobro solo aparece si un cobro se borró: la migración deja a
  // todos con el suyo. Se muestran igual — plata que entró no puede quedar
  // invisible porque le falte un padre.
  const sueltos = pagosDe.get("__sueltos__") ?? [];

  /** Guarda un campo suelto del cliente. Devuelve el error para que el propio
   *  campo lo muestre en su lugar, en vez de un cartel arriba de todo. */
  async function guardarCampo(campos: Partial<Cliente>) {
    const { error } = await sb.from("clientes").update(campos).eq("id", id);
    if (error) return error.message;
    setC((p) => (p ? { ...p, ...campos } : p));
    alCargar?.({ ...(c as Cliente), ...campos });
    return null;
  }

  async function cambiarEstado(cobro: Cobro, estado: string, aviso?: string) {
    if (aviso && !window.confirm(aviso)) return;
    const { error } = await sb
      .from("cobros")
      .update({ estado })
      .eq("id", cobro.id);
    if (error) setError(error.message);
    else cargar();
  }

  async function estadoProducto(asignacion: ClienteProducto, estado: string) {
    const { error } = await sb
      .from("cliente_productos")
      .update({
        estado,
        fin: estado === "finalizado" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", asignacion.id);
    if (error) setError(error.message);
    else cargar();
  }

  async function quitarProducto(asignacion: ClienteProducto) {
    const producto = productoDe.get(asignacion.producto_id);
    if (
      !window.confirm(
        `¿Quitar ${producto?.nombre || "este producto"} del cliente? El historial de cobros no se elimina.`,
      )
    )
      return;
    const { error } = await sb
      .from("cliente_productos")
      .delete()
      .eq("id", asignacion.id);
    if (error) setError(error.message);
    else cargar();
  }

  if (cargando) return <p className="vacio">Cargando…</p>;
  if (!c)
    return <p className="vacio">Ese cliente no existe o no tienes acceso.</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="bloque">
        <h3>Datos</h3>
        <div className="rejilla-datos">
          <CampoVivo
            etiqueta="Nombre"
            valor={c.negocio}
            guardar={(v) => guardarCampo({ negocio: v })}
          />
          <CampoVivo
            etiqueta="Persona de contacto"
            valor={c.nombre}
            guardar={(v) => guardarCampo({ nombre: v })}
          />
          <CampoVivo
            etiqueta="Correo"
            tipo="email"
            valor={c.email}
            guardar={(v) => guardarCampo({ email: v ? v.toLowerCase() : null })}
            ayuda={
              c.email
                ? "Con este correo entra al portal"
                : "Sin correo NO entra al portal"
            }
          />
          <CampoVivo
            etiqueta="Teléfono"
            tipo="tel"
            valor={c.telefono}
            guardar={(v) => guardarCampo({ telefono: v })}
            ayuda={
              c.telefono ? (
                <a
                  href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Escribirle por WhatsApp
                </a>
              ) : (
                "Con código de país"
              )
            }
          />
          <CampoVivo
            etiqueta="Plan o servicio"
            valor={c.plan}
            ancho
            guardar={(v) => guardarCampo({ plan: v })}
            extra={
              // La flecha con lo que ya ofrecemos, al lado del campo libre.
              <select
                className="campo"
                style={{ width: 116, flex: "none" }}
                value=""
                onChange={(e) =>
                  e.target.value && guardarCampo({ plan: e.target.value })
                }
                aria-label="Elegir de los planes que ya ofrecemos"
              >
                <option value="">Elegir…</option>
                {CATALOGO_PLANES.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.planes.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            }
          />
          <CampoVivo
            etiqueta="Moneda"
            valor={c.moneda ?? "CLP"}
            opciones={MONEDAS}
            guardar={(v) => guardarCampo({ moneda: v ?? "CLP" })}
          />
          <CampoVivo
            etiqueta="Página web"
            valor={c.web_url}
            guardar={(v) => guardarCampo({ web_url: v })}
            ayuda={
              c.web_url ? (
                <a href={enlaceWeb(c.web_url)} target="_blank" rel="noreferrer">
                  Abrir el sitio
                </a>
              ) : undefined
            }
          />
          <Dato k="Cliente desde" v={fecha(c.creado_en)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <CampoVivo
            etiqueta="Servicio ofrecido"
            valor={c.concepto}
            multilinea
            guardar={(v) => guardarCampo({ concepto: v })}
            ayuda='Es lo que el cliente ve como "qué incluye".'
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <CampoVivo
            etiqueta="Notas internas"
            valor={c.notas}
            multilinea
            guardar={(v) => guardarCampo({ notas: v })}
            ayuda="Solo las ve el equipo; el cliente nunca las lee."
          />
        </div>
      </section>

      <section className="bloque">
        <div className="cabecera-bloque">
          <div>
            <h3>Productos asignados</h3>
            <p>
              Lo que Cóndor entrega a este cliente, independiente de cómo se
              cobre.
            </p>
          </div>
          <button
            className="btn solido"
            onClick={() => setAsignandoProducto(true)}
          >
            {Ico.mas({ t: 14 })} Asignar producto
          </button>
        </div>
        {asignados.length === 0 ? (
          <p className="vacio">
            Todavía no hay productos asignados. Elige uno del catálogo de
            Productos para conectarlo con este cliente.
          </p>
        ) : (
          <div className="productos-asignados">
            {asignados.map((a) => {
              const p = productoDe.get(a.producto_id);
              return (
                <article key={a.id} className="producto-asignado">
                  <div className="producto-asignado-identidad">
                    <span className="producto-monograma">
                      {(p?.nombre || "P").slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <b>{p?.nombre || "Producto eliminado"}</b>
                      <small>
                        {[p?.familia, p?.codigo, a.inicio && `desde ${fecha(a.inicio)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </div>
                  </div>
                  <div className="producto-asignado-acciones">
                    <select
                      className="campo"
                      value={a.estado}
                      onChange={(e) => estadoProducto(a, e.target.value)}
                      aria-label={`Estado de ${p?.nombre || "producto"}`}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="activo">Activo</option>
                      <option value="pausado">Pausado</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                    <button
                      className="icono-btn peligro"
                      title="Quitar producto"
                      onClick={() => quitarProducto(a)}
                    >
                      {Ico.eliminar({ t: 15 })}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="bloque">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>
            Cobros{" "}
            <span className="tenue" style={{ fontWeight: 400 }}>
              · {plata(totalRecibido, c.moneda)} recibidos en total
            </span>
          </h3>
          <button
            className="btn solido"
            onClick={() => setEditandoCobro("nuevo")}
          >
            {Ico.mas({ t: 14 })} Agregar cobro
          </button>
        </div>

        {cobros.length === 0 ? (
          <p className="vacio">
            Este cliente todavía no tiene cobros. Un cliente puede existir sin
            ninguno: agrégalos cuando haya algo que cobrarle.
          </p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Cobro</th>
                  <th>Tipo</th>
                  <th className="num">Monto</th>
                  <th className="num">Recibido</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((co) => {
                  const hist = pagosDe.get(co.id) ?? [];
                  const abierta = abierto === co.id;
                  return [
                    <tr
                      key={co.id}
                      onClick={() => setAbierto(abierta ? null : co.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <b>{nombreCobro(co)}</b>
                        {co.producto_id && productoDe.get(co.producto_id) && (
                          <>
                            <br />
                            <span className="tenue">
                              Producto ·{" "}
                              {productoDe.get(co.producto_id)?.nombre}
                            </span>
                          </>
                        )}
                        {co.tipo === "mensual" && co.proximo_cobro && (
                          <>
                            <br />
                            <span className="tenue">
                              Próximo: {fecha(co.proximo_cobro)}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            "pill " + (co.tipo === "mensual" ? "azul" : "gris")
                          }
                        >
                          {co.tipo === "mensual" ? "mensual" : "único"}
                        </span>
                      </td>
                      <td className="num">{plata(co.monto, co.moneda)}</td>
                      <td className="num">
                        {plata(recibido(co.id), co.moneda)}
                      </td>
                      <td>
                        <EstadoCobro c={co} />
                      </td>
                      <td className="acciones">
                        <span className="tenue">
                          {hist.length} pago{hist.length === 1 ? "" : "s"}{" "}
                          {abierta ? "▴" : "▾"}
                        </span>
                      </td>
                    </tr>,

                    abierta && (
                      <tr key={co.id + "-det"}>
                        <td
                          colSpan={6}
                          style={{ background: "var(--panel-2)" }}
                        >
                          <div
                            className="botonera"
                            style={{ marginBottom: 10 }}
                          >
                            <button
                              className="btn solido"
                              onClick={() => setCobrando(co)}
                            >
                              {Ico.cobros({ t: 14 })}{" "}
                              {co.link
                                ? "Ver link"
                                : co.tipo === "mensual"
                                  ? "Activar suscripción"
                                  : "Crear link"}
                            </button>
                            <button
                              className="btn"
                              onClick={() => setAnotandoEn(co)}
                            >
                              {Ico.mas({ t: 14 })} Anotar pago
                            </button>
                            <button
                              className="btn"
                              onClick={() => setEditandoCobro(co)}
                            >
                              Editar
                            </button>

                            {co.tipo === "unico" && co.estado !== "anulado" && (
                              <button
                                className="btn peligro"
                                onClick={() => cambiarEstado(co, "anulado")}
                              >
                                Anular
                              </button>
                            )}
                            {co.tipo === "unico" && co.estado === "anulado" && (
                              <button
                                className="btn"
                                onClick={() => cambiarEstado(co, "pendiente")}
                              >
                                Reactivar
                              </button>
                            )}
                            {co.tipo === "mensual" &&
                              co.estado === "activa" && (
                                <button
                                  className="btn"
                                  onClick={() => cambiarEstado(co, "pausada")}
                                >
                                  Pausar
                                </button>
                              )}
                            {co.tipo === "mensual" &&
                              co.estado === "pausada" && (
                                <button
                                  className="btn"
                                  onClick={() => cambiarEstado(co, "activa")}
                                >
                                  Reanudar
                                </button>
                              )}
                            {co.tipo === "mensual" &&
                              co.estado !== "cancelada" && (
                                <button
                                  className="btn peligro"
                                  onClick={() =>
                                    cambiarEstado(
                                      co,
                                      "cancelada",
                                      co.mp_preapproval_id
                                        ? "Esto la marca cancelada acá, pero NO la cancela en Mercado Pago: si no la das de baja también allá, MP va a seguir cobrándole al cliente todos los meses.\n\n¿Marcarla cancelada igual?"
                                        : "¿Cancelar este cobro mensual?",
                                    )
                                  }
                                >
                                  Cancelar
                                </button>
                              )}
                          </div>

                          {hist.length === 0 ? (
                            <p className="vacio" style={{ padding: "8px 0" }}>
                              Sin pagos todavía. Los de Mercado Pago entran
                              solos por webhook; los de transferencia o boleta
                              se anotan a mano.
                            </p>
                          ) : (
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
                                {hist.map((p) => (
                                  <tr key={p.id}>
                                    {/* `fecha` es la del cobro real (la que se anota
                                          a mano); `creado_en` solo dice cuándo se
                                          registró. Por webhook solo existe la segunda. */}
                                    <td>{fecha(p.fecha ?? p.creado_en)}</td>
                                    <td>
                                      {p.detalle || p.tipo || "—"}
                                      {p.periodo && (
                                        <span className="tenue">
                                          {" "}
                                          · {fecha(p.periodo)}
                                        </span>
                                      )}
                                    </td>
                                    <td>{p.metodo ?? "—"}</td>
                                    <td className="num">
                                      {plata(p.monto, co.moneda)}
                                    </td>
                                    <td>
                                      <span
                                        className={
                                          "pill " +
                                          (p.estado === "pagado"
                                            ? "ok"
                                            : "warn")
                                        }
                                      >
                                        {p.estado ?? "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sueltos.length > 0 && (
        <section className="bloque">
          <h3>Pagos sin cobro</h3>
          <p className="parrafo tenue">
            Entraron cuando su cobro ya no existía. Se muestran para que la
            plata no desaparezca de la cuenta del cliente.
          </p>
          <div className="tabla-caja">
            <table>
              <tbody>
                {sueltos.map((p) => (
                  <tr key={p.id}>
                    <td>{fecha(p.fecha ?? p.creado_en)}</td>
                    <td>{p.detalle || p.tipo || "—"}</td>
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
        </section>
      )}

      {editandoCobro && (
        <EditorCobro
          clienteId={c.id}
          monedaCliente={c.moneda}
          cobro={editandoCobro === "nuevo" ? null : editandoCobro}
          cerrar={() => setEditandoCobro(null)}
          guardado={() => {
            setEditandoCobro(null);
            cargar();
          }}
        />
      )}

      {anotandoEn && (
        <AnotarPago
          clienteId={c.id}
          cobro={anotandoEn}
          cerrar={() => setAnotandoEn(null)}
          guardado={() => {
            setAnotandoEn(null);
            cargar();
          }}
        />
      )}

      {cobrando && (
        <CrearLinkCobro
          cliente={c}
          cobro={cobrando}
          cerrar={() => setCobrando(null)}
          guardado={cargar}
        />
      )}
      {asignandoProducto && (
        <AsignarProducto
          clienteId={c.id}
          productos={productos}
          asignados={asignados}
          cerrar={() => setAsignandoProducto(false)}
          guardado={() => {
            setAsignandoProducto(false);
            cargar();
          }}
        />
      )}
    </>
  );
}

function AsignarProducto({
  clienteId,
  productos,
  asignados,
  cerrar,
  guardado,
}: {
  clienteId: string;
  productos: Producto[];
  asignados: ClienteProducto[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const idsAsignados = new Set(asignados.map((a) => a.producto_id));
  const elegibles = productos.filter(
    (p) => p.estado !== "descontinuado" && !idsAsignados.has(p.id),
  );
  const [productoId, setProductoId] = useState(elegibles[0]?.id ?? "");
  const [estado, setEstado] = useState<ClienteProducto["estado"]>("activo");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!productoId) return;
    setGuardando(true);
    const { data: usuario } = await sb.auth.getUser();
    const { error } = await sb.from("cliente_productos").insert({
      cliente_id: clienteId,
      producto_id: productoId,
      estado,
      inicio: inicio || null,
      notas: notas.trim() || null,
      creado_por: usuario.user?.id ?? null,
    });
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal"
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
      >
        <header><h2>Asignar producto</h2></header>
        <div className="contenido">
          {elegibles.length === 0 ? (
            <p className="vacio">
              Todos los productos disponibles ya están asignados. Crea otro en
              la pestaña Productos o reactiva uno descontinuado.
            </p>
          ) : (
            <>
              <label className="campo-lbl">
                Producto del catálogo
                <select
                  className="campo"
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  required
                >
                  {elegibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.familia ? ` · ${p.familia}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="dos">
                <label className="campo-lbl">
                  Estado
                  <select
                    className="campo"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as ClienteProducto["estado"])}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </label>
                <label className="campo-lbl">
                  Inicio
                  <input
                    className="campo"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </label>
              </div>
              <label className="campo-lbl">
                Notas operativas
                <textarea
                  className="campo"
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Alcance, variante contratada o condición especial"
                />
              </label>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button
            className="btn solido"
            disabled={!productoId || guardando}
          >
            {guardando ? "Asignando…" : "Asignar producto"}
          </button>
        </footer>
      </form>
    </div>
  );
}
