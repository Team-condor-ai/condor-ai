import { useEffect, useState, type CSSProperties } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { saludoHora } from "./saludo";
import { BarbaraPlanEditor, type PlanBarbaraEditable } from "./BarbaraPlanEditor";
import { fechaEnZona, fechaLocal, inputEnZona, paredAUTC } from "./barbaraCalendarioUtils";

type Pieza = {
  id: string; fecha: string; tipo: string; angulo: string | null;
  aprobada_sin_cambios: boolean | null; correcciones_pedidas: number | null;
};
type Programacion = {
  id: string; tipo: string; plataforma: string; programada_para: string;
  estado: "borrador" | "programada" | "publicando" | "publicada" | "fallida" | "cancelada";
  zona_horaria: string; motivo_reprogramacion: string | null; razon_planificacion: string | null;
  ultimo_error: string | null; intentos_publicacion: number;
  titulo: string | null; brief: string | null; configuracion: Record<string, unknown> | null;
  serie_id: string | null;
  barbara_memoria: { angulo: string | null } | { angulo: string | null }[] | null;
};

const TIPO_VISUAL: Record<string, { sigla: string; nombre: string }> = {
  carrusel: { sigla: "C", nombre: "Carrusel" },
  historia: { sigla: "H", nombre: "Historia" },
  ugc: { sigla: "U", nombre: "UGC" },
};
const visualDe = (tipo: string) => TIPO_VISUAL[tipo] || { sigla: "P", nombre: "Pieza" };
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const ESTADO: Record<Programacion["estado"], string> = {
  borrador: "Por aprobar", programada: "Programada", publicando: "Publicando",
  publicada: "Publicada", fallida: "Fallida", cancelada: "Cancelada",
};

function lunesDeLaSemana(d: Date) {
  const copia = new Date(d);
  const dow = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - dow);
  copia.setHours(0, 0, 0, 0);
  return copia;
}
const anguloDe = (p: Programacion) => {
  const memoria = Array.isArray(p.barbara_memoria) ? p.barbara_memoria[0] : p.barbara_memoria;
  return p.titulo || memoria?.angulo || p.tipo;
};
const esMovible = (p: Programacion) => p.estado === "borrador" || p.estado === "programada";

type Props = {
  barbaraClienteId: string;
  vistaInicial?: "semana" | "mes";
  nombreCliente: string;
  plan: string;
  resumen?: boolean;
};

/* La fórmula vive en `saludo.ts` para que el titular del inicio y este
   encabezado no puedan desincronizarse: eran dos copias de la misma regla
   y el titular ya se había quedado atrás (saludaba sin nombre). */
const saludoCalendario = (nombre: string) => saludoHora(nombre, nombre || "tu equipo");

/** Calendario unificado: historial real + borradores/programaciones futuras.
 * Mover y aprobar se hace mediante RPC estrechas; la UI nunca puede marcar
 * una pieza como publicada por su cuenta. */
export function BarbaraCalendario({ barbaraClienteId, vistaInicial = "mes", nombreCliente, plan, resumen = false }: Props) {
  const [vista, setVista] = useState<"semana" | "mes">(vistaInicial);
  const [ancla, setAncla] = useState(() => new Date());
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<Programacion | null>(null);
  const [piezaSeleccionada, setPiezaSeleccionada] = useState<Pieza | null>(null);
  const [nuevaHora, setNuevaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [zonaHoraria, setZonaHoraria] = useState("America/Santiago");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Programacion | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  const inicioSemana = lunesDeLaSemana(ancla);
  const primerDiaMes = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const inicioGrillaMes = lunesDeLaSemana(primerDiaMes);
  const base = vista === "semana" ? inicioSemana : inicioGrillaMes;
  const baseIso = fechaLocal(base);
  const cantidad = vista === "semana" ? 7 : 42;

  useEffect(() => {
    let vivo = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setError("");
        const desde = new Date(`${baseIso}T00:00:00`);
        const hasta = new Date(desde); hasta.setDate(hasta.getDate() + cantidad);
        // Se amplía un día a cada lado porque la zona de la programación
        // puede ser distinta a la del navegador que está mirando el portal.
        const desdeUTC = new Date(desde); desdeUTC.setDate(desdeUTC.getDate() - 1);
        const hastaUTC = new Date(hasta); hastaUTC.setDate(hastaUTC.getDate() + 1);
        const consultarProgramaciones = async () => {
          const completa = await sb.from("barbara_programaciones")
            .select("id,tipo,plataforma,programada_para,estado,zona_horaria,motivo_reprogramacion,razon_planificacion,ultimo_error,intentos_publicacion,titulo,brief,configuracion,serie_id,barbara_memoria(angulo)")
            .eq("barbara_cliente_id", barbaraClienteId)
            .gte("programada_para", desdeUTC.toISOString()).lt("programada_para", hastaUTC.toISOString())
            .order("programada_para", { ascending: true });
          if (!completa.error) return completa;

          // Algunas instalaciones todavía no tienen la migración de planes
          // editoriales. El calendario base debe seguir cargando en vez de
          // imprimir el error técnico de una columna faltante en la pantalla.
          const faltaMigracion = /barbara_programaciones\.(titulo|brief|configuracion|serie_id)|column .* does not exist/i
            .test(completa.error.message || "");
          if (!faltaMigracion) return completa;

          const basica = await sb.from("barbara_programaciones")
            .select("id,tipo,plataforma,programada_para,estado,zona_horaria,motivo_reprogramacion,razon_planificacion,ultimo_error,intentos_publicacion,barbara_memoria(angulo)")
            .eq("barbara_cliente_id", barbaraClienteId)
            .gte("programada_para", desdeUTC.toISOString()).lt("programada_para", hastaUTC.toISOString())
            .order("programada_para", { ascending: true });
          if (basica.error) return basica;
          return {
            ...basica,
            data: (basica.data ?? []).map((programacion) => ({
              ...programacion,
              titulo: null,
              brief: null,
              configuracion: null,
              serie_id: null,
            })),
          };
        };
        const [historial, futuro, cuenta] = await Promise.all([
          sb.from("barbara_memoria")
            .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas")
            .eq("barbara_cliente_id", barbaraClienteId)
            .gte("fecha", fechaLocal(desde)).lt("fecha", fechaLocal(hasta)),
          consultarProgramaciones(),
          sb.from("barbara_clientes").select("zona_horaria").eq("id", barbaraClienteId).maybeSingle(),
        ]);
        if (!vivo) return;
        if (historial.error || futuro.error) setError((historial.error || futuro.error)?.message || "No se pudo cargar el calendario");
        else {
          setPiezas((historial.data ?? []) as Pieza[]);
          setProgramaciones((futuro.data ?? []) as unknown as Programacion[]);
          setZonaHoraria(String(cuenta.data?.zona_horaria || futuro.data?.[0]?.zona_horaria || "America/Santiago"));
        }
      })();
    }, 0);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [barbaraClienteId, baseIso, cantidad, version]);

  const dias: Date[] = [];
  for (let i = 0; i < cantidad; i++) { const d = new Date(base); d.setDate(d.getDate() + i); dias.push(d); }

  const abrir = (p: Programacion) => {
    setPiezaSeleccionada(null);
    setSeleccionada(p);
    setNuevaHora(inputEnZona(p.programada_para, p.zona_horaria));
    setMotivo(p.motivo_reprogramacion || "");
    setError("");
  };

  async function reprogramar() {
    if (!seleccionada) return;
    const utc = paredAUTC(nuevaHora, seleccionada.zona_horaria);
    if (!utc || Number.isNaN(utc.getTime())) { setError("La fecha u hora no es válida."); return; }
    setGuardando(true);
    const { error } = await sb.rpc("barbara_reprogramar", {
      p_programacion_id: seleccionada.id,
      p_programada_para: utc.toISOString(),
      p_motivo: motivo.trim() || null,
    });
    setGuardando(false);
    if (error) { setError(error.message); return; }
    setSeleccionada(null);
    setVersion((v) => v + 1);
  }

  async function moverAlDia(programacionId: string, diaIso: string) {
    const programacion = programaciones.find((p) => p.id === programacionId);
    setArrastrando(null);
    setDestino(null);
    if (!programacion || !esMovible(programacion)) return;
    if (fechaEnZona(programacion.programada_para, programacion.zona_horaria) === diaIso) return;
    const horaActual = inputEnZona(programacion.programada_para, programacion.zona_horaria).slice(11, 16);
    const utc = paredAUTC(`${diaIso}T${horaActual}`, programacion.zona_horaria);
    if (!utc || Number.isNaN(utc.getTime())) return;
    setGuardando(true);
    setProgramaciones((actuales) => actuales.map((p) => p.id === programacion.id
      ? { ...p, programada_para: utc.toISOString() }
      : p));
    const { error: errorMover } = await sb.rpc("barbara_reprogramar", {
      p_programacion_id: programacion.id,
      p_programada_para: utc.toISOString(),
      p_motivo: "Movida arrastrando en el calendario",
    });
    setGuardando(false);
    if (errorMover) {
      setProgramaciones((actuales) => actuales.map((p) => p.id === programacion.id ? programacion : p));
      setError(errorMover.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  async function cambiarEstado(estado: "programada" | "cancelada") {
    if (!seleccionada) return;
    setGuardando(true);
    const { error } = await sb.rpc("barbara_cambiar_estado_programacion", {
      p_programacion_id: seleccionada.id, p_estado: estado,
    });
    setGuardando(false);
    if (error) { setError(error.message); return; }
    setSeleccionada(null);
    setVersion((v) => v + 1);
  }

  const HOY = fechaLocal(new Date());
  const conMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const etiquetaRango = vista === "semana"
    ? `${inicioSemana.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – ${new Date(new Date(inicioSemana).setDate(inicioSemana.getDate() + 6)).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`
    : conMayuscula(ancla.toLocaleDateString("es-CL", { month: "long", year: "numeric" }));

  function mover(delta: number) {
    setAncla((a) => {
      const n = new Date(a);
      if (vista === "semana") n.setDate(n.getDate() + delta * 7);
      else n.setMonth(n.getMonth() + delta);
      return n;
    });
  }

  return (
    <div className={`barbara-calendario${resumen ? " resumen" : ""}`}>
      <div className="barbara-calendario-nav">
        <div className="barbara-calendario-contexto">
          <span>{saludoCalendario(nombreCliente)}</span>
          <b className="barbara-calendario-rango">{etiquetaRango}</b>
        </div>
        <div className="barbara-calendario-controles">
          {!resumen && <button className="btn solido barbara-calendario-crear" onClick={() => setCreando(true)}>{Ico.mas({ t: 14 })} Crear contenido</button>}
          <button className={"chip-toggle" + (vista === "semana" ? " on" : "")} onClick={() => setVista("semana")}>Semana</button>
          <button className={"chip-toggle" + (vista === "mes" ? " on" : "")} onClick={() => setVista("mes")}>Mes</button>
          <button className="icono-btn" onClick={() => mover(-1)}>{Ico.volver({ t: 14 })}</button>
          <button className="icono-btn" onClick={() => mover(1)} style={{ transform: "scaleX(-1)" }}>{Ico.volver({ t: 14 })}</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div key={`${vista}-${etiquetaRango}`} className={"barbara-calendario-grilla" + (vista === "mes" ? " mes" : "")}>
        {DIAS.map((d) => <div key={d} className="barbara-calendario-diasem">{d}</div>)}
        {dias.map((d, indiceDia) => {
          const diaIso = fechaLocal(d);
          const esPasado = diaIso < HOY;
          const enMes = vista === "semana" || d.getMonth() === ancla.getMonth();
          const historicas = piezas.filter((p) => p.fecha === diaIso);
          const futuras = programaciones.filter((p) => fechaEnZona(p.programada_para, p.zona_horaria) === diaIso);
          return (
            <div key={diaIso}
              className={"barbara-calendario-celda" + (diaIso === HOY ? " hoy" : "") + (esPasado ? " pasado" : "") + (enMes ? "" : " fuera") + (arrastrando && !esPasado ? " recibe" : "") + (destino === diaIso ? " destino" : "")}
              style={{ "--barbara-dia-indice": indiceDia } as CSSProperties}
              onDragEnter={(e) => { if (arrastrando && !esPasado) { e.preventDefault(); setDestino(diaIso); } }}
              onDragOver={(e) => { if (arrastrando && !esPasado) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDestino(diaIso); } }}
              onDrop={(e) => {
                e.preventDefault();
                if (esPasado) return;
                const id = e.dataTransfer.getData("text/plain") || arrastrando;
                if (id) void moverAlDia(id, diaIso);
              }}>
              <div className="barbara-calendario-num">{diaIso === HOY && <i />}{d.getDate()}</div>
              {futuras.map((p) => (
                <button
                  key={p.id}
                  className={`barbara-calendario-chip futura tipo-${p.tipo} ${p.estado}${arrastrando === p.id ? " arrastrando" : ""}`}
                  onClick={() => abrir(p)}
                  draggable={esMovible(p) && !guardando}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", p.id);
                    setArrastrando(p.id);
                  }}
                  onDragEnd={() => { setArrastrando(null); setDestino(null); }}
                  title={esMovible(p) ? `${anguloDe(p)} · Arrastra para mover de día` : anguloDe(p)}
                  aria-label={`Para ${nombreCliente}. ${ESTADO[p.estado]}: ${anguloDe(p)}`}
                >
                  <span className="barbara-calendario-chip-icono" aria-hidden="true">{visualDe(p.tipo).sigla}</span>
                  <span className="barbara-calendario-chip-copia">
                    <span className="barbara-calendario-chip-meta">
                      <small>{visualDe(p.tipo).nombre}</small>
                      <time>{inputEnZona(p.programada_para, p.zona_horaria).slice(11)}</time>
                    </span>
                    <strong>{anguloDe(p)}</strong>
                  </span>
                </button>
              ))}
              {historicas.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`barbara-calendario-chip historica tipo-${p.tipo}`}
                  title={`Para ${nombreCliente}: ${p.angulo || p.tipo}`}
                  aria-label={`Publicada: ${p.angulo || p.tipo}. Toca para ver detalles.`}
                  onClick={() => {
                    setSeleccionada(null);
                    setPiezaSeleccionada(p);
                  }}
                >
                  <span className="barbara-calendario-chip-icono" aria-hidden="true">{visualDe(p.tipo).sigla}</span>
                  <span className="barbara-calendario-chip-copia">
                    <span className="barbara-calendario-chip-meta">
                      <small>{visualDe(p.tipo).nombre}</small>
                      <time>Publicado</time>
                    </span>
                    <strong>{p.angulo || p.tipo}</strong>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {piezaSeleccionada && (
        <div className="barbara-calendario-detalle" role="status">
          <span className={`barbara-calendario-chip-icono tipo-${piezaSeleccionada.tipo}`} aria-hidden="true">
            {visualDe(piezaSeleccionada.tipo).sigla}
          </span>
          <div>
            <small>Publicado · {piezaSeleccionada.fecha}</small>
            <strong>{piezaSeleccionada.angulo || visualDe(piezaSeleccionada.tipo).nombre}</strong>
            <span>
              {piezaSeleccionada.aprobada_sin_cambios
                ? "Aprobada sin cambios"
                : `${piezaSeleccionada.correcciones_pedidas || 0} corrección${
                    (piezaSeleccionada.correcciones_pedidas || 0) === 1 ? "" : "es"} solicitada${
                    (piezaSeleccionada.correcciones_pedidas || 0) === 1 ? "" : "s"}`}
            </span>
          </div>
          <button type="button" className="icono-btn" aria-label="Cerrar detalle" onClick={() => setPiezaSeleccionada(null)}>
            {Ico.cerrar({ t: 14 })}
          </button>
        </div>
      )}

      {seleccionada && (
        <div className="barbara-programacion-editor">
          <div>
            <small>{ESTADO[seleccionada.estado]} · {seleccionada.plataforma}</small>
            <strong>{anguloDe(seleccionada)}</strong>
            <span>Horario mostrado en {seleccionada.zona_horaria}</span>
            {seleccionada.serie_id && <span>Parte de una serie semanal</span>}
            {seleccionada.brief && <span>{seleccionada.brief}</span>}
            {seleccionada.ultimo_error && <span className="error">{seleccionada.ultimo_error}</span>}
            {seleccionada.intentos_publicacion > 0 && <span>{seleccionada.intentos_publicacion} intento{seleccionada.intentos_publicacion === 1 ? "" : "s"} de publicación</span>}
          </div>
          {(seleccionada.estado === "borrador" || seleccionada.estado === "programada") && <>
            <label className="campo-lbl">Fecha y hora
              <input className="campo" type="datetime-local" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} />
            </label>
            <label className="campo-lbl">Motivo del cambio (opcional)
              <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. mover después del lanzamiento" />
            </label>
            <div className="barbara-programacion-acciones">
              <button className="btn" type="button" disabled={guardando} onClick={() => setEditando(seleccionada)}>Editar contenido</button>
              <button className="btn" disabled={guardando} onClick={reprogramar}>Guardar hora</button>
              {seleccionada.estado === "borrador" && <button className="btn solido" disabled={guardando} onClick={() => cambiarEstado("programada")}>Aprobar programación</button>}
              <button className="btn" disabled={guardando} onClick={() => cambiarEstado("cancelada")}>Cancelar pieza</button>
              <button className="btn" disabled={guardando} onClick={() => setSeleccionada(null)}>Cerrar</button>
            </div>
          </>}
        </div>
      )}

      {creando && (
        <BarbaraPlanEditor barbaraClienteId={barbaraClienteId} plan={plan} zonaHoraria={zonaHoraria}
          cerrar={() => setCreando(false)} guardado={() => { setCreando(false); setVersion((v) => v + 1); }} />
      )}
      {editando && (
        <BarbaraPlanEditor barbaraClienteId={barbaraClienteId} plan={plan} zonaHoraria={editando.zona_horaria}
          existente={editando as PlanBarbaraEditable}
          cerrar={() => setEditando(null)} guardado={() => { setEditando(null); setSeleccionada(null); setVersion((v) => v + 1); }} />
      )}
    </div>
  );
}
