import { ResumenSemana, SeguimientoHoy } from "./PanelSemana";
import { useMiNombre } from "./personas";
import { useSesion } from "../auth/sesion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { useNombreUsuario } from "../auth/nombreUsuario";
import { Ico } from "../disenio/iconos";
import { ETAPAS_TABLERO, atrasoLead, dinero, diasEnEtapa, hace, nombreLead, type Lead } from "./leadsTipos";

type ReunionP = { id: string; titulo: string; fecha_hora: string; cliente: string | null; asistio: boolean | null; meet_url: string | null };
type CobroP = { id: string; titulo: string; monto: number; moneda: string; estado: string; tipo: string; proximo_cobro: string | null; cliente_id: string };
type TareaP = { id: string; titulo: string; estado: string; prioridad: string | null; vence: string | null };
type ClienteP = { id: string; negocio: string | null; nombre: string | null; telefono: string | null };
type ChatP = { cliente_id: string; negocio: string | null; nombre: string | null; ultimo_texto: string | null; ultimo_de_equipo: boolean | null; ultimo_en: string | null; sin_leer: number; pedidos_abiertos: number };
type ActividadP = { id: string; creado_en: string; quien: string; accion: string; modulo: string };

const cuando = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * El panel de arranque (24-oct-2026, rehecho desde cero).
 * Responde cuatro preguntas del día: ¿quién me escribió y no ha recibido respuesta? ¿qué reuniones vienen?
 * ¿qué falta por cobrar? ¿qué tareas vencen? Todo sale de las tablas vigentes (leads, reuniones, cobros, tareas).
 */
export function Dashboard() {
  const nombre = useNombreUsuario();
  const email = useSesion().email;
  const miApodo = useMiNombre(email);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reuniones, setReuniones] = useState<ReunionP[]>([]);
  const [cobros, setCobros] = useState<CobroP[]>([]);
  const [tareas, setTareas] = useState<TareaP[]>([]);
  const [clientes, setClientes] = useState<ClienteP[]>([]);
  const [chats, setChats] = useState<ChatP[]>([]);
  const [actividad, setActividad] = useState<ActividadP[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const desde = new Date(Date.now() - 4 * 86400000).toISOString();
    Promise.all([
      sb.from("leads").select("*").order("creado_en", { ascending: false }).limit(500),
      sb.from("reuniones").select("id,titulo,fecha_hora,cliente,asistio,meet_url").gte("fecha_hora", desde).order("fecha_hora").limit(60),
      sb.from("cobros").select("id,titulo,monto,moneda,estado,tipo,proximo_cobro,cliente_id").eq("estado", "pendiente").limit(100),
      sb.from("tareas").select("id,titulo,estado,prioridad,vence").neq("estado", "hecha").order("vence", { ascending: true, nullsFirst: false }).limit(40),
      sb.from("clientes").select("id,negocio,nombre,telefono").eq("archivado", false),
      sb.rpc("chat_bandeja"),
      sb.from("actividad_reciente").select("*").order("creado_en", { ascending: false }).limit(8),
    ]).then(([l, r, c, t, cl, so, ac]) => {
      setLeads((l.data ?? []) as Lead[]);
      setReuniones((r.data ?? []) as ReunionP[]);
      setCobros((c.data ?? []) as CobroP[]);
      setTareas((t.data ?? []) as TareaP[]);
      setClientes((cl.data ?? []) as ClienteP[]);
      setChats(((so.data ?? []) as ChatP[]).filter((x) => x.sin_leer > 0 || x.pedidos_abiertos > 0));
      setActividad((ac.data ?? []) as ActividadP[]);
      setCargando(false);
    });
  }, []);


  const hoy = new Date();
  const saludo = hoy.getHours() < 12 ? "Buenos días" : hoy.getHours() < 20 ? "Buenas tardes" : "Buenas noches";
  const fecha = hoy.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const reunPorId = useMemo(() => Object.fromEntries(reuniones.map((r) => [r.id, r])), [reuniones]);
  const abiertos = leads.filter((l) => !["ganado", "perdido", "sin_respuesta"].includes(l.etapa));
  const pidenAtencion = abiertos
    .map((l) => ({ l, motivo: atrasoLead(l, reunPorId[l.reunion_id ?? ""]) }))
    .filter((x) => x.motivo)
    .sort((a, b) => diasEnEtapa(b.l) - diasEnEtapa(a.l));
  const enJuego = abiertos.reduce((a, l) => a + (l.valor_estimado ?? 0), 0);
  const proximas = reuniones.filter((r) => new Date(r.fecha_hora).getTime() >= Date.now() - 90 * 60000);
  const proximas7 = proximas.filter((r) => new Date(r.fecha_hora).getTime() < Date.now() + 7 * 86400000);
  const porCobrarClp = cobros.filter((c) => c.moneda === "CLP").reduce((a, c) => a + c.monto, 0);
  const nombreCliente = (id: string) => { const c = clientes.find((x) => x.id === id); return c?.negocio || c?.nombre || "Cliente"; };
  // Fecha LOCAL (Chile): con toISOString un cobro que vence hoy salía «vencido» desde las 21:00.
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const telefonoDe = (id: string) => (clientes.find((x) => x.id === id)?.telefono ?? "").replace(/\D/g, "");
  const maxEtapa = Math.max(1, ...ETAPAS_TABLERO.map((e) => leads.filter((l) => l.etapa === e.id).length));

  if (cargando) return (<><div className="barra"><h1>Panel</h1></div><div className="cuerpo"><p className="vacio">Cargando…</p></div></>);

  return (
    <>
      <div className="barra">
        <div>
          <p className="rotulo-mini">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
          <h1>{nombre ? `${saludo}, ${nombre.split(" ")[0]}` : saludo}</h1>
        </div>
      </div>

      <div className="cuerpo dash">
        <div className="dash-kpis">
          <Link to="/acceso/leads" className="dash-kpi"><span>Leads abiertos</span><b>{abiertos.length}</b><small>{enJuego ? `${dinero(enJuego)} en juego` : "Sin valor estimado aún"}</small></Link>
          <Link to="/acceso/leads" className={`dash-kpi${pidenAtencion.length ? " alerta" : ""}`}><span>Piden atención</span><b>{pidenAtencion.length}</b><small>{pidenAtencion.length ? "Sin respuesta a tiempo" : "Todo al día"}</small></Link>
          <Link to="/acceso/organizacion/calendario" className="dash-kpi"><span>Reuniones · 7 días</span><b>{proximas7.length}</b><small>{proximas7[0] ? `Próxima: ${cuando(proximas7[0].fecha_hora)}` : "Ninguna agendada"}</small></Link>
          <Link to="/acceso/contabilidad?tab=cobros" className="dash-kpi"><span>Por cobrar</span><b>{dinero(porCobrarClp)}</b><small>{cobros.length} cobro{cobros.length === 1 ? "" : "s"} pendiente{cobros.length === 1 ? "" : "s"}</small></Link>
        </div>

        <SeguimientoHoy leads={leads} miApodo={miApodo} email={email} onCambio={(id, c) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...c } : l)))} />
        <ResumenSemana />

        <section className="dash-card">
          <header><h2>Embudo de leads</h2><Link to="/acceso/leads">Abrir tablero {Ico.galon({ t: 12 })}</Link></header>
          <div className="dash-embudo">
            {ETAPAS_TABLERO.map((e) => {
              const n = leads.filter((l) => l.etapa === e.id).length;
              return (
                <Link key={e.id} to="/acceso/leads" className="dash-paso" data-etapa={e.id}>
                  <b>{n}</b><span>{e.texto}</span>
                  <i style={{ width: `${Math.max(6, (n / maxEtapa) * 100)}%` }} />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="dash-dos">
          <section className="dash-card">
            <header><h2>Piden atención</h2><Link to="/acceso/leads">Ver leads {Ico.galon({ t: 12 })}</Link></header>
            {pidenAtencion.length === 0 ? <p className="dash-vacio">Nadie espera respuesta. Buen trabajo.</p> : (
              <ul className="dash-lista">
                {pidenAtencion.slice(0, 6).map(({ l, motivo }) => (
                  <li key={l.id}><Link to="/acceso/leads"><div><b>{nombreLead(l)}</b><small>{l.tipo ? l.tipo + " · " : ""}{hace(diasEnEtapa(l))} en esta etapa</small></div><span className="dash-sello">{motivo}</span></Link></li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <header><h2>Próximas reuniones</h2><Link to="/acceso/organizacion/calendario">Calendario {Ico.galon({ t: 12 })}</Link></header>
            {proximas.length === 0 ? <p className="dash-vacio">No hay reuniones agendadas.</p> : (
              <ul className="dash-lista">
                {proximas.slice(0, 6).map((r) => (
                  <li key={r.id}><a href={r.meet_url || "/acceso/organizacion/calendario"} target={r.meet_url ? "_blank" : undefined} rel="noreferrer"><div><b>{r.titulo}</b><small>{cuando(r.fecha_hora)}{r.cliente ? ` · ${r.cliente}` : ""}</small></div>{r.meet_url && <span className="dash-sello azul">Entrar</span>}</a></li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <header><h2>Por cobrar</h2><Link to="/acceso/contabilidad?tab=cobros">Cobros {Ico.galon({ t: 12 })}</Link></header>
            {cobros.length === 0 ? <p className="dash-vacio">No hay cobros pendientes.</p> : (
              <ul className="dash-lista">
                {cobros.slice(0, 6).map((c) => (
                  <li key={c.id}><Link to={`/acceso/clientes?ver=${c.cliente_id}`}><div><b>{nombreCliente(c.cliente_id)}</b><small>{c.titulo}{c.tipo === "mensual" ? " · mensual" : ""}{c.proximo_cobro ? ` · ${c.proximo_cobro < hoyIso ? "venció" : "vence"} ${new Date(c.proximo_cobro + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}` : ""}</small></div>{c.proximo_cobro && c.proximo_cobro < hoyIso && <span className="dash-sello">Vencido</span>}<span className="dash-monto">{c.moneda === "CLP" ? dinero(c.monto) : `${c.monto.toLocaleString("es-CL")} ${c.moneda}`}</span></Link>{telefonoDe(c.cliente_id) && <a className="dash-recordar" target="_blank" rel="noreferrer" title="Recordarle por WhatsApp" href={`https://wa.me/${telefonoDe(c.cliente_id)}?text=${encodeURIComponent(`Hola, te escribo de Cóndor. Te recuerdo que está pendiente: ${c.titulo}. Cualquier duda, me avisas.`)}`}>{Ico.chat({ t: 15 })}</a>}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <header><h2>Mensajes de clientes</h2><Link to="/acceso/chat">Chat {Ico.galon({ t: 12 })}</Link></header>
            {chats.length === 0 ? <p className="dash-vacio">Ningún cliente espera respuesta.</p> : (
              <ul className="dash-lista">
                {chats.slice(0, 6).map((x) => (
                  <li key={x.cliente_id}><Link to={`/acceso/chat?c=${x.cliente_id}`}><div><b>{x.negocio || x.nombre || "Cliente"}</b><small>{x.ultimo_de_equipo ? "Tú: " : ""}{x.ultimo_texto ?? ""}</small></div>{x.sin_leer > 0 ? <span className="dash-sello">{x.sin_leer} sin leer</span> : <span className="dash-sello azul">{x.pedidos_abiertos} pedido{x.pedidos_abiertos === 1 ? "" : "s"}</span>}</Link></li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <header><h2>Tareas</h2><Link to="/acceso/organizacion/tablero">Tablero {Ico.galon({ t: 12 })}</Link></header>
            {tareas.length === 0 ? <p className="dash-vacio">No hay tareas pendientes.</p> : (
              <ul className="dash-lista">
                {tareas.slice(0, 6).map((t) => (
                  <li key={t.id}><Link to="/acceso/organizacion/tablero"><div><b>{t.titulo}</b><small>{t.vence ? `Vence ${new Date(t.vence + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}` : "Sin fecha"}</small></div>{t.vence && t.vence < hoyIso && <span className="dash-sello">Vencida</span>}</Link></li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="dash-card">
          <header><h2>Actividad reciente</h2></header>
          {actividad.length === 0 ? <p className="dash-vacio">Todavía no hay movimientos.</p> : (
            <ul className="dash-actividad">
              {actividad.map((a) => (
                <li key={a.id}><span className={`dash-punto m-${a.modulo}`} aria-hidden="true" /><p><b>{a.quien.split("@")[0]}</b> {a.accion}</p><small>{new Date(a.creado_en).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
