import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { darAcceso, verClaveInicial } from "../lib/accesos";
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
  const [entrega, setEntrega] = useState<{ email: string; clave: string; nuevo: boolean } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [copiado, setCopiado] = useState(false);

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
    setTrabajando(true); setError("");
    try {
      const r = await darAcceso(correo, "equipo", nombre.trim() || undefined);
      setEntrega({ email: correo, clave: r.clave, nuevo: r.nuevo });
      setEmail(""); setNombre(""); await cargar();
    } catch (e) { setError("No se pudo dar el acceso: " + (e instanceof Error ? e.message : String(e))); }
    setTrabajando(false);
  }

  async function restablecer(m: Miembro) {
    if (!(await confirmar(`Restablecer la clave de ${m.nombre || m.email}`, "Vuelve a la clave inicial y tendrá que elegir una nueva al entrar.", "Restablecer"))) return;
    setError("");
    try { const r = await darAcceso(m.email, "equipo"); setEntrega({ email: m.email, clave: r.clave, nuevo: false }); }
    catch (e) { setError("No se pudo restablecer: " + (e instanceof Error ? e.message : String(e))); }
  }

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); } catch { /* sin permiso */ }
  }

  async function mostrarClave() {
    try { setEntrega({ email: "", clave: await verClaveInicial(), nuevo: false }); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
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
              <button className="icono-btn" title="Restablecer a la clave inicial" onClick={() => restablecer(m)}>{Ico.candado({ t: 15 })}</button>
              {m.email !== yo?.toLowerCase() && <button className="icono-btn peligro" title="Quitar del equipo" onClick={() => quitar(m)}>{Ico.eliminar({ t: 15 })}</button>}
            </article>
          ))}
        </div>
        {entrega && (
          <div className="equipo-entrega" role="status">
            <div>
              <b>{entrega.email ? (entrega.nuevo ? "Acceso creado" : "Clave restablecida") : "Clave inicial"}{entrega.email ? ` · ${entrega.email}` : ""}</b>
              <p>Entra en <a href="https://condorai.cl/acceso" target="_blank" rel="noreferrer">condorai.cl/acceso</a> con su correo y esta clave. Al entrar, el portal le pide elegir la suya.</p>
            </div>
            <code>{entrega.clave}</code>
            <button className="btn" onClick={() => copiar(`Entra a https://condorai.cl/acceso con tu correo${entrega.email ? ` (${entrega.email})` : ""} y la clave ${entrega.clave}. Al entrar te pedirá elegir la tuya.`)}>{copiado ? "Copiado ✓" : "Copiar mensaje"}</button>
            <button className="icono-btn" aria-label="Cerrar" onClick={() => setEntrega(null)}>{Ico.cerrar({ t: 14 })}</button>
          </div>
        )}
        <form className="equipo-alta" onSubmit={agregar}>
          <h3>Agregar a alguien</h3>
          <div>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" aria-label="Correo" required />
            <button className="btn solido" type="submit" disabled={trabajando}>{Ico.mas({ t: 15 })} {trabajando ? "Creando…" : "Agregar"}</button>
          </div>
          <small>Se crea con la clave inicial común y elige la suya al entrar; no depende de ningún correo. Tendrá acceso a todo el portal. <button type="button" className="enlace-btn" onClick={mostrarClave}>Ver la clave inicial</button></small>
        </form>
      </div>
    </>
  );
}
