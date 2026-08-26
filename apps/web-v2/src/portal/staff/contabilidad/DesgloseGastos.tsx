import { useMemo, useState } from "react";
import { plata } from "../../lib/supabase";
import { mesDe } from "../graficos";
import type { Asiento, Cuenta, GastoMeta, MetaAdsAjustes } from "./tipos";

type FilaDistribucion = {
  clave: string;
  nombre: string;
  detalle?: string;
  monto: number;
};

const ORIGENES: Record<string, string> = {
  meta_ads: "Meta Ads · automático",
  manual: "Carga manual",
  fijo: "Gasto fijo",
  cobro: "Cobros y comisiones",
  ratia: "Rat.IA",
};

function ListaDistribucion({
  filas,
  total,
  vacio,
}: {
  filas: FilaDistribucion[];
  total: number;
  vacio: string;
}) {
  const max = Math.max(...filas.map((f) => Math.abs(f.monto)), 1);
  if (!filas.length) return <p className="vacio">{vacio}</p>;

  return (
    <div className="distribucion-lista">
      {filas.map((fila, i) => {
        const porcentaje =
          total > 0 ? Math.round((fila.monto / total) * 100) : 0;
        return (
          <div className="distribucion-fila" key={fila.clave}>
            <div className="distribucion-identidad">
              <i data-tono={String((i % 5) + 1)} aria-hidden="true" />
              <span>
                <b>{fila.nombre}</b>
                {fila.detalle && <small>{fila.detalle}</small>}
              </span>
              <strong>{plata(fila.monto)}</strong>
            </div>
            <div className="distribucion-pista" aria-hidden="true">
              <i
                style={{
                  width: `${Math.max(2, (Math.abs(fila.monto) / max) * 100)}%`,
                }}
              />
            </div>
            <small className="distribucion-porcentaje">
              {porcentaje}% del periodo
            </small>
          </div>
        );
      })}
    </div>
  );
}

export function DesgloseGastos({
  cuentas,
  asientos,
  gastosMeta,
  metaAjustes = null,
}: {
  cuentas: Cuenta[];
  asientos: Asiento[];
  gastosMeta: GastoMeta[];
  metaAjustes?: MetaAdsAjustes | null;
}) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const [periodo, setPeriodo] = useState(mesActual);

  const periodos = useMemo(() => {
    const disponibles = new Set([
      mesActual,
      ...asientos.map((a) => mesDe(a.fecha)),
      ...gastosMeta.map((g) => mesDe(g.fecha)),
    ]);
    return [...disponibles].filter(Boolean).sort().reverse();
  }, [asientos, gastosMeta, mesActual]);

  // Un mes anterior al corte no es un mes sin datos: es un mes que se decidió
  // no contabilizar. La diferencia importa porque el cero de agosto-2026 fue
  // deliberado y sin este aviso parece que el sync se cayó.
  const periodoAntesDelCorte = Boolean(
    metaAjustes && periodo < mesDe(metaAjustes.contabilizar_desde),
  );
  // La pastilla no puede decir "excluido" mientras la tabla de abajo muestra
  // plata: si quedaron filas de antes del corte manda lo que se ve en pantalla.
  const fechaCorteLegible = metaAjustes
    ? new Date(`${metaAjustes.contabilizar_desde}T12:00:00`).toLocaleDateString(
        "es-CL",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : "";

  const d = useMemo(() => {
    const cuentaDe = new Map(cuentas.map((c) => [c.id, c]));
    const porCategoria = new Map<string, FilaDistribucion>();
    const porOrigen = new Map<string, number>();
    let total = 0;
    let metaDesdeLibro = 0;

    for (const asiento of asientos) {
      if (mesDe(asiento.fecha) !== periodo) continue;
      let gastoAsiento = 0;
      for (const linea of asiento.asiento_lineas ?? []) {
        const cuenta = cuentaDe.get(linea.cuenta_id);
        if (cuenta?.tipo !== "gasto") continue;
        const monto = Number(linea.debe ?? 0) - Number(linea.haber ?? 0);
        if (!monto) continue;
        gastoAsiento += monto;
        total += monto;
        const actual = porCategoria.get(cuenta.id) ?? {
          clave: cuenta.id,
          nombre: cuenta.nombre,
          detalle: cuenta.codigo,
          monto: 0,
        };
        actual.monto += monto;
        porCategoria.set(cuenta.id, actual);
      }
      if (gastoAsiento) {
        porOrigen.set(
          asiento.origen,
          (porOrigen.get(asiento.origen) ?? 0) + gastoAsiento,
        );
        if (asiento.origen === "meta_ads") metaDesdeLibro += gastoAsiento;
      }
    }

    const metaPeriodo = gastosMeta.filter((g) => mesDe(g.fecha) === periodo);
    const porCampana = new Map<
      string,
      {
        id: string;
        nombre: string;
        monto: number;
        dias: Set<string>;
        sincronizado: string;
      }
    >();
    for (const gasto of metaPeriodo) {
      const actual = porCampana.get(gasto.campana_id) ?? {
        id: gasto.campana_id,
        nombre: gasto.campana_nombre,
        monto: 0,
        dias: new Set<string>(),
        sincronizado: gasto.sincronizado_en,
      };
      actual.monto += Number(gasto.monto_clp ?? 0);
      actual.dias.add(gasto.fecha);
      if (gasto.sincronizado_en > actual.sincronizado)
        actual.sincronizado = gasto.sincronizado_en;
      porCampana.set(gasto.campana_id, actual);
    }

    // Si la tabla de detalle todavia no fue desplegada, el libro sigue siendo
    // la fuente contable y permite mostrar al menos el gasto por glosa.
    if (!porCampana.size && metaDesdeLibro > 0) {
      for (const asiento of asientos.filter(
        (a) => a.origen === "meta_ads" && mesDe(a.fecha) === periodo,
      )) {
        const nombre =
          asiento.glosa.replace(/^Meta Ads\s*[·-]?\s*/i, "") || "Meta Ads";
        const monto = (asiento.asiento_lineas ?? []).reduce((suma, linea) => {
          const cuenta = cuentaDe.get(linea.cuenta_id);
          return cuenta?.tipo === "gasto"
            ? suma + Number(linea.debe ?? 0) - Number(linea.haber ?? 0)
            : suma;
        }, 0);
        const actual = porCampana.get(nombre) ?? {
          id: nombre,
          nombre,
          monto: 0,
          dias: new Set<string>(),
          sincronizado: asiento.creado_en ?? `${asiento.fecha}T00:00:00Z`,
        };
        actual.monto += monto;
        actual.dias.add(asiento.fecha);
        porCampana.set(nombre, actual);
      }
    }

    const categorias = [...porCategoria.values()].sort(
      (a, b) => b.monto - a.monto,
    );
    const origenes = [...porOrigen.entries()]
      .map(([origen, monto]) => ({
        clave: origen,
        nombre: ORIGENES[origen] ?? origen.replaceAll("_", " "),
        monto,
      }))
      .sort((a, b) => b.monto - a.monto);
    const campanas = [...porCampana.values()].sort((a, b) => b.monto - a.monto);
    const meta =
      metaDesdeLibro || campanas.reduce((suma, c) => suma + c.monto, 0);
    const ultimaSync =
      campanas
        .map((c) => c.sincronizado)
        .filter(Boolean)
        .sort()
        .pop() ?? null;

    return {
      total,
      meta,
      otros: total - meta,
      categorias,
      origenes,
      campanas,
      ultimaSync,
    };
  }, [asientos, cuentas, gastosMeta, periodo]);

  const excluidoYVacio = periodoAntesDelCorte && !d.campanas.length;
  const nombrePeriodo = new Date(`${periodo}-15T12:00:00`).toLocaleDateString(
    "es-CL",
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <>
      <section className="desglose-cabecera">
        <div>
          <span className="sobrelinea">Control de egresos</span>
          <h2>En qué se fue la plata</h2>
          <p>
            Categoría contable, origen del registro y campaña que generó cada
            peso.
          </p>
        </div>
        <label className="campo-lbl desglose-periodo">
          Periodo
          <select
            className="campo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {new Date(`${p}-15T12:00:00`).toLocaleDateString("es-CL", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="desglose-kpis">
        <div>
          <small>Gasto total · {nombrePeriodo}</small>
          <b>{plata(d.total)}</b>
          <span>devengado en el libro contable</span>
        </div>
        <div className="meta">
          <small>Campañas Meta</small>
          <b>{plata(d.meta)}</b>
          <span>
            {d.total > 0 ? Math.round((d.meta / d.total) * 100) : 0}% del gasto
            del periodo
          </span>
        </div>
        <div>
          <small>Otros egresos</small>
          <b>{plata(d.otros)}</b>
          <span>operación, equipo y herramientas</span>
        </div>
        <div>
          <small>Categorías con movimiento</small>
          <b>{d.categorias.length}</b>
          <span>{d.origenes.length} fuentes de registro</span>
        </div>
      </div>

      <div className="desglose-columnas">
        <section className="bloque desglose-panel">
          <header>
            <div>
              <h3>Por categoría</h3>
              <p>La clasificación que usa el estado de resultados.</p>
            </div>
            <b>{plata(d.total)}</b>
          </header>
          <ListaDistribucion
            filas={d.categorias}
            total={d.total}
            vacio="No hay gastos contables en este periodo."
          />
        </section>

        <section className="bloque desglose-panel">
          <header>
            <div>
              <h3>Cómo entraron al libro</h3>
              <p>Automático, fijo o cargado manualmente.</p>
            </div>
          </header>
          <ListaDistribucion
            filas={d.origenes}
            total={d.total}
            vacio="Todavía no hay fuentes de gasto para comparar."
          />
        </section>
      </div>

      <section className="bloque meta-contabilidad">
        <header>
          <div className="meta-titulo">
            <span className="meta-marca" aria-hidden="true">
              f
            </span>
            <div>
              <h3>Campañas de Facebook e Instagram</h3>
              <p>
                Importadas automáticamente desde Meta Ads y conciliadas con el
                libro.
              </p>
            </div>
          </div>
          <div className="meta-estado">
            <span
              className={
                excluidoYVacio
                  ? "pill gris"
                  : d.ultimaSync
                    ? "pill ok"
                    : "pill warn"
              }
            >
              {excluidoYVacio
                ? "Período excluido"
                : d.ultimaSync
                  ? "Sincronización activa"
                  : "Sin datos sincronizados"}
            </span>
            {d.ultimaSync && (
              <small>
                Última lectura{" "}
                {new Date(d.ultimaSync).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            )}
          </div>
        </header>

        {d.campanas.length ? (
          <div className="tabla-caja meta-tabla">
            <table>
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Días con gasto</th>
                  <th>Participación</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {d.campanas.map((campana) => (
                  <tr key={campana.id}>
                    <td>
                      <b>{campana.nombre}</b>
                    </td>
                    <td>{campana.dias.size}</td>
                    <td>
                      <span className="meta-mini-pista">
                        <i
                          style={{
                            width: `${d.meta > 0 ? Math.max(2, (campana.monto / d.meta) * 100) : 0}%`,
                          }}
                        />
                      </span>
                    </td>
                    <td className="num">{plata(campana.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : excluidoYVacio ? (
          <p className="vacio">
            {nombrePeriodo} quedó fuera del registro: la contabilidad de Meta
            Ads parte el {fechaCorteLegible}
            {metaAjustes?.motivo ? ` — ${metaAjustes.motivo}` : "."} El gasto de
            esos días existió en Meta, pero no descuenta en el libro.
          </p>
        ) : (
          <p className="vacio">
            No hay gasto de campañas en {nombrePeriodo}. Cuando Meta reporte
            consumo, aparecerá aquí y en el libro diario.
          </p>
        )}
      </section>
    </>
  );
}
