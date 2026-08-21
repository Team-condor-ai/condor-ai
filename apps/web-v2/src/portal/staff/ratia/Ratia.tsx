import { useEffect, useMemo, useState } from "react";
import { sb, plata, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { MenuAcciones } from "../../disenio/MenuAcciones";
import { Barras, Delta, NavAnio, corto, mesDe, mesesDelAnio } from "../graficos";
import { EditorSuscriptor } from "./EditorSuscriptor";
import { PanelSuscriptor } from "./PanelSuscriptor";
import { BarraLista } from "../BarraLista";
import { PLANES_RATIA, type IngresoRatia, type SuscriptorRatia } from "../tipos";

const FILTROS = ["activa", "pausada", "cancelada", "todos"] as const;
type Filtro = (typeof FILTROS)[number];

const nombrePlan = (id: string | null) =>
  PLANES_RATIA.find((p) => p.id === id)?.nombre ?? (id || "—");

/**
 * Suscriptores de Rat.IA. Su propia pestaña, aparte de los clientes.
 *
 * POR QUÉ NO ESTÁN EN "CLIENTES"
 * ---------------------------------------------------------------------------
 * Rat.IA es un producto propio cobrado por Flow.cl, no un servicio de agencia
 * — la decisión ya estaba tomada y escrita en `ingresos_ratia.sql`. Cientos de
 * suscripciones de $2.990 en la misma lista que la cartera B2B taparían a los
 * clientes reales, y ninguno de los campos de un cliente (setup, mensualidad,
 * reuniones, notas de proyecto) les aplica.
 *
 * DOS FUENTES, Y CADA UNA DICE OTRA COSA
 * ---------------------------------------------------------------------------
 *  · `suscriptores_ratia` — QUIÉN está suscrito. Se carga a mano.
 *  · `ingresos_ratia`     — LA PLATA que entró. La escribe el Worker de Flow.
 *
 * Los ingresos NO se calculan sumando suscriptores: eso daría lo que
 * *deberían* pagar, no lo que pagaron. Para la gráfica de ingresos manda
 * `ingresos_ratia`, que es plata real.
 */
export function Ratia() {
  const [suscriptores, setSuscriptores] = useState<SuscriptorRatia[]>([]);
  const [ingresos, setIngresos] = useState<IngresoRatia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("activa");
  const [editando, setEditando] = useState<SuscriptorRatia | "nuevo" | null>(null);
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [orden, setOrden] = useState("recientes");
  const [viendo, setViendo] = useState<SuscriptorRatia | null>(null);

  async function cargar() {
    setCargando(true);
    const [{ data: s, error: es }, { data: i }] = await Promise.all([
      sb.from("suscriptores_ratia").select("*").order("creado_en", { ascending: false }),
      sb.from("ingresos_ratia").select("*").order("creado_en", { ascending: false }),
    ]);
    if (es) setError("No se pudieron cargar los suscriptores: " + es.message);
    else setError("");
    setSuscriptores((s ?? []) as SuscriptorRatia[]);
    setIngresos((i ?? []) as IngresoRatia[]);
    setCargando(false);
  }

  useEffect(() => {
    // La carga inicial sincroniza la vista con Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  const d = useMemo(() => {
    const meses = mesesDelAnio(anio);
    // Los KPIs miran el mes real, no el año que se esté viendo.
    const h = new Date();
    const clave = (dd: Date) => `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
    const mesHoy = clave(h);
    const mesAntes = clave(new Date(h.getFullYear(), h.getMonth() - 1, 1));

    // Ingresos REALES, de lo que cobró Flow. No se estiman sumando cuotas.
    const porMes = new Map<string, number>();
    for (const g of ingresos) {
      const k = mesDe(g.creado_en);
      porMes.set(k, (porMes.get(k) ?? 0) + (g.monto_bruto ?? 0));
    }

    const altas = new Map<string, number>();
    for (const s of suscriptores) {
      const k = mesDe(s.inicio ?? s.creado_en);
      altas.set(k, (altas.get(k) ?? 0) + 1);
    }

    const activas = suscriptores.filter((s) => s.estado === "activa");
    return {
      activas: activas.length,
      // Todo Rat.IA se cobra en pesos, así que acá no hace falta convertir.
      mrr: activas.reduce((t, s) => t + (s.monto ?? 0), 0),
      ingresoHoy: porMes.get(mesHoy) ?? 0,
      ingresoAntes: porMes.get(mesAntes) ?? 0,
      altasHoy: altas.get(mesHoy) ?? 0,
      altasAntes: altas.get(mesAntes) ?? 0,
      serieIngresos: meses.map((m) => ({ et: m.et, valor: porMes.get(m.clave) ?? 0, futuro: m.futuro, esHoy: m.esHoy })),
      serieAltas: meses.map((m) => ({ et: m.et, valor: altas.get(m.clave) ?? 0, futuro: m.futuro, esHoy: m.esHoy })),
      sinIngresos: ingresos.length === 0,
    };
  }, [suscriptores, ingresos, anio]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return suscriptores.filter((s) => {
      if (filtro !== "todos" && s.estado !== filtro) return false;
      if (!q) return true;
      const campos = [s.nombre, s.email, s.telegram, s.telefono, s.notas];
      const soloDigitos = q.replace(/\D/g, "");
      return (
        campos.filter(Boolean).some((t) => String(t).toLowerCase().includes(q)) ||
        (soloDigitos.length >= 3 && (s.telefono ?? "").replace(/\D/g, "").includes(soloDigitos))
      );
    });
  }, [suscriptores, busca, filtro]);

  const ordenados = useMemo(() => {
    const r = [...visibles];
    r.sort((a, b) => {
      switch (orden) {
        case "monto": return (b.monto ?? 0) - (a.monto ?? 0);
        case "proximo": {
          // Sin fecha va al final: "no tiene próximo cobro" no es "el más
          // próximo", que es lo que pasaría ordenando cadenas vacías primero.
          const x = a.proximo_cobro, y = b.proximo_cobro;
          if (!x && !y) return 0;
          if (!x) return 1;
          if (!y) return -1;
          return x.localeCompare(y);
        }
        case "antiguos": return String(a.inicio ?? a.creado_en ?? "").localeCompare(String(b.inicio ?? b.creado_en ?? ""));
        case "nombre": return a.nombre.localeCompare(b.nombre);
        default: return String(b.creado_en ?? "").localeCompare(String(a.creado_en ?? ""));
      }
    });
    return r;
  }, [visibles, orden]);

  const cuenta = useMemo(() => {
    const n: Record<string, number> = { todos: suscriptores.length };
    for (const s of suscriptores) n[s.estado] = (n[s.estado] ?? 0) + 1;
    return n;
  }, [suscriptores]);

  async function borrar(s: SuscriptorRatia) {
    if (!window.confirm(`¿Eliminar a "${s.nombre}"?\n\nSus ingresos ya registrados NO se borran: quedan en la contabilidad.`)) return;
    const { error } = await sb.from("suscriptores_ratia").delete().eq("id", s.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <h1>Rat.IA</h1>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>
          {Ico.mas({ t: 15 })} Nuevo suscriptor
        </button>
      </div>


      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        <div className="kpis">
          <div className="kpi">
            <div className="tile">{Ico.clientes({ t: 18 })}</div>
            <div className="cifra">
              <b>{d.activas}</b>
              <Delta hoy={d.altasHoy} antes={d.altasAntes} />
            </div>
            <p>Suscripciones activas · {d.altasHoy} nueva{d.altasHoy === 1 ? "" : "s"} este mes</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            <div className="cifra"><b>{plata(d.mrr)}</b></div>
            <p>Al mes, si todas se cobran</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.cobros({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(d.ingresoHoy)}</b>
              <Delta hoy={d.ingresoHoy} antes={d.ingresoAntes} />
            </div>
            <p>Cobrado este mes · {plata(d.ingresoAntes)} el mes pasado</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.grafo({ t: 18 })}</div>
            <div className="cifra"><b>{plata(d.mrr * 12)}</b></div>
            <p>Anual estimado · lo activo × 12</p>
          </div>
        </div>

        {d.sinIngresos && suscriptores.length > 0 && (
          <p className="conteo" style={{ marginBottom: 14 }}>
            Todavía no hay ingresos registrados por Flow. Las cifras de "cobrado"
            van a quedar en cero hasta que el Worker escriba el primero — no se
            estiman sumando suscripciones, porque eso diría lo que <i>deberían</i>{" "}
            pagar, no lo que pagaron.
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <NavAnio anio={anio} setAnio={setAnio} />
        </div>

        <div
          style={{
            display: "grid", gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            marginBottom: 18,
          }}
        >
          <section className="bloque" style={{ margin: 0 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, margin: "0 0 6px" }}>
              Cobrado por mes{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>· lo que registró Flow</span>
            </h3>
            <Barras datos={d.serieIngresos} formato={corto} />
          </section>
          <section className="bloque" style={{ margin: 0 }}>
            <h3>Suscriptores nuevos por mes <span className="tenue" style={{ fontWeight: 400 }}>· {anio}</span></h3>
            <Barras datos={d.serieAltas} formato={(n) => String(n)} />
          </section>
        </div>

        <BarraLista
          busca={busca}
          setBusca={setBusca}
          marcador="Buscar por nombre, Telegram, correo, teléfono o nota…"
          orden={orden}
          setOrden={setOrden}
          ordenes={[
            { id: "recientes", texto: "Más recientes" },
            { id: "monto", texto: "Mayor monto" },
            { id: "proximo", texto: "Cobro más próximo" },
            { id: "antiguos", texto: "Más antiguos" },
            { id: "nombre", texto: "Nombre (A-Z)" },
          ]}
          resultado={busca ? `${ordenados.length} de ${suscriptores.length}` : undefined}
          chips={FILTROS.map((f) => (
            <button
              key={f}
              className={"chip" + (filtro === f ? " on" : "")}
              onClick={() => setFiltro(f)}
            >
              {f === "todos" ? "Todos" : f}
              <span>{cuenta[f] ?? 0}</span>
            </button>
          ))}
        />

        {cargando && <p className="vacio">Cargando…</p>}

        {!cargando && ordenados.length === 0 && (
          <p className="vacio">
            {suscriptores.length === 0
              ? "Todavía no hay suscriptores cargados. Agrega el primero."
              : "Ningún suscriptor calza con ese filtro."}
          </p>
        )}

        {!cargando && ordenados.length > 0 && (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Suscriptor</th>
                  <th>Plan</th>
                  <th className="num">Al mes</th>
                  <th>Estado</th>
                  <th>Próximo cobro</th>
                  <th>Nota</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.nombre}</b>
                      <br />
                      <span className="conteo">
                        {s.telegram ? "@" + s.telegram : s.email || "sin contacto"}
                      </span>
                    </td>
                    <td>{nombrePlan(s.plan)}</td>
                    <td className="num">{plata(s.monto, s.moneda)}</td>
                    <td>
                      <span
                        className={
                          "pill " +
                          (s.estado === "activa" ? "ok" : s.estado === "pausada" ? "warn" : "gris")
                        }
                      >
                        {s.estado}
                      </span>
                    </td>
                    <td>{s.proximo_cobro ? fecha(s.proximo_cobro) : "—"}</td>
                    <td className="tenue" style={{ maxWidth: 260 }}>{s.notas || "—"}</td>
                    <td className="acciones">
                      <button className="btn chico" onClick={() => setViendo(s)}>Ver</button>
                      <MenuAcciones
                        etiqueta={`Acciones de ${s.nombre}`}
                        acciones={[
                          ...(s.telegram
                            ? [{
                                texto: "Abrir Telegram",
                                icono: Ico.chat({ t: 15 }),
                                href: `https://t.me/${s.telegram}`,
                              }]
                            : []),
                          {
                            texto: "Eliminar",
                            icono: Ico.eliminar({ t: 15 }),
                            onClick: () => borrar(s),
                            peligro: true,
                            separar: true,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viendo && (
        <PanelSuscriptor
          suscriptor={viendo}
          cerrar={() => { setViendo(null); cargar(); }}
          cambiado={cargar}
        />
      )}

      {editando && (
        <EditorSuscriptor
          suscriptor={editando === "nuevo" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => { setEditando(null); cargar(); }}
        />
      )}
    </>
  );
}
