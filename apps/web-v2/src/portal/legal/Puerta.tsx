import { useState, type ReactNode } from "react";
import { CAMBIOS, EMPRESA, PAISES, SERVICIOS, VERSION, resumen } from "../../legal/contenido.mjs";
import { Ico } from "../disenio/iconos";
import { salir } from "../auth/sesion";
import { Lector } from "./Lector";
import { aceptar, cancelar, fechaLarga, useTerminos } from "./datos";

/**
 * La puerta de los términos (25-oct-2026, pedido de Max): un cliente no entra a su portal sin aceptar la versión
 * vigente de los términos de SU servicio y SU país. La primera vez se presentan; si salió una versión nueva, se
 * muestra qué cambió. Quien no está de acuerdo puede escribirnos o, si ya había aceptado antes, cancelar sin
 * penalidad (cláusula 17.2) y seguir entrando con la versión anterior hasta que termine.
 */
export function PuertaTerminos({ children }: { children: ReactNode }) {
  const t = useTerminos();
  if (t.estado === "cargando") return <div className="entrada-portal"><p className="vacio">Cargando…</p></div>;
  if (t.estado === "sin-cliente" || t.alDia) return <>{children}</>;
  // Ya canceló por no aceptar la versión nueva: sigue entrando con la anterior hasta su fecha de término.
  if (t.ultima && t.cancelacion) return <>{children}</>;
  return <Pantalla t={t} />;
}

function Pantalla({ t }: { t: Extract<ReturnType<typeof useTerminos>, { estado: "listo" }> }) {
  const { servicio, pais, ultima, recargar } = t;
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [desacuerdo, setDesacuerdo] = useState(false);
  const cambios = ultima ? CAMBIOS[VERSION] ?? [] : [];
  const nombre = SERVICIOS[servicio].nombre, lugar = PAISES[pais].nombre;

  async function enviar() {
    setEnviando(true); setError("");
    try { await aceptar(servicio, pais); await recargar(); }
    catch (e) { setError((e as Error).message || "No pudimos registrar tu aceptación. Inténtalo de nuevo."); setEnviando(false); }
  }
  async function cancelarAhora() {
    setEnviando(true); setError("");
    try { await cancelar("No acepté la versión " + VERSION + " de los términos."); await recargar(); }
    catch (e) { setError((e as Error).message); setEnviando(false); }
  }

  return (
    <div className="tc-puerta">
      <div className="tc-lado">
        <img className="tc-logo" src="/condor/marca/condor-logo-horizontal-negro.svg" alt="Cóndor" width="120" height="26" />
        <span className="tc-chip">{nombre} · {lugar}</span>
        <h1>{ultima ? "Actualizamos nuestros términos" : "Antes de empezar"}</h1>
        <p className="tc-intro">
          {ultima
            ? `Para seguir usando tu portal, revisa y acepta la versión ${VERSION}. Hasta ahora rige la ${ultima.version}, que aceptaste el ${fechaLarga(ultima.aceptado_en)}.`
            : "Estas son las reglas de tu servicio, escritas para que se entiendan. Léelas con calma: después las encuentras siempre en Mi cuenta."}
        </p>

        {cambios.length > 0 ? (
          <ul className="tc-puntos cambios">{cambios.map((c) => <li key={c}><span>{Ico.editar({ t: 14 })}</span><div><p>{c}</p></div></li>)}</ul>
        ) : (
          <ul className="tc-puntos">
            {resumen(servicio).map(([titulo, texto]) => (
              <li key={titulo}><span>{Ico.cheque({ t: 14 })}</span><div><b>{titulo}</b><p>{texto}</p></div></li>
            ))}
          </ul>
        )}
        <p className="tc-nota">Este resumen es para orientarte; lo que vale es el texto completo.</p>

        <div className="tc-aceptar">
          <label className="tc-casilla">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>Leí y acepto los Términos Generales, el contrato de {nombre} y el anexo de {lugar} (versión {VERSION}).</span>
          </label>
          {error && <p className="aviso-error">{error}</p>}
          <button className="btn solido tc-boton" disabled={!ok || enviando} onClick={() => void enviar()}>
            {enviando ? "Registrando…" : "Aceptar y entrar"}
          </button>
          <p className="tc-legal">Queda registrada la fecha, la hora y la versión que aceptas, como prueba para ti y para nosotros.</p>
          <div className="tc-links">
            <button onClick={() => setDesacuerdo((v) => !v)}>No estoy de acuerdo</button>
            <button onClick={() => void salir()}>{Ico.salir({ t: 13 })} Salir</button>
          </div>
          {desacuerdo && (
            <div className="tc-desacuerdo">
              <p>Escríbenos y lo conversamos: <a href={`mailto:${EMPRESA.correo}`}>{EMPRESA.correo}</a> o WhatsApp <a href={`https://wa.me/${EMPRESA.whatsapp}`} target="_blank" rel="noreferrer">{EMPRESA.whatsappVisible}</a>.</p>
              {ultima && (
                <>
                  <p>También puedes cancelar sin penalidad. Tu servicio sigue con la versión que aceptaste hasta el {t.ficha.proximo_cobro ? fechaLarga(t.ficha.proximo_cobro) : "fin del período pagado"}, y te entregamos la carpeta de tu proyecto y las credenciales.</p>
                  <button className="btn chico peligro" disabled={enviando} onClick={() => void cancelarAhora()}>Cancelar mi servicio</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="tc-doc-col">
        <Lector servicio={servicio} pais={pais} alto />
      </div>
    </div>
  );
}
