import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { dinero, nombreLead, type Lead } from "./leadsTipos";
import { hoyLocal } from "./personas";

const CERRADAS = ["ganado", "perdido", "sin_respuesta"];
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return hoyLocal(d); };
const corta = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });

/**
 * «Tu seguimiento de hoy» (24-oct-2026): los leads que me tocan hoy o que ya se me pasaron, según su próxima
 * acción. Es lo que más mueve los cierres: un lead se pierde porque nadie le volvió a escribir a tiempo.
 * Toma los leads con responsable = mi apodo; los sin responsable aparecen aparte para que alguien los tome.
 * «Hecho» deja una nota en el lead (suma en el ranking como contacto) y corre la próxima acción.
 */
export function SeguimientoHoy({ leads, miApodo, email, onCambio }: {
  leads: Lead[]; miApodo: string | null; email: string | null; onCambio: (id: number, cambios: Partial<Lead>) => void;
}) {
  const hoy = hoyLocal();
  const abiertos = leads.filter((l) => !CERRADAS.includes(l.etapa));
  const mios = abiertos.filter((l) => miApodo && l.responsable === miApodo);
  const tocan = mios.filter((l) => l.proxima_accion_en && l.proxima_accion_en <= hoy).sort((a, b) => (a.proxima_accion_en ?? "").localeCompare(b.proxima_accion_en ?? ""));
  const sinAccion = mios.filter((l) => !l.proxima_accion_en).length;
  const sinDueno = abiertos.filter((l) => !l.responsable).length;
  const [ocupado, setOcupado] = useState<number | null>(null);

  async function hecho(l: Lead, dias: number) {
    setOcupado(l.id);
    const proxima = masDias(dias);
    await sb.from("lead_eventos").insert({ lead_id: l.id, tipo: "nota", texto: `Seguimiento hecho: ${l.proxima_accion || "contacto"}. Próximo: ${corta(proxima)}.`, autor: email });
    const { error } = await sb.from("leads").update({ proxima_accion_en: proxima }).eq("id", l.id);
    if (!error) onCambio(l.id, { proxima_accion_en: proxima });
    setOcupado(null);
  }

  if (!miApodo) return null;
  return (
    <section className="dash-card seg-hoy">
      <header>
        <h2>Tu seguimiento de hoy</h2>
        <Link to="/acceso/leads">Mis leads {Ico.galon({ t: 12 })}</Link>
      </header>
      {tocan.length === 0 ? (
        <p className="dash-vacio">{mios.length ? "No te toca ningún seguimiento hoy. 🙌" : "Todavía no tienes leads asignados."}</p>
      ) : (
        <ul className="seg-lista">
          {tocan.map((l) => {
            const vencido = (l.proxima_accion_en ?? "") < hoy;
            const tel = (l.whatsapp ?? "").replace(/\D/g, "");
            return (
              <li key={l.id} className={vencido ? "vencido" : ""}>
                <Link to={`/acceso/leads?lead=${l.id}`} className="seg-quien">
                  <b>{nombreLead(l)}</b>
                  <small>{l.proxima_accion || "Hacer seguimiento"} · {vencido ? `venció el ${corta(l.proxima_accion_en!)}` : "hoy"}{l.valor_estimado ? ` · ${dinero(l.valor_estimado)}` : ""}</small>
                </Link>
                <span className="seg-acc">
                  {tel && <a className="btn chico" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" title="Escribirle por WhatsApp">{Ico.chat({ t: 14 })}</a>}
                  <button className="btn chico" disabled={ocupado === l.id} onClick={() => void hecho(l, 1)} title="Listo; vuelve a aparecer mañana">Hecho · mañana</button>
                  <button className="btn chico" disabled={ocupado === l.id} onClick={() => void hecho(l, 3)} title="Listo; vuelve a aparecer en 3 días">+3 días</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {(sinAccion > 0 || sinDueno > 0) && (
        <p className="seg-avisos">
          {sinAccion > 0 && <Link to="/acceso/leads">{sinAccion} lead{sinAccion === 1 ? "" : "s"} tuyo{sinAccion === 1 ? "" : "s"} sin próxima acción</Link>}
          {sinDueno > 0 && <Link to="/acceso/leads">{sinDueno} lead{sinDueno === 1 ? "" : "s"} sin responsable</Link>}
        </p>
      )}
    </section>
  );
}

type Semana = {
  top: { nombre: string; puntos: number }[];
  nuevos: number; ganados: number; valorGanado: number;
  vencidos: { n: number; monto: number }; tareasAtrasadas: number; solicitudes: number; lecciones: number;
};

/** Lunes 00:00 de esta semana (hora local). */
function lunes() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

/**
 * El resumen de la semana del equipo (24-oct-2026). Lo que antes se pensaba mandar por Telegram los lunes,
 * vive acá: quién va primero, cuánto se cerró, qué plata está vencida, qué tareas se atrasaron.
 */
export function ResumenSemana() {
  const [s, setS] = useState<Semana | null>(null);
  useEffect(() => {
    const desde = lunes().toISOString(), hoy = hoyLocal();
    void Promise.all([
      sb.rpc("ranking_equipo", { desde }),
      sb.from("leads").select("id", { count: "exact", head: true }).gte("creado_en", desde),
      sb.from("leads").select("valor_estimado").eq("etapa", "ganado").gte("etapa_en", desde),
      sb.from("cobros").select("monto,moneda").eq("estado", "pendiente").lt("proximo_cobro", hoy),
      sb.from("tareas").select("id", { count: "exact", head: true }).neq("estado", "hecha").lt("vence", hoy),
      sb.from("chat_mensajes").select("id", { count: "exact", head: true }).in("pedido_estado", ["nueva", "en_curso"]),
      sb.from("curso_progreso").select("leccion_id", { count: "exact", head: true }).gte("hecha_en", desde),
    ]).then(([r, nu, ga, co, ta, so, le]) => {
      const vencidos = (co.data ?? []) as { monto: number; moneda: string }[];
      setS({
        top: ((r.data ?? []) as { nombre: string; puntos: number }[]).filter((x) => x.puntos > 0).slice(0, 3),
        nuevos: nu.count ?? 0,
        ganados: (ga.data ?? []).length,
        valorGanado: (ga.data ?? []).reduce((a: number, x: { valor_estimado: number | null }) => a + (x.valor_estimado ?? 0), 0),
        vencidos: { n: vencidos.length, monto: vencidos.filter((c) => c.moneda === "CLP").reduce((a, c) => a + c.monto, 0) },
        tareasAtrasadas: ta.count ?? 0, solicitudes: so.count ?? 0, lecciones: le.count ?? 0,
      });
    });
  }, []);
  if (!s) return null;
  const medallas = ["🥇", "🥈", "🥉"];
  return (
    <section className="dash-card semana">
      <header><h2>Así va la semana</h2><Link to="/acceso/ranking">Ranking {Ico.galon({ t: 12 })}</Link></header>
      <div className="semana-cuerpo">
        <div className="semana-podio">
          {s.top.length === 0 ? <p className="dash-vacio">Nadie suma puntos todavía esta semana.</p> : s.top.map((p, i) => (
            <span key={p.nombre}><em>{medallas[i]}</em><b>{p.nombre}</b><small>{p.puntos} pts</small></span>
          ))}
        </div>
        <div className="semana-cifras">
          <Link to="/acceso/leads"><b>{s.nuevos}</b><span>leads nuevos</span></Link>
          <Link to="/acceso/leads"><b>{s.ganados}</b><span>ganados{s.valorGanado ? ` · ${dinero(s.valorGanado)}` : ""}</span></Link>
          <Link to="/acceso/contabilidad?tab=cobros" className={s.vencidos.n ? "mal" : ""}><b>{s.vencidos.n}</b><span>cobros vencidos{s.vencidos.monto ? ` · ${dinero(s.vencidos.monto)}` : ""}</span></Link>
          <Link to="/acceso/organizacion/tablero" className={s.tareasAtrasadas ? "mal" : ""}><b>{s.tareasAtrasadas}</b><span>tareas atrasadas</span></Link>
          <Link to="/acceso/chat" className={s.solicitudes ? "ojo" : ""}><b>{s.solicitudes}</b><span>pedidos de clientes abiertos</span></Link>
          <Link to="/acceso/biblioteca"><b>{s.lecciones}</b><span>lecciones vistas</span></Link>
        </div>
      </div>
    </section>
  );
}
