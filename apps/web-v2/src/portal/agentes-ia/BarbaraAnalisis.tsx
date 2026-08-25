import { useEffect, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Fila = {
  id: string; fecha: string; tipo: string; angulo: string | null;
  aprobada_sin_cambios: boolean | null; correcciones_pedidas: number | null; creado_en: string;
};

type Metrica = {
  programacion_id: string; barbara_memoria_id: string; plataforma: string; capturado_en: string;
  me_gusta: number; comentarios: number; compartidos: number; guardados: number;
  alcance: number; impresiones: number; reproducciones: number; clics: number; interacciones: number;
};

type Consumo = {
  id: string; estado: "completa" | "fallida"; fin: string;
  tokens_entrada: number; tokens_salida: number; tokens_cache_lectura: number;
  imagenes: number; video_segundos: number;
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
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [metricasDisponibles, setMetricasDisponibles] = useState(true);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    const hoy = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
    const hace60 = new Date(hoy); hace60.setDate(hace60.getDate() - 60);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    Promise.all([
      sb.from("barbara_memoria")
        .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas,creado_en")
        .eq("barbara_cliente_id", barbaraClienteId)
        .gte("fecha", hace30.toISOString().slice(0, 10))
        .order("fecha", { ascending: false }),
      sb.from("barbara_memoria")
        .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas,creado_en")
        .eq("barbara_cliente_id", barbaraClienteId)
        .gte("fecha", hace60.toISOString().slice(0, 10)).lt("fecha", hace30.toISOString().slice(0, 10)),
      sb.from("barbara_metricas_actuales")
        .select("programacion_id,barbara_memoria_id,plataforma,capturado_en,me_gusta,comentarios,compartidos,guardados,alcance,impresiones,reproducciones,clics,interacciones")
        .eq("barbara_cliente_id", barbaraClienteId),
      sb.from("barbara_consumos")
        .select("id,estado,fin,tokens_entrada,tokens_salida,tokens_cache_lectura,imagenes,video_segundos")
        .eq("barbara_cliente_id", barbaraClienteId).gte("fin", inicioMes).order("fin", { ascending: false }),
    ]).then(([r1, r2, r3, r4]) => {
      if (!vivo) return;
      if (r1.error) setError(r1.error.message);
      else {
        setFilas((r1.data ?? []) as Fila[]);
        setFilasPrev((r2.data ?? []) as Fila[]);
        setMetricas((r3.data ?? []) as Metrica[]);
        setMetricasDisponibles(!r3.error);
        setConsumos((r4.data ?? []) as Consumo[]);
        setError("");
      }
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const total = filas.length;
  const totalPrev = filasPrev.length;
  const aprobadas = filas.filter((f) => f.aprobada_sin_cambios === true).length;
  const tasaAprobacion = total ? Math.round((aprobadas / total) * 100) : 0;
  const tasaAprobacionPrev = totalPrev ? Math.round((filasPrev.filter((f) => f.aprobada_sin_cambios === true).length / totalPrev) * 100) : 0;
  const porTipo = filas.reduce<Record<string, number>>((acc, f) => { acc[f.tipo] = (acc[f.tipo] ?? 0) + 1; return acc; }, {});
  const totalesRed = metricas.reduce((acc, m) => ({
    alcance: acc.alcance + Number(m.alcance || 0),
    interacciones: acc.interacciones + Number(m.interacciones || 0),
    reproducciones: acc.reproducciones + Number(m.reproducciones || 0),
  }), { alcance: 0, interacciones: 0, reproducciones: 0 });
  const consumoMes = consumos.reduce((acc, c) => ({
    tokens: acc.tokens + Number(c.tokens_entrada || 0) + Number(c.tokens_salida || 0),
    cache: acc.cache + Number(c.tokens_cache_lectura || 0),
    imagenes: acc.imagenes + Number(c.imagenes || 0),
    video: acc.video + Number(c.video_segundos || 0),
    fallas: acc.fallas + (c.estado === "fallida" ? 1 : 0),
  }), { tokens: 0, cache: 0, imagenes: 0, video: 0, fallas: 0 });
  const formato = (n: number) => new Intl.NumberFormat("es-CL", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

  const variacion = (actual: number, previo: number) =>
    previo === 0 ? null : Math.round(((actual - previo) / previo) * 100);

  const varPiezas = variacion(total, totalPrev);
  const varAprobacion = tasaAprobacion - tasaAprobacionPrev;

  if (cargando) return <p className="vacio">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="barbara-stats-fila">
        {metricasDisponibles && metricas.length > 0 && (
          <>
            <div className="barbara-stat-tarjeta">
              <span className="barbara-stat-icono">👀</span>
              <b>Alcance confirmado</b>
              <div className="barbara-stat-numero">{formato(totalesRed.alcance)}</div>
              <small>{metricas.length} publicación(es) medidas</small>
            </div>
            <div className="barbara-stat-tarjeta">
              <span className="barbara-stat-icono">💬</span>
              <b>Interacciones reales</b>
              <div className="barbara-stat-numero">{formato(totalesRed.interacciones)}</div>
              <small>Me gusta, comentarios, compartidos, guardados y clics</small>
            </div>
            {totalesRed.reproducciones > 0 && (
              <div className="barbara-stat-tarjeta">
                <span className="barbara-stat-icono">▶️</span>
                <b>Reproducciones</b>
                <div className="barbara-stat-numero">{formato(totalesRed.reproducciones)}</div>
              </div>
            )}
          </>
        )}
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
        {Object.entries(porTipo).map(([tipo, n]) => (
          <div className="barbara-stat-tarjeta" key={tipo}>
            <span className="barbara-stat-icono">{ICONO_TIPO[tipo] || "📄"}</span>
            <b style={{ textTransform: "capitalize" }}>{tipo}</b>
            <div className="barbara-stat-numero">{n}</div>
          </div>
        ))}
      </div>

      {metricas.length > 0 && (
        <div className="barbara-tarjeta-interna">
          <h3>📈 Rendimiento por publicación</h3>
          <div className="tabla-caja">
            <table>
              <thead><tr><th>Red</th><th>Actualizado</th><th>Alcance</th><th>Interacciones</th><th>Guardados</th></tr></thead>
              <tbody>{[...metricas].sort((a, b) => b.alcance - a.alcance).map((m) => (
                <tr key={m.programacion_id}>
                  <td style={{ textTransform: "capitalize" }}>{m.plataforma}</td>
                  <td>{fecha(m.capturado_en)}</td>
                  <td>{formato(m.alcance)}</td>
                  <td>{formato(m.interacciones)}</td>
                  <td>{formato(m.guardados)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {consumos.length > 0 && (
        <div className="barbara-tarjeta-interna">
          <h3>⚙️ Consumo técnico del mes</h3>
          <div className="barbara-stats-fila">
            <div className="barbara-stat-tarjeta"><b>Tokens procesados</b><div className="barbara-stat-numero">{formato(consumoMes.tokens)}</div><small>{formato(consumoMes.cache)} servidos desde caché</small></div>
            <div className="barbara-stat-tarjeta"><b>Imágenes generadas</b><div className="barbara-stat-numero">{formato(consumoMes.imagenes)}</div></div>
            <div className="barbara-stat-tarjeta"><b>Video generado</b><div className="barbara-stat-numero">{formato(consumoMes.video)}s</div></div>
            <div className="barbara-stat-tarjeta"><b>Intentos registrados</b><div className="barbara-stat-numero">{consumos.length}</div><small>{consumoMes.fallas} fallido(s), también contabilizados</small></div>
          </div>
          <p className="tenue">Son unidades reales de uso, no una estimación monetaria. Las tarifas pueden cambiar sin alterar este historial.</p>
        </div>
      )}

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
                        f.aprobada_sin_cambios === true ? "ok"
                          : (f.correcciones_pedidas ?? 0) > 0 ? "gris" : "azul"
                      )}>
                        {f.aprobada_sin_cambios === true ? "Aprobada"
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

      {!metricasDisponibles && <p className="tenue" style={{ marginTop: 14 }}>
        Las métricas externas todavía no están habilitadas en este entorno. Las cifras visibles arriba
        corresponden sólo a producción y aprobaciones verificadas por Bárbara.
      </p>}
    </div>
  );
}
