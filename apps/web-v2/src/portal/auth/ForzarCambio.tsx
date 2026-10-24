import { CambiarClave } from "./CambiarClave";
import { salir } from "./sesion";

/** Pantalla completa que ve quien entró con la clave inicial o con código sin tener contraseña: elige la suya y sigue. */
export function ForzarCambio({ email }: { email: string }) {
  return (
    <div className="acceso">
      <div className="acceso-tarjeta" style={{ maxWidth: 520, gridTemplateColumns: "1fr", minHeight: 0, padding: 14 }}>
        <div className="acceso-forma" style={{ padding: "34px 30px" }}>
          <div style={{ width: "100%", display: "block" }}>
          <img src="/condor/marca/condor-logo-horizontal.svg" alt="condor.ai" width="124" height="26" style={{ marginBottom: 22 }} />
          <h1>Elige tu contraseña</h1>
          <p className="acceso-bajada">Antes de seguir, elige una contraseña tuya para <b>{email}</b>. Con ella entras directo la próxima vez, sin clave inicial ni códigos por correo.</p>
          <CambiarClave titulo="" />
          <p className="acceso-pie"><a href="#salir" className="enlace-fuerte" onClick={(e) => { e.preventDefault(); void salir(); }}>Salir</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
