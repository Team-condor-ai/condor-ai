import { useState } from "react";
import { entrarConClave, entrarConCodigo, fijarClave, pedirCodigo } from "./sesion";

type Metodo = "codigo" | "clave";
type Paso = "entrar" | "verificar" | "crear";

/**
 * La única puerta del portal.
 *
 * SE ELIGE EL MÉTODO, NO SE MEZCLAN
 * ---------------------------------------------------------------------------
 * La primera versión ponía "Enviar código" y abajo un enlace "Ya tengo
 * contraseña". Confundía: parecía que había que hacer las dos cosas. Ahora
 * son dos pestañas y el formulario es uno solo — o código, o contraseña.
 *
 * EL CÓDIGO NO SIEMPRE ES DE 6 DÍGITOS
 * ---------------------------------------------------------------------------
 * Supabase permite configurar el largo del OTP entre 6 y 10, y este proyecto
 * lo tiene en 8. El campo estaba fijo en 6 y truncaba el código: llegaba uno
 * válido al correo y era imposible escribirlo entero.
 *
 * Por eso no se asume el largo: se aceptan hasta `MAX_CODIGO` dígitos y el
 * botón se habilita desde `MIN_CODIGO`. Si mañana cambian la configuración,
 * esto sigue funcionando.
 *
 * NO SE DICE SI EL CORREO EXISTE
 * ---------------------------------------------------------------------------
 * El mensaje tras pedir el código es el mismo exista o no el correo. Decir
 * "ese correo no está registrado" convierte el login en un verificador de
 * cartera: cualquiera podría averiguar quién es cliente de Cóndor.
 */
const MIN_CODIGO = 6;
const MAX_CODIGO = 10;

export function Login() {
  const [metodo, setMetodo] = useState<Metodo>("codigo");
  const [paso, setPaso] = useState<Paso>("entrar");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

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

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (paso === "entrar" && metodo === "codigo")
      return envolver(async () => {
        await pedirCodigo(email);
        setPaso("verificar");
      });
    if (paso === "entrar")
      return envolver(() => entrarConClave(email, clave));
    if (paso === "verificar")
      return envolver(async () => {
        await entrarConCodigo(email, codigo);
        setPaso("crear");
      });
    return envolver(async () => {
      if (clave.length < 8)
        throw new Error("La contraseña necesita al menos 8 caracteres.");
      if (clave !== clave2) throw new Error("Las dos contraseñas no coinciden.");
      await fijarClave(clave);
    });
  }

  return (
    <div className="entrada-portal">
      <form className="tarjeta-entrada-portal" onSubmit={enviar}>
        <div className="marca-portal">
          <span className="punto" aria-hidden="true" />
          <span>
            <b>CÓNDOR AI</b>
            <small>PORTAL</small>
          </span>
        </div>

        {paso === "entrar" && (
          <div key="entrar" className="paso">
            <h1>Acceso</h1>

            <div className="pestanas" role="tablist">
              {(
                [
                  ["codigo", "Con código"],
                  ["clave", "Con contraseña"],
                ] as const
              ).map(([id, txt]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={metodo === id}
                  className={"pestana" + (metodo === id ? " on" : "")}
                  onClick={() => {
                    setMetodo(id);
                    setError("");
                  }}
                >
                  {txt}
                </button>
              ))}
            </div>

            <p className="bajada">
              {metodo === "codigo"
                ? "Te enviamos un código a tu correo. No necesitas recordar nada."
                : "Entra con la contraseña que creaste la primera vez."}
            </p>

            <input
              className="campo"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="tu@correo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {metodo === "clave" && (
              <input
                className="campo"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            )}

            <button className="btn solido ancho" disabled={cargando}>
              {cargando
                ? metodo === "codigo"
                  ? "Enviando…"
                  : "Entrando…"
                : metodo === "codigo"
                  ? "Enviarme el código"
                  : "Entrar"}
            </button>
          </div>
        )}

        {paso === "verificar" && (
          <div key="verificar" className="paso">
            <h1>Revisa tu correo</h1>
            <p className="bajada">
              Si <b>{email}</b> tiene acceso, le llegó un código. Escríbelo acá.
            </p>
            <input
              className="campo codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={MAX_CODIGO}
              placeholder="••••••"
              value={codigo}
              onChange={(e) =>
                setCodigo(e.target.value.replace(/\D/g, "").slice(0, MAX_CODIGO))
              }
            />
            <button
              className="btn solido ancho"
              disabled={cargando || codigo.length < MIN_CODIGO}
            >
              {cargando ? "Entrando…" : "Entrar"}
            </button>
            <button
              type="button"
              className="enlace"
              onClick={() => {
                setPaso("entrar");
                setCodigo("");
                setError("");
              }}
            >
              Usar otro correo
            </button>
          </div>
        )}

        {paso === "crear" && (
          <div key="crear" className="paso">
            <h1>Crea tu contraseña</h1>
            <p className="bajada">
              Para entrar directo la próxima vez, sin esperar el correo.
            </p>
            <input
              className="campo"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              placeholder="Nueva contraseña (mínimo 8)"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <input
              className="campo"
              type="password"
              required
              autoComplete="new-password"
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
