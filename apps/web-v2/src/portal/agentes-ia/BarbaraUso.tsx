import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { BARBARA_CUOTAS } from "./tipos";

type Tipo = "carrusel" | "historia" | "ugc";
const ETIQUETA: Record<Tipo, string> = { carrusel: "Carruseles", historia: "Historias", ugc: "Videos UGC" };

/** Cuota operacional, calculada desde piezas originales del mes. Las
 * correcciones tienen `corrige_a`, por lo que no cuentan como una entrega. */
export function BarbaraUso({ barbaraClienteId, plan }: { barbaraClienteId: string; plan: string }) {
  const [usadas, setUsadas] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const mes = useMemo(() => new Date().toLocaleDateString("es-CL", { month: "long" }), []);
  useEffect(() => {
    const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0);
    sb.from("barbara_memoria").select("tipo,corrige_a").eq("barbara_cliente_id", barbaraClienteId).gte("fecha", inicio.toISOString().slice(0, 10)).is("corrige_a", null)
      .then(({ data }) => {
        setUsadas((data ?? []).reduce<Record<string, number>>((total, pieza) => ({ ...total, [pieza.tipo]: (total[pieza.tipo] ?? 0) + 1 }), {}));
        setCargando(false);
      });
  }, [barbaraClienteId]);
  const cuotas = BARBARA_CUOTAS[plan] ?? BARBARA_CUOTAS.barbara;
  return <section className="barbara-uso" aria-label="Uso mensual del plan">
    <header><span>Uso de {mes}</span><small>{cargando ? "Actualizando…" : "Las correcciones no consumen cuota"}</small></header>
    <div>{(Object.keys(ETIQUETA) as Tipo[]).map((tipo) => {
      const limite = cuotas[tipo]; const usada = usadas[tipo] ?? 0; const porcentaje = limite ? Math.min(100, (usada / limite) * 100) : 0;
      return <article key={tipo} className={limite ? "" : "no-incluido"}><small>{ETIQUETA[tipo]}</small><b>{limite ? `${usada} / ${limite}` : "No incluido"}</b>{limite > 0 && <i><span style={{ width: porcentaje + "%" }} /></i>}</article>;
    })}</div>
  </section>;
}
