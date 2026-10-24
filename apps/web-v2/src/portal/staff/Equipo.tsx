import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";

type Miembro = { email: string; nombre: string | null };

/**
 * Quién entra a la vista de equipo del portal (24-oct-2026).
 * Agregar a alguien le da acceso completo al portal (clientes, cobros, contabilidad, biblioteca): por eso
 * la lista es corta, se confirma al quitar y nadie puede quitarse a sí mismo (lo impide también la base).
 */
export function Equipo() {
  const yo = useSesion().email;
  const confirmar = useConfirmacion();
  const [filas, setFilas] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");

  async function cargar() {
    const { data, error: e } = await sb.from("admins").select("email,nombre").order("nombre");
    if (e) setError("No se pudo cargar el equipo: " + e.message);
    else { setError(""); setFilas((data ?? []) as Miembro[]); }
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, []);

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(correo)) { setError("Escribe un correo válido."); return; }
    const { error: e } = await sb.from("admins").insert({ email: correo, nombre: nombre.trim() || null });
    if (e) { setError("No se pudo agregar: " + e.message); return; }
    setEmail(""); setNombre(""); await cargar();
  }

  async function quitar(m: Miembro) {
    if (!(await confirmar(`Quitar a ${m.nombre || m.email}`, "Dejará de entrar a la vista de equipo del portal. Sus datos en la base no se borran.", "Quitar"))) return;
    const { data, error: e } = await sb.from("admins").delete().eq("email", m.email).select("email");
    if (e || !data?.length) { setError(e ? "No se pudo quitar: " + e.message : "No se pudo quitar: la base no lo permitió."); return; }
    await cargar();
  }

  return (
    <>
      <div className="barra"><h1>Equipo</h1></div>
      <div className="cuerpo">
        {error && <p className="aviso-error" role="alert">{error}</p>}
        <div className="equipo-rejilla">
          {cargando ? <p className="vacio">Cargando…</p> : filas.map((m) => (
            <article key={m.email} className="equipo-persona">
              <span className="ini">{(m.nombre || m.email).slice(0, 2).toUpperCase()}</span>
              <div><b>{m.nombre || m.email.split("@")[0]}</b><small>{m.email}</small></div>
              {m.email !== yo?.toLowerCase() && <button className="icono-btn peligro" title="Quitar del equipo" onClick={() => quitar(m)}>{Ico.eliminar({ t: 15 })}</button>}
            </article>
          ))}
        </div>
        <form className="equipo-alta" onSubmit={agregar}>
          <h3>Agregar a alguien</h3>
          <div>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" aria-label="Correo" required />
            <button className="btn solido" type="submit">{Ico.mas({ t: 15 })} Agregar</button>
          </div>
          <small>Entra con un código que se envía a ese correo. Tendrá acceso a todo el portal.</small>
        </form>
      </div>
    </>
  );
}
