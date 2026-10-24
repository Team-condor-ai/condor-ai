import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { olvidarEquipo, useYo } from "./personas";

/**
 * «Mi cuenta» del equipo (24-oct-2026): el nombre completo (lo ven los clientes en el chat) y el apodo,
 * el usuario informal de cada uno. El apodo se cambia solo, por `cambiar_mi_apodo`; el nombre lo deja
 * Personas, para que no cambie lo que ve un cliente sin que el equipo lo sepa.
 */
export function MiPerfil() {
  const email = useSesion().email;
  const yo = useYo(email);
  const [apodo, setApodo] = useState("");
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | string>("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (yo) setApodo(yo.apodo ?? ""); }, [yo]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("guardando");
    const { error } = await sb.rpc("cambiar_mi_apodo", { nuevo: apodo });
    if (error) { setEstado("No se pudo guardar: " + error.message); return; }
    olvidarEquipo();
    setEstado("ok");
  }

  return (
    <form className="bloque perfil" onSubmit={guardar}>
      <h3>Mi perfil</h3>
      <div className="perfil-fila">
        <label>Nombre<input value={yo?.completo ?? ""} disabled /><small>Así te ven los clientes en el chat. Si está mal, se corrige en Personas.</small></label>
        <label>Apodo<span className="perfil-apodo"><em>@</em><input value={apodo} onChange={(e) => { setApodo(e.target.value.replace(/\s+/g, "_")); setEstado(""); }} maxLength={40} placeholder="tu_usuario" /></span><small>Tu usuario informal: sale en el ranking y dentro del equipo.</small></label>
      </div>
      <div className="perfil-pie">
        {estado === "ok" && <span className="solicitud-ok">Listo, apodo guardado.</span>}
        {estado && estado !== "ok" && estado !== "guardando" && <span className="aviso-error">{estado}</span>}
        <button className="btn solido" disabled={estado === "guardando" || !yo}>{estado === "guardando" ? "Guardando…" : "Guardar apodo"}</button>
      </div>
    </form>
  );
}
