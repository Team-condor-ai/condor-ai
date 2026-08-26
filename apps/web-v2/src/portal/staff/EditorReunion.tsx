import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import type { Cliente, PerfilAdmin, Reunion } from "./tipos";

type Props = {
  cerrar: () => void;
  guardado: () => void;
  /** Presente = se edita una reunión ya agendada. Ausente = se agenda una nueva. */
  existente?: Reunion | null;
};
type ReglaSemanal = { dia: number; hora: string };
/** Qué se toca cuando la reunión pertenece a una serie semanal. */
type Alcance = "una" | "serie";

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

function horaLocal(fecha: Date) {
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
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

/**
 * Agenda una reunión nueva (única o serie semanal) o edita una ya agendada.
 *
 * POR QUÉ UN SOLO COMPONENTE Y NO DOS
 * ---------------------------------------------------------------------------
 * Los campos son exactamente los mismos y el aviso por correo también. Dos
 * archivos significaba que agregar un campo —el link de la videollamada, por
 * ejemplo— había que acordarse de hacerlo dos veces. Lo único que cambia entre
 * los dos modos es la recurrencia: una reunión que ya existe no se convierte
 * en serie desde acá (habría que decidir qué pasa con las ocurrencias viejas),
 * así que ese bloque solo aparece al crear.
 */
export function EditorReunion({ cerrar, guardado, existente = null }: Props) {
  const editando = Boolean(existente);
  const hoy = useMemo(() => fechaLocal(), []);
  const inicio = useMemo(
    () => (existente ? new Date(existente.fecha_hora) : null),
    [existente],
  );

  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? "");
  const [fecha, setFecha] = useState(inicio ? fechaLocal(inicio) : hoy);
  const [hora, setHora] = useState(inicio ? horaLocal(inicio) : "09:00");
  const [duracion, setDuracion] = useState(existente?.duracion_min ?? 60);
  const [cliente, setCliente] = useState(existente?.cliente ?? "");
  const [meetUrl, setMeetUrl] = useState(existente?.meet_url ?? "");
  const [contacto, setContacto] = useState(existente?.contacto ?? "");
  const [emailExterno, setEmailExterno] = useState(existente?.email ?? "");
  const [invitados, setInvitados] = useState<string[]>([]);
  const [repite, setRepite] = useState(false);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(() => sumarMeses(hoy, 3));
  const [reglas, setReglas] = useState<ReglaSemanal[]>([{ dia: 1, hora: "09:00" }]);
  const [alcance, setAlcance] = useState<Alcance>("una");
  /* Al editar, avisar es opt-in: mover una reunión de sala no justifica un
     correo a cinco personas, pero cambiar la hora sí. Lo decide quien edita. */
  const [avisar, setAvisar] = useState(!editando);
  const [equipo, setEquipo] = useState<PerfilAdmin[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [cargandoInvitados, setCargandoInvitados] = useState(editando);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    sb.from("admin_profiles").select("id,email,nombre").order("nombre")
      .then(({ data }) => setEquipo((data ?? []) as PerfilAdmin[]));
    sb.from("clientes").select("*").order("negocio")
      .then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, []);

  /* Los invitados no viven en `reuniones` sino en la tabla puente, así que hay
     que ir a buscarlos aparte para poder mostrarlos ya marcados. */
  useEffect(() => {
    if (!existente) return;
    let vivo = true;
    sb.from("reuniones_admins").select("admin_id").eq("reunion_id", existente.id)
      .then(({ data }) => {
        if (!vivo) return;
        setInvitados((data ?? []).map((fila) => String(fila.admin_id)));
        setCargandoInvitados(false);
      });
    return () => { vivo = false; };
  }, [existente]);

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

  const elegidos = equipo.filter((p) => invitados.includes(p.id));
  /* El invitado externo (el cliente que reservó desde la web) no está en
     `admin_profiles`: viaja aparte pero recibe el mismo correo con el .ics. */
  const destinatarios = [
    ...elegidos.map((p) => ({ nombre: p.nombre, email: p.email })),
    ...(emailExterno.trim()
      ? [{ nombre: contacto.trim() || cliente.trim() || "Invitado", email: emailExterno.trim() }]
      : []),
  ];

  async function notificar(cuerpo: Record<string, unknown>) {
    const { error: errAviso } = await sb.functions.invoke("reunion-notificar", { body: cuerpo });
    if (errAviso) throw new Error(errAviso.message);
  }

  async function sincronizarInvitados(reunionIds: string[]) {
    const { error: errBorrar } = await sb
      .from("reuniones_admins").delete().in("reunion_id", reunionIds);
    if (errBorrar) throw new Error(errBorrar.message);
    if (!invitados.length) return;
    const filas = reunionIds.flatMap((reunion_id) =>
      invitados.map((admin_id) => ({ reunion_id, admin_id })));
    const { error: errInsertar } = await sb.from("reuniones_admins").insert(filas);
    if (errInsertar) throw new Error(errInsertar.message);
  }

  async function actualizar() {
    if (!existente) return;
    let advertencia = "";
    const fechaHora = fechaHoraISO(fecha, hora);
    const comunes = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      duracion_min: duracion,
      cliente: cliente.trim() || null,
      meet_url: meetUrl.trim() || null,
      contacto: contacto.trim() || null,
      email: emailExterno.trim() || null,
    };

    // La fecha y la hora pertenecen a ESTA ocurrencia. Propagarlas a la serie
    // apilaría las doce reuniones del trimestre en el mismo instante.
    const { error: errUno } = await sb.from("reuniones")
      .update({ ...comunes, fecha_hora: fechaHora }).eq("id", existente.id);
    if (errUno) throw new Error(errUno.message);

    let afectadas = [existente.id];
    if (alcance === "serie" && existente.serie_id) {
      const { error: errSerie } = await sb.from("reuniones")
        .update(comunes)
        .eq("serie_id", existente.serie_id)
        .neq("id", existente.id);
      if (errSerie) throw new Error(errSerie.message);
      const { data: hermanas } = await sb.from("reuniones")
        .select("id").eq("serie_id", existente.serie_id);
      afectadas = (hermanas ?? []).map((r) => String(r.id));
    }

    try {
      await sincronizarInvitados(afectadas);
    } catch (fallo) {
      advertencia = `Reunión actualizada, pero los invitados fallaron: ${
        fallo instanceof Error ? fallo.message : "error desconocido"}`;
    }

    if (avisar && destinatarios.length) {
      try {
        await notificar({
          motivo: "actualizada",
          titulo: comunes.titulo,
          descripcion: comunes.descripcion ?? "",
          fecha_hora: fechaHora,
          ocurrencias: [fechaHora],
          duracion_min: duracion,
          cliente: comunes.cliente ?? "",
          meet_url: comunes.meet_url ?? "",
          invitados: destinatarios.map((d) => d.nombre),
          invitados_email: destinatarios,
        });
      } catch {
        advertencia ||= "Cambios guardados, pero no se pudo enviar el aviso por correo/Telegram.";
      }
    }
    return advertencia;
  }

  async function crear() {
    let advertencia = "";
    if (repite && !reglas.length) throw new Error("Selecciona al menos un día para la reunión recurrente.");
    if (repite && hasta < desde) throw new Error("La fecha final debe ser igual o posterior a la fecha inicial.");

    const ocurrencias = repite
      ? crearOcurrencias(desde, hasta, reglas)
      : [fechaHoraISO(fecha, hora)];
    if (!ocurrencias.length) throw new Error("No hay días seleccionados dentro del rango indicado.");
    if (ocurrencias.length >= 200) throw new Error("La serie alcanza el límite de 200 reuniones. Acorta el rango.");

    const { data: sesion } = await sb.auth.getUser();
    const yo = sesion?.user?.id;
    if (!yo) throw new Error("Tu sesión expiró. Vuelve a entrar para agendar la reunión.");

    const serieId = repite ? crypto.randomUUID() : null;
    const base = {
      titulo: titulo.trim(), descripcion: descripcion.trim() || null,
      duracion_min: duracion, cliente: cliente.trim() || null,
      meet_url: meetUrl.trim() || null, creado_por: yo,
      contacto: contacto.trim() || null, email: emailExterno.trim() || null,
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
      throw new Error(errCrear?.message ?? "No se pudo guardar la reunión.");
    }

    if (invitados.length) {
      const participantes = creadas.flatMap((reunion) =>
        invitados.map((admin_id) => ({ reunion_id: reunion.id, admin_id })));
      const { error: errInv } = await sb.from("reuniones_admins").insert(participantes);
      if (errInv) advertencia = `Reunión guardada, pero los invitados fallaron: ${errInv.message}`;
    }

    if (avisar && destinatarios.length) {
      try {
        await notificar({
          motivo: "nueva",
          titulo: titulo.trim(), descripcion: descripcion.trim(),
          fecha_hora: ocurrencias[0], ocurrencias,
          resumen_recurrencia: repite
            ? `Todos los ${resumenRecurrencia}, desde ${desde} hasta ${hasta}` : "",
          duracion_min: duracion, cliente: cliente.trim(),
          meet_url: meetUrl.trim(),
          invitados: destinatarios.map((d) => d.nombre),
          invitados_email: destinatarios,
        });
      } catch {
        advertencia ||= "Reunión guardada, pero no se pudo enviar el aviso por correo/Telegram.";
      }
    }
    return advertencia;
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const advertencia = editando ? await actualizar() : await crear();
      setGuardando(false);
      if (advertencia) setAviso(advertencia);
      else guardado();
    } catch (fallo) {
      setGuardando(false);
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar la reunión.");
    }
  }

  const textoBoton = editando
    ? guardando ? "Guardando…" : avisar ? "Guardar y avisar" : "Guardar cambios"
    : guardando ? "Agendando…" : repite ? "Agendar serie y avisar" : "Agendar y avisar";

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal panel-reunion" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <div>
            <h2>{editando ? "Editar reunión" : "Agendar reunión"}</h2>
            <small>Hora local de Santiago</small>
          </div>
        </header>
        <div className="contenido">
          <label className="campo-lbl">Título
            <input className="campo" autoFocus required placeholder="Kickoff Bárbara — cliente nuevo"
              value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>

          {!editando && (
            <div className="selector-recurrencia" aria-label="Frecuencia de la reunión">
              <button type="button" className={!repite ? "activo" : ""} onClick={() => setRepite(false)}>Una vez</button>
              <button type="button" className={repite ? "activo" : ""} onClick={() => setRepite(true)}>Se repite</button>
            </div>
          )}

          {editando && existente?.serie_id && (
            <div className="selector-recurrencia" aria-label="Alcance del cambio">
              <button type="button" className={alcance === "una" ? "activo" : ""}
                onClick={() => setAlcance("una")}>Solo esta</button>
              <button type="button" className={alcance === "serie" ? "activo" : ""}
                onClick={() => setAlcance("serie")}>Toda la serie</button>
            </div>
          )}

          {!repite || editando ? (
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

          {editando && alcance === "serie" && (
            <p className="resumen-serie">
              El título, las notas, la duración, el cliente y el link se aplican a
              toda la serie. La fecha y la hora solo cambian en esta reunión.
            </p>
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
            <small>¿No tienes uno? Abre <a href="https://meet.new" target="_blank" rel="noreferrer">meet.new</a> y pega acá el link. Va dentro del correo, no solo en el portal.</small>
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
            {cargandoInvitados && <small className="ayuda-invitados">Cargando los invitados actuales…</small>}
          </div>

          <div className="dos">
            <label className="campo-lbl">Invitado externo (opcional)
              <input className="campo" placeholder="Nombre del cliente"
                value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </label>
            <label className="campo-lbl">Su correo
              <input className="campo" type="email" placeholder="cliente@empresa.cl"
                value={emailExterno} onChange={(e) => setEmailExterno(e.target.value)} />
            </label>
          </div>

          <label className="campo-lbl">Notas
            <textarea className="campo" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>

          <label className="linea-check">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
            <span>
              {editando ? "Reenviar el correo con los cambios" : "Avisar por correo y Telegram"}
              <small>
                {destinatarios.length
                  ? `${destinatarios.length} destinatario${destinatarios.length === 1 ? "" : "s"}: ${destinatarios.map((d) => d.nombre).join(", ")}`
                  : "Elige invitados o escribe un correo externo para poder avisar."}
              </small>
            </span>
          </label>

          {error && <p className="error">{error}</p>}
          {aviso && <p className="error">{aviso}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={aviso ? guardado : cerrar}>{aviso ? "Entendido" : "Cancelar"}</button>
          <button className="btn solido" disabled={guardando}>{textoBoton}</button>
        </footer>
      </form>
    </div>
  );
}
