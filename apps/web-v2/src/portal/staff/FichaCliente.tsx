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
  type Cobro,
  type Pago,
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
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [gestionando, setGestionando] = useState<string | null>(null);

  const [editandoCobro, setEditandoCobro] = useState<Cobro | null | "nuevo">(
    null,
  );
  const [anotandoEn, setAnotandoEn] = useState<Cobro | null>(null);
  const [cobrando, setCobrando] = useState<Cobro | null>(null);

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
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

    const [{ data: co, error: eco }, { data: p }] =
      await Promise.all([
        sb.from("cobros").select("*").eq("cliente_id", id).order("numero"),
        sb
          .from("pagos")
          .select("*")
          .eq("cliente_id", id)
          .order("creado_en", { ascending: false }),
      ]);
    // Si la migración todavía no se corrió, la tabla no existe. Se avisa en vez
    // de mostrar una ficha vacía que parece un cliente sin cobros.
    if (eco) setError("No se pudieron cargar los cobros: " + eco.message);
    setCobros((co ?? []) as Cobro[]);
    setPagos((p ?? []) as Pago[]);
    if (!silencioso) setCargando(false);
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
    else void cargar(true);
  }

  async function gestionarSuscripcion(
    cobro: Cobro,
    accion: "pausar" | "reanudar" | "cancelar",
  ) {
    if (
      accion === "cancelar" &&
      !window.confirm("Se cancelará la suscripción en Mercado Pago y dejarán de hacerse cobros automáticos. Esta acción no se puede deshacer. ¿Continuar?")
    ) return;
    setGestionando(cobro.id);
    setError("");
    try {
      const { data, error } = await sb.functions.invoke("gestionar-suscripcion", {
        body: { cobro_id: cobro.id, accion },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await cargar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la suscripción.");
    } finally {
      setGestionando(null);
    }
  }

  async function eliminarPagoPendiente(pago: Pago) {
    if (pago.estado && pago.estado !== "pendiente") return;
    const ok = window.confirm(
      "¿Eliminar este pago pendiente?\n\n" +
        "Se quitará del historial interno, pero un link activo en Mercado Pago no se cancela con esta acción.",
    );
    if (!ok) return;
    const anterior = pagos;
    setPagos((lista) => lista.filter((p) => p.id !== pago.id));
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
                                   disabled={gestionando === co.id}
                                   onClick={() => void gestionarSuscripcion(co, "pausar")}
                                 >
                                   {gestionando === co.id ? "Actualizando…" : "Pausar"}
                                 </button>
                              )}
                            {co.tipo === "mensual" &&
                              co.estado === "pausada" && (
                                 <button
                                   className="btn"
                                   disabled={gestionando === co.id}
                                   onClick={() => void gestionarSuscripcion(co, "reanudar")}
                                 >
                                   {gestionando === co.id ? "Actualizando…" : "Reanudar"}
                                 </button>
                              )}
                            {co.tipo === "mensual" &&
                              co.estado !== "cancelada" && (
                                 <button
                                   className="btn peligro"
                                   disabled={gestionando === co.id}
                                   onClick={() => void gestionarSuscripcion(co, "cancelar")}
                                 >
                                   {gestionando === co.id ? "Cancelando…" : "Cancelar"}
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
                                  <th aria-label="Acciones"></th>
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
                                    <td className="acciones">
                                      {(!p.estado || p.estado === "pendiente") && (
                                        <button
                                          className="icono-btn peligro"
                                          onClick={() => void eliminarPagoPendiente(p)}
                                          title="Eliminar pago pendiente"
                                          aria-label="Eliminar pago pendiente"
                                        >
                                          {Ico.eliminar({ t: 14 })}
                                        </button>
                                      )}
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
                    <td className="acciones">
                      {(!p.estado || p.estado === "pendiente") && (
                        <button
                          className="icono-btn peligro"
                          onClick={() => void eliminarPagoPendiente(p)}
                          title="Eliminar pago pendiente"
                          aria-label="Eliminar pago pendiente"
                        >
                          {Ico.eliminar({ t: 14 })}
                        </button>
                      )}
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
            void cargar(true);
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
            void cargar(true);
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
    </>
  );
}
