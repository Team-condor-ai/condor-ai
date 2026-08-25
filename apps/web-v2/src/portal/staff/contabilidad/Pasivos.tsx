import { useEffect, useState } from "react";
import { sb, plata, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { lineasDe, type Asiento, type Cuenta, type PasivoAbierto } from "./tipos";

const CODIGO_TARJETA_CORPORATIVA = "2105";

/**
 * Pasivos, uno por uno: cobrarlos de la plata líquida real, o marcarlos
 * pagados sin tocarla cuando ya se cobraron solos por otro medio (ej. una
 * tarjeta corporativa cargando Meta Ads automáticamente).
 *
 * POR QUÉ NO BASTABA CON EL SALDO DE LA CUENTA
 * ---------------------------------------------------------------------------
 * "Meta Ads por pagar" solo se cancelaba importando la cartola bancaria a
 * mano — si nadie lo hacía, quedaba inflado para siempre y sin forma de decir
 * "esto ya se pagó, pero no de la plata que trackeamos acá". Esta pantalla
 * salda un ítem a la vez, y cada uno queda enlazado al asiento que lo saldó
 * (`salda_asiento_id`) para poder auditar después.
 */
export function Pasivos({
  cuentas,
  recargar,
}: {
  cuentas: Cuenta[];
  recargar: () => void;
}) {
  const [abiertos, setAbiertos] = useState<PasivoAbierto[]>([]);
  const [saldados, setSaldados] = useState<Asiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [cuentaElegida, setCuentaElegida] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const liquidas = cuentas.filter((c) => c.liquida);
  const pasivas = cuentas.filter((c) => c.tipo === "pasivo");
  const gastos = cuentas.filter((c) => c.tipo === "gasto");
  const tarjeta = cuentas.find((c) => c.codigo === CODIGO_TARJETA_CORPORATIVA);

  async function cargar() {
    setCargando(true);
    const [ab, sd] = await Promise.all([
      sb.from("pasivos_abiertos").select("*"),
      sb
        .from("asientos")
        .select("*, asiento_lineas(*)")
        .not("salda_asiento_id", "is", null)
        .order("fecha", { ascending: false })
        .limit(100),
    ]);
    if (ab.error) setError("Falta correr la migración de pasivos: " + ab.error.message);
    else setError("");
    setAbiertos((ab.data ?? []) as PasivoAbierto[]);
    setSaldados((sd.data ?? []) as Asiento[]);
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saldar(item: PasivoAbierto, cuentaHaberId: string, comoSeVe: string) {
    setProcesando(item.asiento_id);
    setError("");
    const { data: asiento, error: e1 } = await sb
      .from("asientos")
      .insert({
        fecha: new Date().toISOString().slice(0, 10),
        glosa: `${comoSeVe}: ${item.glosa}`,
        origen: "manual",
        salda_asiento_id: item.asiento_id,
      })
      .select()
      .single();

    if (e1 || !asiento) {
      setProcesando(null);
      setError(e1?.message ?? "No se pudo crear el asiento de pago");
      return;
    }

    const lineas = lineasDe(item.cuenta_id, cuentaHaberId, item.monto);
    const { error: e2 } = await sb
      .from("asiento_lineas")
      .insert(lineas.map((l) => ({ ...l, asiento_id: asiento.id })));

    if (e2) {
      await sb.from("asientos").delete().eq("id", asiento.id);
      setProcesando(null);
      setError(e2.message);
      return;
    }

    setProcesando(null);
    setCobrando(null);
    setCuentaElegida("");
    await cargar();
    recargar();
  }

  function comoSeSaldo(a: Asiento) {
    const l = (a.asiento_lineas ?? []).find((x) => x.haber > 0);
    const cuenta = cuentas.find((c) => c.id === l?.cuenta_id);
    if (!cuenta) return null;
    return cuenta.liquida
      ? { texto: `Cobrado de ${cuenta.nombre}`, clase: "ok" }
      : { texto: "Pagado sin afectar el líquido", clase: "gris" };
  }

  if (cargando) return <p className="vacio">Cargando…</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="bloque">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>
            Pasivos abiertos{" "}
            <span className="tenue" style={{ fontWeight: 400 }}>
              · {abiertos.length} ítem{abiertos.length === 1 ? "" : "s"} sin saldar
            </span>
          </h3>
          <button className="btn solido" style={{ marginLeft: "auto" }} onClick={() => setCreando(true)}>
            {Ico.mas({ t: 14 })} Nuevo pasivo
          </button>
        </div>
        {abiertos.length === 0 ? (
          <p className="vacio">No hay pasivos pendientes de saldar.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Glosa</th>
                  <th>Cuenta</th>
                  <th className="num">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {abiertos.map((item) => (
                  <tr key={item.asiento_id}>
                    <td>{fecha(item.fecha)}</td>
                    <td>{item.glosa}</td>
                    <td className="conteo">
                      {item.cuenta_codigo} · {item.cuenta_nombre}
                    </td>
                    <td className="num">{plata(item.monto)}</td>
                    <td>
                      {cobrando === item.asiento_id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select
                            className="campo"
                            style={{ padding: "4px 8px" }}
                            value={cuentaElegida}
                            onChange={(e) => setCuentaElegida(e.target.value)}
                          >
                            <option value="">Elegir cuenta…</option>
                            {liquidas.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                          <button
                            className="btn solido"
                            disabled={!cuentaElegida || procesando === item.asiento_id}
                            onClick={() => saldar(item, cuentaElegida, "Pago de")}
                          >
                            Confirmar
                          </button>
                          <button className="btn" onClick={() => { setCobrando(null); setCuentaElegida(""); }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn solido"
                            disabled={procesando === item.asiento_id}
                            onClick={() => setCobrando(item.asiento_id)}
                          >
                            Cobrar
                          </button>
                          <button
                            className="btn"
                            disabled={!tarjeta || procesando === item.asiento_id}
                            title={!tarjeta ? "Falta la cuenta 2105 Tarjeta de crédito corporativa" : ""}
                            onClick={() =>
                              tarjeta &&
                              window.confirm(
                                `¿Marcar "${item.glosa}" como pagado sin afectar el líquido? Se reclasifica a "${tarjeta.nombre}", ninguna cuenta de Caja/Banco/Mercado Pago baja.`,
                              ) &&
                              saldar(item, tarjeta.id, "Pagado sin afectar el líquido")
                            }
                          >
                            Marcar pagado
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="conteo" style={{ marginTop: 10 }}>
          <b>Cobrar</b> baja una cuenta líquida real (Caja, Banco o Mercado
          Pago). <b>Marcar pagado</b> es para gastos que ya se cobraron solos
          por otro medio (ej. tarjeta corporativa): salda el pasivo sin restar
          nada de la plata disponible.
        </p>
      </section>

      <section className="bloque">
        <h3>
          Pasivos saldados{" "}
          <span className="tenue" style={{ fontWeight: 400 }}>
            · últimos {saldados.length}
          </span>
        </h3>
        {saldados.length === 0 ? (
          <p className="vacio">Todavía no se ha saldado ningún pasivo desde acá.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <tbody>
                {saldados.map((a) => {
                  const como = comoSeSaldo(a);
                  return (
                    <tr key={a.id}>
                      <td>{fecha(a.fecha)}</td>
                      <td>{a.glosa}</td>
                      <td>
                        {como && <span className={"pill " + como.clase}>{como.texto}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creando && (
        <NuevoPasivo
          pasivas={pasivas}
          gastos={gastos}
          cerrar={() => setCreando(false)}
          guardado={() => {
            setCreando(false);
            cargar();
            recargar();
          }}
        />
      )}
    </>
  );
}

/**
 * Un pasivo entrado a mano: "debo esto, todavía no lo pago". Debita un gasto
 * (lo que se debe) y acredita la cuenta de pasivo elegida — el mismo par que
 * usa el sync de Meta Ads, solo que aquí la categoría de pasivo la elige la
 * persona en vez de venir fija por integración. Queda abierto de inmediato en
 * "Pasivos abiertos", arriba, para saldarlo cuando corresponda.
 */
function NuevoPasivo({
  pasivas,
  gastos,
  cerrar,
  guardado,
}: {
  pasivas: Cuenta[];
  gastos: Cuenta[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const [fechaVal, setFechaVal] = useState(new Date().toISOString().slice(0, 10));
  const [glosa, setGlosa] = useState("");
  const [monto, setMonto] = useState(0);
  const [cuentaPasivo, setCuentaPasivo] = useState(pasivas[0]?.id ?? "");
  const [cuentaGasto, setCuentaGasto] = useState(gastos[0]?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!glosa.trim()) { setError("Describe qué se debe."); return; }
    if (!monto || monto <= 0) { setError("Ponle un monto."); return; }
    if (!cuentaPasivo || !cuentaGasto) { setError("Elige la categoría de pasivo y el gasto que corresponde."); return; }
    setGuardando(true);
    setError("");

    const { data: asiento, error: e1 } = await sb.from("asientos").insert({
      fecha: fechaVal,
      glosa: glosa.trim(),
      origen: "manual",
    }).select().single();
    if (e1 || !asiento) { setGuardando(false); setError(e1?.message ?? "No se pudo crear el asiento"); return; }

    const m = Math.round(Number(monto) || 0);
    const { error: e2 } = await sb.from("asiento_lineas")
      .insert(lineasDe(cuentaGasto, cuentaPasivo, m).map((l) => ({ ...l, asiento_id: asiento.id })));
    if (e2) {
      await sb.from("asientos").delete().eq("id", asiento.id);
      setGuardando(false);
      setError(e2.message);
      return;
    }
    setGuardando(false);
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Nuevo pasivo</h2>
          <small>Algo que se debe y todavía no se paga</small>
        </header>
        <div className="contenido">
          <label className="campo-lbl">
            Qué se debe
            <input
              className="campo" autoFocus
              placeholder="Ej: factura del contador de agosto"
              value={glosa} onChange={(e) => setGlosa(e.target.value)}
            />
          </label>
          <div className="dos">
            <label className="campo-lbl">
              Monto
              <input
                className="campo" type="number" min={0} required
                value={monto || ""} onChange={(e) => setMonto(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Fecha
              <input className="campo" type="date" value={fechaVal} onChange={(e) => setFechaVal(e.target.value)} />
            </label>
          </div>
          <label className="campo-lbl">
            Categoría de pasivo
            <select className="campo" value={cuentaPasivo} onChange={(e) => setCuentaPasivo(e.target.value)}>
              {pasivas.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
              ))}
            </select>
          </label>
          <label className="campo-lbl">
            Gasto que corresponde
            <select className="campo" value={cuentaGasto} onChange={(e) => setCuentaGasto(e.target.value)}>
              {gastos.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
              ))}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Registrar pasivo"}
          </button>
        </footer>
      </form>
    </div>
  );
}
