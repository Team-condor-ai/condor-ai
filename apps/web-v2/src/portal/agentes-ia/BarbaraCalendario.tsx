import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";

type Pieza = {
  id: string; fecha: string; tipo: string; angulo: string | null;
  aprobada_sin_cambios: boolean | null; correcciones_pedidas: number | null;
};
type Programacion = {
  id: string; tipo: string; plataforma: string; programada_para: string;
  estado: "borrador" | "programada" | "publicando" | "publicada" | "fallida" | "cancelada";
  zona_horaria: string; motivo_reprogramacion: string | null; razon_planificacion: string | null;
  barbara_memoria: { angulo: string | null } | { angulo: string | null }[] | null;
};

const ICONO_TIPO: Record<string, string> = { carrusel: "🖼️", historia: "📱", ugc: "🎬" };
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
const dos = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

function partesEnZona(fecha: Date, zona: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha);
  const get = (tipo: string) => Number(p.find((x) => x.type === tipo)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function fechaEnZona(iso: string, zona: string) {
  const p = partesEnZona(new Date(iso), zona);
  return `${p.year}-${dos(p.month)}-${dos(p.day)}`;
}

function inputEnZona(iso: string, zona: string) {
  const p = partesEnZona(new Date(iso), zona);
  return `${p.year}-${dos(p.month)}-${dos(p.day)}T${dos(p.hour)}:${dos(p.minute)}`;
}

function paredAUTC(valor: string, zona: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!m) return null;
  const objetivo = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let candidata = objetivo;
  for (let i = 0; i < 3; i++) {
    const p = partesEnZona(new Date(candidata), zona);
    candidata += objetivo - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return new Date(candidata);
}

const anguloDe = (p: Programacion) => {
  const memoria = Array.isArray(p.barbara_memoria) ? p.barbara_memoria[0] : p.barbara_memoria;
  return memoria?.angulo || p.tipo;
};

type Props = { barbaraClienteId: string; vistaInicial?: "semana" | "mes" };

/** Calendario unificado: historial real + borradores/programaciones futuras.
 * Mover y aprobar se hace mediante RPC estrechas; la UI nunca puede marcar
 * una pieza como publicada por su cuenta. */
export function BarbaraCalendario({ barbaraClienteId, vistaInicial = "mes" }: Props) {
  const [vista, setVista] = useState<"semana" | "mes">(vistaInicial);
  const [ancla, setAncla] = useState(() => new Date());
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<Programacion | null>(null);
  const [nuevaHora, setNuevaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  const inicioSemana = lunesDeLaSemana(ancla);
  const primerDiaMes = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const inicioGrillaMes = lunesDeLaSemana(primerDiaMes);
  const base = vista === "semana" ? inicioSemana : inicioGrillaMes;
  const baseIso = isoLocal(base);
  const cantidad = vista === "semana" ? 7 : 42;

  useEffect(() => {
    let vivo = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCargando(true);
        setError("");
        const desde = new Date(`${baseIso}T00:00:00`);
        const hasta = new Date(desde); hasta.setDate(hasta.getDate() + cantidad);
        // Se amplía un día a cada lado porque la zona de la programación
        // puede ser distinta a la del navegador que está mirando el portal.
        const desdeUTC = new Date(desde); desdeUTC.setDate(desdeUTC.getDate() - 1);
        const hastaUTC = new Date(hasta); hastaUTC.setDate(hastaUTC.getDate() + 1);
        const [historial, futuro] = await Promise.all([
          sb.from("barbara_memoria")
            .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas")
            .eq("barbara_cliente_id", barbaraClienteId)
            .gte("fecha", isoLocal(desde)).lt("fecha", isoLocal(hasta)),
          sb.from("barbara_programaciones")
            .select("id,tipo,plataforma,programada_para,estado,zona_horaria,motivo_reprogramacion,razon_planificacion,barbara_memoria(angulo)")
            .eq("barbara_cliente_id", barbaraClienteId)
            .gte("programada_para", desdeUTC.toISOString()).lt("programada_para", hastaUTC.toISOString())
            .order("programada_para", { ascending: true }),
        ]);
        if (!vivo) return;
        if (historial.error || futuro.error) setError((historial.error || futuro.error)?.message || "No se pudo cargar el calendario");
        else {
          setPiezas((historial.data ?? []) as Pieza[]);
          setProgramaciones((futuro.data ?? []) as unknown as Programacion[]);
        }
        setCargando(false);
      })();
    }, 0);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [barbaraClienteId, baseIso, cantidad, version]);

  const dias: Date[] = [];
  for (let i = 0; i < cantidad; i++) { const d = new Date(base); d.setDate(d.getDate() + i); dias.push(d); }

  const abrir = (p: Programacion) => {
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

  const HOY = isoLocal(new Date());
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
    <div className="barbara-calendario">
      <div className="barbara-calendario-nav">
        <b className="barbara-calendario-rango">{etiquetaRango}</b>
        <div className="barbara-calendario-controles">
          <button className={"chip-toggle" + (vista === "semana" ? " on" : "")} onClick={() => setVista("semana")}>Semana</button>
          <button className={"chip-toggle" + (vista === "mes" ? " on" : "")} onClick={() => setVista("mes")}>Mes</button>
          <button className="chip-toggle" onClick={() => setAncla(new Date())}>Hoy</button>
          <button className="icono-btn" onClick={() => mover(-1)}>{Ico.volver({ t: 14 })}</button>
          <button className="icono-btn" onClick={() => mover(1)} style={{ transform: "scaleX(-1)" }}>{Ico.volver({ t: 14 })}</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div className={"barbara-calendario-grilla" + (vista === "mes" ? " mes" : "")}>
        {DIAS.map((d) => <div key={d} className="barbara-calendario-diasem">{d}</div>)}
        {dias.map((d) => {
          const diaIso = isoLocal(d);
          const enMes = vista === "semana" || d.getMonth() === ancla.getMonth();
          const historicas = piezas.filter((p) => p.fecha === diaIso);
          const futuras = programaciones.filter((p) => fechaEnZona(p.programada_para, p.zona_horaria) === diaIso);
          return (
            <div key={diaIso} className={"barbara-calendario-celda" + (diaIso === HOY ? " hoy" : "") + (enMes ? "" : " fuera")}>
              <div className="barbara-calendario-num">{diaIso === HOY && <i />}{d.getDate()}</div>
              {futuras.map((p) => (
                <button key={p.id} className={`barbara-calendario-chip futura ${p.estado}`} onClick={() => abrir(p)}>
                  <span>{ICONO_TIPO[p.tipo] || "📄"}</span>
                  <small>{inputEnZona(p.programada_para, p.zona_horaria).slice(11)} · {anguloDe(p).slice(0, 24)}</small>
                </button>
              ))}
              {historicas.map((p) => (
                <div key={p.id} className="barbara-calendario-chip historica">
                  <span>{ICONO_TIPO[p.tipo] || "📄"}</span>
                  <small>{p.angulo ? (p.angulo.length > 28 ? p.angulo.slice(0, 26) + "…" : p.angulo) : p.tipo}</small>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!cargando && !piezas.length && !programaciones.length && <p className="tenue" style={{ marginTop: 10 }}>Sin piezas en este rango todavía.</p>}
      <div className="barbara-calendario-leyenda">
        <span><i className="borrador" /> Por aprobar</span><span><i className="programada" /> Programada</span><span><i className="historica" /> Historial</span>
      </div>

      {seleccionada && (
        <div className="barbara-programacion-editor">
          <div>
            <small>{ESTADO[seleccionada.estado]} · {seleccionada.plataforma}</small>
            <strong>{anguloDe(seleccionada)}</strong>
            <span>Horario mostrado en {seleccionada.zona_horaria}</span>
          </div>
          {(seleccionada.estado === "borrador" || seleccionada.estado === "programada") && <>
            <label className="campo-lbl">Fecha y hora
              <input className="campo" type="datetime-local" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} />
            </label>
            <label className="campo-lbl">Motivo del cambio (opcional)
              <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. mover después del lanzamiento" />
            </label>
            <div className="barbara-programacion-acciones">
              <button className="btn" disabled={guardando} onClick={reprogramar}>Guardar hora</button>
              {seleccionada.estado === "borrador" && <button className="btn solido" disabled={guardando} onClick={() => cambiarEstado("programada")}>Aprobar programación</button>}
              <button className="btn" disabled={guardando} onClick={() => cambiarEstado("cancelada")}>Cancelar pieza</button>
              <button className="btn" disabled={guardando} onClick={() => setSeleccionada(null)}>Cerrar</button>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
