import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import type { Cliente, PerfilAdmin } from "./tipos";

type Props = {
  cerrar: () => void;
  guardado: () => void;
};

const DURACIONES = [15, 30, 45, 60, 90, 120];

/**
 * Agendar una reunión del equipo.
 *
 * Guarda en `reuniones` + `reuniones_admins` y después llama a la Edge
 * Function `reunion-notificar`, que avisa por Telegram y manda a cada
 * invitado un correo con el botón de Google Calendar y el .ics adjunto.
 *
 * EL AVISO NO PUEDE VOLTEAR EL GUARDADO
 * ---------------------------------------------------------------------------
 * Si Telegram o Resend fallan (secrets sin configurar, API caída), la reunión
 * YA quedó guardada y visible para todo el equipo. Por eso el error de la
 * notificación se muestra como advertencia y no como fallo: perder la reunión
 * porque no salió un correo sería mucho peor que avisar a mano.
 */
export function EditorReunion({ cerrar, guardado }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [cliente, setCliente] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [invitados, setInvitados] = useState<string[]>([]);

  const [equipo, setEquipo] = useState<PerfilAdmin[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    sb.from("admin_profiles")
      .select("id,email,nombre")
      .order("nombre")
      .then(({ data }) => setEquipo((data ?? []) as PerfilAdmin[]));
    sb.from("clientes")
      .select("*")
      .order("negocio")
      .then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, []);

  function alternar(id: string) {
    setInvitados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");
    setAviso("");

    const { data: sesion } = await sb.auth.getUser();
    const yo = sesion?.user?.id;

    const { data: creada, error: errCrear } = await sb
      .from("reuniones")
      .insert({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        fecha_hora: new Date(fecha).toISOString(),
        duracion_min: duracion,
        cliente: cliente.trim() || null,
        meet_url: meetUrl.trim() || null,
        creado_por: yo,
      })
      .select()
      .single();

    if (errCrear || !creada) {
      setGuardando(false);
      setError(errCrear?.message ?? "No se pudo guardar la reunión.");
      return;
    }

    if (invitados.length) {
      const { error: errInv } = await sb.from("reuniones_admins").insert(
        invitados.map((admin_id) => ({ reunion_id: creada.id, admin_id })),
      );
      if (errInv) setAviso(`Reunión guardada, pero los invitados fallaron: ${errInv.message}`);
    }

    const elegidos = equipo.filter((p) => invitados.includes(p.id));
    try {
      const { error: errAviso } = await sb.functions.invoke("reunion-notificar", {
        body: {
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          fecha_hora: new Date(fecha).toISOString(),
          duracion_min: duracion,
          cliente: cliente.trim(),
          invitados: elegidos.map((p) => p.nombre),
          invitados_email: elegidos.map((p) => ({ nombre: p.nombre, email: p.email })),
        },
      });
      if (errAviso) {
        setAviso("Reunión guardada, pero no se pudo enviar el aviso por correo/Telegram.");
      }
    } catch {
      setAviso("Reunión guardada, pero no se pudo enviar el aviso por correo/Telegram.");
    }

    setGuardando(false);
    if (!aviso) guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Agendar reunión</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Título
            <input
              className="campo"
              required
              placeholder="Kickoff Bárbara — cliente nuevo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Fecha y hora
              <input
                className="campo"
                type="datetime-local"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="campo-lbl">
              Duración
              <select
                className="campo"
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
              >
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="campo-lbl">
            Cliente (opcional)
            <input
              className="campo"
              list="lista-clientes"
              placeholder="Negocio al que corresponde"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
            <datalist id="lista-clientes">
              {clientes.map((c) => (
                <option key={c.id} value={c.negocio ?? c.email} />
              ))}
            </datalist>
          </label>

          <label className="campo-lbl">
            Link de la videollamada (opcional)
            <input
              className="campo"
              placeholder="https://meet.google.com/…"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
            />
            <small>
              ¿No tienes uno? Abre{" "}
              <a href="https://meet.new" target="_blank" rel="noreferrer">
                meet.new
              </a>{" "}
              y pega acá el link que te dé.
            </small>
          </label>

          <div>
            <label className="campo-lbl">Invitados del equipo</label>
            {equipo.length === 0 ? (
              <p className="conteo">
                Todavía no hay perfiles del equipo. Cada uno aparece acá la primera vez
                que entra al portal.
              </p>
            ) : (
              <div className="chips" style={{ marginTop: 8 }}>
                {equipo.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={"chip" + (invitados.includes(p.id) ? " on" : "")}
                    onClick={() => alternar(p.id)}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            <small style={{ display: "block", marginTop: 8, color: "var(--texto-3)" }}>
              A cada invitado le llega un correo con el botón de Google Calendar y el
              archivo .ics, y se avisa al grupo de Telegram.
            </small>
          </div>

          <label className="campo-lbl">
            Notas
            <textarea
              className="campo"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}
          {aviso && <p className="error">{aviso}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={aviso ? guardado : cerrar}>
            {aviso ? "Entendido" : "Cancelar"}
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Agendando…" : "Agendar y avisar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
