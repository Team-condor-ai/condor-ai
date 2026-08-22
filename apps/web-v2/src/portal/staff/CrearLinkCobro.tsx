import { useState } from "react";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { nombreCobro, type Cliente, type Cobro } from "./tipos";

type Props = {
  cliente: Cliente;
  cobro: Cobro;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Genera el link de Mercado Pago de un cobro que ya existe.
 *
 * ACÁ NO SE DECIDE NADA: EL COBRO YA LO DICE TODO
 * ---------------------------------------------------------------------------
 * Antes esta pantalla preguntaba tipo, concepto y monto, y el cobro nacía en el
 * mismo acto — así que el mismo trabajo generaba una fila nueva cada vez que
 * alguien volvía a mandar el link. Ahora el cobro se crea aparte y esto solo lo
 * lleva a Mercado Pago.
 *
 * ÚNICO Y MENSUAL NO SON LO MISMO EN MP
 * ---------------------------------------------------------------------------
 * "Único" crea un checkout de una sola vez. "Mensual" crea una SUSCRIPCIÓN: el
 * cliente autoriza una vez y MP le cobra solo cada mes. No es un link que haya
 * que reenviar, y conviene decirlo porque la diferencia no se ve en la URL.
 *
 * El monto NUNCA viaja desde acá: `crear-pago` lo lee de la fila del cobro.
 */
export function CrearLinkCobro({ cliente, cobro, cerrar, guardado }: Props) {
  const [enviarCorreo, setEnviarCorreo] = useState(!!cliente.email);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState(cobro.link ?? "");
  const [correoOk, setCorreoOk] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [cuentaActual, setCuentaActual] = useState(!!cobro.mp_cuenta_id);
  // Un link ya guardado se muestra de entrada para poder reenviarlo, pero hay
  // que distinguirlo del recién generado: el mensaje "listo y enviado" sobre un
  // link viejo diría que se acaba de mandar un correo que nadie mandó.
  const [reciente, setReciente] = useState(false);

  const esMensual = cobro.tipo === "mensual";

  async function generar(ev?: React.FormEvent, forzarNuevo = false) {
    ev?.preventDefault();
    if (
      forzarNuevo &&
      !window.confirm("Se invalidará el intento pendiente interno y se creará un enlace con la cuenta de Mercado Pago actual. ¿Continuar?")
    ) return;
    setTrabajando(true);
    setError("");
    try {
      const { data, error } = await sb.functions.invoke("crear-pago", {
        body: {
          cobro_id: cobro.id,
          enviar_correo: enviarCorreo && !!cliente.email,
          forzar_nuevo: forzarNuevo,
        },
      });
      if (error) throw error;
      const r = data as { init_point?: string; correo_enviado?: boolean; error?: string };
      if (r?.error) throw new Error(r.error);
      if (!r?.init_point) throw new Error("Mercado Pago no devolvió un link.");
      setLink(r.init_point);
      setCorreoOk(!!r.correo_enviado);
      setReciente(true);
      setCuentaActual(true);
      guardado();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(
        /not found|404/i.test(m)
          ? "Falta desplegar la Edge Function `crear-pago`. No se cobró nada."
          : /MP_ACCESS_TOKEN/i.test(m)
            ? "Falta configurar MP_ACCESS_TOKEN en Supabase. No se cobró nada."
            : /cobros/i.test(m) && /relation|does not exist/i.test(m)
              ? "Falta correr la migración `20260821_cobros.sql` en Supabase."
              : m,
      );
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el link a mano.");
    }
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={generar}>
        <header>
          <h2>{esMensual ? "Activar suscripción" : "Crear link de cobro"}</h2>
        </header>

        <div className="contenido">
          <p className="tenue" style={{ marginTop: 0 }}>
            <b>{nombreCobro(cobro)}</b> · {plata(cobro.monto, cobro.moneda)}
            {esMensual ? " al mes" : ""}
          </p>

          {link ? (
            <>
              {cuentaActual ? (
                <p className="ok-msg">
                  {reciente
                    ? `Link listo${correoOk ? ` y enviado a ${cliente.email}` : ""}.`
                    : "Este cobro ya tiene un link generado."}
                </p>
              ) : (
                <p className="error">
                  Enlace heredado de la integración anterior. Regénéralo antes de enviarlo o abrirlo.
                </p>
              )}
              <label className="campo-lbl">
                Link de pago
                <input className="campo" readOnly value={link} onFocus={(e) => e.target.select()} />
              </label>
              <div className="botonera">
                {cuentaActual && (
                  <>
                    <button type="button" className="btn solido" onClick={copiar}>
                      {copiado ? "¡Copiado!" : "Copiar link"}
                    </button>
                    <a className="btn" href={link} target="_blank" rel="noreferrer">Abrir</a>
                  </>
                )}
                {!(esMensual && cobro.estado === "activa") && (
                  <button
                    type="button"
                    className="btn"
                    disabled={trabajando}
                    onClick={() => void generar(undefined, true)}
                  >
                    {trabajando ? "Regenerando…" : "Regenerar en cuenta actual"}
                  </button>
                )}
              </div>
              <p className="conteo" style={{ marginTop: 10 }}>
                Queda guardado en el cobro: puedes volver a copiarlo desde su ficha
                sin generar uno nuevo.
              </p>
              <div className="pago-pasos pago-pasos-compacto" aria-label="Estado del enlace">
                <span className="listo">Cobro creado</span>
                <span className="listo">Link generado</span>
                <span>Confirmación pendiente</span>
              </div>
            </>
          ) : (
            <>
              <p className="conteo" style={{ marginBottom: 12 }}>
                {esMensual
                  ? "El cliente autoriza una vez y Mercado Pago le cobra solo cada mes. Cada mes cobrado va a aparecer en el historial de este cobro."
                  : "Un pago de una sola vez. Al pagarlo, el cobro queda cerrado."}
              </p>

              {cliente.email ? (
                <div className="chips">
                  <button
                    type="button"
                    className={"chip" + (enviarCorreo ? " on" : "")}
                    onClick={() => setEnviarCorreo((v) => !v)}
                  >
                    Enviar por correo a {cliente.email}
                  </button>
                </div>
              ) : (
                <p className="conteo">
                  Este cliente no tiene correo, así que el link hay que pasárselo a mano.
                </p>
              )}

              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            {link ? "Cerrar" : "Cancelar"}
          </button>
          {!link && (
            <button className="btn solido" disabled={trabajando}>
              {trabajando ? "Generando…" : <>{Ico.cobros({ t: 15 })} Generar link</>}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
