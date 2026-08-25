import { useEffect, useMemo, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Metrica = {
  barbara_memoria_id: string; programacion_id: string; plataforma: Plataforma;
  capturado_en: string; me_gusta: number; comentarios: number; compartidos: number;
  guardados: number; alcance: number; impresiones: number; reproducciones: number;
  clics: number; seguidores: number | null; interacciones: number;
};
type Canal = { plataforma: Plataforma; activo: boolean; account_ref: string | null };

/** Las cuatro que acepta `barbara_canales` (CHECK en la base). */
type Plataforma = "instagram" | "facebook" | "tiktok" | "linkedin";

const REDES: { id: Plataforma; nombre: string; cuenta: string }[] = [
  { id: "instagram", nombre: "Instagram", cuenta: "Instagram Business" },
  { id: "facebook", nombre: "Facebook", cuenta: "Página de Facebook" },
  { id: "tiktok", nombre: "TikTok", cuenta: "TikTok Business" },
  { id: "linkedin", nombre: "LinkedIn", cuenta: "Página de LinkedIn" },
];

/**
 * "Análisis y reportes" — el rendimiento de la CUENTA en cada red.
 *
 * QUÉ CAMBIÓ Y POR QUÉ (25-ago-2026)
 * ---------------------------------------------------------------------------
 * Antes esto medía la PRODUCCIÓN de Bárbara: cuántas piezas salieron, cuántas
 * se aprobaron a la primera, el mix por tipo. Es información real y útil para
 * el equipo, pero no es lo que un cliente entra a mirar acá: él quiere saber
 * cómo le está yendo a su cuenta. Pedido explícito de Joaquín.
 *
 * Ahora la pantalla se organiza por RED —Instagram, Facebook, TikTok,
 * LinkedIn, las cuatro que acepta `barbara_canales`— y cada una muestra el
 * estado real de esa cuenta.
 *
 * DE DÓNDE SALEN LOS NÚMEROS, Y POR QUÉ NO HAY NINGUNO INVENTADO
 * ---------------------------------------------------------------------------
 * `barbara_metricas_actuales` es la vista de las métricas confirmadas por
 * publicación, con `plataforma` y `seguidores`. La alimenta un recolector
 * externo autorizado (Meta Insights, TikTok Analytics, Metricool…) contra la
 * función `barbara-metricas`, con firma HMAC — ver `services/barbara/METRICAS.md`.
 *
 * Ese recolector TODAVÍA NO ESTÁ CONECTADO. Por eso cada red tiene tres
 * estados posibles y ninguno es un número de relleno:
 *
 *   · sin canal          → la red no está dada de alta para este cliente.
 *   · canal sin métricas → publica, pero nadie está enviando la analítica.
 *   · con métricas       → los agregados reales de esa cuenta.
 *
 * Rellenar los huecos con datos de ejemplo sería lo peor posible acá: un
 * reporte que miente es más caro que un reporte vacío, porque se toman
 * decisiones con él.
 */
export function BarbaraAnalisis({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    // El `setCargando(true)` va DENTRO de la función asíncrona, no suelto en
    // el cuerpo del efecto: ahí dispararía un render extra sincrónico antes
    // de que el efecto termine (react-hooks/set-state-in-effect).
    void (async () => {
      setCargando(true);
      await Promise.all([
      sb.from("barbara_metricas_actuales")
        .select("barbara_memoria_id,programacion_id,plataforma,capturado_en,me_gusta,comentarios,compartidos,guardados,alcance,impresiones,reproducciones,clics,seguidores,interacciones")
        .eq("barbara_cliente_id", barbaraClienteId),
      sb.from("barbara_canales")
        .select("plataforma,activo,account_ref")
        .eq("barbara_cliente_id", barbaraClienteId),
      ]).then(([rm, rc]) => {
        if (!vivo) return;
        // Que falte la analítica no puede tumbar la pantalla: los canales
        // solos ya dicen algo útil ("está conectada, falta el recolector").
        setMetricas(rm.error ? [] : ((rm.data ?? []) as Metrica[]));
        setCanales(rc.error ? [] : ((rc.data ?? []) as Canal[]));
        setError(rc.error?.message || "");
        setCargando(false);
      });
    })();
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const porRed = useMemo(() => {
    const mapa = new Map<Plataforma, Metrica[]>();
    for (const m of metricas) {
      if (!mapa.has(m.plataforma)) mapa.set(m.plataforma, []);
      mapa.get(m.plataforma)!.push(m);
    }
    return mapa;
  }, [metricas]);

  const canalDe = (p: Plataforma) => canales.find((c) => c.plataforma === p);

  if (cargando) return <p className="vacio">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;

  const algunaConDatos = REDES.some((r) => (porRed.get(r.id)?.length ?? 0) > 0);

  return (
    <div className="barbara-analisis">
      {!algunaConDatos && (
        <p className="tenue" style={{ marginBottom: 16 }}>
          Todavía no llegan estadísticas de ninguna cuenta. Se activan cuando se
          conecta un recolector de analítica a la red — mientras tanto, Bárbara
          publica igual, pero no puede medir el resultado.
        </p>
      )}

      <div className="barbara-redes">
        {REDES.map((red) => (
          <PanelRed
            key={red.id}
            nombre={red.nombre}
            cuenta={red.cuenta}
            canal={canalDe(red.id)}
            filas={porRed.get(red.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

const formato = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);

function PanelRed({ nombre, cuenta, canal, filas }: {
  nombre: string; cuenta: string; canal: Canal | undefined; filas: Metrica[];
}) {
  const totales = filas.reduce(
    (acc, m) => ({
      alcance: acc.alcance + Number(m.alcance || 0),
      impresiones: acc.impresiones + Number(m.impresiones || 0),
      interacciones: acc.interacciones + Number(m.interacciones || 0),
      reproducciones: acc.reproducciones + Number(m.reproducciones || 0),
    }),
    { alcance: 0, impresiones: 0, interacciones: 0, reproducciones: 0 },
  );

  // Los seguidores son un valor de CUENTA, no una suma: se toma la lectura
  // más reciente. Sumarlos daría "12 publicaciones × 4.000 seguidores".
  const ultima = filas.reduce<Metrica | null>(
    (mejor, m) => (!mejor || m.capturado_en > mejor.capturado_en ? m : mejor), null);
  const seguidores = ultima?.seguidores ?? null;

  // Tasa de interacción sobre ALCANCE (personas únicas), no sobre
  // impresiones: es la definición que usan las propias plataformas, y sobre
  // impresiones el número sale sistemáticamente más bajo y no se puede
  // comparar con nada de lo que el cliente lea afuera.
  const tasa = totales.alcance > 0
    ? (totales.interacciones / totales.alcance) * 100 : null;

  const conectada = Boolean(canal?.activo);

  return (
    <section className="barbara-red">
      <header>
        <div>
          <b>{nombre}</b>
          {canal?.account_ref && <small>{canal.account_ref}</small>}
        </div>
        <span className={"pill " + (conectada ? "ok" : "gris")}>
          {conectada ? "Conectada" : "Sin conectar"}
        </span>
      </header>

      {filas.length === 0 ? (
        <p className="tenue">
          {conectada
            ? "Conectada para publicar, pero todavía no llegan estadísticas de esta cuenta."
            : `Falta dar de alta la cuenta de ${cuenta} para publicar y medir.`}
        </p>
      ) : (
        <>
          <div className="barbara-red-cifras">
            {seguidores !== null && (
              <div><small>Seguidores</small><b>{formato(seguidores)}</b></div>
            )}
            <div><small>Alcance</small><b>{formato(totales.alcance)}</b></div>
            <div><small>Interacciones</small><b>{formato(totales.interacciones)}</b></div>
            {tasa !== null && (
              <div><small>Tasa de interacción</small><b>{tasa.toFixed(1)}%</b></div>
            )}
            {totales.reproducciones > 0 && (
              <div><small>Reproducciones</small><b>{formato(totales.reproducciones)}</b></div>
            )}
            <div><small>Publicaciones medidas</small><b>{filas.length}</b></div>
          </div>
          {ultima && (
            <p className="tenue barbara-red-pie">
              Última medición: {fecha(ultima.capturado_en)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
