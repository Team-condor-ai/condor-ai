import { useMemo, useState } from "react";
import { plata } from "../../lib/supabase";
import { Barras, corto, mesesDelAnio } from "../graficos";
import type { IngresoCliente } from "./tipos";

/**
 * La tarjeta grande de "Monto Ecommerce" en el panel principal.
 *
 * PEDIDO EXACTO: un número grande arriba, y al apretarlo se ve el
 * desglose por cliente (Tecnobox, Silver and Co) y la comisión
 * acumulada en el plazo elegido. Por eso es una tarjeta que se expande
 * en el lugar, no un link a otra pantalla — lo que se pidió ver "al
 * apretarlo" tiene que aparecer ahí mismo.
 *
 * CLIENTES CONOCIDOS DE ANTEMANO, aunque no tengan datos todavía.
 * Silver and Co no tiene nada conectado aún (1-sept-2026): se declara
 * igual acá, con monto en $0 y un aviso explícito, para que la tarjeta
 * no cambie de forma el día que se conecte — solo deja de estar vacía.
 */
const CLIENTES_ECOMMERCE: { clave: string; nombre: string }[] = [
  { clave: "tecnobox", nombre: "Tecnobox" },
  { clave: "silver_and_co", nombre: "Silver and Co" },
];

type Plazo = "mes" | "trimestre" | "anio";
const PLAZOS: { valor: Plazo; etiqueta: string; meses: number }[] = [
  { valor: "mes", etiqueta: "Este mes", meses: 1 },
  { valor: "trimestre", etiqueta: "Últimos 3 meses", meses: 3 },
  { valor: "anio", etiqueta: "Este año", meses: 12 },
];

export function IngresoEcommerce({
  ingresos,
}: {
  ingresos: IngresoCliente[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [plazo, setPlazo] = useState<Plazo>("mes");

  const d = useMemo(() => {
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const anioActual = hoy.getFullYear();
    const config = PLAZOS.find((p) => p.valor === plazo)!;

    // Los últimos N meses terminando en el actual, "YYYY-MM" para comparar
    // como texto sin líos de zona horaria.
    const mesesDelPlazo = new Set(
      Array.from({ length: config.meses }, (_, i) => {
        const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
      }),
    );

    const enPlazo = ingresos.filter((i) => mesesDelPlazo.has(i.mes));

    const porCliente = CLIENTES_ECOMMERCE.map((c) => {
      const filas = enPlazo.filter((i) => i.cliente === c.clave);
      const comision = filas.reduce((s, f) => s + (f.comision_calculada ?? 0), 0);
      const ventaNeta = filas.reduce((s, f) => s + (f.venta_neta_mes ?? 0), 0);
      const delMesActual = ingresos.find(
        (i) => i.cliente === c.clave && i.mes === mesActual,
      );
      return {
        ...c,
        comision,
        ventaNeta,
        tieneDatos: filas.length > 0,
        borrador: delMesActual?.borrador ?? filas[0]?.borrador ?? false,
      };
    });

    const totalComision = porCliente.reduce((s, c) => s + c.comision, 0);
    const totalVentaNeta = porCliente.reduce((s, c) => s + c.ventaNeta, 0);
    const algunoEsBorrador = porCliente.some((c) => c.tieneDatos && c.borrador);

    // La serie del gráfico siempre es de los 12 meses del año en curso,
    // combinando todos los clientes — el plazo de arriba filtra la cifra
    // grande, no el gráfico, así siempre se ve el año completo de contexto.
    const porMes = new Map<string, number>();
    for (const i of ingresos) {
      if (!i.mes.startsWith(String(anioActual))) continue;
      porMes.set(i.mes, (porMes.get(i.mes) ?? 0) + (i.comision_calculada ?? 0));
    }
    const serie = mesesDelAnio(anioActual).map((m) => ({
      et: m.et,
      valor: porMes.get(m.clave) ?? 0,
      futuro: m.futuro,
      esHoy: m.esHoy,
    }));

    return { porCliente, totalComision, totalVentaNeta, algunoEsBorrador, serie };
  }, [ingresos, plazo]);

  return (
    <section className="bloque ingreso-ecommerce">
      <button
        type="button"
        className="ingreso-ecommerce-resumen"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <div className="cifra">
          <small>Monto Ecommerce</small>
          <b>{plata(d.totalComision)}</b>
          <span>
            comisión acumulada ·{" "}
            {PLAZOS.find((p) => p.valor === plazo)?.etiqueta.toLowerCase()}
            {d.algunoEsBorrador && " · provisional"}
          </span>
        </div>
        <i className={`ingreso-ecommerce-flecha${abierto ? " abierta" : ""}`} aria-hidden="true">
          ▾
        </i>
      </button>

      {abierto && (
        <div className="ingreso-ecommerce-detalle">
          <div className="ingreso-ecommerce-plazos">
            {PLAZOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                className={`chip${plazo === p.valor ? " on" : ""}`}
                onClick={() => setPlazo(p.valor)}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <div className="ingreso-ecommerce-clientes">
            {d.porCliente.map((c) => (
              <div key={c.clave} className="ingreso-ecommerce-cliente">
                <div>
                  <b>{c.nombre}</b>
                  {c.tieneDatos && c.borrador && (
                    <span className="pill warn">provisional</span>
                  )}
                </div>
                {c.tieneDatos ? (
                  <>
                    <strong>{plata(c.comision)}</strong>
                    <small>sobre {plata(c.ventaNeta)} de venta neta</small>
                  </>
                ) : (
                  <p className="ingreso-ecommerce-sin-datos">
                    Sin conectar todavía
                  </p>
                )}
              </div>
            ))}
          </div>

          {d.algunoEsBorrador && (
            <p className="ingreso-ecommerce-aviso">
              Los tramos de comisión de Tecnobox son un borrador — todavía no
              los confirmó el cliente. Este monto es una proyección, no un
              cobro cerrado.
            </p>
          )}

          <h3>
            Comisión por mes{" "}
            <span className="tenue" style={{ fontWeight: 400 }}>
              · {new Date().getFullYear()}, todos los clientes
            </span>
          </h3>
          <Barras datos={d.serie} formato={corto} alto={120} />
        </div>
      )}
    </section>
  );
}
