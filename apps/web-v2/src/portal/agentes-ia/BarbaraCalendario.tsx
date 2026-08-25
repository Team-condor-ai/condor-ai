import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";

type Pieza = {
  id: string;
  fecha: string;
  tipo: string;
  angulo: string | null;
  aprobada_sin_cambios: boolean | null;
  correcciones_pedidas: number | null;
};

const ICONO_TIPO: Record<string, string> = { carrusel: "🖼️", historia: "📱", ugc: "🎬" };
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function lunesDeLaSemana(d: Date) {
  const copia = new Date(d);
  const dow = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - dow);
  copia.setHours(0, 0, 0, 0);
  return copia;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Props = { barbaraClienteId: string; vistaInicial?: "semana" | "mes" };

/**
 * El calendario de contenido — con datos REALES de `barbara_memoria`. No
 * existe todavía un calendario EDITABLE de piezas futuras: Bárbara genera
 * según el cron del workflow, no según un plan pre-armado, así que esto
 * muestra lo que YA se publicó, con su estado real.
 */
export function BarbaraCalendario({ barbaraClienteId, vistaInicial = "mes" }: Props) {
  const [vista, setVista] = useState<"semana" | "mes">(vistaInicial);
  const [ancla, setAncla] = useState(() => new Date());
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [cargando, setCargando] = useState(true);

  // Rango real a pedir según la vista: la semana visible, o el mes completo
  // (incluye los días de relleno del mes anterior/siguiente que se ven en la
  // grilla, igual que cualquier calendario real).
  const inicioSemana = lunesDeLaSemana(ancla);
  const primerDiaMes = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const inicioGrillaMes = lunesDeLaSemana(primerDiaMes);

  const base = vista === "semana" ? inicioSemana : inicioGrillaMes;
  const baseIso = iso(base);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const desde = new Date(baseIso);
    const hasta = new Date(desde); hasta.setDate(hasta.getDate() + (vista === "semana" ? 6 : 41));
    sb.from("barbara_memoria")
      .select("id,fecha,tipo,angulo,aprobada_sin_cambios,correcciones_pedidas")
      .eq("barbara_cliente_id", barbaraClienteId)
      .gte("fecha", iso(desde)).lte("fecha", iso(hasta))
      .then(({ data }) => { if (vivo) { setPiezas((data ?? []) as Pieza[]); setCargando(false); } });
    return () => { vivo = false; };
  }, [barbaraClienteId, vista, baseIso]);

  const dias: Date[] = [];
  const cantidad = vista === "semana" ? 7 : 42;
  for (let i = 0; i < cantidad; i++) { const d = new Date(base); d.setDate(d.getDate() + i); dias.push(d); }

  const piezasDe = (d: Date) => piezas.filter((p) => p.fecha === iso(d));
  const HOY = iso(new Date());

  // Mayúscula SOLO en la primera letra — `text-transform: capitalize` en CSS
  // pone mayúscula en cada palabra, y en español "Agosto De 2026" está mal.
  const conMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const etiquetaRango = vista === "semana"
    ? `${inicioSemana.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – ${new Date(new Date(inicioSemana).setDate(inicioSemana.getDate() + 6)).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`
    : conMayuscula(ancla.toLocaleDateString("es-CL", { month: "long", year: "numeric" }));

  function mover(delta: number) {
    setAncla((a) => {
      const n = new Date(a);
      if (vista === "semana") n.setDate(n.getDate() + delta * 7);
      else n.setMonth(n.getMonth() + delta);
      return n;
    });
  }

  return (
    <div className="barbara-calendario">
      <div className="barbara-calendario-nav">
        <b className="barbara-calendario-rango">{etiquetaRango} <small>(GMT-4)</small></b>
        <div className="barbara-calendario-controles">
          <button className={"chip-toggle" + (vista === "semana" ? " on" : "")} onClick={() => setVista("semana")}>Semana</button>
          <button className={"chip-toggle" + (vista === "mes" ? " on" : "")} onClick={() => setVista("mes")}>Mes</button>
          <button className="chip-toggle" onClick={() => setAncla(new Date())}>Hoy</button>
          <button className="icono-btn" onClick={() => mover(-1)}>{Ico.volver({ t: 14 })}</button>
          <button className="icono-btn" onClick={() => mover(1)} style={{ transform: "scaleX(-1)" }}>{Ico.volver({ t: 14 })}</button>
        </div>
      </div>

      <div className={"barbara-calendario-grilla" + (vista === "mes" ? " mes" : "")}>
        {DIAS.map((d) => <div key={d} className="barbara-calendario-diasem">{d}</div>)}
        {dias.map((d) => {
          const enMes = vista === "semana" || d.getMonth() === ancla.getMonth();
          const hoy = iso(d) === HOY;
          const delDia = piezasDe(d);
          return (
            <div key={d.toISOString()} className={"barbara-calendario-celda" + (hoy ? " hoy" : "") + (enMes ? "" : " fuera")}>
              <div className="barbara-calendario-num">{hoy && <i />}{d.getDate()}</div>
              {delDia.map((p) => (
                <div key={p.id} className="barbara-calendario-chip">
                  <span>{ICONO_TIPO[p.tipo] || "📄"}</span>
                  <small>{p.angulo ? (p.angulo.length > 28 ? p.angulo.slice(0, 26) + "…" : p.angulo) : p.tipo}</small>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!cargando && piezas.length === 0 && (
        <p className="tenue" style={{ marginTop: 10 }}>Sin piezas en este rango todavía.</p>
      )}
    </div>
  );
}
