import { useEffect, useState } from "react";
import { sb, fecha } from "../../lib/supabase";
import { useConfirmacion } from "../../disenio/Confirmacion";

/**
 * Memoria global de Bárbara: lo que funciona entre TODOS los clientes.
 *
 * POR QUÉ ESTA PANTALLA TIENE QUE EXISTIR
 * ---------------------------------------------------------------------------
 * Los patrones los destila `services/barbara/patrones.mjs` (semanal) y nacen
 * APAGADOS a propósito: con pocos clientes un patrón cruzado es ruido, y
 * aprender de ruido es peor que no aprender. Pero un sistema cuyo resultado
 * depende de un interruptor humano necesita el interruptor: sin esta pantalla
 * los patrones se acumularían para siempre sin influir en nada.
 *
 * LO QUE HAY QUE MIRAR ANTES DE ENCENDER UNO
 * ---------------------------------------------------------------------------
 * Un patrón encendido se le aplica a TODOS los clientes a la vez. La `nota`
 * dice de cuántas piezas y cuántas marcas salió — si son pocas marcas, ese
 * "patrón" describe a un cliente y para eso ya está su memoria individual.
 *
 * LA LÍNEA QUE NO SE CRUZA: acá solo hay patrones de rendimiento, nunca
 * contenido ni identidad de una marca. Está publicado como promesa en la
 * landing de Bárbara. Si algún patrón nombra una marca o un rubro, es un
 * error del destilador: apágalo y avisa.
 */
type Patron = {
  id: string;
  patron: string;
  tipo: string | null;
  muestras: number;
  activo: boolean;
  nota: string | null;
  actualizado_en: string;
  marcas: number;
  confianza_numerica: number | null;
  evidencia: { id?: string; direccion?: string; tasa?: number; tasa_resto?: number; delta?: number } | null;
};

async function consultarPatrones() {
  return sb.from("barbara_patrones")
    .select("id,patron,tipo,muestras,marcas,confianza_numerica,evidencia,activo,nota,actualizado_en")
    .order("activo", { ascending: false }).order("muestras", { ascending: false });
}

export function PatronesGlobales() {
  const confirmar = useConfirmacion();
  const [patrones, setPatrones] = useState<Patron[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    const { data, error } = await consultarPatrones();
    if (error) setError(error.message);
    else setPatrones(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    let vivo = true;
    const timer = window.setTimeout(() => {
      void consultarPatrones().then(({ data, error }) => {
        if (!vivo) return;
        if (error) setError(error.message); else setPatrones((data ?? []) as Patron[]);
        setCargando(false);
      });
    }, 0);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, []);

  async function alternar(p: Patron) {
    if (!p.activo && !await confirmar(
      "¿Encender este patrón global?",
      `Lo aplica a TODOS los clientes en su próxima pieza.

“${p.patron}”

` +
        `Evidencia: ${p.muestras} piezas de ${p.marcas} marcas, ` +
        `diferencia ${Math.round((p.evidencia?.delta || 0) * 100)} puntos.`,
      "Encender",
    )) {
      return;
    }
    setPatrones((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)),
    );
    const { error } = await sb.rpc("barbara_configurar_patron_global", {
      p_patron_id: p.id, p_activo: !p.activo,
    });
    if (error) {
      setError(error.message);
      cargar();
    }
  }

  if (cargando) return <p className="tenue">Cargando patrones…</p>;

  const encendidos = patrones.filter((p) => p.activo).length;

  return (
    <>
      {error ? <p className="error">{error}</p> : null}

      {!patrones.length ? (
        <p className="tenue">
          Todavía no hay patrones. Se destilan solos cada lunes a partir de las
          piezas que los clientes aprobaron sin cambios frente a las que
          pidieron corregir. Hacen falta al menos 12 piezas cerradas de 3 marcas
          distintas — con menos, cualquier patrón sería casualidad.
        </p>
      ) : (
        <>
          <p className="tenue" style={{ marginBottom: 10 }}>
            {encendidos} de {patrones.length} encendido
            {encendidos === 1 ? "" : "s"}.{" "}
            {encendidos === 0
              ? "Ninguno está influyendo en la generación todavía."
              : "Los encendidos entran en el prompt de todos los clientes."}
          </p>

          <ul className="lista-reglas">
            {patrones.map((p) => (
              <li key={p.id} className={"regla" + (p.activo ? "" : " apagada")}>
                <div className="regla-txt">
                  <span>{p.patron}</span>
                  <div className="regla-meta">
                    {p.tipo ? <span className="etiqueta-cat">{p.tipo}</span> : null}
                    <span className="veces">{p.muestras} piezas</span>
                    <span className="veces">{p.marcas} marcas</span>
                    {p.evidencia?.delta != null && (
                      <span className="veces">{p.evidencia.delta > 0 ? "+" : ""}{Math.round(p.evidencia.delta * 100)} pts vs. resto</span>
                    )}
                    {p.nota ? <span className="origen">{p.nota}</span> : null}
                    <span className="veces">{fecha(p.actualizado_en)}</span>
                  </div>
                </div>
                <button type="button" className="btn chico" onClick={() => alternar(p)}>
                  {p.activo ? "Apagar" : "Encender"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
