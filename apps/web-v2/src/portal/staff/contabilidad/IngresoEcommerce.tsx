/* eslint-disable react-refresh/only-export-components -- CLIENTES_ECOMMERCE
   y LogoShopify se exportan para reusarlos en Productos.tsx (pestaña
   Ecommerce), mismo criterio que graficos.tsx. */
import { useMemo, useState } from "react";
import { plata } from "../../lib/supabase";
import { Barras, corto, mesesDelAnio } from "../graficos";
import type { IngresoCliente } from "./tipos";

/**
 * Una bolsa de compras simple, para marcar que Tecnobox vende por Shopify.
 * Mismo criterio que el círculo "f" de Meta en DesgloseGastos: una marca
 * externa no sigue el lenguaje de íconos monocromos del portal (ver
 * disenio/iconos.tsx), va aparte con su propio color — pero en vez de
 * reconstruir el logo exacto de memoria (fácil de copiar mal un trazo y
 * que salga irreconocible), es una bolsa genérica reconocible sobre el
 * verde de la marca.
 */
export function LogoShopify() {
  return (
    <span className="shopify-marca" aria-hidden="true" title="Shopify">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8Z" fill="#fff" fillOpacity=".15" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    </span>
  );
}

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
 *
 * `clave` tiene que ser IDÉNTICA a `ingresos_clientes.cliente` y a
 * `comision_tramos.cliente` en la base — si no calzan, la fila sale en $0
 * para siempre sin que nada falle a la vista. Silver quedó como `silver`
 * (no `silver_and_co`, como decía este archivo antes de conectarlo el
 * 3-sept-2026).
 */
export const CLIENTES_ECOMMERCE: {
  clave: string;
  nombre: string;
  plataforma?: "shopify";
}[] = [
  { clave: "tecnobox", nombre: "Tecnobox", plataforma: "shopify" },
  { clave: "silver", nombre: "Silver & Co", plataforma: "shopify" },
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

    // TODO lo que se suma o se muestra va en CLP. `comision_calculada` y
    // `venta_neta_mes` están en la moneda del cliente (guaraníes para
    // Silver), así que sumarlas entre clientes daría un número inventado.
    // Las filas viejas de Tecnobox no traen `_clp`; ahí la moneda ya era
    // CLP, así que el propio valor sirve de respaldo.
    const enClp = (f: IngresoCliente, campo: "comision" | "venta") =>
      campo === "comision"
        ? (f.comision_clp ?? f.comision_calculada ?? 0)
        : (f.venta_neta_clp ?? f.venta_neta_mes ?? 0);

    const porCliente = CLIENTES_ECOMMERCE.map((c) => {
      const filas = enPlazo.filter((i) => i.cliente === c.clave);
      const comision = filas.reduce((s, f) => s + enClp(f, "comision"), 0);
      const ventaNeta = filas.reduce((s, f) => s + enClp(f, "venta"), 0);
      const delMesActual = ingresos.find(
        (i) => i.cliente === c.clave && i.mes === mesActual,
      );
      // La moneda original se muestra al lado del monto en CLP: sin eso,
      // ver "$2.305.500" de una tienda que factura en guaraníes hace
      // dudar del número.
      const monedaOrigen = (delMesActual ?? filas[0])?.moneda;
      return {
        ...c,
        comision,
        ventaNeta,
        monedaOrigen: monedaOrigen && monedaOrigen !== "CLP" ? monedaOrigen : null,
        tieneDatos: filas.length > 0,
        borrador: delMesActual?.borrador ?? filas[0]?.borrador ?? false,
      };
    });

    const totalComision = porCliente.reduce((s, c) => s + c.comision, 0);
    const totalVentaNeta = porCliente.reduce((s, c) => s + c.ventaNeta, 0);
    const algunoEsBorrador = porCliente.some((c) => c.tieneDatos && c.borrador);
    // Se nombran los clientes en borrador en vez de decir "Tecnobox" fijo:
    // desde que Silver también entró, el aviso mentía cuando el
    // provisional era el otro.
    const enBorrador = porCliente
      .filter((c) => c.tieneDatos && c.borrador)
      .map((c) => c.nombre)
      .join(" y ");

    // La serie del gráfico siempre es de los 12 meses del año en curso,
    // combinando todos los clientes — el plazo de arriba filtra la cifra
    // grande, no el gráfico, así siempre se ve el año completo de contexto.
    const porMes = new Map<string, number>();
    for (const i of ingresos) {
      if (!i.mes.startsWith(String(anioActual))) continue;
      // En CLP, por lo mismo que arriba: el gráfico combina clientes.
      porMes.set(i.mes, (porMes.get(i.mes) ?? 0) + enClp(i, "comision"));
    }
    const serie = mesesDelAnio(anioActual).map((m) => ({
      et: m.et,
      valor: porMes.get(m.clave) ?? 0,
      futuro: m.futuro,
      esHoy: m.esHoy,
    }));

    return { porCliente, totalComision, totalVentaNeta, algunoEsBorrador, enBorrador, serie };
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
                  {c.plataforma === "shopify" && <LogoShopify />}
                  <b>{c.nombre}</b>
                  {c.tieneDatos && c.borrador && (
                    <span className="pill warn">provisional</span>
                  )}
                </div>
                {c.tieneDatos ? (
                  <>
                    <strong>{plata(c.comision)}</strong>
                    <small>
                      sobre {plata(c.ventaNeta)} de venta neta
                      {c.monedaOrigen && ` · convertido de ${c.monedaOrigen}`}
                    </small>
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
              Los tramos de {d.enBorrador} son un borrador — todavía no los
              confirmó el cliente. Este monto es una proyección, no un cobro
              cerrado.
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
