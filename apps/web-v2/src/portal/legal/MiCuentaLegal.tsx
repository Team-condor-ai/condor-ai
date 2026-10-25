import { useState } from "react";
import { Link } from "react-router-dom";
import { EMPRESA, PAISES, SERVICIOS } from "../../legal/contenido.mjs";
import { Lector } from "./Lector";
import { cancelar, entregaLimite, fechaLarga, useTerminos } from "./datos";

/**
 * «Mi cuenta» del cliente: su suscripción, cómo cancelar y los términos que aceptó (25-oct-2026).
 * Cancelar es un paso, sin palabras que escribir ni ofertas de por medio (cláusula 7.1): se le dice qué pasa y
 * confirma. Antes la baja archivaba la ficha al instante y el cliente perdía el portal ese mismo día; ahora el
 * servicio sigue hasta el fin del período y la cancelación queda registrada y en el chat del equipo.
 */
export function MiCuentaLegal() {
  const t = useTerminos();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [verTerminos, setVerTerminos] = useState(false);
  if (t.estado !== "listo") return null;
  const { ficha, servicio, pais, ultima, cancelacion: ca } = t;

  async function confirmar() {
    setEnviando(true); setError("");
    try { await cancelar(motivo); await t.recargar(); setAbierto(false); }
    catch (e) { setError((e as Error).message || `No pudimos registrarla. Escríbenos a ${EMPRESA.correo} y la procesamos.`); }
    setEnviando(false);
  }

  return (
    <>
      <section className="bloque tc-cuenta">
        <h3>Suscripción</h3>
        {ca ? (
          <div className="tc-estado-cancel">
            <b>Cancelaste tu servicio el {fechaLarga(ca.solicitada_en)}.</b>
            <ul>
              <li>Tu {SERVICIOS[servicio].nombre} sigue activo hasta el <b>{fechaLarga(ca.termina_el)}</b> y no habrá más cobros.</li>
              <li>{ca.entregado_en
                ? <>Te entregamos la carpeta de tu proyecto y las credenciales el {fechaLarga(ca.entregado_en)}.</>
                : <>Te entregamos la carpeta completa de tu proyecto y las credenciales a más tardar el <b>{fechaLarga(entregaLimite(ca.termina_el))}</b>.</>}</li>
            </ul>
            <p>¿Te arrepentiste? <Link to="/acceso/chat">Escríbenos por el chat</Link> y lo dejamos como estaba.</p>
          </div>
        ) : !abierto ? (
          <>
            <p className="parrafo">Tu plan <b>{ficha.plan || SERVICIOS[servicio].corto}</b> está activo{ficha.proximo_cobro ? <>; el próximo cobro es el <b>{fechaLarga(ficha.proximo_cobro)}</b></> : null}.</p>
            <button className="btn peligro" onClick={() => setAbierto(true)}>Cancelar servicio</button>
            <p className="tc-otros">También puedes cancelar por el <Link to="/acceso/chat">chat</Link>, por correo a <a href={`mailto:${EMPRESA.correo}`}>{EMPRESA.correo}</a> o por WhatsApp al <a href={`https://wa.me/${EMPRESA.whatsapp}`} target="_blank" rel="noreferrer">{EMPRESA.whatsappVisible}</a>. Basta uno.</p>
          </>
        ) : (
          <div className="caja-baja">
            <h4>Si cancelas</h4>
            <ul className="lista-perdida tc-si-cancelas">
              <li>Tu servicio sigue activo hasta el <b>{ficha.proximo_cobro ? fechaLarga(ficha.proximo_cobro) : "final del período pagado"}</b>. No pierdes lo que ya pagaste.</li>
              <li>Después no hay más cobros ni multas.</li>
              <li>En máximo 10 días hábiles te entregamos la carpeta completa de tu proyecto, las credenciales y tus datos.</li>
            </ul>
            <label className="campo-lbl">
              ¿Nos cuentas por qué? <small>(opcional)</small>
              <textarea className="campo" rows={3} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Nos ayuda a mejorar" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="tc-acciones">
              <button className="btn" onClick={() => setAbierto(false)} disabled={enviando}>Volver</button>
              <button className="btn peligro" onClick={() => void confirmar()} disabled={enviando}>{enviando ? "Registrando…" : "Confirmar cancelación"}</button>
            </div>
          </div>
        )}
      </section>

      <section className="bloque tc-cuenta">
        <h3>Términos y condiciones</h3>
        <p className="parrafo">
          {ultima
            ? <>Aceptaste la versión <b>{ultima.version}</b> el {fechaLarga(ultima.aceptado_en)}: Términos Generales, contrato de {SERVICIOS[ultima.servicio].nombre} y anexo de {PAISES[ultima.pais].nombre}.</>
            : "Todavía no aceptas los términos."}
        </p>
        <button className="btn" onClick={() => setVerTerminos((v) => !v)}>{verTerminos ? "Ocultar" : "Ver o descargar"}</button>
        {verTerminos && <Lector servicio={ultima?.servicio ?? servicio} pais={ultima?.pais ?? pais} />}
      </section>
    </>
  );
}
