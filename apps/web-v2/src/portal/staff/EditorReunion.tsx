import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import type { Cliente, PerfilAdmin } from "./tipos";

type Props = { cerrar: () => void; guardado: () => void };
type ReglaSemanal = { dia: number; hora: string };

const DURACIONES = [15, 30, 45, 60, 90, 120];
const DIAS = [
  { dia: 1, corto: "Lun", nombre: "lunes" },
  { dia: 2, corto: "Mar", nombre: "martes" },
  { dia: 3, corto: "Mié", nombre: "miércoles" },
  { dia: 4, corto: "Jue", nombre: "jueves" },
  { dia: 5, corto: "Vie", nombre: "viernes" },
  { dia: 6, corto: "Sáb", nombre: "sábado" },
  { dia: 0, corto: "Dom", nombre: "domingo" },
];

function fechaLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function sumarMeses(fecha: string, meses: number) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return fechaLocal(new Date(anio, mes - 1 + meses, dia, 12));
}

function fechaHoraISO(fecha: string, hora: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  const valor = new Date(anio, mes - 1, dia, horas, minutos, 0, 0);
  if (Number.isNaN(valor.getTime())) throw new Error("Elige una fecha y una hora válidas.");
  return valor.toISOString();
}

function crearOcurrencias(desde: string, hasta: string, reglas: ReglaSemanal[]) {
  const [anioI, mesI, diaI] = desde.split("-").map(Number);
  const [anioF, mesF, diaF] = hasta.split("-").map(Number);
  const cursor = new Date(anioI, mesI - 1, diaI, 12);
  const fin = new Date(anioF, mesF - 1, diaF, 12);
  const porDia = new Map(reglas.map((r) => [r.dia, r.hora]));
  const ocurrencias: string[] = [];
  while (cursor <= fin && ocurrencias.length < 200) {
    const hora = porDia.get(cursor.getDay());
    if (hora) ocurrencias.push(fechaHoraISO(fechaLocal(cursor), hora));
    cursor.setDate(cursor.getDate() + 1);
  }
  return ocurrencias;
}

/** Agenda una reunión única o una serie semanal con una hora por día. */
export function EditorReunion({ cerrar, guardado }: Props) {
  const hoy = useMemo(() => fechaLocal(), []);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState("09:00");
  const [duracion, setDuracion] = useState(60);
  const [cliente, setCliente] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [invitados, setInvitados] = useState<string[]>([]);
  const [repite, setRepite] = useState(false);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(() => sumarMeses(hoy, 3));
  const [reglas, setReglas] = useState<ReglaSemanal[]>([{ dia: 1, hora: "09:00" }]);
  const [equipo, setEquipo] = useState<PerfilAdmin[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    sb.from("admin_profiles").select("id,email,nombre").order("nombre")
      .then(({ data }) => setEquipo((data ?? []) as PerfilAdmin[]));
    sb.from("clientes").select("*").order("negocio")
      .then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, []);

  function alternarInvitado(id: string) {
    setInvitados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function alternarDia(dia: number) {
    setReglas((actuales) => actuales.some((r) => r.dia === dia)
      ? actuales.filter((r) => r.dia !== dia)
      : [...actuales, { dia, hora: "09:00" }]);
  }

  function cambiarHoraDia(dia: number, nuevaHora: string) {
    setReglas((actuales) => actuales.map((r) => r.dia === dia ? { ...r, hora: nuevaHora } : r));
  }

  const resumenRecurrencia = reglas
    .slice()
    .sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7))
    .map((r) => `${DIAS.find((d) => d.dia === r.dia)?.nombre} a las ${r.hora}`)
    .join(" y ");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");
    setAviso("");
    let advertencia = "";

    if (repite && !reglas.length) {
      setGuardando(false);
      setError("Selecciona al menos un día para la reunión recurrente.");
      return;
    }
    if (repite && hasta < desde) {
      setGuardando(false);
      setError("La fecha final debe ser igual o posterior a la fecha inicial.");
      return;
    }

    let ocurrencias: string[];
    try {
      ocurrencias = repite ? crearOcurrencias(desde, hasta, reglas) : [fechaHoraISO(fecha, hora)];
    } catch (fallo) {
      setGuardando(false);
      setError(fallo instanceof Error ? fallo.message : "Revisa la fecha y la hora.");
      return;
    }
    if (!ocurrencias.length) {
      setGuardando(false);
      setError("No hay días seleccionados dentro del rango indicado.");
      return;
    }
    if (ocurrencias.length >= 200) {
      setGuardando(false);
      setError("La serie alcanza el límite de 200 reuniones. Acorta el rango.");
      return;
    }

    const { data: sesion } = await sb.auth.getUser();
    const yo = sesion?.user?.id;
    if (!yo) {
      setGuardando(false);
      setError("Tu sesión expiró. Vuelve a entrar para agendar la reunión.");
      return;
    }

    const serieId = repite ? crypto.randomUUID() : null;
    const base = {
      titulo: titulo.trim(), descripcion: descripcion.trim() || null,
      duracion_min: duracion, cliente: cliente.trim() || null,
      meet_url: meetUrl.trim() || null, creado_por: yo,
    };
    const filas = ocurrencias.map((fecha_hora) => ({
      ...base, fecha_hora,
      ...(repite ? {
        serie_id: serieId, recurrencia_reglas: reglas,
        recurrencia_desde: desde, recurrencia_hasta: hasta,
      } : {}),
    }));
    const { data: creadas, error: errCrear } = await sb
      .from("reuniones").insert(filas).select("id,fecha_hora");
    if (errCrear || !creadas?.length) {
      setGuardando(false);
      setError(errCrear?.message ?? "No se pudo guardar la reunión.");
      return;
    }

    if (invitados.length) {
      const participantes = creadas.flatMap((reunion) =>
        invitados.map((admin_id) => ({ reunion_id: reunion.id, admin_id })));
      const { error: errInv } = await sb.from("reuniones_admins").insert(participantes);
      if (errInv) advertencia = `Reunión guardada, pero los invitados fallaron: ${errInv.message}`;
    }

    const elegidos = equipo.filter((p) => invitados.includes(p.id));
    try {
      const { error: errAviso } = await sb.functions.invoke("reunion-notificar", { body: {
        titulo: titulo.trim(), descripcion: descripcion.trim(), fecha_hora: ocurrencias[0],
        ocurrencias, resumen_recurrencia: repite
          ? `Todos los ${resumenRecurrencia}, desde ${desde} hasta ${hasta}` : "",
        duracion_min: duracion, cliente: cliente.trim(),
        invitados: elegidos.map((p) => p.nombre),
        invitados_email: elegidos.map((p) => ({ nombre: p.nombre, email: p.email })),
      }});
      if (errAviso) advertencia ||= "Reunión guardada, pero no se pudo enviar el aviso por correo/Telegram.";
    } catch {
      advertencia ||= "Reunión guardada, pero no se pudo enviar el aviso por correo/Telegram.";
    }

    setGuardando(false);
    if (advertencia) setAviso(advertencia);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal panel-reunion" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header><div><h2>Agendar reunión</h2><small>Hora local de Santiago</small></div></header>
        <div className="contenido">
          <label className="campo-lbl">Título
            <input className="campo" autoFocus required placeholder="Kickoff Bárbara — cliente nuevo"
              value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>

          <div className="selector-recurrencia" aria-label="Frecuencia de la reunión">
            <button type="button" className={!repite ? "activo" : ""} onClick={() => setRepite(false)}>Una vez</button>
            <button type="button" className={repite ? "activo" : ""} onClick={() => setRepite(true)}>Se repite</button>
          </div>

          {!repite ? (
            <div className="tres fecha-hora-reunion">
              <label className="campo-lbl">Fecha
                <input className="campo" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              <label className="campo-lbl">Hora
                <input className="campo" type="time" step="300" required value={hora} onChange={(e) => setHora(e.target.value)} />
              </label>
              <label className="campo-lbl">Duración
                <select className="campo" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                  {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </label>
            </div>
          ) : (
            <section className="reunion-recurrencia">
              <div className="tres fecha-hora-reunion">
                <label className="campo-lbl">Desde
                  <input className="campo" type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="campo-lbl">Hasta
                  <input className="campo" type="date" required min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </label>
                <label className="campo-lbl">Duración
                  <select className="campo" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                    {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </label>
              </div>
              <div className="reglas-semana">
                {DIAS.map((d) => {
                  const regla = reglas.find((r) => r.dia === d.dia);
                  return <div className={`regla-dia${regla ? " elegida" : ""}`} key={d.dia}>
                    <button type="button" aria-pressed={!!regla} onClick={() => alternarDia(d.dia)}>
                      <i aria-hidden="true" /> {d.corto}
                    </button>
                    <input aria-label={`Hora del ${d.nombre}`} className="campo" type="time" step="300"
                      disabled={!regla} required={!!regla} value={regla?.hora ?? "09:00"}
                      onChange={(e) => cambiarHoraDia(d.dia, e.target.value)} />
                  </div>;
                })}
              </div>
              <p className="resumen-serie">
                {reglas.length ? `Se agendará ${resumenRecurrencia}.` : "Elige uno o más días."}
              </p>
            </section>
          )}

          <label className="campo-lbl">Cliente (opcional)
            <input className="campo" list="lista-clientes" placeholder="Negocio al que corresponde"
              value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <datalist id="lista-clientes">
              {clientes.map((c) => <option key={c.id} value={c.negocio || c.nombre || c.email || ""} />)}
            </datalist>
          </label>
          <label className="campo-lbl">Link de la videollamada (opcional)
            <input className="campo" type="url" placeholder="https://meet.google.com/…"
              value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} />
            <small>¿No tienes uno? Abre <a href="https://meet.new" target="_blank" rel="noreferrer">meet.new</a> y pega acá el link.</small>
          </label>

          <div>
            <label className="campo-lbl">Invitados del equipo</label>
            {equipo.length === 0 ? <p className="conteo">Todavía no hay perfiles del equipo.</p> : (
              <div className="chips" style={{ marginTop: 8 }}>
                {equipo.map((p) => <button key={p.id} type="button"
                  className={`chip${invitados.includes(p.id) ? " on" : ""}`}
                  onClick={() => alternarInvitado(p.id)}>{p.nombre}</button>)}
              </div>
            )}
            <small className="ayuda-invitados">El aviso se envía una sola vez; el archivo de calendario incluye todas las fechas de la serie.</small>
          </div>

          <label className="campo-lbl">Notas
            <textarea className="campo" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="error">{aviso}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={aviso ? guardado : cerrar}>{aviso ? "Entendido" : "Cancelar"}</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Agendando…" : repite ? "Agendar serie y avisar" : "Agendar y avisar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
