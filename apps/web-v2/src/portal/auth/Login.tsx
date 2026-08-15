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
 * válido al correo y era imposible escribirlo entero. Por eso no se asume el
 * largo — se aceptan hasta `MAX_CODIGO` y el botón se habilita desde
 * `MIN_CODIGO`.
 *
 * NO SE DICE SI EL CORREO EXISTE
 * ---------------------------------------------------------------------------
 * El mensaje tras pedir el código es el mismo exista o no el correo. Decir
 * "ese correo no está registrado" convierte el login en un verificador de
 * cartera: cualquiera podría averiguar quién es cliente de Cóndor.
 */
const MIN_CODIGO = 6;
const MAX_CODIGO = 10;

/** La marca del panel. Mismo trazo que el resto de los iconos. */
function Estrella({ t = 22 }: { t?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.6v18.8M4.9 6.5l14.2 11M19.1 6.5l-14.2 11"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Login() {
  const [metodo, setMetodo] = useState<Metodo>("codigo");
  const [paso, setPaso] = useState<Paso>("entrar");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [verClave, setVerClave] = useState(false);
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
    if (paso === "entrar") return envolver(() => entrarConClave(email, clave));
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

  const titulo =
    paso === "verificar" ? "Revisa tu correo"
    : paso === "crear" ? "Crea tu contraseña"
    : "Entra a tu portal";

  const bajada =
    paso === "verificar" ? <>Si <b>{email}</b> tiene acceso, le llegó un código. Escríbelo acá abajo.</>
    : paso === "crear" ? "Para entrar directo la próxima vez, sin esperar el correo."
    : metodo === "codigo" ? "Te enviamos un código a tu correo. No necesitas recordar nada."
    : "Con la contraseña que creaste la primera vez.";

  return (
    <div className="acceso">
      <div className="acceso-tarjeta">
        {/* ── Panel de marca ───────────────────────────────────────────── */}
        <aside className="acceso-marca">
          <div className="acceso-lienzo" aria-hidden="true">
            <span className="mancha m1" />
            <span className="mancha m2" />
            <span className="mancha m3" />
          </div>
          <div className="acceso-marca-top">
            <Estrella t={26} />
          </div>
          <div className="acceso-marca-pie">
            <p className="chico">Tu operación, en un solo lugar</p>
            <h2>
              Planes, cobros y documentos.
              <br />
              Todo lo tuyo con Cóndor.
            </h2>
          </div>
        </aside>

        {/* ── Formulario ───────────────────────────────────────────────── */}
        <div className="acceso-forma">
          <form onSubmit={enviar}>
            <span className="acceso-logo">
              <Estrella t={21} />
            </span>

            <h1>{titulo}</h1>
            <p className="acceso-bajada">{bajada}</p>

            {paso === "entrar" && (
              <div key="entrar" className="paso">
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

                <label className="rotulo" htmlFor="ac-email">
                  Tu correo
                </label>
                <input
                  id="ac-email"
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
                  <>
                    <label className="rotulo" htmlFor="ac-clave">
                      Contraseña
                    </label>
                    <div className="campo-ojo">
                      <input
                        id="ac-clave"
                        className="campo"
                        type={verClave ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                      />
                      <button
                        type="button"
                        className="ojo"
                        onClick={() => setVerClave((v) => !v)}
                        aria-label={verClave ? "Ocultar" : "Mostrar"}
                      >
                        {verClave ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                            <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                            <path d="M9.4 5.2A9.5 9.5 0 0 1 12 4.9c5 0 9 4.6 9 7.1a10 10 0 0 1-2.4 3.9M6.1 6.9C4 8.4 3 10.7 3 12c0 2.5 4 7.1 9 7.1a9.6 9.6 0 0 0 3.6-.7" />
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                            <path d="M3 12s3.6-7.1 9-7.1S21 12 21 12s-3.6 7.1-9 7.1S3 12 3 12z" />
                            <circle cx="12" cy="12" r="2.4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}

                <button className="btn-acceso" disabled={cargando}>
                  {cargando
                    ? metodo === "codigo" ? "Enviando…" : "Entrando…"
                    : metodo === "codigo" ? "Enviarme el código" : "Entrar"}
                </button>
              </div>
            )}

            {paso === "verificar" && (
              <div key="verificar" className="paso">
                <label className="rotulo" htmlFor="ac-codigo">
                  Código de acceso
                </label>
                <input
                  id="ac-codigo"
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
                  className="btn-acceso"
                  disabled={cargando || codigo.length < MIN_CODIGO}
                >
                  {cargando ? "Entrando…" : "Entrar"}
                </button>
                <p className="acceso-pie">
                  ¿Otro correo?{" "}
                  <button
                    type="button"
                    className="enlace-fuerte"
                    onClick={() => {
                      setPaso("entrar");
                      setCodigo("");
                      setError("");
                    }}
                  >
                    Volver
                  </button>
                </p>
              </div>
            )}

            {paso === "crear" && (
              <div key="crear" className="paso">
                <label className="rotulo" htmlFor="ac-nueva">
                  Nueva contraseña
                </label>
                <input
                  id="ac-nueva"
                  className="campo"
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
                <label className="rotulo" htmlFor="ac-nueva2">
                  Repítela
                </label>
                <input
                  id="ac-nueva2"
                  className="campo"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={clave2}
                  onChange={(e) => setClave2(e.target.value)}
                />
                <button className="btn-acceso" disabled={cargando}>
                  {cargando ? "Guardando…" : "Guardar y entrar"}
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}

            {paso === "entrar" && (
              <p className="acceso-pie">
                ¿No tienes acceso todavía?{" "}
                <a className="enlace-fuerte" href="mailto:contacto@teamcondorcl.com">
                  Escríbenos
                </a>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
