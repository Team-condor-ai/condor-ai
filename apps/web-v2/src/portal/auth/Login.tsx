import { useState } from "react";
import { entrarConClave, entrarConCodigo, fijarClave, pedirCodigo } from "./sesion";

type Paso = "entrar" | "verificar" | "crear";

/**
 * La única puerta del portal.
 *
 * LA ESTRUCTURA SIGUE LA REFERENCIA, LA FUNCIÓN NO SE INVENTA
 * ---------------------------------------------------------------------------
 * El diseño de referencia trae: correo, contraseña, botón, un separador y
 * abajo otras formas de entrar. Se respeta tal cual — pero Cóndor no tiene
 * login social, así que donde iban Google y Facebook va lo que sí existe:
 * pedir un código al correo.
 *
 * Es mejor que las pestañas que había antes. Con pestañas hay que decidir
 * cómo entrar antes de entender las opciones; así el camino normal está a la
 * vista y la alternativa aparece cuando se necesita.
 *
 * EL CÓDIGO NO SIEMPRE ES DE 6 DÍGITOS
 * ---------------------------------------------------------------------------
 * Supabase permite configurarlo entre 6 y 10 y este proyecto lo tiene en 8.
 * El campo estaba fijo en 6 y truncaba el código: llegaba uno válido al
 * correo y era imposible escribirlo entero. Por eso no se asume el largo.
 *
 * NO SE DICE SI EL CORREO EXISTE
 * ---------------------------------------------------------------------------
 * El mensaje tras pedir el código es el mismo exista o no. Decir "ese correo
 * no está registrado" convierte el login en un verificador de cartera.
 */
const MIN_CODIGO = 6;
const MAX_CODIGO = 10;

function Estrella({ t = 22 }: { t?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.8v18.4M4.7 6.6l14.6 10.8M19.3 6.6L4.7 17.4"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OjoAbierto() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6.4 5.2 12 5.2 21.5 12 21.5 12 17.6 18.8 12 18.8 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function OjoCerrado() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8" />
      <path d="M9.4 5.4A9.7 9.7 0 0 1 12 5.2c5.6 0 9.5 6.8 9.5 6.8a17 17 0 0 1-2.5 3.4M6.2 7.1A16.6 16.6 0 0 0 2.5 12S6.4 18.8 12 18.8a9.8 9.8 0 0 0 3.7-.7" />
    </svg>
  );
}
function Sobre() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
      <path d="m3.5 7 7.3 5.1a2 2 0 0 0 2.4 0L20.5 7" />
    </svg>
  );
}

export function Login() {
  const [paso, setPaso] = useState<Paso>("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [codigo, setCodigo] = useState("");
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

  function pedirElCodigo() {
    if (!email.trim()) {
      setError("Escribe tu correo y te enviamos el código.");
      return;
    }
    envolver(async () => {
      await pedirCodigo(email);
      setPaso("verificar");
    });
  }

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
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
    paso === "verificar" ? (
      <>Te enviamos un código a <b>{email}</b>. Escríbelo acá abajo para entrar.</>
    ) : paso === "crear" ? (
      "Así entras directo la próxima vez, sin esperar el correo."
    ) : (
      "Tus planes, tus pagos y tus documentos, todo en un solo lugar."
    );

  return (
    <div className="acceso">
      <div className="acceso-tarjeta">
        <aside className="acceso-marca">
          <div className="acceso-lienzo" aria-hidden="true">
            <span className="m1" />
            <span className="m2" />
            <span className="m3" />
          </div>
          <div className="acceso-marca-top">
            <Estrella t={27} />
          </div>
          <div className="acceso-marca-pie">
            <p className="chico">Todo tu proyecto</p>
            <h2>Planes, cobros y documentos, en un solo lugar</h2>
          </div>
        </aside>

        <div className="acceso-forma">
          <form onSubmit={enviar} noValidate>
            <span className="acceso-logo">
              <Estrella t={17} />
            </span>

            <h1>{titulo}</h1>
            <p className="acceso-bajada">{bajada}</p>

            {paso === "entrar" && (
              <div key="entrar" className="paso">
                <div className="campo-grupo">
                  <label className="rotulo" htmlFor="ac-email">Tu correo</label>
                  <input
                    id="ac-email"
                    className="campo"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    placeholder="tu@correo.cl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="campo-grupo">
                  <label className="rotulo" htmlFor="ac-clave">Contraseña</label>
                  <div className="campo-ojo">
                    <input
                      id="ac-clave"
                      className="campo"
                      type={verClave ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ojo"
                      onClick={() => setVerClave((v) => !v)}
                      aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {verClave ? <OjoCerrado /> : <OjoAbierto />}
                    </button>
                  </div>
                </div>

                <button className="btn-acceso" disabled={cargando}>
                  {cargando ? "Entrando…" : "Entrar"}
                </button>

                <div className="separador">
                  <i aria-hidden="true" />
                  <span>o</span>
                  <i aria-hidden="true" />
                </div>

                <button
                  type="button"
                  className="btn-alterno"
                  onClick={pedirElCodigo}
                  disabled={cargando}
                >
                  <Sobre />
                  Enviarme un código al correo
                </button>

                <p className="acceso-pie">
                  ¿No tienes acceso todavía?{" "}
                  <a className="enlace-fuerte" href="mailto:contacto@teamcondorcl.com">
                    Escríbenos
                  </a>
                </p>
              </div>
            )}

            {paso === "verificar" && (
              <div key="verificar" className="paso">
                <div className="campo-grupo">
                  <label className="rotulo" htmlFor="ac-codigo">Código de acceso</label>
                  <input
                    id="ac-codigo"
                    className="campo codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    autoFocus
                    maxLength={MAX_CODIGO}
                    placeholder="••••••"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value.replace(/\D/g, "").slice(0, MAX_CODIGO))
                    }
                  />
                </div>

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
                <div className="campo-grupo">
                  <label className="rotulo" htmlFor="ac-nueva">Nueva contraseña</label>
                  <input
                    id="ac-nueva"
                    className="campo"
                    type="password"
                    autoFocus
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                  />
                </div>
                <div className="campo-grupo">
                  <label className="rotulo" htmlFor="ac-nueva2">Repítela</label>
                  <input
                    id="ac-nueva2"
                    className="campo"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={clave2}
                    onChange={(e) => setClave2(e.target.value)}
                  />
                </div>
                <button className="btn-acceso" disabled={cargando}>
                  {cargando ? "Guardando…" : "Guardar y entrar"}
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
