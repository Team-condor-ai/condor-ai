import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb, plata, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import { Barras, corto, mesDe, mesesDelAnio, NavAnio } from "../graficos";
import { RegistrarMovimiento } from "./RegistrarMovimiento";
import { GastosFijos } from "./GastosFijos";
import { EditorCuenta } from "./EditorCuenta";
import { EditorAsiento } from "./EditorAsiento";
import { DesgloseGastos } from "./DesgloseGastos";
import { ImportarCartola } from "./ImportarCartola";
import { TransferirFondos } from "./TransferirFondos";
import { Pasivos } from "./Pasivos";
import { Cobros } from "../Cobros";
import type { Asiento, Cuenta, GastoMeta, MetaAdsAjustes, SaldoCuenta } from "./tipos";

// "Cobros" se fusionó acá el 2-sept-2026 (pedido de Joaquín): vivía como
// pestaña propia del menú, separada de Contabilidad, pero es la misma
// pregunta de plata -- quién pagó y cuánto entró -- vista desde el cliente en
// vez de la cuenta. `Cobros.tsx` ya no trae su propio encabezado de página:
// se le sacó el `<div className="barra">` para que no salgan dos títulos
// apilados al montarlo como pestaña.
const PESTANAS = [
  { id: "resumen", texto: "Resumen" },
  { id: "desglose", texto: "Desglose de egresos" },
  { id: "cobros", texto: "Cobros" },
  { id: "pasivos", texto: "Pasivos" },
  { id: "libro", texto: "Libro diario" },
  { id: "fijos", texto: "Gastos fijos" },
  { id: "cuentas", texto: "Plan de cuentas" },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

/**
 * Contabilidad con partida doble.
 *
 * LAS TRES PREGUNTAS QUE TIENE QUE RESPONDER
 * ---------------------------------------------------------------------------
 *  1. ¿Cuánto tengo? → suma de las cuentas líquidas.
 *  2. ¿Cómo me fue? → Ingresos − Gastos del período.
 *  3. ¿Cuánto valgo? → Activo − Pasivo, que por definición es el Patrimonio.
 *
 * LA ECUACIÓN SE MUESTRA, NO SE ASUME
 * ---------------------------------------------------------------------------
 * `Activo = Pasivo + Patrimonio` aparece en pantalla con sus tres cifras. Si
 * algún día no cuadra, se ve; esconderla sería confiar en que nadie se
 * equivocó nunca cargando un asiento.
 *
 * El patrimonio se calcula como `Activo − Pasivo` y NO se lee de las cuentas
 * de patrimonio: así incluye el resultado del ejercicio sin necesidad de un
 * asiento de cierre, que es justo lo que nadie se acuerda de hacer.
 */
export function Contabilidad() {
  const confirmar = useConfirmacion();
  const [params] = useSearchParams();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [gastosMeta, setGastosMeta] = useState<GastoMeta[]>([]);
  const [metaAjustes, setMetaAjustes] = useState<MetaAdsAjustes | null>(null);
  const [descuadrados, setDescuadrados] = useState<
    { id: string; glosa: string }[]
  >([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState<Pestana>(() => {
    const pedida = params.get("tab");
    return PESTANAS.some((p) => p.id === pedida)
      ? (pedida as Pestana)
      : "resumen";
  });
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [registrando, setRegistrando] = useState<"ingreso" | "egreso" | null>(
    null,
  );
  const [asientoManual, setAsientoManual] = useState(false);
  const [cartolaAbierta, setCartolaAbierta] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<Cuenta | "nueva" | null>(
    null,
  );

  async function cargar() {
    setCargando(true);
    const [cu, sa, as, de, gm, ma] = await Promise.all([
      sb.from("cuentas").select("*").order("orden"),
      sb.from("saldos_cuentas").select("*"),
      sb
        .from("asientos")
        .select("*, asiento_lineas(*)")
        .order("fecha", { ascending: false })
        .limit(400),
      sb.from("asientos_descuadrados").select("id, glosa"),
      sb
        .from("gastos_meta")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(2000),
      sb
        .from("meta_ads_ajustes")
        .select("contabilizar_desde,motivo,actualizado_en")
        .maybeSingle(),
    ]);
    if (cu.error)
      setError(
        "Falta correr la migración de contabilidad: " + cu.error.message,
      );
    else setError("");
    setCuentas((cu.data ?? []) as Cuenta[]);
    setSaldos((sa.data ?? []) as SaldoCuenta[]);
    setAsientos((as.data ?? []) as Asiento[]);
    // La contabilidad sigue funcionando si la migración de Meta aún no fue
    // desplegada. En ese caso Desglose usa los asientos meta_ads como respaldo.
    setGastosMeta((gm.data ?? []) as GastoMeta[]);
    // Igual que `gastos_meta`: si la migración del corte no está aplicada, la
    // pantalla se comporta como antes en vez de romperse.
    setMetaAjustes((ma.data ?? null) as MetaAdsAjustes | null);
    setDescuadrados((de.data ?? []) as { id: string; glosa: string }[]);
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const d = useMemo(() => {
    const porTipo = (t: string) =>
      saldos
        .filter((s) => s.tipo === t)
        .reduce((a, s) => a + Number(s.saldo ?? 0), 0);

    const activo = porTipo("activo");
    const pasivo = porTipo("pasivo");
    // Patrimonio = lo que queda después de pagar todo lo que se debe. Es la
    // definición, y sale sola sin asiento de cierre.
    const patrimonio = activo - pasivo;
    const liquido = saldos
      .filter((s) => s.liquida)
      .reduce((a, s) => a + Number(s.saldo ?? 0), 0);

    const tipoDe = new Map(cuentas.map((c) => [c.id, c.tipo]));
    const meses = mesesDelAnio(anio);
    const ing = new Map<string, number>();
    const gas = new Map<string, number>();

    for (const a of asientos) {
      const k = mesDe(a.fecha);
      for (const l of a.asiento_lineas ?? []) {
        const t = tipoDe.get(l.cuenta_id);
        // Un ingreso aumenta por el haber; un gasto, por el debe. Lo contrario
        // (una nota de crédito, un reembolso) resta, y por eso va el signo.
        if (t === "ingreso") ing.set(k, (ing.get(k) ?? 0) + l.haber - l.debe);
        if (t === "gasto") gas.set(k, (gas.get(k) ?? 0) + l.debe - l.haber);
      }
    }

    const hoy = new Date();
    const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const ingAnio = meses.reduce((t, m) => t + (ing.get(m.clave) ?? 0), 0);
    const gasAnio = meses.reduce((t, m) => t + (gas.get(m.clave) ?? 0), 0);

    return {
      activo,
      pasivo,
      patrimonio,
      liquido,
      ingresoMes: ing.get(mesHoy) ?? 0,
      gastoMes: gas.get(mesHoy) ?? 0,
      ingAnio,
      gasAnio,
      serieIngreso: meses.map((m) => ({
        et: m.et,
        valor: ing.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      serieGasto: meses.map((m) => ({
        et: m.et,
        valor: gas.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      // Cuántos meses aguanta lo líquido al ritmo de gasto de los últimos
      // meses. Es la pregunta que de verdad se hace quien mira la caja.
      pista: (() => {
        const cerrados = meses
          .filter((m) => !m.futuro && !m.esHoy)
          .map((m) => gas.get(m.clave) ?? 0);
        const conGasto = cerrados.filter((v) => v > 0);
        if (!conGasto.length || liquido <= 0) return null;
        const prom = conGasto.reduce((a, b) => a + b, 0) / conGasto.length;
        return prom > 0 ? liquido / prom : null;
      })(),
    };
  }, [saldos, cuentas, asientos, anio]);

  // Deshacer solo se ofrece para lo que el equipo anotó a mano (el egreso/
  // ingreso rápido, el asiento manual, un gasto fijo anotado con un clic).
  // Un asiento de origen 'cobro' o 'meta_ads' está ligado a un pago real o a
  // un sync externo — borrarlo ahí desincroniza los libros del sistema que lo
  // generó, así que esos no se ofrecen para borrar desde acá.
  const ORIGENES_BORRABLES = new Set(["manual", "manual-contador", "fijo"]);

  async function borrarAsiento(a: Asiento) {
    const detalle = (a.asiento_lineas ?? [])
      .map((l) => cuentas.find((c) => c.id === l.cuenta_id)?.nombre ?? "—")
      .join(" / ");
    if (!await confirmar(`¿Deshacer "${a.glosa}"?`, `${detalle}\n\nEsto borra el asiento y no se puede recuperar.`, "Deshacer")) return;
    const { error } = await sb.from("asientos").delete().eq("id", a.id);
    if (error) setError(error.message);
    else cargar();
  }

  const grupos = useMemo(() => {
    const g: Record<string, SaldoCuenta[]> = {};
    for (const s of saldos) (g[s.tipo] ??= []).push(s);
    for (const k of Object.keys(g))
      g[k].sort((a, b) => a.codigo.localeCompare(b.codigo));
    return g;
  }, [saldos]);

  if (cargando)
    return (
      <div className="cuerpo">
        <p className="vacio">Cargando…</p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <h1>Contabilidad</h1>
        <button className="btn" onClick={() => setAsientoManual(true)}>
          {Ico.libro({ t: 14 })} Asiento manual
        </button>
        <button className="btn" onClick={() => setCartolaAbierta(true)}>
          {Ico.subir({ t: 14 })} Cartola
        </button>
        <button className="btn" onClick={() => setTransfiriendo(true)}>
          {Ico.traspaso({ t: 14 })} Mover fondos
        </button>
        <button className="btn" onClick={() => setRegistrando("ingreso")}>
          {Ico.mas({ t: 14 })} Ingreso
        </button>
        <button className="btn solido" onClick={() => setRegistrando("egreso")}>
          {Ico.mas({ t: 14 })} Egreso
        </button>
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        {descuadrados.length > 0 && (
          <p className="error">
            {descuadrados.length} asiento{descuadrados.length === 1 ? "" : "s"}{" "}
            no cuadra
            {descuadrados.length === 1 ? "" : "n"} (el debe no iguala al haber):{" "}
            {descuadrados
              .slice(0, 3)
              .map((a) => a.glosa)
              .join(", ")}
            . Revísalos en el libro.
          </p>
        )}

        <div className="chips" style={{ marginBottom: 14 }}>
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              className={"chip" + (pestana === p.id ? " on" : "")}
              onClick={() => setPestana(p.id)}
            >
              {p.texto}
            </button>
          ))}
        </div>

        {pestana === "resumen" && (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="tile">{Ico.cobros({ t: 18 })}</div>
                <div className="cifra">
                  <b>{plata(d.liquido)}</b>
                </div>
                <p>
                  Disponible ahora · caja, banco y Mercado Pago
                  {d.pista !== null && (
                    <> · alcanza para ~{d.pista.toFixed(1)} meses</>
                  )}
                </p>
              </div>
              <div className="kpi">
                <div className="tile">{Ico.boletas({ t: 18 })}</div>
                <div className="cifra">
                  <b style={{ color: "var(--ok-tx)" }}>{plata(d.ingresoMes)}</b>
                </div>
                <p>Ingresos de este mes</p>
              </div>
              <div className="kpi">
                <div className="tile">{Ico.descargar({ t: 18 })}</div>
                <div className="cifra">
                  <b style={{ color: "var(--mal-tx)" }}>{plata(d.gastoMes)}</b>
                </div>
                <p>Gastos de este mes</p>
              </div>
              <div className="kpi">
                <div className="tile">{Ico.grafo({ t: 18 })}</div>
                <div className="cifra">
                  <b
                    style={{
                      color:
                        d.ingresoMes - d.gastoMes >= 0
                          ? "var(--ok-tx)"
                          : "var(--mal-tx)",
                    }}
                  >
                    {plata(d.ingresoMes - d.gastoMes)}
                  </b>
                </div>
                <p>Resultado del mes · ingresos menos gastos</p>
              </div>
            </div>

            {/* LA ECUACIÓN, A LA VISTA. Si deja de cuadrar, se nota. */}
            <section className="bloque">
              <h3>Balance</h3>
              <div
                className="totales"
                style={{
                  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                }}
              >
                <div>
                  <small>Activo</small>
                  <b>{plata(d.activo)}</b>
                  <span className="conteo">lo que hay y lo que nos deben</span>
                </div>
                <div>
                  <small>Pasivo</small>
                  <b>{plata(d.pasivo)}</b>
                  <span className="conteo">lo que debemos</span>
                </div>
                <div>
                  <small>Patrimonio</small>
                  <b
                    style={{
                      color: d.patrimonio >= 0 ? undefined : "var(--mal-tx)",
                    }}
                  >
                    {plata(d.patrimonio)}
                  </b>
                  <span className="conteo">activo − pasivo</span>
                </div>
              </div>
              <p className="conteo" style={{ marginTop: 10 }}>
                <b>{plata(d.activo)}</b> = <b>{plata(d.pasivo)}</b> +{" "}
                <b>{plata(d.patrimonio)}</b> · la ecuación contable se cumple
                por construcción: el patrimonio se calcula como activo menos
                pasivo, así incluye el resultado del ejercicio sin asiento de
                cierre.
              </p>
            </section>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <NavAnio anio={anio} setAnio={setAnio} />
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                marginBottom: 18,
              }}
            >
              <section className="bloque" style={{ margin: 0 }}>
                <h3 style={{ minHeight: 22, margin: "0 0 6px" }}>
                  Ingresos por mes{" "}
                  <span className="tenue" style={{ fontWeight: 400 }}>
                    · {plata(d.ingAnio)} en {anio}
                  </span>
                </h3>
                <Barras datos={d.serieIngreso} formato={corto} />
              </section>
              <section className="bloque" style={{ margin: 0 }}>
                <h3 style={{ minHeight: 22, margin: "0 0 6px" }}>
                  Gastos por mes{" "}
                  <span className="tenue" style={{ fontWeight: 400 }}>
                    · {plata(d.gasAnio)} en {anio}
                  </span>
                </h3>
                <Barras datos={d.serieGasto} formato={corto} />
              </section>
            </div>

            <section className="bloque">
              <h3>
                Estado de resultados {anio}{" "}
                <span className="tenue" style={{ fontWeight: 400 }}>
                  · {d.ingAnio - d.gasAnio >= 0 ? "utilidad" : "pérdida"} de{" "}
                  {plata(Math.abs(d.ingAnio - d.gasAnio))}
                </span>
              </h3>
              <div className="tabla-caja">
                <table>
                  <tbody>
                    <tr>
                      <td>Ingresos</td>
                      <td className="num">{plata(d.ingAnio)}</td>
                    </tr>
                    <tr>
                      <td>Gastos</td>
                      <td className="num">−{plata(d.gasAnio)}</td>
                    </tr>
                    <tr style={{ fontWeight: 700 }}>
                      <td>Resultado del ejercicio</td>
                      <td
                        className="num"
                        style={{
                          color:
                            d.ingAnio - d.gasAnio >= 0
                              ? "var(--ok-tx)"
                              : "var(--mal-tx)",
                        }}
                      >
                        {plata(d.ingAnio - d.gasAnio)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {pestana === "desglose" && (
          <DesgloseGastos
            cuentas={cuentas}
            asientos={asientos}
            gastosMeta={gastosMeta}
            metaAjustes={metaAjustes}
          />
        )}

        {pestana === "pasivos" && (
          <Pasivos cuentas={cuentas} recargar={cargar} />
        )}

        {pestana === "libro" && (
          <section className="bloque">
            <h3>
              Libro diario{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · {asientos.length} asientos
              </span>
            </h3>
            {asientos.length === 0 ? (
              <p className="vacio">
                Todavía no hay movimientos. Registra el primero con los botones
                de arriba.
              </p>
            ) : (
              <div className="tabla-caja">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Glosa</th>
                      <th>Cuentas</th>
                      <th className="num">Monto</th>
                      <th>Origen</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientos.map((a) => {
                      const total = (a.asiento_lineas ?? []).reduce(
                        (t, l) => t + l.debe,
                        0,
                      );
                      const nombre = (id: string) =>
                        cuentas.find((c) => c.id === id)?.nombre ?? "—";
                      return (
                        <tr key={a.id}>
                          <td>{fecha(a.fecha)}</td>
                          <td>
                            <b>{a.glosa}</b>
                          </td>
                          <td className="conteo">
                            {(a.asiento_lineas ?? []).map((l, i) => (
                              <span key={l.id}>
                                {i > 0 && " · "}
                                {nombre(l.cuenta_id)}{" "}
                                {l.debe > 0 ? "(debe)" : "(haber)"}
                              </span>
                            ))}
                          </td>
                          <td className="num">{plata(total)}</td>
                          <td>
                            <span className="pill gris">{a.origen}</span>
                          </td>
                          <td className="acciones">
                            {ORIGENES_BORRABLES.has(a.origen) && (
                              <button
                                className="icono-btn peligro"
                                title="Deshacer (borra el asiento)"
                                onClick={() => borrarAsiento(a)}
                              >
                                {Ico.eliminar({ t: 15 })}
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
          </section>
        )}

        {pestana === "cobros" && <Cobros />}

        {pestana === "fijos" && (
          <GastosFijos
            cuentas={cuentas}
            asientos={asientos}
            recargar={cargar}
          />
        )}

        {pestana === "cuentas" && (
          <>
            <div className="plan-cuentas-cab">
              <div>
                <b>Plan de cuentas configurable</b>
                <small>
                  La numeración y clasificación quedan bajo criterio del
                  contador.
                </small>
              </div>
              <button
                className="btn solido"
                onClick={() => setCuentaEditando("nueva")}
              >
                {Ico.mas({ t: 14 })} Nueva cuenta
              </button>
            </div>
            {(
              ["activo", "pasivo", "patrimonio", "ingreso", "gasto"] as const
            ).map((t) => (
              <section className="bloque" key={t}>
                <h3 style={{ textTransform: "capitalize" }}>{t}</h3>
                <div className="tabla-caja">
                  <table>
                    <tbody>
                      {(grupos[t] ?? []).map((s) => (
                        <tr
                          key={s.id}
                          onClick={() =>
                            setCuentaEditando(
                              cuentas.find((c) => c.id === s.id) ?? null,
                            )
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <td style={{ width: 70 }} className="conteo">
                            {s.codigo}
                          </td>
                          <td>
                            {s.nombre}
                            {s.liquida && (
                              <span
                                className="pill ok"
                                style={{ marginLeft: 8 }}
                              >
                                líquida
                              </span>
                            )}
                            {!s.corriente && (
                              <span
                                className="pill gris"
                                style={{ marginLeft: 8 }}
                              >
                                no corriente
                              </span>
                            )}
                          </td>
                          <td className="num">{plata(Number(s.saldo ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {registrando && (
        <RegistrarMovimiento
          tipo={registrando}
          cuentas={cuentas}
          cerrar={() => setRegistrando(null)}
          guardado={() => {
            setRegistrando(null);
            cargar();
          }}
        />
      )}
      {asientoManual && (
        <EditorAsiento
          cuentas={cuentas}
          cerrar={() => setAsientoManual(false)}
          guardado={() => {
            setAsientoManual(false);
            cargar();
          }}
        />
      )}
      {cartolaAbierta && (
        <ImportarCartola
          cuentas={cuentas}
          asientos={asientos}
          cerrar={() => setCartolaAbierta(false)}
          recargar={cargar}
        />
      )}
      {transfiriendo && (
        <TransferirFondos
          cuentas={cuentas}
          cerrar={() => setTransfiriendo(false)}
          guardado={() => {
            setTransfiriendo(false);
            cargar();
          }}
        />
      )}
      {cuentaEditando && (
        <EditorCuenta
          cuenta={cuentaEditando === "nueva" ? null : cuentaEditando}
          cerrar={() => setCuentaEditando(null)}
          guardado={() => {
            setCuentaEditando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
