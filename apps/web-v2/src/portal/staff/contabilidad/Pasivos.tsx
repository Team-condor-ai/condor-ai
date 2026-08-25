import { useEffect, useState } from "react";
import { sb, plata, fecha } from "../../lib/supabase";
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

  const liquidas = cuentas.filter((c) => c.liquida);
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
        <h3>
          Pasivos abiertos{" "}
          <span className="tenue" style={{ fontWeight: 400 }}>
            · {abiertos.length} ítem{abiertos.length === 1 ? "" : "s"} sin saldar
          </span>
        </h3>
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
    </>
  );
}
