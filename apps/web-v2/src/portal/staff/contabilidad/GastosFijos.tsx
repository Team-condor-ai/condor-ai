import { useMemo, useState } from "react";
import { sb, plata } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { CampoVivo } from "../CampoVivo";
import { lineasDe, type Asiento, type Cuenta, type GastoFijo } from "./tipos";

/** Un gasto fijo recién creado no tiene cuenta: hay que elegirla a propósito. */
const SIN_CUENTA = "— elegir cuenta —";

/**
 * Los gastos que se repiten todos los meses.
 *
 * LA PREGUNTA REAL DE FIN DE MES NO ES "CUÁNTO GASTÉ"
 * ---------------------------------------------------------------------------
 * Es "¿qué me falta pagar?". Por eso cada gasto fijo muestra si el de ESTE mes
 * ya quedó anotado, y si no, un botón que lo anota con un clic. Una lista que
 * solo dice cuánto se paga de arriendo no evita que un mes se olvide.
 *
 * El cruce se hace por glosa y mes: no es infalible —si alguien lo anota con
 * otro texto, no lo reconoce— pero sí es honesto: prefiere decir "falta" y que
 * alguien mire, antes que dar por pagado algo que no lo está.
 */
export function GastosFijos({
  cuentas,
  asientos,
  recargar,
}: {
  cuentas: Cuenta[];
  asientos: Asiento[];
  recargar: () => void;
}) {
  const [fijos, setFijos] = useState<GastoFijo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState("");

  const liquidas = useMemo(() => cuentas.filter((c) => c.liquida), [cuentas]);
  const gastos = useMemo(() => cuentas.filter((c) => c.tipo === "gasto"), [cuentas]);

  if (!cargado) {
    sb.from("gastos_fijos").select("*").order("nombre").then(({ data }) => {
      setFijos((data ?? []) as GastoFijo[]);
      setCargado(true);
    });
  }

  const mesHoy = new Date().toISOString().slice(0, 7);
  const yaPagado = (g: GastoFijo) =>
    asientos.some(
      (a) => a.fecha?.slice(0, 7) === mesHoy && a.glosa.toLowerCase().includes(g.nombre.toLowerCase()),
    );

  async function anotar(g: GastoFijo) {
    // El mismo fallback silencioso de antes: anotaba en la primera cuenta del
    // plan y el gasto aparecía como sueldo. Mejor negarse y decir por qué.
    const cuentaGasto = g.cuenta_id;
    const medio = liquidas[0]?.id;
    if (!cuentaGasto) { setError(`Elige la cuenta de "${g.nombre}" antes de anotarlo.`); return; }
    if (!medio) { setError("No hay ninguna cuenta líquida para pagar el gasto."); return; }
    setTrabajando(g.id);
    const { data: a, error: e1 } = await sb.from("asientos").insert({
      glosa: g.nombre, origen: "fijo",
    }).select().single();
    if (e1 || !a) { setTrabajando(""); setError(e1?.message ?? "no se pudo"); return; }
    const { error: e2 } = await sb.from("asiento_lineas")
      .insert(lineasDe(cuentaGasto, medio, g.monto).map((l) => ({ ...l, asiento_id: a.id })));
    if (e2) { await sb.from("asientos").delete().eq("id", a.id); setError(e2.message); }
    setTrabajando("");
    recargar();
  }

  async function agregar() {
    // Sin cuenta a propósito: heredar `gastos[0]` dejaba todo anotado en la
    // primera cuenta del plan —Sueldos y honorarios— sin que nadie lo eligiera.
    const { data } = await sb.from("gastos_fijos").insert({
      nombre: "Gasto nuevo", monto: 0, cuenta_id: null,
    }).select().single();
    if (data) setFijos((p) => [...p, data as GastoFijo]);
  }

  async function borrar(g: GastoFijo) {
    if (!window.confirm(`¿Quitar "${g.nombre}" de los gastos fijos?\n\nLos asientos que ya se anotaron NO se borran.`)) return;
    await sb.from("gastos_fijos").delete().eq("id", g.id);
    setFijos((p) => p.filter((x) => x.id !== g.id));
  }

  const total = fijos.filter((g) => g.activo).reduce((t, g) => t + (g.monto ?? 0), 0);
  const faltan = fijos.filter((g) => g.activo && !yaPagado(g));

  return (
    <section className="bloque">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>
          Gastos fijos{" "}
          <span className="tenue" style={{ fontWeight: 400 }}>· {plata(total)} al mes</span>
        </h3>
        <button className="btn solido" style={{ marginLeft: "auto" }} onClick={agregar}>
          {Ico.mas({ t: 14 })} Agregar
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {faltan.length > 0 && (
        <p className="conteo" style={{ marginTop: 8 }}>
          Este mes falta anotar <b>{faltan.length}</b> de {fijos.filter((g) => g.activo).length}:{" "}
          {faltan.map((g) => g.nombre).join(", ")}.
        </p>
      )}

      {fijos.length === 0 ? (
        <p className="vacio">
          Sin gastos fijos cargados. Agrega el arriendo, los sueldos y las
          herramientas: son los que hacen que el resultado del mes se parezca a
          la realidad.
        </p>
      ) : (
        <div className="tabla-caja" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr><th>Gasto</th><th className="num">Monto</th><th>Cuenta</th><th>Este mes</th><th></th></tr>
            </thead>
            <tbody>
              {fijos.map((g) => {
                const pagado = yaPagado(g);
                return (
                  <tr key={g.id}>
                    <td style={{ minWidth: 190 }}>
                      <CampoVivo
                        etiqueta="" valor={g.nombre}
                        guardar={async (v) => {
                          const { error } = await sb.from("gastos_fijos").update({ nombre: v ?? "" }).eq("id", g.id);
                          if (!error) setFijos((p) => p.map((x) => (x.id === g.id ? { ...x, nombre: v ?? "" } : x)));
                          return error?.message ?? null;
                        }}
                      />
                    </td>
                    <td className="num" style={{ minWidth: 120 }}>
                      <CampoVivo
                        etiqueta="" tipo="number" valor={String(g.monto ?? 0)}
                        guardar={async (v) => {
                          const m = Math.round(Number(v) || 0);
                          const { error } = await sb.from("gastos_fijos").update({ monto: m }).eq("id", g.id);
                          if (!error) setFijos((p) => p.map((x) => (x.id === g.id ? { ...x, monto: m } : x)));
                          return error?.message ?? null;
                        }}
                      />
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <CampoVivo
                        etiqueta=""
                        valor={cuentas.find((c) => c.id === g.cuenta_id)?.nombre ?? SIN_CUENTA}
                        opciones={[SIN_CUENTA, ...gastos.map((c) => c.nombre)]}
                        guardar={async (v) => {
                          const id = gastos.find((c) => c.nombre === v)?.id ?? null;
                          const { error } = await sb.from("gastos_fijos")
                            .update({ cuenta_id: id }).eq("id", g.id);
                          if (!error) setFijos((p) => p.map((x) => (x.id === g.id ? { ...x, cuenta_id: id } : x)));
                          return error?.message ?? null;
                        }}
                      />
                    </td>
                    <td>
                      {pagado ? (
                        <span className="pill ok">anotado</span>
                      ) : (
                        <button
                          className="btn chico"
                          disabled={trabajando === g.id}
                          onClick={() => anotar(g)}
                        >
                          {trabajando === g.id ? "…" : "Anotar"}
                        </button>
                      )}
                    </td>
                    <td className="acciones">
                      <button className="icono-btn peligro" title="Quitar" onClick={() => borrar(g)}>
                        {Ico.eliminar({ t: 15 })}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
