import { useEffect, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Fila = {
  id: string; fecha: string; tipo: string; angulo: string | null;
  aprobada_sin_cambios: boolean | null; correcciones_pedidas: number | null; estado: "en_revision" | "requiere_ajuste" | "aprobada" | "publicada" | "historica" | null; creado_en: string;
};

const ICONO_TIPO: Record<string, string> = { carrusel: "🖼️", historia: "📱", ugc: "🎬" };

/**
 * "Análisis y reportes" con datos REALES, no una maqueta de interacciones
 * de Instagram/TikTok — Bárbara no tiene ninguna integración de métricas de
 * redes sociales conectada todavía (eso requeriría la API de cada
 * plataforma). Se mantiene la MISMA estructura visual de tarjetas de
 * estadística que la referencia (icono + número grande + variación), pero
 * con lo que sí es real: cuántas piezas salieron, tasa de aprobación, y
 * el mix por tipo — la misma señal que ya usa la memoria global de Bárbara
 * para aprender.
 */
export function BarbaraAnalisis({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filasPrev, setFilasPrev] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const hoy = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
    const hace60 = new Date(hoy); hace60.setDate(hace60.getDate() - 60);
    Promise.all([
      sb.from("barbara_memoria")
        .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas,estado,creado_en")
        .eq("barbara_cliente_id", barbaraClienteId)
        .gte("fecha", hace30.toISOString().slice(0, 10))
        .order("fecha", { ascending: false }),
      sb.from("barbara_memoria")
        .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas,estado,creado_en")
        .eq("barbara_cliente_id", barbaraClienteId)
        .gte("fecha", hace60.toISOString().slice(0, 10)).lt("fecha", hace30.toISOString().slice(0, 10)),
    ]).then(([r1, r2]) => {
      if (!vivo) return;
      if (r1.error) setError(r1.error.message);
      else { setFilas((r1.data ?? []) as Fila[]); setFilasPrev((r2.data ?? []) as Fila[]); setError(""); }
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const total = filas.length;
  const totalPrev = filasPrev.length;
  const aprobadas = filas.filter((f) => f.estado === "aprobada" || f.estado === "publicada" || f.aprobada_sin_cambios === true).length;
  const tasaAprobacion = total ? Math.round((aprobadas / total) * 100) : 0;
  const tasaAprobacionPrev = totalPrev ? Math.round((filasPrev.filter((f) => f.estado === "aprobada" || f.estado === "publicada" || f.aprobada_sin_cambios === true).length / totalPrev) * 100) : 0;
  const porTipo = filas.reduce<Record<string, number>>((acc, f) => { acc[f.tipo] = (acc[f.tipo] ?? 0) + 1; return acc; }, {});

  const variacion = (actual: number, previo: number) =>
    previo === 0 ? null : Math.round(((actual - previo) / previo) * 100);

  const varPiezas = variacion(total, totalPrev);
  const varAprobacion = tasaAprobacion - tasaAprobacionPrev;
  const porRevisar = filas.filter((f) => f.estado === "en_revision" || f.estado === "requiere_ajuste").length;

  if (cargando) return <p className="vacio">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="barbara-stats-fila">
        <div className="barbara-stat-tarjeta">
          <span className="barbara-stat-icono">✅</span>
          <b>Piezas · 30 días</b>
          <div className="barbara-stat-numero">{total}</div>
          {varPiezas !== null && (
            <small className={varPiezas >= 0 ? "arriba" : "abajo"}>
              {varPiezas >= 0 ? "↑" : "↓"} {Math.abs(varPiezas)}% vs. periodo anterior
            </small>
          )}
        </div>
        <div className="barbara-stat-tarjeta">
          <span className="barbara-stat-icono">🎯</span>
          <b>Aprobadas a la primera</b>
          <div className="barbara-stat-numero">{tasaAprobacion}%</div>
          <small className={varAprobacion >= 0 ? "arriba" : "abajo"}>
            {varAprobacion >= 0 ? "↑" : "↓"} {Math.abs(varAprobacion)} pts vs. periodo anterior
          </small>
        </div>
        <div className="barbara-stat-tarjeta">
          <span className="barbara-stat-icono">Revisión</span>
          <b>En revisión</b>
          <div className="barbara-stat-numero">{porRevisar}</div>
          <small>Esperando una decisión</small>
        </div>
        {Object.entries(porTipo).map(([tipo, n]) => (
          <div className="barbara-stat-tarjeta" key={tipo}>
            <span className="barbara-stat-icono">{ICONO_TIPO[tipo] || "📄"}</span>
            <b style={{ textTransform: "capitalize" }}>{tipo}</b>
            <div className="barbara-stat-numero">{n}</div>
          </div>
        ))}
      </div>

      <div className="barbara-tarjeta-interna">
        <h3>{ICONO_TIPO.carrusel} Piezas de los últimos 30 días</h3>
        {total === 0 ? (
          <p className="vacio">Sin piezas todavía.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead><tr><th>Fecha</th><th>Contenido</th><th>Tipo</th><th>Estado</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>{fecha(f.creado_en)}</td>
                    <td>{f.angulo || "—"}</td>
                    <td>{ICONO_TIPO[f.tipo] || ""} {f.tipo}</td>
                    <td>
                      <span className={"pill " + (
                        f.estado === "publicada" || f.estado === "aprobada" || f.aprobada_sin_cambios === true ? "ok"
                          : (f.correcciones_pedidas ?? 0) > 0 ? "gris" : "azul"
                      )}>
                        {f.estado === "publicada" ? "Publicada"
                          : f.estado === "aprobada" || f.aprobada_sin_cambios === true ? "Aprobada"
                          : (f.correcciones_pedidas ?? 0) > 0 ? `${f.correcciones_pedidas} corrección(es)`
                          : "Esperando"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="tenue" style={{ marginTop: 14 }}>
        Todavía no hay integración con métricas de Instagram/TikTok (alcance, interacciones) —
        esto muestra lo que Bárbara sabe de verdad: qué generó y cómo respondió la marca.
      </p>
    </div>
  );
}
