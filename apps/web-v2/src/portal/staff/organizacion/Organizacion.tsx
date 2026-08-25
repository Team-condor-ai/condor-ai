import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sb, fecha, plata } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import { EditorReunion } from "../EditorReunion";
import { NotasInternas } from "./NotasInternas";
import type {
  Cliente,
  Cobro,
  Pago,
  Reunion,
  SuscriptorRatia,
} from "../tipos";

type EstadoTarea = "por_hacer" | "en_curso" | "bloqueada" | "hecha";
type Prioridad = "baja" | "media" | "alta" | "urgente";
type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  asignados: string[];
  cliente_id: string | null;
  inicio: string | null;
  inicio_hora: string | null;
  vence: string | null;
  vence_hora: string | null;
  etiquetas: string[];
  orden: number;
  hecha_en: string | null;
  creado_en: string;
};
type Meta = {
  id: string;
  titulo: string;
  detalle: string | null;
  metrica:
    | "manual"
    | "recurrente"
    | "clientes"
    | "cobrado_mes"
    | "suscriptores_ratia";
  objetivo: number;
  avance: number;
  hasta: string | null;
  estado: "activa" | "lograda" | "archivada";
};

const COLUMNAS: { id: EstadoTarea; titulo: string; ayuda: string }[] = [
  { id: "por_hacer", titulo: "Por hacer", ayuda: "Lista y sin empezar" },
  { id: "en_curso", titulo: "En curso", ayuda: "Trabajo activo" },
  { id: "bloqueada", titulo: "Bloqueadas", ayuda: "Necesitan destrabe" },
  { id: "hecha", titulo: "Terminadas", ayuda: "Cerradas" },
];

function PrioridadTarea({ nivel, compacta = false }: { nivel: Prioridad; compacta?: boolean }) {
  return (
    <span className={`prioridad ${nivel}${compacta ? " compacta" : ""}`}>
      <i aria-hidden="true" />
      <span>{nivel}</span>
    </span>
  );
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diferenciaDias(desde: string, hasta: string) {
  const a = new Date(`${desde}T12:00:00`).getTime();
  const b = new Date(`${hasta}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function Organizacion() {
  const { vista = "tablero" } = useParams();
  const navega = useNavigate();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ratia, setRatia] = useState<SuscriptorRatia[]>([]);
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<
    Tarea | "nueva" | "nueva_agendada" | null
  >(null);
  const [editandoMeta, setEditandoMeta] = useState<Meta | "nueva" | null>(null);
  const [editandoReunion, setEditandoReunion] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "mias" | "vencidas">("todas");

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const [ta, me, cl, co, pa, ra, re] = await Promise.all([
      sb.from("tareas").select("*").order("orden"),
      sb.from("metas").select("*").order("creado_en", { ascending: false }),
      sb.from("clientes").select("*"),
      sb.from("cobros").select("*"),
      sb.from("pagos").select("*"),
      sb.from("suscriptores_ratia").select("*"),
      sb.from("reuniones").select("*").order("fecha_hora"),
    ]);
    if (ta.error)
      setError(
        "Falta aplicar la migración de Organización: " + ta.error.message,
      );
    else setError("");
    setTareas((ta.data ?? []) as Tarea[]);
    setMetas((me.data ?? []) as Meta[]);
    setClientes((cl.data ?? []) as Cliente[]);
    setCobros((co.data ?? []) as Cobro[]);
    setPagos((pa.data ?? []) as Pago[]);
    setRatia((ra.data ?? []) as SuscriptorRatia[]);
    setReuniones((re.data ?? []) as Reunion[]);
    if (!silencioso) setCargando(false);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const cliente = useMemo(
    () => new Map(clientes.map((c) => [c.id, c])),
    [clientes],
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const visibles = tareas.filter(
    (t) =>
      filtro === "todas" ||
      (filtro === "vencidas"
        ? !!t.vence && t.vence < hoy && t.estado !== "hecha"
        : (t.asignados?.length ?? 0) > 0),
  );

  async function mover(id: string, estado: EstadoTarea) {
    setTareas((p) => p.map((t) => (t.id === id ? { ...t, estado } : t)));
    const { error } = await sb.from("tareas").update({ estado }).eq("id", id);
    if (error) {
      setError(error.message);
      cargar();
    }
  }

  const metricas = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    return {
      recurrente: cobros
        .filter((c) => c.tipo === "mensual" && c.estado === "activa")
        .reduce((t, c) => t + c.monto, 0),
      clientes: clientes.filter((c) => !c.archivado).length,
      cobrado_mes: pagos
        .filter(
          (p) =>
            p.estado === "pagado" &&
            (p.fecha ?? p.creado_en ?? "").startsWith(mes),
        )
        .reduce((t, p) => t + (p.monto ?? 0), 0),
      suscriptores_ratia: ratia.filter((x) => x.estado === "activa").length,
    };
  }, [cobros, clientes, pagos, ratia]);

  return (
    <>
      <div className="barra">
        <div>
          <h1>Organización</h1>
          <small className="subtitulo-barra">
            Trabajo, tiempo y objetivos del equipo
          </small>
        </div>
        {vista === "metas" ? (
          <button
            className="btn solido"
            onClick={() => setEditandoMeta("nueva")}
          >
            {Ico.mas({ t: 15 })} Nueva meta
          </button>
        ) : vista === "calendario" ? (
          <div className="botonera">
            <a
              className="btn"
              href="https://meet.new"
              target="_blank"
              rel="noreferrer"
              title="Abrir una sala de Google Meet al instante"
            >
              {Ico.video({ t: 15 })} Reunión instantánea
            </a>
            <button className="btn" onClick={() => setEditando("nueva_agendada")}>
              {Ico.mas({ t: 15 })} Nueva tarea
            </button>
            <button
              className="btn solido"
              onClick={() => setEditandoReunion(true)}
            >
              {Ico.reuniones({ t: 15 })} Agendar reunión
            </button>
          </div>
        ) : vista === "notas" || vista === "informacion" ? null : (
          <button className="btn solido" onClick={() => setEditando("nueva")}>
            {Ico.mas({ t: 15 })} Nueva tarea
          </button>
        )}
      </div>
      <div className="cuerpo organizacion">
        {error && <p className="error">{error}</p>}
        <div className="subnav-organizacion">
          <button
            className={vista === "tablero" ? "on" : ""}
            onClick={() => navega("/acceso/organizacion/tablero")}
          >
            {Ico.tablero({ t: 15 })} Tablero
          </button>
          <button
            className={vista === "calendario" ? "on" : ""}
            onClick={() => navega("/acceso/organizacion/calendario")}
          >
            {Ico.reuniones({ t: 15 })} Calendario
          </button>
          <button
            className={vista === "metas" ? "on" : ""}
            onClick={() => navega("/acceso/organizacion/metas")}
          >
            {Ico.meta({ t: 15 })} Metas
          </button>
          <button
            className={vista === "notas" || vista === "informacion" ? "on" : ""}
            onClick={() => navega("/acceso/organizacion/informacion")}
          >
            {Ico.documentos({ t: 15 })} Información interna
          </button>
        </div>
        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : vista === "tablero" ? (
          <>
            <div className="chips">
              <button
                className={"chip" + (filtro === "todas" ? " on" : "")}
                onClick={() => setFiltro("todas")}
              >
                Todas
              </button>
              <button
                className={"chip" + (filtro === "mias" ? " on" : "")}
                onClick={() => setFiltro("mias")}
              >
                Asignadas
              </button>
              <button
                className={"chip" + (filtro === "vencidas" ? " on" : "")}
                onClick={() => setFiltro("vencidas")}
              >
                Vencidas
              </button>
            </div>
            <div className="kanban">
              {COLUMNAS.map((col) => (
                <section
                  className="kanban-col"
                  key={col.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/tarea");
                    if (id) mover(id, col.id);
                  }}
                >
                  <header>
                    <div>
                      <b>{col.titulo}</b>
                      <small>{col.ayuda}</small>
                    </div>
                    <span>
                      {visibles.filter((t) => t.estado === col.id).length}
                    </span>
                  </header>
                  <div className="kanban-lista">
                    {visibles
                      .filter((t) => t.estado === col.id)
                      .map((t) => (
                        <article
                          className="tarea"
                          key={t.id}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/tarea", t.id)
                          }
                          onClick={() => setEditando(t)}
                        >
                          <div className="tarea-arriba">
                            <PrioridadTarea nivel={t.prioridad} />
                            {t.vence && (
                              <time
                                className={
                                  t.vence < hoy && t.estado !== "hecha"
                                    ? "vencida"
                                    : ""
                                }
                              >
                                {fecha(t.vence)}
                              </time>
                            )}
                            {!t.inicio && !t.vence && (
                              <span className="tarea-sin-agenda">Sin agendar</span>
                            )}
                          </div>
                          <h3>{t.titulo}</h3>
                          {t.descripcion && <p>{t.descripcion}</p>}
                          <div className="tarea-pie">
                            <span>
                              {t.cliente_id
                                ? cliente.get(t.cliente_id)?.negocio ||
                                  "Cliente"
                                : "Cóndor"}
                            </span>
                            {t.asignados?.slice(0, 2).map((nombre) => (
                              <span className="persona-mini" key={nombre} title={nombre}>
                                {nombre.slice(0, 2).toUpperCase()}
                              </span>
                            ))}
                            {(t.asignados?.length ?? 0) > 2 && (
                              <span className="persona-mini" title={t.asignados.slice(2).join(", ")}>
                                +{t.asignados.length - 2}
                              </span>
                            )}
                          </div>
                          {t.etiquetas?.length > 0 && (
                            <div className="etiquetas">
                              {t.etiquetas.map((x) => (
                                <em key={x}>{x}</em>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                  <button
                    className="agregar-tarea"
                    onClick={() => setEditando("nueva")}
                  >
                    + Agregar tarea
                  </button>
                </section>
              ))}
            </div>
          </>
        ) : vista === "calendario" ? (
          <Calendario
            // Las tareas sin fecha pertenecen al Tablero. No se les inventa
            // un día para poder dibujarlas acá.
            tareas={tareas.filter((t) => t.inicio || t.vence)}
            reuniones={reuniones}
            cliente={cliente}
            abrir={setEditando}
            actualizarTarea={(id, cambios) =>
              setTareas((lista) =>
                lista.map((t) => (t.id === id ? { ...t, ...cambios } : t)),
              )
            }
            actualizarReunion={(id, cambios) =>
              setReuniones((lista) =>
                lista.map((r) => (r.id === id ? { ...r, ...cambios } : r)),
              )
            }
            quitarReunion={(id) =>
              setReuniones((lista) => lista.filter((r) => r.id !== id))
            }
            restaurarReunion={(reunion) =>
              setReuniones((lista) =>
                [...lista, reunion].sort(
                  (a, b) => +new Date(a.fecha_hora) - +new Date(b.fecha_hora),
                ),
              )
            }
            error={setError}
          />
        ) : vista === "notas" || vista === "informacion" ? (
          <NotasInternas />
        ) : (
          <Metas metas={metas} metricas={metricas} editar={setEditandoMeta} />
        )}
      </div>
      {editando && (
        <EditorTarea
          tarea={typeof editando === "string" ? null : editando}
          agendarInicial={editando === "nueva_agendada"}
          clientes={clientes}
          cerrar={() => setEditando(null)}
          guardado={() => {
            setEditando(null);
            void cargar(true);
          }}
        />
      )}
      {editandoMeta && (
        <EditorMeta
          meta={editandoMeta === "nueva" ? null : editandoMeta}
          cerrar={() => setEditandoMeta(null)}
          guardado={() => {
            setEditandoMeta(null);
            void cargar(true);
          }}
        />
      )}
      {editandoReunion && (
        <EditorReunion
          cerrar={() => setEditandoReunion(false)}
          guardado={() => {
            setEditandoReunion(false);
            void cargar(true);
          }}
        />
      )}
    </>
  );
}

function Calendario({
  tareas,
  reuniones,
  cliente,
  abrir,
  actualizarTarea,
  actualizarReunion,
  quitarReunion,
  restaurarReunion,
  error,
}: {
  tareas: Tarea[];
  reuniones: Reunion[];
  cliente: Map<string, Cliente>;
  abrir: (t: Tarea) => void;
  actualizarTarea: (id: string, cambios: Partial<Tarea>) => void;
  actualizarReunion: (id: string, cambios: Partial<Reunion>) => void;
  quitarReunion: (id: string) => void;
  restaurarReunion: (reunion: Reunion) => void;
  error: (mensaje: string) => void;
}) {
  const confirmar = useConfirmacion();
  const [mes, setMes] = useState(() => new Date());
  const [ahora] = useState(() => Date.now());
  const [ajustando, setAjustando] = useState<{
    id: string;
    tipo: "tarea" | "reunion";
    valor: number;
    inicio?: string;
    fin?: string;
  } | null>(null);
  const anio = mes.getFullYear(),
    m = mes.getMonth();
  const inicio = new Date(anio, m, 1);
  const dias = new Date(anio, m + 1, 0).getDate();
  const huecosIniciales = inicio.getDay();
  // Seis semanas siempre: el mes no queda visualmente truncado cuando su
  // último día cae antes del sábado.
  const celdas = [
    ...Array(huecosIniciales).fill(null),
    ...Array.from({ length: dias }, (_, i) => i + 1),
    ...Array(42 - huecosIniciales - dias).fill(null),
  ];
  const clave = (d: number) =>
    `${anio}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fechaLocal = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const hoy = fechaLocal(new Date().toISOString());

  const inicioVisibleTarea = (t: Tarea) => {
    if (ajustando?.tipo === "tarea" && ajustando.id === t.id && ajustando.inicio)
      return ajustando.inicio;
    return t.inicio ?? t.vence;
  };
  const finVisibleTarea = (t: Tarea) => {
    const inicioT = t.inicio ?? t.vence;
    if (!inicioT) return null;
    if (ajustando?.tipo === "tarea" && ajustando.id === t.id && ajustando.fin)
      return ajustando.fin;
    return t.vence ?? inicioT;
  };

  async function guardarTarea(t: Tarea, inicioNuevo: string, finNuevo: string) {
    const anterior = { inicio: t.inicio, vence: t.vence };
    actualizarTarea(t.id, { inicio: inicioNuevo, vence: finNuevo });
    const { error: fallo } = await sb
      .from("tareas")
      .update({ inicio: inicioNuevo, vence: finNuevo })
      .eq("id", t.id);
    if (fallo) {
      actualizarTarea(t.id, anterior);
      error(fallo.message);
    }
  }

  async function guardarReunion(r: Reunion, cambios: Partial<Reunion>) {
    const anterior = { ...r };
    actualizarReunion(r.id, cambios);
    const { error: fallo } = await sb
      .from("reuniones")
      .update(cambios)
      .eq("id", r.id);
    if (fallo) {
      actualizarReunion(r.id, anterior);
      error(fallo.message);
    }
  }

  async function soltar(e: React.DragEvent, destino: string) {
    e.preventDefault();
    try {
      const crudo =
        e.dataTransfer.getData("application/condor-cal") ||
        e.dataTransfer.getData("text/plain");
      const dato = JSON.parse(crudo) as {
        tipo: "tarea" | "reunion";
        id: string;
        desde: string;
      };
      const delta = diferenciaDias(dato.desde, destino);
      if (dato.tipo === "tarea") {
        const t = tareas.find((x) => x.id === dato.id);
        if (!t) return;
        const inicioT = t.inicio ?? t.vence ?? dato.desde;
        const finT = t.vence ?? inicioT;
        await guardarTarea(t, sumarDias(inicioT, delta), sumarDias(finT, delta));
      } else {
        const r = reuniones.find((x) => x.id === dato.id);
        if (!r) return;
        const d = new Date(r.fecha_hora);
        const [y, mo, dia] = destino.split("-").map(Number);
        d.setFullYear(y, mo - 1, dia);
        await guardarReunion(r, { fecha_hora: d.toISOString() });
      }
    } catch {
      // Arrastres de fuera del calendario no hacen nada.
    }
  }

  function redimensionarTarea(t: Tarea, delta: number) {
    const inicioT = t.inicio ?? t.vence;
    if (!inicioT) return;
    const finT = t.vence ?? inicioT;
    const diasActuales = diferenciaDias(inicioT, finT) + 1;
    const diasNuevos = Math.max(1, diasActuales + delta);
    void guardarTarea(t, inicioT, sumarDias(inicioT, diasNuevos - 1));
  }

  function redimensionarReunion(r: Reunion, delta: number) {
    const minutos = Math.min(12 * 60, Math.max(15, (r.duracion_min ?? 60) + delta * 15));
    void guardarReunion(r, { duracion_min: minutos });
  }

  function iniciarResizeTarea(
    e: React.PointerEvent<HTMLSpanElement>,
    tarea: Tarea,
    borde: "inicio" | "fin",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const baseInicio = tarea.inicio ?? tarea.vence;
    if (!baseInicio) return;
    const baseFin = tarea.vence ?? baseInicio;
    const semana = e.currentTarget.closest<HTMLElement>(".cal-semana");
    const anchoDia = Math.max(1, (semana?.getBoundingClientRect().width ?? 700) / 7);
    const origen = e.clientX;
    let pasos = 0;
    let nuevoInicio = baseInicio;
    let nuevoFin = baseFin;
    document.body.classList.add("cal-redimensionando");
    setAjustando({
      id: tarea.id,
      tipo: "tarea",
      valor: diferenciaDias(baseInicio, baseFin) + 1,
      inicio: baseInicio,
      fin: baseFin,
    });
    const mover = (ev: PointerEvent) => {
      pasos = Math.round((ev.clientX - origen) / anchoDia);
      if (borde === "inicio") {
        const candidato = sumarDias(baseInicio, pasos);
        nuevoInicio = candidato > baseFin ? baseFin : candidato;
        nuevoFin = baseFin;
      } else {
        const candidato = sumarDias(baseFin, pasos);
        nuevoInicio = baseInicio;
        nuevoFin = candidato < baseInicio ? baseInicio : candidato;
      }
      setAjustando({
        id: tarea.id,
        tipo: "tarea",
        valor: diferenciaDias(nuevoInicio, nuevoFin) + 1,
        inicio: nuevoInicio,
        fin: nuevoFin,
      });
    };
    const terminar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
      document.body.classList.remove("cal-redimensionando");
      setAjustando(null);
      if (!pasos) return;
      void guardarTarea(tarea, nuevoInicio, nuevoFin);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar, { once: true });
    window.addEventListener("pointercancel", terminar, { once: true });
  }

  function iniciarResizeReunion(
    e: React.PointerEvent<HTMLSpanElement>,
    reunion: Reunion,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const origen = e.clientY;
    const base = reunion.duracion_min ?? 60;
    let pasos = 0;
    setAjustando({ id: reunion.id, tipo: "reunion", valor: base });
    const mover = (ev: PointerEvent) => {
      pasos = Math.round((ev.clientY - origen) / 12);
      setAjustando({
        id: reunion.id,
        tipo: "reunion",
        valor: Math.min(12 * 60, Math.max(15, base + pasos * 15)),
      });
    };
    const terminar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
      setAjustando(null);
      if (pasos) redimensionarReunion(reunion, pasos);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar, { once: true });
    window.addEventListener("pointercancel", terminar, { once: true });
  }

  function segmentosDeSemana(diasSemana: Array<number | null>) {
    const fechas = diasSemana
      .filter((d): d is number => d !== null)
      .map(clave);
    if (!fechas.length) return { segmentos: [], carriles: 0 };
    const desdeSemana = fechas[0];
    const hastaSemana = fechas.at(-1)!;
    const crudos = tareas
      .map((tarea) => {
        const inicioT = inicioVisibleTarea(tarea);
        const finT = finVisibleTarea(tarea);
        if (!inicioT || !finT || finT < desdeSemana || inicioT > hastaSemana)
          return null;
        const inicioSegmento = inicioT < desdeSemana ? desdeSemana : inicioT;
        const finSegmento = finT > hastaSemana ? hastaSemana : finT;
        const columnaInicio = diasSemana.findIndex(
          (d) => d !== null && clave(d) === inicioSegmento,
        );
        const columnaFin = diasSemana.findIndex(
          (d) => d !== null && clave(d) === finSegmento,
        );
        if (columnaInicio < 0 || columnaFin < 0) return null;
        return {
          tarea,
          inicioT,
          finT,
          columnaInicio,
          columnaFin,
          continuaAntes: inicioT < inicioSegmento,
          continuaDespues: finT > finSegmento,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort(
        (a, b) =>
          a.columnaInicio - b.columnaInicio || b.columnaFin - a.columnaFin,
      );

    const finPorCarril: number[] = [];
    const segmentos = crudos.map((segmento) => {
      let carril = finPorCarril.findIndex(
        (finAnterior) => segmento.columnaInicio > finAnterior,
      );
      if (carril < 0) carril = finPorCarril.length;
      finPorCarril[carril] = segmento.columnaFin;
      return { ...segmento, carril };
    });
    return { segmentos, carriles: finPorCarril.length };
  }

  const proximas = reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() >= ahora)
    .sort((a, b) => +new Date(a.fecha_hora) - +new Date(b.fecha_hora));
  const pasadas = reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() < ahora)
    .sort((a, b) => +new Date(b.fecha_hora) - +new Date(a.fecha_hora));

  async function eliminar(r: Reunion) {
    if (!await confirmar(`¿Eliminar la reunión "${r.titulo}"?`, undefined, "Eliminar")) return;
    quitarReunion(r.id);
    const { error: fallo } = await sb
      .from("reuniones")
      .delete()
      .eq("id", r.id);
    if (fallo) {
      restaurarReunion(r);
      error(fallo.message);
    }
  }

  return (
    <>
      <section className="calendario">
        <header>
          <button
            className="icono-btn"
            onClick={() => setMes(new Date(anio, m - 1, 1))}
            aria-label="Mes anterior"
          >
            {Ico.volver({ t: 15 })}
          </button>
          <h2>
            {mes.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
          </h2>
          <button
            className="icono-btn invierte"
            onClick={() => setMes(new Date(anio, m + 1, 1))}
            aria-label="Mes siguiente"
          >
            {Ico.volver({ t: 15 })}
          </button>
          <button className="btn chico cal-hoy-btn" onClick={() => setMes(new Date())}>
            Hoy
          </button>
        </header>
        <div className="cal-leyenda">
          <span><i className="tarea" /> Tareas</span>
          <span><i className="reunion" /> Reuniones</span>
        </div>
        <p className="cal-ayuda">
          Arrastra una tarea para moverla; toma sus costados para cambiar inicio
          o término. En reuniones, estira el borde inferior para ajustar minutos.
        </p>
        <div className="cal-grid">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((x) => (
            <b className="cal-dia" key={x}>{x}</b>
          ))}
          {Array.from({ length: 6 }, (_, semanaIndex) => {
            const diasSemana = celdas.slice(semanaIndex * 7, semanaIndex * 7 + 7);
            const { segmentos, carriles } = segmentosDeSemana(diasSemana);
            return (
              <div
                className="cal-semana"
                key={semanaIndex}
                style={{ "--alto-tareas": `${carriles * 46}px` } as React.CSSProperties}
              >
                <div className="cal-semana-celdas">
                  {diasSemana.map((d, i) => (
                    <div
                      className={
                        "cal-celda" +
                        (!d
                          ? " vacia"
                          : clave(d) === hoy
                            ? " hoy"
                            : clave(d) < hoy
                              ? " pasada"
                              : " futura")
                      }
                      key={i}
                      onDragOver={(e) => d && e.preventDefault()}
                      onDrop={(e) => d && soltar(e, clave(d))}
                    >
                      {d && (
                        <>
                          <span aria-current={clave(d) === hoy ? "date" : undefined}>
                            {d}
                          </span>
                          {reuniones
                            .filter((r) => fechaLocal(r.fecha_hora) === clave(d))
                            .map((r) => (
                              <a
                                key={r.id}
                                className={`evento reunion${new Date(r.fecha_hora).getTime() < ahora ? " evento-pasado" : ""}`}
                                href={r.meet_url || undefined}
                                target={r.meet_url ? "_blank" : undefined}
                                rel={r.meet_url ? "noreferrer" : undefined}
                                title={
                                  r.meet_url
                                    ? "Entrar a la videollamada"
                                    : r.descripcion || undefined
                                }
                                style={
                                  {
                                    "--duracion-evento": `${Math.min(100, ((ajustando?.id === r.id ? ajustando.valor : r.duracion_min ?? 60) / 180) * 100)}%`,
                                    minHeight: `${Math.min(88, 36 + ((ajustando?.id === r.id ? ajustando.valor : r.duracion_min ?? 60) / 15) * 2)}px`,
                                  } as React.CSSProperties
                                }
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = "move";
                                  const dato = JSON.stringify({
                                    tipo: "reunion",
                                    id: r.id,
                                    desde: clave(d),
                                  });
                                  e.dataTransfer.setData("application/condor-cal", dato);
                                  e.dataTransfer.setData("text/plain", dato);
                                }}
                                onKeyDown={(e) => {
                                  if (!e.shiftKey) return;
                                  if (e.key === "ArrowRight") {
                                    e.preventDefault();
                                    redimensionarReunion(r, 1);
                                  }
                                  if (e.key === "ArrowLeft") {
                                    e.preventDefault();
                                    redimensionarReunion(r, -1);
                                  }
                                }}
                              >
                                <b>{hora(r.fecha_hora)} · {r.titulo}</b>
                                <small>
                                  {r.cliente || "Cóndor"} · {ajustando?.id === r.id
                                    ? ajustando.valor
                                    : r.duracion_min ?? 60} min
                                </small>
                                <span
                                  className="evento-resize vertical"
                                  aria-hidden="true"
                                  title="Arrastra hacia arriba o abajo para cambiar la duración"
                                  onPointerDown={(e) => iniciarResizeReunion(e, r)}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                />
                              </a>
                            ))}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="cal-tareas-capa" aria-label="Tareas de la semana">
                  {segmentos.map((segmento) => {
                    const { tarea: t } = segmento;
                    const terminoEnPasado = segmento.finT < hoy;
                    const vencida = terminoEnPasado && t.estado !== "hecha";
                    return (
                      <button
                        key={`${t.id}-${semanaIndex}`}
                        className={`evento tarea calendario-span ${t.prioridad}${segmento.continuaAntes ? " continua-antes" : ""}${segmento.continuaDespues ? " continua-despues" : ""}${ajustando?.id === t.id ? " ajustando" : ""}${vencida ? " tarea-vencida" : terminoEnPasado ? " tarea-pasada" : ""}`}
                        style={{
                          left: `calc(${(segmento.columnaInicio / 7) * 100}% + 3px)`,
                          width: `calc(${((segmento.columnaFin - segmento.columnaInicio + 1) / 7) * 100}% - 6px)`,
                          top: `${segmento.carril * 46}px`,
                        }}
                        onClick={() => abrir(t)}
                        draggable={ajustando?.id !== t.id}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          const dato = JSON.stringify({
                            tipo: "tarea",
                            id: t.id,
                            desde: segmento.inicioT,
                          });
                          e.dataTransfer.setData("application/condor-cal", dato);
                          e.dataTransfer.setData("text/plain", dato);
                        }}
                        onKeyDown={(e) => {
                          if (!e.shiftKey) return;
                          if (e.key === "ArrowRight") {
                            e.preventDefault();
                            redimensionarTarea(t, 1);
                          }
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            redimensionarTarea(t, -1);
                          }
                        }}
                      >
                        {!segmento.continuaAntes && (
                          <span
                            className="evento-resize lateral izq"
                            aria-hidden="true"
                            title="Mover el inicio"
                            onPointerDown={(e) => iniciarResizeTarea(e, t, "inicio")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <span className="evento-tarea-contenido">
                          <b title={t.titulo}>{t.titulo}</b>
                          <span className="evento-tarea-meta">
                            <PrioridadTarea nivel={t.prioridad} compacta />
                            <small>
                              {t.inicio_hora ? `${t.inicio_hora.slice(0, 5)} · ` : ""}
                              {t.cliente_id
                                ? cliente.get(t.cliente_id)?.negocio
                                : t.asignados?.join(", ") || "Cóndor"}
                            </small>
                          </span>
                        </span>
                        {!segmento.continuaDespues && (
                          <span
                            className="evento-resize lateral der"
                            aria-hidden="true"
                            title="Mover el término"
                            onPointerDown={(e) => iniciarResizeTarea(e, t, "fin")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {proximas.length === 0 && (
        <p className="vacio">No hay reuniones próximas agendadas.</p>
      )}
      <AgendaReuniones
        datos={proximas}
        titulo="Próximas reuniones"
        eliminar={eliminar}
      />
      <AgendaReuniones
        datos={pasadas}
        titulo="Reuniones anteriores"
        eliminar={eliminar}
      />
    </>
  );
}

function AgendaReuniones({
  datos,
  titulo,
  eliminar,
}: {
  datos: Reunion[];
  titulo: string;
  eliminar: (r: Reunion) => void;
}) {
  if (!datos.length) return null;
  return (
    <section className="bloque agenda-reuniones">
      <h3>{titulo}</h3>
      <div className="tabla-caja">
        <table>
          <thead>
            <tr>
              <th>Reunión</th>
              <th>Cuándo</th>
              <th>Duración</th>
              <th>Cliente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {datos.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.titulo}</b>
                  {r.descripcion && <small>{r.descripcion}</small>}
                </td>
                <td>
                  {new Date(r.fecha_hora).toLocaleString("es-CL", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>{r.duracion_min ?? 60} min</td>
                <td>{r.cliente || "—"}</td>
                <td className="acciones">
                  {r.meet_url && (
                    <a
                      className="icono-btn"
                      title="Entrar a la videollamada"
                      href={r.meet_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {Ico.video({ t: 15 })}
                    </a>
                  )}
                  <button
                    className="icono-btn peligro"
                    title="Eliminar reunión"
                    onClick={() => eliminar(r)}
                  >
                    {Ico.eliminar({ t: 15 })}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metas({
  metas,
  metricas,
  editar,
}: {
  metas: Meta[];
  metricas: Record<string, number>;
  editar: (m: Meta) => void;
}) {
  return (
    <div className="metas-grid">
      {metas
        .filter((m) => m.estado !== "archivada")
        .map((m) => {
          const actual =
            m.metrica === "manual" ? m.avance : (metricas[m.metrica] ?? 0);
          const pct = Math.min(
            100,
            m.objetivo > 0 ? (actual / m.objetivo) * 100 : 0,
          );
          const plataM = ["recurrente", "cobrado_mes"].includes(m.metrica);
          return (
            <article className="meta-card" key={m.id} onClick={() => editar(m)}>
              <div className="meta-top">
                <span className="meta-icon">{Ico.meta({ t: 18 })}</span>
                <span className={"pill " + (pct >= 100 ? "ok" : "gris")}>
                  {pct >= 100 ? "lograda" : "activa"}
                </span>
              </div>
              <h3>{m.titulo}</h3>
              {m.detalle && <p>{m.detalle}</p>}
              <div className="progreso">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="meta-numeros">
                <b>{plataM ? plata(actual) : actual.toLocaleString("es-CL")}</b>
                <span>
                  de{" "}
                  {plataM
                    ? plata(m.objetivo)
                    : m.objetivo.toLocaleString("es-CL")}{" "}
                  · {pct.toFixed(0)}%
                </span>
              </div>
              {m.hasta && <small>Fecha objetivo · {fecha(m.hasta)}</small>}
            </article>
          );
        })}
      {metas.length === 0 && (
        <p className="vacio">
          Crea una meta manual o conéctala a ingresos, clientes o suscriptores.
        </p>
      )}
    </div>
  );
}

function EditorTarea({
  tarea,
  agendarInicial = false,
  clientes,
  cerrar,
  guardado,
}: {
  tarea: Tarea | null;
  agendarInicial?: boolean;
  clientes: Cliente[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const confirmar = useConfirmacion();
  const hoy = new Date().toISOString().slice(0, 10);
  const [agendada, setAgendada] = useState(
    !!(tarea?.inicio || tarea?.vence || agendarInicial),
  );
  const [f, setF] = useState({
    titulo: tarea?.titulo ?? "",
    descripcion: tarea?.descripcion ?? "",
    estado: tarea?.estado ?? "por_hacer",
    prioridad: tarea?.prioridad ?? "media",
    cliente_id: tarea?.cliente_id ?? "",
    inicio: tarea?.inicio ?? tarea?.vence ?? (agendarInicial ? hoy : ""),
    inicio_hora: tarea?.inicio_hora?.slice(0, 5) ?? "",
    vence: tarea?.vence ?? "",
    vence_hora: tarea?.vence_hora?.slice(0, 5) ?? "",
    etiquetas: (tarea?.etiquetas ?? []).join(", "),
  });
  // Responsables: texto libre, pero varios — sin tabla de usuarios detrás.
  const [asignados, setAsignados] = useState<string[]>(tarea?.asignados ?? []);
  const [nuevoAsignado, setNuevoAsignado] = useState("");
  function agregarAsignado() {
    const v = nuevoAsignado.trim();
    if (!v) return;
    setAsignados((p) => (p.includes(v) ? p : [...p, v]));
    setNuevoAsignado("");
  }
  // Cliente con buscador: el <select> nativo se vuelve interminable con
  // muchos clientes. Se escribe el nombre y se elige de una lista filtrada.
  const clienteElegido = clientes.find((c) => c.id === (tarea?.cliente_id ?? ""));
  const [busquedaCliente, setBusquedaCliente] = useState(
    clienteElegido ? clienteElegido.negocio || clienteElegido.nombre || "" : "",
  );
  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  function cambiarAgenda(valor: boolean) {
    setAgendada(valor);
    setError("");
    if (valor && !f.inicio && !f.vence) set("inicio", hoy);
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (agendada && !f.inicio && !f.vence) {
      setError("Elige una fecha para agregar la tarea al calendario.");
      return;
    }
    if (agendada && f.inicio && f.vence && f.vence < f.inicio) {
      setError("La fecha de término no puede ser anterior al inicio.");
      return;
    }
    if (
      agendada && f.inicio === f.vence && f.inicio_hora && f.vence_hora &&
      f.vence_hora < f.inicio_hora
    ) {
      setError("La hora de término no puede ser anterior al inicio.");
      return;
    }

    const filaBase = {
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim() || null,
      estado: f.estado,
      prioridad: f.prioridad,
      asignados,
      cliente_id: f.cliente_id || null,
      inicio: agendada ? f.inicio || f.vence || null : null,
      vence: agendada ? f.vence || f.inicio || null : null,
      etiquetas: f.etiquetas
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    // Al sacar una tarea del calendario también se limpian sus horas. El
    // reintento de abajo permite que esto conviva con una base que aún no
    // incorporó esas dos columnas.
    const fila = {
      ...filaBase,
      inicio_hora: agendada ? f.inicio_hora || null : null,
      vence_hora: agendada ? f.vence_hora || null : null,
    };
    const guardar = (datos: typeof filaBase | typeof fila) =>
      tarea
        ? sb.from("tareas").update(datos).eq("id", tarea.id)
        : sb.from("tareas").insert(datos);
    let { error: fallo } = await guardar(fila);

    // Compatibilidad para tareas con fecha pero sin hora mientras producción
    // termina de incorporar inicio_hora/vence_hora. Si el usuario sí escribió
    // una hora, no la descartamos en silencio: explicamos qué falta.
    if (
      fallo && (!agendada || (!f.inicio_hora && !f.vence_hora)) &&
      /inicio_hora|vence_hora|schema cache/i.test(fallo.message)
    ) {
      ({ error: fallo } = await guardar(filaBase));
    }
    if (fallo) {
      setError(
        /inicio_hora|vence_hora|schema cache/i.test(fallo.message)
          ? "Falta aplicar la actualización de horas del calendario. La tarea no se guardó."
          : fallo.message,
      );
    } else guardado();
  }
  async function borrar() {
    if (!tarea || !await confirmar("¿Eliminar esta tarea?", undefined, "Eliminar")) return;
    await sb.from("tareas").delete().eq("id", tarea.id);
    guardado();
  }
  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <h2>{tarea ? "Editar tarea" : "Nueva tarea"}</h2>
        </header>
        <div className="contenido">
          <label className="campo-lbl">
            Título
            <input
              className="campo"
              autoFocus
              required
              value={f.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Descripción
            <textarea
              className="campo"
              rows={4}
              value={f.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </label>
          <div className="dos">
            <label className="campo-lbl">
              Estado
              <select
                className="campo"
                value={f.estado}
                onChange={(e) => set("estado", e.target.value)}
              >
                {COLUMNAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Prioridad
              <select
                className="campo"
                value={f.prioridad}
                onChange={(e) => set("prioridad", e.target.value)}
              >
                {["baja", "media", "alta", "urgente"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="dos">
            <label className="campo-lbl">
              Responsables{" "}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                · Enter o coma agrega
              </span>
              {asignados.length > 0 && (
                <div className="chips" style={{ marginBottom: 4 }}>
                  {asignados.map((nombre) => (
                    <button
                      key={nombre}
                      type="button"
                      className="chip on"
                      title="Quitar"
                      onClick={() =>
                        setAsignados((p) => p.filter((x) => x !== nombre))
                      }
                    >
                      {nombre} ✕
                    </button>
                  ))}
                </div>
              )}
              <input
                className="campo"
                value={nuevoAsignado}
                placeholder="Nombre o equipo"
                onChange={(e) => setNuevoAsignado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    agregarAsignado();
                  }
                }}
                onBlur={agregarAsignado}
              />
            </label>
            <label className="campo-lbl" style={{ position: "relative" }}>
              Cliente
              <input
                className="campo"
                value={busquedaCliente}
                placeholder="Buscar cliente…"
                onChange={(e) => {
                  setBusquedaCliente(e.target.value);
                  setClienteAbierto(true);
                  if (!e.target.value.trim()) set("cliente_id", "");
                }}
                onFocus={() => setClienteAbierto(true)}
                onBlur={() => setTimeout(() => setClienteAbierto(false), 150)}
              />
              {clienteAbierto && (
                <div
                  style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                    marginTop: 4, maxHeight: 220, overflowY: "auto",
                    background: "var(--panel)", border: "1px solid var(--borde)",
                    borderRadius: 10, boxShadow: "0 8px 24px -12px rgba(0,0,0,.35)",
                  }}
                >
                  <div
                    style={{ padding: "8px 10px", cursor: "pointer", fontSize: 13.5 }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      set("cliente_id", "");
                      setBusquedaCliente("");
                      setClienteAbierto(false);
                    }}
                  >
                    Trabajo interno de Cóndor
                  </div>
                  {clientes
                    .filter(
                      (c) =>
                        !c.archivado &&
                        (c.negocio || c.nombre || "")
                          .toLowerCase()
                          .includes(busquedaCliente.trim().toLowerCase()),
                    )
                    .slice(0, 30)
                    .map((c) => (
                      <div
                        key={c.id}
                        style={{ padding: "8px 10px", cursor: "pointer", fontSize: 13.5 }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          set("cliente_id", c.id);
                          setBusquedaCliente(c.negocio || c.nombre || "");
                          setClienteAbierto(false);
                        }}
                      >
                        {c.negocio || c.nombre}
                      </div>
                    ))}
                </div>
              )}
            </label>
          </div>
          <div className="chips modo-agenda" aria-label="Dónde mostrar la tarea">
            <button
              type="button"
              className={"chip" + (!agendada ? " on" : "")}
              onClick={() => cambiarAgenda(false)}
            >
              Solo tablero
            </button>
            <button
              type="button"
              className={"chip" + (agendada ? " on" : "")}
              onClick={() => cambiarAgenda(true)}
            >
              Agregar al calendario
            </button>
          </div>

          {agendada ? (
            <>
              <div className="dos horario-editor">
                <label className="campo-lbl">
                  Fecha de inicio
                  <input
                    className="campo"
                    type="date"
                    required
                    value={f.inicio}
                    onChange={(e) => set("inicio", e.target.value)}
                  />
                </label>
                <label className="campo-lbl">
                  Hora de inicio <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
                  <input
                    className="campo"
                    type="time"
                    step="300"
                    value={f.inicio_hora}
                    onChange={(e) => set("inicio_hora", e.target.value)}
                  />
                </label>
              </div>
              <div className="dos horario-editor">
                <label className="campo-lbl">
                  Fecha de término <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
                  <input
                    className="campo"
                    type="date"
                    min={f.inicio || undefined}
                    value={f.vence}
                    onChange={(e) => set("vence", e.target.value)}
                  />
                </label>
                <label className="campo-lbl">
                  Hora de término <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
                  <input
                    className="campo"
                    type="time"
                    step="300"
                    value={f.vence_hora}
                    onChange={(e) => set("vence_hora", e.target.value)}
                  />
                </label>
              </div>
              <small className="ayuda-horario">
                Aparecerá en Calendario. Allí puedes mover el bloque o estirarlo desde ambos costados.
              </small>
            </>
          ) : (
            <p className="aviso-sin-agenda">
              Sin fecha ni hora · aparecerá únicamente en la tab Tablero.
            </p>
          )}
          <label className="campo-lbl">
            Etiquetas
            <input
              className="campo"
              value={f.etiquetas}
              onChange={(e) => set("etiquetas", e.target.value)}
              placeholder="diseño, cliente, urgente"
            />
            <small>Separadas por coma.</small>
          </label>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          {tarea && (
            <button type="button" className="btn peligro" onClick={borrar}>
              Eliminar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido">Guardar</button>
        </footer>
      </form>
    </div>
  );
}

function EditorMeta({
  meta,
  cerrar,
  guardado,
}: {
  meta: Meta | null;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [f, setF] = useState({
    titulo: meta?.titulo ?? "",
    detalle: meta?.detalle ?? "",
    metrica: meta?.metrica ?? "manual",
    objetivo: meta?.objetivo ?? 0,
    avance: meta?.avance ?? 0,
    hasta: meta?.hasta ?? "",
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | number) =>
    setF((p) => ({ ...p, [k]: v }));
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const fila = {
      ...f,
      titulo: f.titulo.trim(),
      detalle: f.detalle.trim() || null,
      hasta: f.hasta || null,
    };
    const q = meta
      ? sb.from("metas").update(fila).eq("id", meta.id)
      : sb.from("metas").insert(fila);
    const { error } = await q;
    if (error) setError(error.message);
    else guardado();
  }
  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <h2>{meta ? "Editar meta" : "Nueva meta"}</h2>
        </header>
        <div className="contenido">
          <label className="campo-lbl">
            Meta
            <input
              className="campo"
              autoFocus
              required
              value={f.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ej: llegar a $5M de MRR"
            />
          </label>
          <label className="campo-lbl">
            Detalle
            <textarea
              className="campo"
              rows={2}
              value={f.detalle}
              onChange={(e) => set("detalle", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Cómo se mide
            <select
              className="campo"
              value={f.metrica}
              onChange={(e) => set("metrica", e.target.value)}
            >
              <option value="manual">Avance manual</option>
              <option value="recurrente">Ingreso recurrente</option>
              <option value="clientes">Clientes activos</option>
              <option value="cobrado_mes">Cobrado este mes</option>
              <option value="suscriptores_ratia">Suscriptores Rat.IA</option>
            </select>
            <small>
              Las métricas conectadas se actualizan solas con los datos del
              portal.
            </small>
          </label>
          <div className="dos">
            <label className="campo-lbl">
              Objetivo
              <input
                className="campo"
                type="number"
                min={0}
                value={f.objetivo || ""}
                onChange={(e) => set("objetivo", Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Fecha objetivo
              <input
                className="campo"
                type="date"
                value={f.hasta}
                onChange={(e) => set("hasta", e.target.value)}
              />
            </label>
          </div>
          {f.metrica === "manual" && (
            <label className="campo-lbl">
              Avance actual
              <input
                className="campo"
                type="number"
                min={0}
                value={f.avance || ""}
                onChange={(e) => set("avance", Number(e.target.value))}
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido">Guardar meta</button>
        </footer>
      </form>
    </div>
  );
}
