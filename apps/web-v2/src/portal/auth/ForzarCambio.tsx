import { CambiarClave } from "./CambiarClave";
import { salir } from "./sesion";

/** Pantalla completa que ve quien entró con la clave inicial: elige la suya y sigue (24-oct-2026). */
export function ForzarCambio({ email }: { email: string }) {
  return (
    <div className="acceso">
      <div className="acceso-tarjeta" style={{ maxWidth: 520, gridTemplateColumns: "1fr", minHeight: 0, padding: 14 }}>
        <div className="acceso-forma" style={{ padding: "34px 30px" }}>
          <div style={{ width: "100%", display: "block" }}>
          <img src="/condor/marca/condor-logo-horizontal.svg" alt="condor.ai" width="124" height="26" style={{ marginBottom: 22 }} />
          <h1>Elige tu contraseña</h1>
          <p className="acceso-bajada">Entraste con la clave inicial. Elige una tuya para <b>{email}</b>; con ella entras la próxima vez sin esperar ningún correo.</p>
          <CambiarClave titulo="" />
          <p className="acceso-pie"><a href="#salir" className="enlace-fuerte" onClick={(e) => { e.preventDefault(); void salir(); }}>Salir</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
