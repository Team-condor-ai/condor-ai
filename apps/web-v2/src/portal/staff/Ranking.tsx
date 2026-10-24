import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { iniciales, tono, useEquipo } from "./personas";

type Fila = {
  email: string; nombre: string;
  leads_avanzados: number; leads_ganados: number; contactos: number; tareas: number;
  lecciones: number; cursos: number; minutos: number; dias: number; puntos: number;
};
type Periodo = "semana" | "mes" | "todo";

/** Cuánto vale cada cosa. Tiene que calzar con `ranking_equipo()` en la base (migración 20261024d). */
const PUNTOS: { clave: keyof Fila; texto: string; vale: number }[] = [
  { clave: "leads_ganados", texto: "Lead ganado", vale: 50 },
  { clave: "cursos", texto: "Curso terminado", vale: 25 },
  { clave: "leads_avanzados", texto: "Lead avanzado de etapa", vale: 10 },
  { clave: "tareas", texto: "Tarea hecha", vale: 5 },
  { clave: "lecciones", texto: "Lección vista", vale: 4 },
  { clave: "contactos", texto: "Nota, llamada o WhatsApp registrado", vale: 3 },
  { clave: "dias", texto: "Día con actividad", vale: 2 },
];

/** Lunes de esta semana a las 00:00 (hora de Chile = hora del navegador del equipo). */
function desdeDe(p: Periodo): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (p === "mes") d.setDate(1);
  else return "-infinity";
  return d.toISOString();
}

/**
 * Ranking del equipo (24-oct-2026, pedido de Max). Todo sale de lo que ya registra el portal:
 * cambios de etapa y notas de los leads (`lead_eventos.autor`), tareas hechas (`tareas.asignados`) y los
 * cursos (`curso_progreso`, `curso_avance`). El cálculo vive en la base (`ranking_equipo`), así nadie lo
 * puede inflar desde el navegador.
 */
export function Ranking() {
  const yo = useSesion().email?.toLowerCase();
  const equipo = useEquipo();
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void sb.rpc("ranking_equipo", { desde: desdeDe(periodo) }).then(({ data, error: e }) => {
      if (!vivo) return;
      setError(e ? "No se pudo cargar el ranking: " + e.message : "");
      setFilas((data ?? []) as Fila[]);
    });
    return () => { vivo = false; };
  }, [periodo]);

  const foto = (email: string) => equipo.find((p) => p.email === email)?.foto;
  const cara = (f: Fila, grande = false) => {
    const src = foto(f.email);
    return <span className={`rk-cara${grande ? " grande" : ""}`} style={{ background: src ? undefined : tono(f.email) }}>{src ? <img src={src} alt="" /> : iniciales(f.nombre)}</span>;
  };
  const max = Math.max(1, ...(filas ?? []).map((f) => f.puntos));
  const podio = (filas ?? []).filter((f) => f.puntos > 0).slice(0, 3);
  const nadie = filas !== null && filas.every((f) => f.puntos === 0);

  return (
    <>
      <div className="barra">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>{Ico.trofeo({ t: 26 })} Ranking del equipo</h1>
        <div className="rk-periodos" role="tablist">
          {(["semana", "mes", "todo"] as Periodo[]).map((p) => (
            <button key={p} role="tab" aria-selected={periodo === p} className={periodo === p ? "on" : ""} onClick={() => setPeriodo(p)}>
              {p === "semana" ? "Esta semana" : p === "mes" ? "Este mes" : "Desde siempre"}
            </button>
          ))}
        </div>
      </div>

      <div className="cuerpo">
        {error && <p className="aviso-error">{error}</p>}
        {filas === null ? <p className="vacio">Cargando…</p> : (
          <>
            {nadie ? (
              <div className="bv-vacio"><b>Todavía no hay puntos {periodo === "semana" ? "esta semana" : periodo === "mes" ? "este mes" : ""}</b><span>Mueve un lead de etapa, termina una tarea o mira una lección y apareces acá.</span></div>
            ) : (
              <div className="rk-podio">
                {[1, 0, 2].map((i) => !podio[i] ? <div key={i} aria-hidden="true" /> : (
                  <div key={podio[i].email} className={`rk-lugar l${i + 1}${podio[i].email === yo ? " yo" : ""}`}>
                    <span className="rk-medalla">{i + 1}</span>
                    {cara(podio[i], true)}
                    <b>{podio[i].nombre}</b>
                    <span className="rk-pts">{podio[i].puntos.toLocaleString("es-CL")} pts</span>
                    <span className="rk-pedestal" />
                  </div>
                ))}
              </div>
            )}

            <div className="tabla-caja rk-tabla">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Persona</th><th className="num">Puntos</th>
                    <th className="num" title="Leads que movió a una etapa más adelante">Avanzados</th>
                    <th className="num">Ganados</th>
                    <th className="num" title="Notas, llamadas, WhatsApp y reuniones registradas en los leads">Contactos</th>
                    <th className="num">Tareas</th>
                    <th className="num">Lecciones</th>
                    <th className="num">Cursos</th>
                    <th className="num" title="Minutos de video de cursos">Min. curso</th>
                    <th className="num" title="Días con alguna actividad">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.email} className={f.email === yo ? "rk-yo" : ""}>
                      <td className="rk-n">{i + 1}</td>
                      <td><span className="rk-persona">{cara(f)}<b>{f.nombre}</b>{f.email === yo && <em>tú</em>}</span></td>
                      <td className="num"><span className="rk-barra"><i style={{ width: `${(f.puntos / max) * 100}%` }} /></span><b>{f.puntos.toLocaleString("es-CL")}</b></td>
                      <td className="num">{f.leads_avanzados || "—"}</td>
                      <td className="num">{f.leads_ganados || "—"}</td>
                      <td className="num">{f.contactos || "—"}</td>
                      <td className="num">{f.tareas || "—"}</td>
                      <td className="num">{f.lecciones || "—"}</td>
                      <td className="num">{f.cursos || "—"}</td>
                      <td className="num">{f.minutos || "—"}</td>
                      <td className="num">{f.dias || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="rk-reglas">
              <summary>Cómo se ganan los puntos</summary>
              <ul>{PUNTOS.map((p) => <li key={p.clave}><span>{p.texto}</span><b>+{p.vale}</b></li>)}</ul>
              <p className="conteo">Cuenta lo que cada uno hace con su sesión en el portal: mover leads, registrar contactos, cerrar tareas (las que tiene asignadas) y avanzar en los cursos de la Biblioteca.</p>
            </details>
          </>
        )}
      </div>
    </>
  );
}
