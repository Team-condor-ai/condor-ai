import { useState } from "react";
import { fijarClave } from "./sesion";

/** Formulario para elegir o cambiar la contraseña desde dentro del portal (equipo y clientes). */
export function CambiarClave({ alListo, titulo = "Cambiar mi contraseña" }: { alListo?: () => void; titulo?: string }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(""); setOk(false);
    if (a.length < 8) { setError("Necesita al menos 8 caracteres."); return; }
    if (a !== b) { setError("Las dos contraseñas no coinciden."); return; }
    if (/^condor-inicio/i.test(a)) { setError("Elige una distinta a la clave inicial."); return; }
    setGuardando(true);
    try { await fijarClave(a); setOk(true); setA(""); setB(""); alListo?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar."); }
    setGuardando(false);
  }

  return (
    <form className="cambiar-clave" onSubmit={guardar}>
      <h3>{titulo}</h3>
      <label>Nueva contraseña<input type={ver ? "text" : "password"} value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></label>
      <label>Repítela<input type={ver ? "text" : "password"} value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></label>
      <label className="ficha-check"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar lo que escribo</label>
      {error && <p className="aviso-error" role="alert">{error}</p>}
      {ok && <p className="solicitud-ok" role="status">Listo, tu contraseña quedó cambiada.</p>}
      <div><button className="btn solido" disabled={guardando}>{guardando ? "Guardando…" : "Guardar contraseña"}</button></div>
    </form>
  );
}
