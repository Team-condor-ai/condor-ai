/* Componentes y utilidades gráficas comparten deliberadamente este módulo. */
/* eslint-disable react-refresh/only-export-components */
import { Ico } from "../disenio/iconos";

/**
 * Piezas de gráfico compartidas por los resúmenes del portal.
 *
 * TODO A MANO, SIN LIBRERÍA
 * ---------------------------------------------------------------------------
 * Un gráfico de barras son divs con una altura en porcentaje, y uno de líneas
 * es una `polyline` de SVG. Traer una librería costaría cientos de kB en un
 * portal que ya carga el generador de PDF en diferido justamente por peso.
 */

export const MESES_ET = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export type Mes = { clave: string; et: string; futuro: boolean; esHoy: boolean };

/**
 * Los doce meses de un AÑO CALENDARIO, de enero a diciembre.
 *
 * Antes era una ventana rodante de 12 meses hacia atrás. Se leía mal: el eje
 * empezaba en un mes cualquiera y comparar dos años era imposible porque cada
 * uno arrancaba en otro lado. Un año va de enero a diciembre.
 *
 * Los meses que todavía no llegan vienen marcados: no es que valgan cero, es
 * que aún no pasan, y un gráfico que los dibuja iguales miente.
 */
export function mesesDelAnio(anio: number): Mes[] {
  const hoy = new Date();
  const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  return MESES_ET.map((et, i) => {
    const clave = `${anio}-${String(i + 1).padStart(2, "0")}`;
    return { clave, et, futuro: clave > claveHoy, esHoy: clave === claveHoy };
  });
}

/** Los meses que VIENEN, para las proyecciones. */
export function proximosMeses(n: number) {
  const hoy = new Date();
  const out: { clave: string; et: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    out.push({
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      et: MESES_ET[d.getMonth()],
    });
  }
  return out;
}

/** Los últimos n meses cerrados (sin el actual, que va a medias). */
export function mesesCerrados(n: number) {
  const hoy = new Date();
  const out: string[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** El mes de una fecha ISO, por texto: no hay zona horaria que se meta. */
export const mesDe = (iso: string | null | undefined) => (iso ?? "").slice(0, 7);

/** Cifras cortas para las etiquetas: 1.4M, 269k, 900. */
export const corto = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(Math.round(n));

export function Delta({ hoy, antes }: { hoy: number; antes: number }) {
  // Sin base de comparación no se inventa un porcentaje: un salto "+100%"
  // desde cero no dice nada.
  if (antes === 0) return hoy > 0 ? <span className="delta sube">nuevo</span> : null;
  const pct = Math.round(((hoy - antes) / antes) * 100);
  const clase = pct > 0 ? "sube" : pct < 0 ? "baja" : "neutro";
  return <span className={"delta " + clase}>{pct > 0 ? "+" : ""}{pct}%</span>;
}

/** Las flechas para cambiar de año. */
export function NavAnio({ anio, setAnio }: { anio: number; setAnio: (n: number) => void }) {
  const actual = new Date().getFullYear();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
      {anio !== actual && (
        <button className="btn chico" onClick={() => setAnio(actual)} title="Volver al año actual">
          Hoy
        </button>
      )}
      <button
        className="icono-btn"
        onClick={() => setAnio(anio - 1)}
        title={`Ver ${anio - 1}`}
        aria-label={`Ver ${anio - 1}`}
      >
        {Ico.volver({ t: 15 })}
      </button>
      <b style={{ minWidth: 46, textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
        {anio}
      </b>
      <button
        className="icono-btn"
        onClick={() => setAnio(anio + 1)}
        disabled={anio >= actual}
        style={anio >= actual ? { opacity: 0.35, cursor: "default" } : undefined}
        title={`Ver ${anio + 1}`}
        aria-label={`Ver ${anio + 1}`}
      >
        <span style={{ display: "grid", placeItems: "center", transform: "rotate(180deg)" }}>
          {Ico.volver({ t: 15 })}
        </span>
      </button>
    </span>
  );
}

/**
 * Barras por mes.
 *
 * CADA COLUMNA ES UNA GRILLA DE TRES FILAS, Y NO ES UN DETALLE
 * ---------------------------------------------------------------------------
 * Con flexbox, la cifra de arriba no ocupa lugar cuando el mes va en cero (un
 * span vacío no genera línea), así que esa columna quedaba más corta y su
 * etiqueta subía unos píxeles: el eje de meses salía en dos alturas distintas.
 * Con `grid-template-rows: 18px 1fr 16px` las tres filas miden lo mismo en
 * todas las columnas, tengan contenido o no.
 */
export function Barras({
  datos,
  formato,
  alto = 168,
}: {
  datos: { et: string; valor: number; futuro?: boolean; esHoy?: boolean }[];
  formato: (n: number) => string;
  alto?: number;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div
      className="graf-barras"
      style={{ height: alto, alignItems: "stretch", paddingTop: 8, gap: 6 }}
    >
      {datos.map((d, i) => {
        const pct = Math.max((d.valor / max) * 100, d.valor > 0 ? 4 : 0);
        return (
          <div
            key={i}
            className="col"
            // `alignItems`/`justifyItems` explícitos: la clase `.col` del ERP
            // trae `align-items:center`, que en flex-column centra en
            // HORIZONTAL — pero al pasar a grid pasa a centrar en VERTICAL y
            // aplasta la celda de la barra a 1px. Se veían las cifras y no las
            // barras. Misma trampa de siempre: una propiedad heredada que
            // significa otra cosa en el modo nuevo.
            style={{
              display: "grid", gridTemplateRows: "18px 1fr 16px", gap: 0, minWidth: 0,
              alignItems: "stretch", justifyItems: "center",
            }}
            title={d.futuro ? `${d.et}: todavía no llega` : `${d.et}: ${formato(d.valor)}`}
          >
            <span
              className="val"
              style={{
                alignSelf: "end",
                color: d.esHoy ? "var(--texto)" : undefined,
                opacity: d.futuro ? 0 : 1,
              }}
            >
              {d.valor > 0 ? formato(d.valor) : " "}
            </span>

            <span
              style={{
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                minHeight: 0, width: "100%",
                // La línea de base va acá y no en el contenedor: así corre
                // exactamente bajo las barras y no bajo las etiquetas.
                borderBottom: "1px solid var(--borde)",
              }}
            >
              {d.futuro ? (
                // Un mes que todavía no llega se dibuja rayado y a media
                // altura: no vale cero, es que aún no pasa.
                <i
                  style={{
                    height: "100%", width: "100%", maxWidth: 54, borderRadius: "6px 6px 0 0",
                    background:
                      "repeating-linear-gradient(135deg, var(--borde) 0 2px, transparent 2px 7px)",
                    opacity: 0.55,
                  }}
                />
              ) : (
                <i
                  style={{
                    height: `${pct}%`,
                    minHeight: d.valor > 0 ? undefined : 0,
                    background: d.esHoy
                      ? "linear-gradient(180deg, var(--azul-fuerte), var(--azul))"
                      : "var(--azul)",
                    opacity: d.esHoy ? 1 : 0.66,
                  }}
                />
              )}
            </span>

            <span className="et" style={{ alignSelf: "start", opacity: d.futuro ? 0.45 : 1 }}>
              {d.et}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type Serie = { nombre: string; color: string; valores: number[]; guion?: boolean };

/**
 * Varias series en el tiempo, para comparar escenarios.
 *
 * `preserveAspectRatio="none"` estira el dibujo al ancho disponible; sin
 * `vectorEffect="non-scaling-stroke"` ese estirón deformaría también el grosor
 * de las líneas y unas saldrían más gordas que otras según el ancho.
 */
export function Lineas({
  etiquetas,
  series,
  formato,
}: {
  etiquetas: string[];
  series: Serie[];
  formato: (n: number) => string;
}) {
  const W = 1000, H = 300, PAD = 8;
  const todos = series.flatMap((s) => s.valores);
  const max = Math.max(...todos, 1);
  const min = Math.min(...todos, 0);
  const rango = max - min || 1;
  const x = (i: number) => (etiquetas.length < 2 ? W / 2 : (i / (etiquetas.length - 1)) * W);
  const y = (v: number) => H - PAD - ((v - min) / rango) * (H - PAD * 2);
  const EJE = 52;

  return (
    // El eje va en HTML y no en `<text>` del SVG: con
    // `preserveAspectRatio="none"` el dibujo se estira al ancho disponible, y
    // ese estirón deformaría también las letras.
    <div className="graf-linea" style={{ position: "relative", paddingLeft: EJE }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, top: 0, width: EJE - 8, height: 170,
          fontSize: 10.5, color: "var(--texto-3)", textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {[1, 0.5, 0].map((f) => (
          <span
            key={f}
            style={{
              position: "absolute",
              top: `calc(${((1 - f) * (H - PAD * 2) + PAD) / H * 100}% - 7px)`,
              right: 0,
            }}
          >
            {formato(min + rango * f)}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {/* Área entre el mejor y el peor escenario: el ancho de esa banda ES
            la incertidumbre, y se lee de un vistazo mejor que tres líneas. */}
        {series.length >= 2 && (
          <polygon
            points={
              series[0].valores.map((v, i) => `${x(i)},${y(v)}`).join(" ") +
              " " +
              [...series[series.length - 1].valores]
                .map((v, i) => ({ v, i }))
                .reverse()
                .map(({ v, i }) => `${x(i)},${y(v)}`)
                .join(" ")
            }
            fill="var(--azul)"
            opacity="0.09"
          />
        )}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1="0" x2={W} y1={y(min + rango * f)} y2={y(min + rango * f)}
            stroke="var(--borde)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s) => (
          <polyline
            key={s.nombre}
            points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.guion ? "7 6" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="graf-et">
        {etiquetas.map((e, i) => (
          <span key={i}>{e}</span>
        ))}
      </div>

      <div className="leyenda">
        {series.map((s) => (
          <span key={s.nombre}>
            <i style={{ background: s.color }} />
            {s.nombre}
            <b style={{ marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>
              {formato(s.valores[s.valores.length - 1] ?? 0)}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}
