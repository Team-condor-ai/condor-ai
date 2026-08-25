import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { EditorReunion } from "./EditorReunion";
import type { Reunion } from "./tipos";

/**
 * Reuniones del equipo.
 *
 * LA BASE DE DATOS YA EXISTÍA
 * ---------------------------------------------------------------------------
 * `reuniones`, `reuniones_admins` y la Edge Function `reunion-notificar`
 * (Telegram + correo con .ics adjunto) se construyeron en junio-2026 y nunca
 * tuvieron pantalla en el portal. Este módulo es esa pantalla — no se tocó
 * el esquema salvo por `meet_url`, que es lo único que faltaba.
 */

function cuando(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Reuniones() {
  const confirmar = useConfirmacion();
  const [filas, setFilas] = useState<Reunion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("reuniones")
      .select("*")
      .order("fecha_hora", { ascending: false });
    if (error) setError(error.message);
    else {
      setFilas((data ?? []) as Reunion[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Se separan por fecha, no por un campo de estado: una reunión "próxima" es
  // simplemente una cuya hora todavía no pasó. Guardar un estado aparte
  // obligaría a mantenerlo al día con un cron para nada.
  const { proximas, pasadas } = useMemo(() => {
    const ahora = Date.now();
    const p: Reunion[] = [];
    const q: Reunion[] = [];
    for (const r of filas) {
      (new Date(r.fecha_hora).getTime() >= ahora ? p : q).push(r);
    }
    p.sort((a, b) => +new Date(a.fecha_hora) - +new Date(b.fecha_hora));
    return { proximas: p, pasadas: q };
  }, [filas]);

  async function eliminar(r: Reunion) {
    if (!await confirmar(`¿Eliminar la reunión "${r.titulo}"?`, undefined, "Eliminar")) return;
    const { error } = await sb.from("reuniones").delete().eq("id", r.id);
    if (error) setError(error.message);
    else cargar();
  }

  function Tabla({ datos, vacio }: { datos: Reunion[]; vacio: string }) {
    if (datos.length === 0) return <p className="vacio">{vacio}</p>;
    return (
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
                <td>{cuando(r.fecha_hora)}</td>
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
                    title="Eliminar"
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
    );
  }

  return (
    <>
      <div className="barra">
        <h1>Reuniones</h1>
        {/* `meet.new` crea la sala al instante en la cuenta de Google con la
            que ya estés conectado — no necesita API, credenciales ni permisos
            de Calendar. Para una reunión "ahora mismo" es lo más directo. */}
        <a
          className="btn"
          href="https://meet.new"
          target="_blank"
          rel="noreferrer"
          title="Abre una sala de Google Meet al instante"
        >
          {Ico.video({ t: 15 })} Reunión instantánea
        </a>
        <button className="btn solido" onClick={() => setEditando(true)}>
          {Ico.mas({ t: 15 })} Agendar reunión
        </button>
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}
        {cargando && <p className="vacio">Cargando…</p>}

        {!cargando && (
          <>
            <section className="bloque">
              <h3>Próximas</h3>
              <Tabla datos={proximas} vacio="No hay reuniones agendadas." />
            </section>

            {pasadas.length > 0 && (
              <section className="bloque">
                <h3>Anteriores</h3>
                <Tabla datos={pasadas} vacio="" />
              </section>
            )}
          </>
        )}
      </div>

      {editando && (
        <EditorReunion
          cerrar={() => setEditando(false)}
          guardado={() => {
            setEditando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
