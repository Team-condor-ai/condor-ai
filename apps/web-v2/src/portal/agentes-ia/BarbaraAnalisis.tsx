import { useEffect, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Fila = {
  id: string; fecha: string; tipo: string; angulo: string | null;
  aprobada_sin_cambios: boolean | null; correcciones_pedidas: number | null; creado_en: string;
};

/**
 * "Análisis y reportes" con datos REALES, no una maqueta de interacciones
 * de Instagram/TikTok — Bárbara no tiene ninguna integración de métricas de
 * redes sociales conectada todavía (eso requeriría la API de cada
 * plataforma, no algo que exista hoy). Lo que SÍ es real y útil: cuántas
 * piezas salieron, cuántas se aprobaron a la primera, y en qué se pidió
 * corrección más seguido — la misma señal que ya usa la memoria global de
 * Bárbara para aprender (ver `barbara_patrones` / STACK-TECNICO.md).
 */
export function BarbaraAnalisis({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const desde = new Date(); desde.setDate(desde.getDate() - 30);
    sb.from("barbara_memoria")
      .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas,creado_en")
      .eq("barbara_cliente_id", barbaraClienteId)
      .gte("fecha", desde.toISOString().slice(0, 10))
      .order("fecha", { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setError(error.message);
        else { setFilas((data ?? []) as Fila[]); setError(""); }
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const total = filas.length;
  const aprobadas = filas.filter((f) => f.aprobada_sin_cambios === true).length;
  const corregidas = filas.filter((f) => (f.correcciones_pedidas ?? 0) > 0).length;
  const porTipo = filas.reduce<Record<string, number>>((acc, f) => {
    acc[f.tipo] = (acc[f.tipo] ?? 0) + 1;
    return acc;
  }, {});

  if (cargando) return <p className="vacio">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="rejilla-datos" style={{ marginBottom: 18 }}>
        <div className="dato"><small>Piezas · últimos 30 días</small><b>{total}</b></div>
        <div className="dato"><small>Aprobadas a la primera</small><b>{total ? Math.round((aprobadas / total) * 100) : 0}%</b></div>
        <div className="dato"><small>Con al menos 1 corrección</small><b>{total ? Math.round((corregidas / total) * 100) : 0}%</b></div>
        {Object.entries(porTipo).map(([tipo, n]) => (
          <div className="dato" key={tipo}><small>{tipo}</small><b>{n}</b></div>
        ))}
      </div>

      {total === 0 ? (
        <p className="vacio">Sin piezas en los últimos 30 días.</p>
      ) : (
        <div className="tabla-caja">
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Ángulo</th><th>Estado</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>{fecha(f.creado_en)}</td>
                  <td>{f.tipo}</td>
                  <td>{f.angulo || "—"}</td>
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

      <p className="tenue" style={{ marginTop: 14 }}>
        Todavía no hay integración con métricas de Instagram/TikTok (alcance, interacciones) —
        esto muestra lo que Bárbara sabe de verdad: qué generó y cómo respondió la marca.
      </p>
    </div>
  );
}
