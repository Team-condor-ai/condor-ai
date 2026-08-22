import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { sb, plata } from "../lib/supabase";
import type { Cobro } from "../staff/tipos";

type EstadoVista = "confirmando" | "pagado" | "activa" | "pendiente" | "rechazado";

type Resultado = {
  estado?: string;
  monto?: number;
  moneda?: string;
  detalle?: string;
  error?: string;
};

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ResultadoPago() {
  const [params] = useSearchParams();
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";
  const cobroId = params.get("cobro_id") || "";
  const [estado, setEstado] = useState<EstadoVista>("confirmando");
  const [detalle, setDetalle] = useState("Estamos confirmando la operación con Mercado Pago.");
  const [monto, setMonto] = useState<number | null>(null);
  const [moneda, setMoneda] = useState("CLP");

  useEffect(() => {
    let vivo = true;

    async function revisarCobro() {
      if (!cobroId) return false;
      const { data } = await sb.from("cobros").select("*").eq("id", cobroId).maybeSingle();
      const cobro = data as Cobro | null;
      if (!cobro || !vivo) return false;
      setMonto(cobro.monto);
      setMoneda(cobro.moneda);
      setDetalle(cobro.titulo || `Cobro ${cobro.numero}`);
      if (cobro.estado === "pagado") {
        setEstado("pagado");
        return true;
      }
      if (cobro.estado === "activa") {
        setEstado("activa");
        return true;
      }
      if (cobro.estado === "cancelada" || cobro.estado === "anulado") {
        setEstado("rechazado");
        return true;
      }
      return false;
    }

    async function verificar() {
      try {
        if (paymentId) {
          const { data, error } = await sb.functions.invoke("verificar-pago", {
            body: { payment_id: paymentId },
          });
          if (error) throw error;
          const r = (data || {}) as Resultado;
          if (r.error) throw new Error(r.error);
          if (!vivo) return;
          setMonto(r.monto ?? null);
          setMoneda(r.moneda || "CLP");
          setDetalle(r.detalle || "Pago condor.ai");
          setEstado(
            r.estado === "pagado"
              ? "pagado"
              : r.estado === "rechazado" || r.estado === "reembolsado"
                ? "rechazado"
                : "pendiente",
          );
          return;
        }

        // El retorno de una suscripción puede llegar antes que su webhook. Se
        // consulta la fila RLS unas pocas veces sin recargar la página.
        for (let intento = 0; intento < 6 && vivo; intento += 1) {
          if (await revisarCobro()) return;
          await espera(1200);
        }
        if (vivo) {
          setEstado("pendiente");
          setDetalle("La autorización fue recibida y sigue en confirmación.");
        }
      } catch {
        if (!vivo) return;
        // Una caída de red no convierte el pago en rechazado. El webhook puede
        // confirmarlo igualmente y el historial se actualizará después.
        setEstado("pendiente");
        setDetalle("Mercado Pago recibió la operación; aún estamos conciliándola.");
      }
    }

    void verificar();
    return () => { vivo = false; };
  }, [cobroId, paymentId]);

  const copia = {
    confirmando: {
      marca: "···",
      titulo: "Confirmando tu pago",
      texto: "No cierres esta ventana. Normalmente toma solo unos segundos.",
    },
    pagado: {
      marca: "✓",
      titulo: "Pago confirmado",
      texto: "Quedó registrado en tu cuenta y ya aparece en tu historial.",
    },
    activa: {
      marca: "✓",
      titulo: "Suscripción activada",
      texto: "Autorizaste el cobro automático. Cada cuota aparecerá en tu historial cuando Mercado Pago la acredite.",
    },
    pendiente: {
      marca: "·",
      titulo: "Confirmación en proceso",
      texto: "Puedes volver a tu cuenta. Actualizaremos el estado automáticamente.",
    },
    rechazado: {
      marca: "!",
      titulo: "La operación no se completó",
      texto: "No registramos un pago. Puedes intentarlo nuevamente desde tu plan.",
    },
  }[estado];

  return (
    <>
      <div className="barra">
        <h1>Estado del pago</h1>
      </div>
      <div className="cuerpo pago-resultado-wrap">
        <section className={`pago-resultado ${estado}`} aria-live="polite">
          <div className="pago-resultado-marca" aria-hidden="true">{copia.marca}</div>
          <p className="pago-eyebrow">Mercado Pago · condor.ai</p>
          <h2>{copia.titulo}</h2>
          <p className="pago-resultado-texto">{copia.texto}</p>

          {(monto !== null || detalle) && (
            <dl className="pago-resumen">
              <div>
                <dt>Concepto</dt>
                <dd>{detalle}</dd>
              </div>
              {monto !== null && (
                <div>
                  <dt>Monto</dt>
                  <dd>{plata(monto, moneda)}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="pago-pasos" aria-label="Progreso del pago">
            <span className="listo">Cobro creado</span>
            <span className="listo">Mercado Pago</span>
            <span className={estado === "pagado" || estado === "activa" ? "listo" : "actual"}>
              {estado === "activa" ? "Autorizada" : "Confirmado"}
            </span>
          </div>

          <div className="botonera pago-resultado-acciones">
            <Link className="btn solido" to="/acceso/plan">Volver a mi cuenta</Link>
            {estado === "rechazado" && (
              <Link className="btn" to="/acceso/plan">Intentar de nuevo</Link>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
