import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sb, fecha, plata } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { EditorReunion } from "../EditorReunion";
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
  asignado_a: string | null;
  cliente_id: string | null;
  inicio: string | null;
  vence: string | null;
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
  const [editando, setEditando] = useState<Tarea | "nueva" | null>(null);
  const [editandoMeta, setEditandoMeta] = useState<Meta | "nueva" | null>(null);
  const [editandoReunion, setEditandoReunion] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "mias" | "vencidas">("todas");

  async function cargar() {
    setCargando(true);
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
    setCargando(false);
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
        : !!t.asignado_a),
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
            <button className="btn" onClick={() => setEditando("nueva")}>
              {Ico.mas({ t: 15 })} Nueva tarea
            </button>
            <button
              className="btn solido"
              onClick={() => setEditandoReunion(true)}
            >
              {Ico.reuniones({ t: 15 })} Agendar reunión
            </button>
          </div>
        ) : (
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
                            <span className={`prioridad ${t.prioridad}`}>
                              {t.prioridad}
                            </span>
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
                            {t.asignado_a && (
                              <span className="persona-mini">
                                {t.asignado_a.slice(0, 2).toUpperCase()}
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
            tareas={tareas}
            reuniones={reuniones}
            cliente={cliente}
            abrir={setEditando}
            recargar={cargar}
            error={setError}
          />
        ) : (
          <Metas metas={metas} metricas={metricas} editar={setEditandoMeta} />
        )}
      </div>
      {editando && (
        <EditorTarea
          tarea={editando === "nueva" ? null : editando}
          clientes={clientes}
          cerrar={() => setEditando(null)}
          guardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
      {editandoMeta && (
        <EditorMeta
          meta={editandoMeta === "nueva" ? null : editandoMeta}
          cerrar={() => setEditandoMeta(null)}
          guardado={() => {
            setEditandoMeta(null);
            cargar();
          }}
        />
      )}
      {editandoReunion && (
        <EditorReunion
          cerrar={() => setEditandoReunion(false)}
          guardado={() => {
            setEditandoReunion(false);
            cargar();
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
  recargar,
  error,
}: {
  tareas: Tarea[];
  reuniones: Reunion[];
  cliente: Map<string, Cliente>;
  abrir: (t: Tarea) => void;
  recargar: () => void;
  error: (mensaje: string) => void;
}) {
  const [mes, setMes] = useState(() => new Date());
  const [ahora] = useState(() => Date.now());
  const [ajustando, setAjustando] = useState<{
    id: string;
    tipo: "tarea" | "reunion";
    valor: number;
  } | null>(null);
  const anio = mes.getFullYear(),
    m = mes.getMonth();
  const inicio = new Date(anio, m, 1);
  const dias = new Date(anio, m + 1, 0).getDate();
  const celdas = [
    ...Array(inicio.getDay()).fill(null),
    ...Array.from({ length: dias }, (_, i) => i + 1),
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

  async function guardarTarea(t: Tarea, inicioNuevo: string, finNuevo: string) {
    const { error: fallo } = await sb
      .from("tareas")
      .update({ inicio: inicioNuevo, vence: finNuevo })
      .eq("id", t.id);
    if (fallo) error(fallo.message);
    else recargar();
  }

  async function guardarReunion(r: Reunion, cambios: Partial<Reunion>) {
    const { error: fallo } = await sb
      .from("reuniones")
      .update(cambios)
      .eq("id", r.id);
    if (fallo) error(fallo.message);
    else recargar();
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

  function iniciarResize(
    e: React.PointerEvent,
    tipo: "tarea" | "reunion",
    item: Tarea | Reunion,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const origen = e.clientX;
    const base =
      tipo === "tarea"
        ? diferenciaDias(
            (item as Tarea).inicio ?? (item as Tarea).vence ?? clave(1),
            (item as Tarea).vence ?? (item as Tarea).inicio ?? clave(1),
          ) + 1
        : (item as Reunion).duracion_min ?? 60;
    let pasos = 0;
    setAjustando({ id: item.id, tipo, valor: base });
    const mover = (ev: PointerEvent) => {
      pasos = Math.round((ev.clientX - origen) / 34);
      const valor =
        tipo === "tarea"
          ? Math.max(1, base + pasos)
          : Math.min(12 * 60, Math.max(15, base + pasos * 15));
      setAjustando({ id: item.id, tipo, valor });
    };
    const terminar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", terminar);
      setAjustando(null);
      if (!pasos) return;
      if (tipo === "tarea") redimensionarTarea(item as Tarea, pasos);
      else redimensionarReunion(item as Reunion, pasos);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar, { once: true });
  }
  const proximas = reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() >= ahora)
    .sort((a, b) => +new Date(a.fecha_hora) - +new Date(b.fecha_hora));
  const pasadas = reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() < ahora)
    .sort((a, b) => +new Date(b.fecha_hora) - +new Date(a.fecha_hora));

  async function eliminar(r: Reunion) {
    if (!window.confirm(`¿Eliminar la reunión "${r.titulo}"?`)) return;
    const { error: fallo } = await sb
      .from("reuniones")
      .delete()
      .eq("id", r.id);
    if (fallo) error(fallo.message);
    else recargar();
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
        </header>
        <div className="cal-leyenda">
          <span><i className="tarea" /> Tareas</span>
          <span><i className="reunion" /> Reuniones</span>
        </div>
        <p className="cal-ayuda">
          Arrastra un bloque para cambiarlo de fecha. Estira su borde derecho
          para ajustar días o minutos · con teclado: Shift + ← / →.
        </p>
        <div className="cal-grid">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((x) => (
            <b className="cal-dia" key={x}>{x}</b>
          ))}
          {celdas.map((d, i) => (
            <div
              className={"cal-celda" + (!d ? " vacia" : "")}
              key={i}
              onDragOver={(e) => d && e.preventDefault()}
              onDrop={(e) => d && soltar(e, clave(d))}
            >
              {d && (
                <>
                  <span>{d}</span>
                  {reuniones
                    .filter((r) => fechaLocal(r.fecha_hora) === clave(d))
                    .map((r) => (
                      <a
                        key={r.id}
                        className="evento reunion"
                        href={r.meet_url || undefined}
                        target={r.meet_url ? "_blank" : undefined}
                        rel={r.meet_url ? "noreferrer" : undefined}
                        title={r.meet_url ? "Entrar a la videollamada" : r.descripcion || undefined}
                        style={
                          {
                            "--duracion-evento": `${Math.min(100, ((ajustando?.id === r.id ? ajustando.valor : r.duracion_min ?? 60) / 180) * 100)}%`,
                          } as React.CSSProperties
                        }
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          const dato = JSON.stringify({ tipo: "reunion", id: r.id, desde: clave(d) });
                          e.dataTransfer.setData(
                            "application/condor-cal",
                            dato,
                          );
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
                          className="evento-resize"
                          aria-hidden="true"
                          title="Arrastra para cambiar la duración"
                          onPointerDown={(e) => iniciarResize(e, "reunion", r)}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                      </a>
                    ))}
                  {tareas
                    .filter((t) => {
                      const inicioT = t.inicio ?? t.vence;
                      const finT = t.vence ?? t.inicio;
                      return !!inicioT && !!finT && clave(d) >= inicioT && clave(d) <= finT;
                    })
                    .map((t) => (
                      <button
                        key={t.id}
                        className={`evento tarea ${t.prioridad}${clave(d) !== (t.inicio ?? t.vence) ? " continua-antes" : ""}${clave(d) !== (t.vence ?? t.inicio) ? " continua-despues" : ""}`}
                        onClick={() => abrir(t)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          const dato = JSON.stringify({ tipo: "tarea", id: t.id, desde: clave(d) });
                          e.dataTransfer.setData(
                            "application/condor-cal",
                            dato,
                          );
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
                        <b>{t.titulo}</b>
                        <small>
                          {t.cliente_id
                            ? cliente.get(t.cliente_id)?.negocio
                            : t.asignado_a || "Cóndor"}
                        </small>
                        {clave(d) === (t.vence ?? t.inicio) && (
                          <span
                            className="evento-resize"
                            aria-hidden="true"
                            title="Arrastra para ampliar o acortar días"
                            onPointerDown={(e) => iniciarResize(e, "tarea", t)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          />
                        )}
                      </button>
                    ))}
                </>
              )}
            </div>
          ))}
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
  clientes,
  cerrar,
  guardado,
}: {
  tarea: Tarea | null;
  clientes: Cliente[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const [f, setF] = useState({
    titulo: tarea?.titulo ?? "",
    descripcion: tarea?.descripcion ?? "",
    estado: tarea?.estado ?? "por_hacer",
    prioridad: tarea?.prioridad ?? "media",
    asignado_a: tarea?.asignado_a ?? "",
    cliente_id: tarea?.cliente_id ?? "",
    inicio: tarea?.inicio ?? tarea?.vence ?? "",
    vence: tarea?.vence ?? "",
    etiquetas: (tarea?.etiquetas ?? []).join(", "),
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const fila = {
      ...f,
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim() || null,
      asignado_a: f.asignado_a.trim() || null,
      cliente_id: f.cliente_id || null,
      inicio: f.inicio || f.vence || null,
      vence: f.vence || f.inicio || null,
      etiquetas: f.etiquetas
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    const q = tarea
      ? sb.from("tareas").update(fila).eq("id", tarea.id)
      : sb.from("tareas").insert(fila);
    const { error } = await q;
    if (error) setError(error.message);
    else guardado();
  }
  async function borrar() {
    if (!tarea || !window.confirm("¿Eliminar esta tarea?")) return;
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
              Responsable
              <input
                className="campo"
                value={f.asignado_a}
                onChange={(e) => set("asignado_a", e.target.value)}
                placeholder="Nombre o equipo"
              />
            </label>
            <label className="campo-lbl">
              Comienza
              <input
                className="campo"
                type="date"
                value={f.inicio}
                onChange={(e) => set("inicio", e.target.value)}
              />
            </label>
          </div>
          <label className="campo-lbl">
            Termina / vence
            <input
              className="campo"
              type="date"
              min={f.inicio || undefined}
              value={f.vence}
              onChange={(e) => set("vence", e.target.value)}
            />
            <small>En el calendario puedes mover el bloque o estirarlo desde su borde derecho.</small>
          </label>
          <label className="campo-lbl">
            Cliente
            <select
              className="campo"
              value={f.cliente_id}
              onChange={(e) => set("cliente_id", e.target.value)}
            >
              <option value="">Trabajo interno de Cóndor</option>
              {clientes
                .filter((c) => !c.archivado)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.negocio || c.nombre}
                  </option>
                ))}
            </select>
          </label>
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
                value={f.objetivo}
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
                value={f.avance}
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
