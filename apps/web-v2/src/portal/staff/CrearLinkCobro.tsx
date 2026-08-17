import { useState } from "react";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import type { Cliente } from "./tipos";

type Props = {
  cliente: Cliente;
  cerrar: () => void;
  guardado: () => void;
};

type Modo = "unico" | "mensual";

/**
 * Genera un link de cobro de Mercado Pago para un cliente ya existente.
 *
 * ÚNICO vs MENSUAL NO ES LO MISMO EN MERCADO PAGO
 * ---------------------------------------------------------------------------
 * "Único" crea una `preference` (checkout de una sola vez). "Mensual" crea un
 * `preapproval`, que es una SUSCRIPCIÓN: el cliente autoriza una vez y MP le
 * cobra solo cada mes. No es un link que haya que reenviar todos los meses, y
 * conviene decirlo en pantalla porque la diferencia no se ve en el link.
 *
 * EL MONTO LIBRE LO PERMITE LA FUNCIÓN SOLO PARA ADMINS
 * ---------------------------------------------------------------------------
 * `crear-pago` ignora el monto que venga del navegador salvo que quien llame
 * sea admin. Para un cliente normal siempre manda su ficha, así que nadie
 * puede cobrarse $1 a sí mismo abriendo la consola.
 */
export function CrearLinkCobro({ cliente, cerrar, guardado }: Props) {
  const [modo, setModo] = useState<Modo>("unico");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [enviarCorreo, setEnviarCorreo] = useState(true);

  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [correoOk, setCorreoOk] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const montoFicha = modo === "mensual" ? cliente.mensual_monto ?? 0 : cliente.setup_monto ?? 0;
  // En "mensual" se respeta la ficha si el campo quedó en 0, para no romper el
  // caso normal de "cóbrale su mensualidad de siempre".
  const montoFinal = monto > 0 ? monto : montoFicha;

  async function generar(ev: React.FormEvent) {
    ev.preventDefault();
    setTrabajando(true);
    setError("");
    setLink("");
    try {
      const { data, error } = await sb.functions.invoke("crear-pago", {
        body: {
          cliente_id: cliente.id,
          // La función trata cualquier tipo distinto de "mensual" como pago
          // único, así que "unico" cae en el checkout de una sola vez.
          tipo: modo,
          monto: monto > 0 ? monto : undefined,
          concepto: concepto.trim() || undefined,
          enviar_correo: enviarCorreo,
        },
      });
      if (error) throw error;
      const r = data as { init_point?: string; correo_enviado?: boolean; error?: string };
      if (r?.error) throw new Error(r.error);
      if (!r?.init_point) throw new Error("Mercado Pago no devolvió un link.");
      setLink(r.init_point);
      setCorreoOk(!!r.correo_enviado);
      guardado();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(
        /not found|404/i.test(m)
          ? "Falta desplegar la Edge Function `crear-pago`. No se cobró nada."
          : /MP_ACCESS_TOKEN/i.test(m)
            ? "Falta configurar MP_ACCESS_TOKEN en Supabase. No se cobró nada."
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
          <h2>Crear link de cobro</h2>
        </header>

        <div className="contenido">
          {link ? (
            <>
              <p className="ok-msg">
                Link listo{correoOk ? ` y enviado a ${cliente.email}` : ""}.
              </p>
              <label className="campo-lbl">
                Link de pago
                <input className="campo" readOnly value={link} onFocus={(e) => e.target.select()} />
              </label>
              <div className="botonera">
                <button type="button" className="btn solido" onClick={copiar}>
                  {copiado ? "¡Copiado!" : "Copiar link"}
                </button>
                <a className="btn" href={link} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              </div>
              <p className="conteo" style={{ marginTop: 10 }}>
                Queda guardado en el historial de pagos del cliente: puedes volver a
                copiarlo desde ahí sin generar un cobro nuevo.
              </p>
            </>
          ) : (
            <>
              <div className="chips" style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  className={"chip" + (modo === "unico" ? " on" : "")}
                  onClick={() => setModo("unico")}
                >
                  Cobro único
                </button>
                <button
                  type="button"
                  className={"chip" + (modo === "mensual" ? " on" : "")}
                  onClick={() => setModo("mensual")}
                >
                  Suscripción mensual
                </button>
              </div>
              <p className="conteo" style={{ marginBottom: 12 }}>
                {modo === "unico"
                  ? "Un pago de una sola vez. Sirve para trabajos puntuales."
                  : "El cliente autoriza una vez y Mercado Pago le cobra solo cada mes. No hay que reenviarlo."}
              </p>

              <label className="campo-lbl">
                Concepto
                <input
                  className="campo"
                  placeholder={
                    modo === "unico"
                      ? "Ej: landing para campaña de septiembre"
                      : "Ej: Bárbara Go · plan mensual"
                  }
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                />
                <small>Es lo que el cliente ve en el checkout y en el correo.</small>
              </label>

              <label className="campo-lbl">
                Monto ({cliente.moneda ?? "CLP"})
                <input
                  className="campo"
                  type="number"
                  min={0}
                  value={monto || ""}
                  placeholder={montoFicha ? String(montoFicha) : "0"}
                  onChange={(e) => setMonto(Number(e.target.value))}
                />
                <small>
                  {montoFicha > 0 && monto <= 0
                    ? `Vacío usa el monto de la ficha: ${plata(montoFicha, cliente.moneda)}.`
                    : "Este monto es solo para este cobro; no cambia la ficha del cliente."}
                </small>
              </label>

              <div className="chips">
                <button
                  type="button"
                  className={"chip" + (enviarCorreo ? " on" : "")}
                  onClick={() => setEnviarCorreo((v) => !v)}
                >
                  Enviar por correo a {cliente.email}
                </button>
              </div>

              {montoFinal <= 0 && (
                <p className="conteo" style={{ marginTop: 10 }}>
                  Escribe un monto: este cliente no tiene uno definido en su ficha.
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
            <button className="btn solido" disabled={trabajando || montoFinal <= 0}>
              {trabajando ? "Generando…" : (
                <>
                  {Ico.cobros({ t: 15 })} Generar link
                </>
              )}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
