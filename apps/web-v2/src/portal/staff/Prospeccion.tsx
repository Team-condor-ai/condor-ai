import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { useNombreUsuario } from "../auth/nombreUsuario";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { BarraLista } from "./BarraLista";
import { Barras } from "./graficos";
import {
  type Prospecto,
  CANALES_PROSPECTO,
  ESTADOS_PROSPECTO,
  METAS_SEMANALES_PROSPECCION,
  diasParaSeguimiento,
  textoEstadoProspecto,
} from "./tipos";

const LINEA = "ecommerce";

/**
 * CRM de prospección de Cóndor Ecommerce (2-sept-2026).
 *
 * POR QUÉ SE EDITA EN LA TABLA Y NO EN UN PANEL APARTE
 * ---------------------------------------------------------------------------
 * Joaquín lo pidió explícito: "como un excel". `Clientes.tsx` abre un panel
 * para cada ficha porque un cliente tiene cobros, pagos e historial — mucho
 * para una fila. Un prospecto es una fila de verdad: negocio, contacto,
 * canal, estado, nota. Cabe entera en la tabla, así que se edita ahí mismo,
 * celda por celda, igual que `CampoVivo` pero pensado para una grilla en vez
 * de un formulario.
 *
 * POR QUÉ EL ESTADO RESETEA EL RELOJ EN LA BASE, NO ACÁ
 * ---------------------------------------------------------------------------
 * `ultima_actividad_en` la actualiza un trigger de Postgres cuando cambia el
 * estado (ver prospectos.sql). Si esta pantalla tuviera que acordarse de
 * mandar la fecha en cada PATCH, un día alguien agrega un tercer lugar que
 * también edita el estado (un script, otra pantalla) y se le olvida — el
 * reloj de la alerta quedaría mintiendo sin que nadie lo note.
 */
export function Prospeccion() {
  const sesion = useSesion();
  const nombreYo = useNombreUsuario();
  const confirmar = useConfirmacion();

  const [vista, setVista] = useState<"lista" | "dashboard">("lista");
  const [filas, setFilas] = useState<Prospecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "atrasados" | "activos" | "cerrados" | "nunca">("todos");
  const [orden, setOrden] = useState("atrasados");

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const { data, error } = await sb
      .from("prospectos")
      .select("*")
      .eq("linea", LINEA)
      .order("creado_en", { ascending: false });
    if (error) setError(error.message);
    else setError("");
    setFilas((data ?? []) as Prospecto[]);
    if (!silencioso) setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, []);

  const esAtrasado = (p: Prospecto) => {
    const d = diasParaSeguimiento(p);
    return d != null && d < 0;
  };
  const esTerminal = (p: Prospecto) => p.estado === "cerrado" || p.estado === "nunca_contesto";

  const atrasados = useMemo(() => filas.filter(esAtrasado), [filas]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((p) => {
      if (filtro === "atrasados" && !esAtrasado(p)) return false;
      if (filtro === "activos" && (esTerminal(p) || p.estado === "cerrado")) return false;
      if (filtro === "cerrados" && p.estado !== "cerrado") return false;
      if (filtro === "nunca" && p.estado !== "nunca_contesto") return false;
      if (!q) return true;
      return [p.negocio, p.contacto, p.notas, p.creado_por_nombre]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q));
    });
  }, [filas, busca, filtro]);

  const ordenados = useMemo(() => {
    const r = [...visibles];
    r.sort((a, b) => {
      if (orden === "atrasados") {
        const da = diasParaSeguimiento(a) ?? 999;
        const db = diasParaSeguimiento(b) ?? 999;
        return da - db;
      }
      if (orden === "nombre") return a.negocio.localeCompare(b.negocio);
      if (orden === "recientes") return b.creado_en.localeCompare(a.creado_en);
      return 0;
    });
    return r;
  }, [visibles, orden]);

  const cuenta = useMemo(() => {
    const n = { todos: 0, atrasados: 0, activos: 0, cerrados: 0, nunca: 0 };
    for (const p of filas) {
      n.todos++;
      if (esAtrasado(p)) n.atrasados++;
      if (p.estado === "cerrado") n.cerrados++;
      else if (p.estado === "nunca_contesto") n.nunca++;
      else n.activos++;
    }
    return n;
  }, [filas]);

  async function crear() {
    const { error } = await sb.from("prospectos").insert({
      linea: LINEA,
      negocio: "Nuevo prospecto",
      canales: [],
      estado: "recien_contactado",
      creado_por_email: sesion.email,
      creado_por_nombre: nombreYo || sesion.email,
    });
    if (error) setError(error.message);
    else void cargar(true);
  }

  async function actualizar(p: Prospecto, cambios: Partial<Prospecto>) {
    // Optimista: se ve al toque, y si Supabase lo rechaza se recarga la
    // fila real en vez de dejar la pantalla mintiendo.
    setFilas((ls) => ls.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
    const { error } = await sb.from("prospectos").update(cambios).eq("id", p.id);
    if (error) { setError(error.message); void cargar(true); }
  }

  function toggleCanal(p: Prospecto, canalId: string) {
    const tiene = p.canales.includes(canalId);
    const nuevos = tiene ? p.canales.filter((c) => c !== canalId) : [...p.canales, canalId];
    void actualizar(p, { canales: nuevos });
  }

  async function eliminar(p: Prospecto) {
    const ok = await confirmar(
      `¿Eliminar "${p.negocio}" de la lista de prospección?`,
      "Esto no se puede deshacer.",
      "Eliminar",
    );
    if (!ok) return;
    const { error } = await sb.from("prospectos").delete().eq("id", p.id);
    if (error) setError(error.message);
    else void cargar(true);
  }

  return (
    <>
      <div className="barra">
        <h1>Prospección</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="chips" style={{ margin: 0 }}>
            <button className={"chip" + (vista === "lista" ? " on" : "")} onClick={() => setVista("lista")}>Lista</button>
            <button className={"chip" + (vista === "dashboard" ? " on" : "")} onClick={() => setVista("dashboard")}>Dashboard</button>
          </div>
          {vista === "lista" && (
            <button className="btn solido" onClick={() => void crear()}>
              {Ico.mas({ t: 15 })} Nuevo prospecto
            </button>
          )}
        </div>
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        {vista === "lista" ? (
          <>
            {atrasados.length > 0 && (
              <div className="aviso">
                <b>{atrasados.length}</b> prospecto{atrasados.length === 1 ? "" : "s"} necesita
                {atrasados.length === 1 ? "" : "n"} seguimiento ahora — sin movimiento desde antes de lo esperado
                para su estado actual.
              </div>
            )}

            <BarraLista
              busca={busca}
              setBusca={setBusca}
              marcador="Buscar por negocio, contacto o nota…"
              orden={orden}
              setOrden={setOrden}
              ordenes={[
                { id: "atrasados", texto: "Más atrasado primero" },
                { id: "recientes", texto: "Más reciente" },
                { id: "nombre", texto: "Nombre (A-Z)" },
              ]}
              resultado={busca ? `${ordenados.length} de ${filas.length}` : undefined}
              chips={[
                { id: "todos", texto: "Todos" },
                { id: "atrasados", texto: "Atrasados" },
                { id: "activos", texto: "En seguimiento" },
                { id: "cerrados", texto: "Cerrados" },
                { id: "nunca", texto: "Nunca contestó" },
              ].map((f) => (
                <button
                  key={f.id}
                  className={"chip" + (filtro === f.id ? " on" : "")}
                  onClick={() => setFiltro(f.id as typeof filtro)}
                >
                  {f.texto}
                  <span>{cuenta[f.id as keyof typeof cuenta] ?? 0}</span>
                </button>
              ))}
            />

            {cargando && <p className="vacio">Cargando…</p>}
            {!cargando && ordenados.length === 0 && (
              <p className="vacio">
                {filas.length === 0 ? "Todavía no hay prospectos. Crea el primero." : "Ningún prospecto calza con ese filtro."}
              </p>
            )}

            {!cargando && ordenados.length > 0 && (
              <div className="tabla-caja">
                <table>
                  <thead>
                    <tr>
                      <th>Negocio</th>
                      <th>Contacto</th>
                      <th>Canales</th>
                      <th>Estado</th>
                      <th>Seguimiento</th>
                      <th>Responsable</th>
                      <th>Notas</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map((p) => {
                      const dias = diasParaSeguimiento(p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <input
                              className="campo-vivo"
                              defaultValue={p.negocio}
                              onBlur={(e) => e.target.value.trim() && e.target.value !== p.negocio && actualizar(p, { negocio: e.target.value.trim() })}
                              style={{ minWidth: 130 }}
                            />
                          </td>
                          <td>
                            <input
                              className="campo-vivo"
                              defaultValue={p.contacto ?? ""}
                              placeholder="tel / usuario"
                              onBlur={(e) => e.target.value !== (p.contacto ?? "") && actualizar(p, { contacto: e.target.value.trim() || null })}
                              style={{ minWidth: 110 }}
                            />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              {CANALES_PROSPECTO.map((c) => {
                                const on = p.canales.includes(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    className="icono-btn"
                                    title={c.texto}
                                    aria-label={c.texto}
                                    onClick={() => toggleCanal(p, c.id)}
                                    style={{
                                      width: 26, height: 26, border: "1px solid " + (on ? c.color : "var(--borde)"),
                                      color: on ? c.color : "var(--texto-3)",
                                      background: on ? c.color + "1a" : "transparent",
                                    }}
                                  >
                                    {Ico[c.id as "instagram" | "facebook" | "maps" | "linkedin"]({ t: 14 })}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <select
                              className="campo"
                              value={p.estado}
                              onChange={(e) => actualizar(p, { estado: e.target.value })}
                              style={{ minWidth: 150 }}
                            >
                              {ESTADOS_PROSPECTO.map((e) => (
                                <option key={e.id} value={e.id}>{e.texto}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {dias == null ? (
                              <span className="conteo">—</span>
                            ) : dias < 0 ? (
                              <span className="pill mal">atrasado {Math.abs(dias)}d</span>
                            ) : (
                              <span className="pill gris">en {dias}d</span>
                            )}
                          </td>
                          <td><small>{p.creado_por_nombre || "—"}</small></td>
                          <td>
                            <input
                              className="campo-vivo"
                              defaultValue={p.notas ?? ""}
                              placeholder="—"
                              onBlur={(e) => e.target.value !== (p.notas ?? "") && actualizar(p, { notas: e.target.value.trim() || null })}
                              style={{ minWidth: 130 }}
                            />
                          </td>
                          <td className="acciones">
                            <button className="icono-btn" title="Eliminar" aria-label="Eliminar" onClick={() => void eliminar(p)}>
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
          </>
        ) : (
          <DashboardProspeccion filas={filas} cargando={cargando} />
        )}
      </div>
    </>
  );
}

/** Rango de fechas + KPIs + gráficos, para la reunión comercial de los viernes. */
function DashboardProspeccion({ filas, cargando }: { filas: Prospecto[]; cargando: boolean }) {
  const hoy = new Date();
  const lunesEstaSemana = new Date(hoy);
  lunesEstaSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [desde, setDesde] = useState(iso(lunesEstaSemana));
  const [hasta, setHasta] = useState(iso(hoy));

  function preset(dias: number) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - dias);
    setDesde(iso(d));
    setHasta(iso(hoy));
  }

  const enRango = useMemo(
    () => filas.filter((p) => {
      const f = p.creado_en.slice(0, 10);
      return f >= desde && f <= hasta;
    }),
    [filas, desde, hasta],
  );

  const cerrados = enRango.filter((p) => p.estado === "cerrado").length;
  const tasa = enRango.length ? Math.round((cerrados / enRango.length) * 100) : 0;
  const atrasadosAhora = filas.filter((p) => (diasParaSeguimiento(p) ?? 1) < 0).length;

  const porPersona = METAS_SEMANALES_PROSPECCION.map((m) => ({
    ...m,
    contactados: enRango.filter((p) => p.creado_por_email === m.email).length,
  }));

  const porCanal = CANALES_PROSPECTO.map((c) => ({
    et: c.texto,
    valor: enRango.filter((p) => p.canales.includes(c.id)).length,
  }));

  function exportarCsv() {
    const filas2 = enRango.map((p) => [
      p.creado_en.slice(0, 10), p.negocio, p.contacto ?? "", p.canales.join("|"),
      textoEstadoProspecto(p.estado), p.creado_por_nombre ?? "", (p.notas ?? "").replace(/[\n,]/g, " "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = ["fecha,negocio,contacto,canales,estado,responsable,notas", ...filas2].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `prospeccion-ecommerce-${desde}-a-${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (cargando) return <p className="vacio">Cargando…</p>;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div className="chips" style={{ margin: 0 }}>
          <button className="chip" onClick={() => preset(6)}>Esta semana</button>
          <button className="chip" onClick={() => preset(13)}>Últimas 2 semanas</button>
          <button className="chip" onClick={() => preset(29)}>Este mes</button>
        </div>
        <input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 150 }} />
        <span className="conteo">a</span>
        <input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 150 }} />
        <button className="btn chico" style={{ marginLeft: "auto" }} onClick={exportarCsv}>
          {Ico.descargar({ t: 15 })} Exportar CSV
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="tile">{Ico.clientes({ t: 18 })}</div>
          <div className="cifra"><b>{enRango.length}</b></div>
          <p>Prospectados en el período</p>
        </div>
        <div className="kpi">
          <div className="tile">{Ico.cheque({ t: 18 })}</div>
          <div className="cifra"><b>{cerrados}</b></div>
          <p>Cerrados</p>
        </div>
        <div className="kpi">
          <div className="tile">{Ico.grafo({ t: 18 })}</div>
          <div className="cifra"><b>{tasa}%</b></div>
          <p>Tasa de conversión del período</p>
        </div>
        <div className="kpi">
          <div className="tile">{Ico.repetir({ t: 18 })}</div>
          <div className="cifra"><b>{atrasadosAhora}</b></div>
          <p>Atrasados de seguimiento (ahora)</p>
        </div>
      </div>

      <h3 style={{ marginTop: 22 }}>Contactos por persona, vs. meta semanal</h3>
      <div className="tabla-caja">
        <table>
          <thead><tr><th>Persona</th><th className="num">Contactados</th><th className="num">Meta</th><th className="num">% de la meta</th></tr></thead>
          <tbody>
            {porPersona.map((m) => {
              const pct = Math.round((m.contactados / m.meta) * 100);
              return (
                <tr key={m.email}>
                  <td>{m.nombre}</td>
                  <td className="num">{m.contactados}</td>
                  <td className="num">{m.meta}</td>
                  <td className="num">
                    <span className={"pill " + (pct >= 100 ? "ok" : pct >= 60 ? "warn" : "mal")}>{pct}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 22 }}>De dónde vienen los prospectos</h3>
      <Barras datos={porCanal} formato={(n) => String(n)} />
    </>
  );
}
