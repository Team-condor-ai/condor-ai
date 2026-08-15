import { useState } from "react";
import { entrarConClave, entrarConCodigo, fijarClave, pedirCodigo } from "./sesion";

type Paso = "correo" | "codigo" | "clave" | "crear";

/**
 * La única puerta del portal.
 *
 * NO SE DICE SI EL CORREO EXISTE
 * ---------------------------------------------------------------------------
 * El mensaje después de pedir el código es siempre el mismo, exista o no el
 * correo. Decir "ese correo no está registrado" convierte el login en un
 * verificador de cartera: cualquiera podría probar correos y averiguar quién
 * es cliente de Cóndor. La Edge Function `solicitar-acceso` ya responde
 * genérico por el mismo motivo; acá no se puede arruinar eso en el front.
 */
export function Login() {
  const [paso, setPaso] = useState<Paso>("correo");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function envolver(fn: () => Promise<void>) {
    setCargando(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="entrada-portal">
      <form
        className="tarjeta-entrada-portal"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (paso === "correo")
            envolver(async () => {
              await pedirCodigo(email);
              setAviso(
                "Si ese correo tiene acceso, le llegó un código de 6 dígitos.",
              );
              setPaso("codigo");
            });
          else if (paso === "codigo")
            envolver(async () => {
              await entrarConCodigo(email, codigo);
              setPaso("crear");
            });
          else if (paso === "clave")
            envolver(() => entrarConClave(email, clave));
          else
            envolver(async () => {
              if (clave.length < 8)
                throw new Error("La contraseña necesita al menos 8 caracteres.");
              if (clave !== clave2)
                throw new Error("Las dos contraseñas no coinciden.");
              await fijarClave(clave);
            });
        }}
      >
        <div className="marca-portal">
          <span className="punto" aria-hidden="true" />
          <span>
            <b>CÓNDOR AI</b>
            <small>PORTAL</small>
          </span>
        </div>

        {paso === "correo" && (
          <div key="correo" className="paso">
            <h1>Acceso</h1>
            <p className="bajada">
              Clientes y equipo entran por acá. Te enviamos un código a tu
              correo.
            </p>
            <input
              className="campo"
              type="email"
              required
              autoFocus
              placeholder="tu@correo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn solido ancho" disabled={cargando}>
              {cargando ? "Enviando…" : "Enviar código"}
            </button>
            <button
              type="button"
              className="enlace"
              onClick={() => setPaso("clave")}
            >
              Ya tengo contraseña
            </button>
          </div>
        )}

        {paso === "codigo" && (
          <div key="codigo" className="paso">
            <h1>Revisa tu correo</h1>
            <p className="bajada">{aviso}</p>
            <input
              className="campo codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn solido ancho" disabled={cargando}>
              {cargando ? "Entrando…" : "Entrar"}
            </button>
            <button
              type="button"
              className="enlace"
              onClick={() => setPaso("correo")}
            >
              Usar otro correo
            </button>
          </div>
        )}

        {paso === "clave" && (
          <div key="clave" className="paso">
            <h1>Entrar</h1>
            <p className="bajada">Con tu correo y tu contraseña.</p>
            <input
              className="campo"
              type="email"
              required
              placeholder="tu@correo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="campo"
              type="password"
              required
              placeholder="Tu contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <button className="btn solido ancho" disabled={cargando}>
              {cargando ? "Entrando…" : "Entrar"}
            </button>
            <button
              type="button"
              className="enlace"
              onClick={() => setPaso("correo")}
            >
              Prefiero un código
            </button>
          </div>
        )}

        {paso === "crear" && (
          <div key="crear" className="paso">
            <h1>Crea tu contraseña</h1>
            <p className="bajada">
              Para que la próxima vez entres directo, sin esperar el correo.
            </p>
            <input
              className="campo"
              type="password"
              required
              autoFocus
              placeholder="Nueva contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <input
              className="campo"
              type="password"
              required
              placeholder="Repítela"
              value={clave2}
              onChange={(e) => setClave2(e.target.value)}
            />
            <button className="btn solido ancho" disabled={cargando}>
              {cargando ? "Guardando…" : "Guardar y entrar"}
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
