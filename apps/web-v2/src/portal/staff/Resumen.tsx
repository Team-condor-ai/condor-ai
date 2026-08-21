import { useMemo, useState } from "react";
import { plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useCambio } from "../lib/cambio";
import { Barras, Delta, NavAnio, corto, mesDe, mesesDelAnio } from "./graficos";
import type { Cliente, Cobro } from "./tipos";

/** Lo mínimo que necesita el resumen de cada pago. */
export type PagoResumen = {
  cliente_id: string;
  cobro_id: string | null;
  monto: number | null;
  estado: string | null;
  fecha: string | null;
  creado_en: string | null;
};

/**
 * Los números de arriba de Clientes: KPIs y dos gráficos de barras.
 *
 * SIN LIBRERÍA DE GRÁFICOS, Y ES UNA DECISIÓN
 * ---------------------------------------------------------------------------
 * Dos gráficos de barras son divs con una altura en porcentaje. Traer una
 * librería para esto costaría cientos de kB en un portal que ya carga el
 * generador de PDF en diferido justamente por peso. El CSS (`.graf-barras`)
 * ya venía en la hoja del ERP sin que nadie lo usara.
 *
 * LAS MONEDAS NO SE CONVIERTEN
 * ---------------------------------------------------------------------------
 * Sumar CLP con USD necesita un tipo de cambio, y un tipo de cambio escrito a
 * mano en el código envejece en silencio: los totales siguen saliendo, cada vez
 * más falsos. (El panel viejo tenía `USD:950` escrito a mano desde junio.)
 * Acá se calcula sobre la moneda que más se usa y se avisa si quedó algo fuera.
 */

export function Resumen({
  clientes,
  cobros,
  pagos,
}: {
  clientes: Cliente[];
  cobros: Cobro[];
  pagos: PagoResumen[];
}) {
  const cambio = useCambio();
  // Qué año calendario se está mirando. Las flechas lo cambian.
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  const d = useMemo(() => {
    const meses = mesesDelAnio(anio);
    // Los KPIs miran SIEMPRE el mes real, no el año que se esté viendo:
    // cambiar de año no puede cambiar "cuánto llevo este mes".
    const h = new Date();
    const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mesHoy = clave(h);
    const mesAntes = clave(new Date(h.getFullYear(), h.getMonth() - 1, 1));

    // Moneda de cada pago: la de su cobro, y si no la de su cliente.
    const monedaCobro = new Map(cobros.map((c) => [c.id, c.moneda]));
    const monedaCliente = new Map(clientes.map((c) => [c.id, c.moneda ?? "CLP"]));
    const monedaDe = (p: PagoResumen) =>
      (p.cobro_id ? monedaCobro.get(p.cobro_id) : null) ??
      monedaCliente.get(p.cliente_id) ??
      "CLP";

    const pagados = pagos.filter((p) => p.estado === "pagado");

    // TODO SE LLEVA A PESOS. Antes se elegía la moneda que más se usaba y el
    // resto quedaba fuera del total: un cliente en dólares simplemente no
    // aparecía en las gráficas. Ahora se convierte con el cambio del día.
    const usadas = new Set<string>();
    for (const p of pagados) usadas.add((monedaDe(p) || "CLP").toUpperCase());

    // Recaudado por mes. `fecha` es cuándo entró la plata de verdad;
    // `creado_en` solo dice cuándo se registró la fila.
    const recaudado = new Map<string, number>();
    for (const p of pagados) {
      const k = mesDe(p.fecha ?? p.creado_en);
      recaudado.set(k, (recaudado.get(k) ?? 0) + cambio.aCLP(p.monto, monedaDe(p)));
    }

    const nuevos = new Map<string, number>();
    for (const c of clientes) {
      const k = mesDe(c.creado_en);
      nuevos.set(k, (nuevos.get(k) ?? 0) + 1);
    }

    // Recurrente = solo los mensuales ACTIVOS, o sea los que Mercado Pago está
    // cobrando de verdad. Los 'pendiente' están acordados pero el cliente aún no
    // autoriza: contarlos sería facturación imaginaria.
    const vivos = new Set(clientes.filter((c) => !c.archivado).map((c) => c.id));
    const mensuales = cobros.filter((c) => c.tipo === "mensual" && vivos.has(c.cliente_id));
    for (const c of mensuales) usadas.add((c.moneda ?? "CLP").toUpperCase());

    const recurrente = mensuales
      .filter((c) => c.estado === "activa")
      .reduce((t, c) => t + cambio.aCLP(c.monto, c.moneda), 0);
    const porActivar = mensuales
      .filter((c) => c.estado === "pendiente")
      .reduce((t, c) => t + cambio.aCLP(c.monto, c.moneda), 0);

    return {
      // Monedas que aparecen en los datos y NO se pudieron convertir: su plata
      // no está contada, y la pantalla tiene que decirlo.
      sinTasa: [...usadas].filter((m) => !cambio.tieneTasa(m)),
      convertidas: [...usadas].filter((m) => m !== "CLP" && cambio.tieneTasa(m)),
      activos: clientes.filter((c) => !c.archivado).length,
      nuevosHoy: nuevos.get(mesHoy) ?? 0,
      nuevosAntes: nuevos.get(mesAntes) ?? 0,
      recaudadoHoy: recaudado.get(mesHoy) ?? 0,
      recaudadoAntes: recaudado.get(mesAntes) ?? 0,
      recurrente,
      porActivar,
      serieRecaudado: meses.map((m) => ({
        et: m.et, valor: recaudado.get(m.clave) ?? 0, futuro: m.futuro, esHoy: m.esHoy,
      })),
      serieNuevos: meses.map((m) => ({
        et: m.et, valor: nuevos.get(m.clave) ?? 0, futuro: m.futuro, esHoy: m.esHoy,
      })),
      totalAnio: meses.reduce((t, m) => t + (recaudado.get(m.clave) ?? 0), 0),
      totalHistorico: pagados.reduce((t, p) => t + cambio.aCLP(p.monto, monedaDe(p)), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, cobros, pagos, anio, cambio.listo, cambio.fecha]);


  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="tile">{Ico.clientes({ t: 18 })}</div>
          <div className="cifra">
            <b>{d.activos}</b>
            <Delta hoy={d.nuevosHoy} antes={d.nuevosAntes} />
          </div>
          <p>
            Clientes activos · {d.nuevosHoy} nuevo{d.nuevosHoy === 1 ? "" : "s"} este mes
          </p>
        </div>

        <div className="kpi">
          <div className="tile">{Ico.cobros({ t: 18 })}</div>
          <div className="cifra">
            <b>{plata(d.recaudadoHoy)}</b>
            <Delta hoy={d.recaudadoHoy} antes={d.recaudadoAntes} />
          </div>
          <p>Recaudado este mes · {plata(d.recaudadoAntes)} el mes pasado</p>
        </div>

        <div className="kpi">
          <div className="tile">{Ico.repetir({ t: 18 })}</div>
          <div className="cifra">
            <b>{plata(d.recurrente)}</b>
          </div>
          <p>
            Recurrente al mes · suscripciones cobrando
            {d.porActivar > 0 && (
              <> · <b>{plata(d.porActivar)}</b> más sin activar</>
            )}
          </p>
        </div>

        <div className="kpi">
          <div className="tile">{Ico.grafo({ t: 18 })}</div>
          <div className="cifra">
            <b>{plata(d.recurrente * 12)}</b>
          </div>
          <p>Anual estimado · lo recurrente × 12, sin contar cobros únicos</p>
        </div>
      </div>

      {(d.convertidas.length > 0 || d.sinTasa.length > 0) && (
        <p className="conteo" style={{ marginBottom: 14 }}>
          {d.convertidas.length > 0 && (
            <>
              Todo en <b>CLP</b>. Lo cobrado en {d.convertidas.join(", ")} se
              convirtió con el cambio
              {cambio.fecha ? <> del <b>{fecha(cambio.fecha)}</b></> : " más reciente"}.{" "}
            </>
          )}
          {d.sinTasa.length > 0 && (
            <b style={{ color: "var(--mal-tx)" }}>
              No hay cambio para {d.sinTasa.join(", ")}: esa plata NO está
              contada en los números de arriba.
            </b>
          )}
        </p>
      )}

      {/* La navegación de año va ARRIBA de las dos tarjetas y no dentro del
          título de una: metida en un `h3`, ese título ocupaba dos líneas y su
          gráfico arrancaba más abajo que el de al lado. Se veían desniveladas. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <NavAnio anio={anio} setAnio={setAnio} />
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          marginBottom: 18,
        }}
      >
        <section className="bloque" style={{ margin: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, margin: "0 0 6px" }}>
            Recaudado por mes{" "}
            <span className="tenue" style={{ fontWeight: 400 }}>
              · {plata(d.totalAnio)} en {anio}
            </span>
          </h3>
          <Barras datos={d.serieRecaudado} formato={corto} />
        </section>

        <section className="bloque" style={{ margin: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, margin: "0 0 6px" }}>
            Clientes nuevos por mes{" "}
            <span className="tenue" style={{ fontWeight: 400 }}>· {anio}</span>
          </h3>
          <Barras datos={d.serieNuevos} formato={(n) => String(n)} />
        </section>
      </div>
    </>
  );
}
