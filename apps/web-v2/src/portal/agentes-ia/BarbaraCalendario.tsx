import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

type Pieza = {
  id: string;
  fecha: string;
  tipo: string;
  angulo: string | null;
  pilar: string | null;
  aprobada_sin_cambios: boolean | null;
  correcciones_pedidas: number | null;
};

const ETIQUETA_TIPO: Record<string, string> = {
  carrusel: "🖼️ Carrusel", historia: "📱 Historia", ugc: "🎬 UGC",
};

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function lunesDeLaSemana(d: Date) {
  const copia = new Date(d);
  const dow = (copia.getDay() + 6) % 7; // 0 = lunes
  copia.setDate(copia.getDate() - dow);
  copia.setHours(0, 0, 0, 0);
  return copia;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * El calendario de contenido, con datos REALES de `barbara_memoria` — no
 * hay un calendario editable de piezas futuras todavía (Bárbara genera
 * según el cron del workflow, no según un plan pre-armado), así que esto
 * muestra lo que YA se publicó, semana por semana, con su estado real
 * (aprobada / corregida / pendiente de que el cliente responda).
 */
export function BarbaraCalendario({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [semana, setSemana] = useState(() => lunesDeLaSemana(new Date()));
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const desde = iso(semana);
    const hastaD = new Date(semana); hastaD.setDate(hastaD.getDate() + 6);
    const hasta = iso(hastaD);
    sb.from("barbara_memoria")
      .select("id,fecha,tipo,angulo,pilar,aprobada_sin_cambios,correcciones_pedidas")
      .eq("barbara_cliente_id", barbaraClienteId)
      .gte("fecha", desde).lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setError(error.message);
        else { setPiezas((data ?? []) as Pieza[]); setError(""); }
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [barbaraClienteId, semana]);

  const porDia = (offset: number) => {
    const d = new Date(semana); d.setDate(d.getDate() + offset);
    const f = iso(d);
    return { fecha: d, piezas: piezas.filter((p) => p.fecha === f) };
  };

  return (
    <div className="barbara-calendario">
      <div className="barbara-calendario-nav">
        <button className="btn chico" onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(n.getDate() - 7); return n; })}>
          ← Semana anterior
        </button>
        <b>{semana.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – {(() => { const f = new Date(semana); f.setDate(f.getDate() + 6); return f.toLocaleDateString("es-CL", { day: "numeric", month: "short" }); })()}</b>
        <button className="btn chico" onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(n.getDate() + 7); return n; })}>
          Semana siguiente →
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="vacio">Cargando…</p>}

      {!cargando && (
        <div className="barbara-calendario-grilla">
          {DIAS.map((nombre, i) => {
            const { fecha, piezas: delDia } = porDia(i);
            const hoy = iso(fecha) === iso(new Date());
            return (
              <div key={nombre} className={"barbara-calendario-col" + (hoy ? " hoy" : "")}>
                <div className="barbara-calendario-col-tit">
                  <span>{nombre}</span>
                  <small>{fecha.getDate()}</small>
                </div>
                {delDia.length === 0 && <p className="tenue" style={{ fontSize: 12 }}>—</p>}
                {delDia.map((p) => (
                  <div key={p.id} className="barbara-calendario-pieza">
                    <b>{ETIQUETA_TIPO[p.tipo] || p.tipo}</b>
                    {p.angulo && <small>{p.angulo}</small>}
                    <span className={"pill " + (
                      p.aprobada_sin_cambios === true ? "ok"
                        : (p.correcciones_pedidas ?? 0) > 0 ? "gris"
                        : "azul"
                    )}>
                      {p.aprobada_sin_cambios === true ? "Aprobada"
                        : (p.correcciones_pedidas ?? 0) > 0 ? `${p.correcciones_pedidas} corrección(es)`
                        : "Esperando respuesta"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
