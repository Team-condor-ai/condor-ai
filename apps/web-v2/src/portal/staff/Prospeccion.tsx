import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { useNombreUsuario } from "../auth/nombreUsuario";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { BarraLista } from "./BarraLista";
import { Barras } from "./graficos";
import {
  type Prospecto,
  type CanalProspecto,
  CANALES_PROSPECTO,
  ESTADOS_PROSPECTO,
  EQUIPO_CONDOR,
  diasParaSeguimiento,
  textoEstadoProspecto,
  semanaLaboral,
  fraccionSemanaTranscurrida,
  esViernesLaboral,
  metaEfectiva,
} from "./tipos";

const LINEA = "ecommerce";

/**
 * CRM de prospección de Cóndor Ecommerce (2-sept-2026, ampliado el mismo
 * día tras el primer uso real).
 *
 * POR QUÉ SE EDITA EN LA TABLA Y NO EN UN PANEL APARTE
 * ---------------------------------------------------------------------------
 * Joaquín lo pidió explícito: "como un excel". Un prospecto es una fila de
 * verdad: negocio, contacto, canal, estado, nota. Cabe entera en la tabla,
 * así que se edita ahí mismo, celda por celda.
 *
 * POR QUÉ EL ESTADO RESETEA EL RELOJ EN LA BASE, NO ACÁ
 * ---------------------------------------------------------------------------
 * `ultima_actividad_en` la actualiza un trigger de Postgres cuando cambia el
 * estado (ver prospectos.sql). Si esta pantalla tuviera que acordarse de
 * mandar la fecha en cada PATCH, un día alguien agrega un tercer lugar que
 * también edita el estado y se le olvida — el reloj de la alerta quedaría
 * mintiendo sin que nadie lo note.
 *
 * POR QUÉ LA LISTA SE SUBCARPETEA POR PERSONA
 * ---------------------------------------------------------------------------
 * Pedido explícito, mismo día: "el modulo completo debe estar todo
 * subcarpeteado/categorizado si son de alejandro, joaquin o max". Cada
 * carpeta lleva su propia tarjeta de cumplimiento (hoy y esta semana)
 * arriba, con foto real — se reusa la misma lista `EQUIPO_CONDOR` que
 * define metas, fotos y roles, para que cambiar un dato ahí lo actualice
 * en todos lados a la vez.
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
      const handles = p.canales.map((c) => c.handle).filter(Boolean);
      return [p.negocio, p.contacto, p.notas, p.creado_por_nombre, ...handles]
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

  // Una carpeta por persona del equipo + "Otros" para lo que no calce
  // (prospectos cargados antes de tener este dato, o por alguien fuera de
  // los 3 que prospectan hoy) -- nunca se descarta una fila en silencio.
  const carpetas = useMemo(() => {
    const grupos = new Map<string, Prospecto[]>();
    for (const p of ordenados) {
      const clave = EQUIPO_CONDOR.some((m) => m.email === p.creado_por_email) ? p.creado_por_email! : "otros";
      (grupos.get(clave) ?? grupos.set(clave, []).get(clave)!).push(p);
    }
    const orden2 = [...EQUIPO_CONDOR.map((m) => m.email), "otros"];
    return orden2
      .filter((k) => grupos.has(k))
      .map((k) => ({
        persona: EQUIPO_CONDOR.find((m) => m.email === k) ?? null,
        prospectos: grupos.get(k)!,
      }));
  }, [ordenados]);

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
    const tiene = p.canales.some((c) => c.canal === canalId);
    const nuevos: CanalProspecto[] = tiene
      ? p.canales.filter((c) => c.canal !== canalId)
      : [...p.canales, { canal: canalId, handle: "" }];
    void actualizar(p, { canales: nuevos });
  }

  function actualizarHandle(p: Prospecto, canalId: string, handle: string) {
    const nuevos = p.canales.map((c) => (c.canal === canalId ? { ...c, handle } : c));
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
            <BandaViernes filas={filas} />

            <div className="kpis" style={{ marginBottom: 14 }}>
              {EQUIPO_CONDOR.map((persona) => (
                <TarjetaCumplimiento key={persona.email} persona={persona} filas={filas} />
              ))}
            </div>

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
              marcador="Buscar por negocio, contacto, @ o nota…"
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

            {!cargando && carpetas.map(({ persona, prospectos }) => (
              <details key={persona?.email ?? "otros"} className="bloque" open style={{ marginBottom: 14 }}>
                <summary style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
                  {persona ? <FotoPersona persona={persona} t={22} /> : <span className="ini" style={{ width: 22, height: 22, fontSize: 10 }}>?</span>}
                  {persona?.nombre ?? "Otros / sin asignar"}
                  <span className="conteo">{prospectos.length}</span>
                </summary>
                <div className="tabla-caja" style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Negocio</th>
                        <th>Contacto</th>
                        <th>Canales</th>
                        <th>Estado</th>
                        <th>Seguimiento</th>
                        <th>Notas</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospectos.map((p) => {
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
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {CANALES_PROSPECTO.map((c) => {
                                    const on = p.canales.some((x) => x.canal === c.id);
                                    return (
                                      <button
                                        key={c.id}
                                        className="icono-btn"
                                        title={c.texto}
                                        aria-label={c.texto}
                                        onClick={() => toggleCanal(p, c.id)}
                                        style={{
                                          width: 24, height: 24, border: "1px solid " + (on ? c.color : "var(--borde)"),
                                          color: on ? c.color : "var(--texto-3)",
                                          background: on ? c.color + "1a" : "transparent",
                                        }}
                                      >
                                        {Ico[c.id as "instagram" | "facebook" | "maps" | "linkedin"]({ t: 13 })}
                                      </button>
                                    );
                                  })}
                                </div>
                                {p.canales.map((c) => {
                                  const cfg = CANALES_PROSPECTO.find((x) => x.id === c.canal);
                                  return (
                                    <div key={c.canal} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{ color: cfg?.color, flex: "none" }}>
                                        {Ico[c.canal as "instagram" | "facebook" | "maps" | "linkedin"]({ t: 12 })}
                                      </span>
                                      <input
                                        className="campo-vivo"
                                        defaultValue={c.handle}
                                        placeholder={c.canal === "maps" ? "nombre del local" : "@usuario"}
                                        onBlur={(e) => e.target.value !== c.handle && actualizarHandle(p, c.canal, e.target.value.trim())}
                                        style={{ fontSize: 11.5, padding: "2px 6px" }}
                                      />
                                    </div>
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
              </details>
            ))}
          </>
        ) : (
          <DashboardProspeccion filas={filas} cargando={cargando} />
        )}
      </div>
    </>
  );
}

function FotoPersona({ persona, t = 28 }: { persona: { nombre: string; foto: string }; t?: number }) {
  return (
    <img
      src={persona.foto}
      alt={persona.nombre}
      width={t}
      height={t}
      style={{ width: t, height: t, borderRadius: "50%", objectFit: "cover", flex: "none" }}
    />
  );
}

/** Cuántos contactó hoy y esta semana, contra su meta -- con el ritmo
 *  esperado A ESTA HORA de la semana, no solo el total. Ver
 *  `fraccionSemanaTranscurrida` en tipos.ts: es lo que evita exigirle a
 *  alguien el 100% de la meta un miércoles a media tarde. */
function TarjetaCumplimiento({ persona, filas }: { persona: typeof EQUIPO_CONDOR[number]; filas: Prospecto[] }) {
  const ahora = new Date();
  const hoyIso = ahora.toISOString().slice(0, 10);
  const { inicio } = semanaLaboral(ahora);
  const deLaPersona = filas.filter((p) => p.creado_por_email === persona.email);
  const hoy = deLaPersona.filter((p) => p.creado_en.slice(0, 10) === hoyIso).length;
  const semana = deLaPersona.filter((p) => new Date(p.creado_en) >= inicio).length;
  const meta = metaEfectiva(persona, ahora);
  const metaDiaria = Math.round(meta / 5);
  const esperadoAhora = Math.max(1, Math.round(meta * fraccionSemanaTranscurrida(ahora)));
  const pctSemana = Math.round((semana / esperadoAhora) * 100);

  return (
    <div className="kpi">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <FotoPersona persona={persona} />
        <div>
          <b style={{ fontSize: 13 }}>{persona.nombre}</b>
          <small style={{ display: "block", color: "var(--texto-3)" }}>{persona.rol}</small>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <div>
          <div className="cifra"><b>{hoy}</b>/{metaDiaria}</div>
          <p>Hoy</p>
        </div>
        <div>
          <div className="cifra"><b>{semana}</b>/{meta}</div>
          <p>Esta semana</p>
        </div>
      </div>
      <span className={"pill " + (pctSemana >= 100 ? "ok" : pctSemana >= 70 ? "warn" : "mal")} style={{ marginTop: 6, display: "inline-block" }}>
        {pctSemana}% del ritmo esperado a esta hora ({esperadoAhora})
      </span>
    </div>
  );
}

/** Cuenta regresiva de presión, solo visible los viernes hasta las 19:00 --
 *  pedido explícito de Joaquín: "que se active todos los viernes... donde
 *  se ponga presion en el portal para completar la prospeccion". */
function BandaViernes({ filas }: { filas: Prospecto[] }) {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (!esViernesLaboral(ahora)) return null;

  const { inicio, fin } = semanaLaboral(ahora);
  const msRestante = fin.getTime() - ahora.getTime();
  const horas = Math.floor(msRestante / 3600000);
  const minutos = Math.floor((msRestante % 3600000) / 60000);

  const faltantes = EQUIPO_CONDOR.map((persona) => {
    const semana = filas.filter((p) => p.creado_por_email === persona.email && new Date(p.creado_en) >= inicio).length;
    return { nombre: persona.nombre, falta: Math.max(0, metaEfectiva(persona, ahora) - semana) };
  }).filter((f) => f.falta > 0);

  return (
    <div className="aviso" style={{ borderColor: "var(--mal-bd)", background: "var(--mal-bg)", color: "var(--mal-tx)", marginBottom: 14 }}>
      <b>Quedan {horas}h {minutos}min para cerrar la semana de prospección</b> (hoy viernes, corte 20:00).
      {faltantes.length > 0 ? (
        <> Todavía falta: {faltantes.map((f) => `${f.nombre} (${f.falta})`).join(" · ")}.</>
      ) : (
        <> Los tres ya cumplieron su meta semanal.</>
      )}
    </div>
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

  const porPersona = EQUIPO_CONDOR.map((m) => ({
    email: m.email,
    nombre: m.nombre,
    meta: metaEfectiva(m),
    contactados: enRango.filter((p) => p.creado_por_email === m.email).length,
  }));

  const porCanal = CANALES_PROSPECTO.map((c) => ({
    et: c.texto,
    valor: enRango.filter((p) => p.canales.some((x) => x.canal === c.id)).length,
  }));

  function exportarCsv() {
    const filas2 = enRango.map((p) => [
      p.creado_en.slice(0, 10), p.negocio, p.contacto ?? "",
      p.canales.map((c) => `${c.canal}:${c.handle}`).join("|"),
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

/**
 * Versión compacta para el Panel general (2-sept-2026, pedido de Joaquín:
 * "el dashboard general debe estar conectado a panel"). Se fetchea sus
 * propios datos porque el Panel no cargaba `prospectos` para nada más —
 * pedirle a `Dashboard.tsx` que lo hiciera solo para esta tarjeta habría
 * acoplado dos pantallas que hoy no se necesitan la una a la otra.
 */
export function ResumenProspeccion() {
  const [filas, setFilas] = useState<Prospecto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("prospectos").select("*").eq("linea", LINEA);
      setFilas((data ?? []) as Prospecto[]);
      setCargando(false);
    })();
  }, []);

  if (cargando) return null;

  return (
    <section className="bloque">
      <div className="cabecera-bloque">
        <div>
          <h3>Prospección — Cóndor Ecommerce</h3>
          <p>Cumplimiento de la semana, equipo comercial</p>
        </div>
        <Link className="btn chico" to="/acceso/prospeccion">Ver módulo completo</Link>
      </div>
      <div className="kpis" style={{ marginTop: 10 }}>
        {EQUIPO_CONDOR.map((persona) => (
          <TarjetaCumplimiento key={persona.email} persona={persona} filas={filas} />
        ))}
      </div>
    </section>
  );
}
