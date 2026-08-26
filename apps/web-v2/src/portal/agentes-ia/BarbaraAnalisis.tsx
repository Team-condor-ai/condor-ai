import { useEffect, useMemo, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Plataforma = "instagram" | "facebook" | "tiktok" | "linkedin";
type Metrica = {
  barbara_memoria_id: string; programacion_id: string; plataforma: Plataforma;
  capturado_en: string; me_gusta: number; comentarios: number; compartidos: number;
  guardados: number; alcance: number; impresiones: number; reproducciones: number;
  clics: number; seguidores: number | null; interacciones: number;
};
type Canal = { plataforma: Plataforma; activo: boolean; account_ref: string | null };
type ProgramacionMetrica = {
  id: string; tipo: string; programada_para: string; titulo: string | null;
  barbara_memoria: { angulo: string | null } | { angulo: string | null }[] | null;
};
type Punto = Metrica & { fecha: string; titulo: string; tipo: string; tasa: number };

const REDES: { id: Plataforma; nombre: string; cuenta: string }[] = [
  { id: "instagram", nombre: "Instagram", cuenta: "Instagram Business" },
  { id: "facebook", nombre: "Facebook", cuenta: "Página de Facebook" },
  { id: "tiktok", nombre: "TikTok", cuenta: "TikTok Business" },
  { id: "linkedin", nombre: "LinkedIn", cuenta: "Página de LinkedIn" },
];

const formato = (n: number) => new Intl.NumberFormat("es-CL", {
  notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1,
}).format(n);

function pasoBonito(maximo: number, divisiones = 4) {
  const bruto = Math.max(1, maximo) / divisiones;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / magnitud;
  const factor = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return factor * magnitud;
}

const memoriaDe = (p?: ProgramacionMetrica) => p
  ? Array.isArray(p.barbara_memoria) ? p.barbara_memoria[0] : p.barbara_memoria
  : null;

const suma = (filas: Metrica[], campo: keyof Metrica) =>
  filas.reduce((total, fila) => total + Number(fila[campo] || 0), 0);

export function BarbaraAnalisis({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [programaciones, setProgramaciones] = useState<ProgramacionMetrica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      setCargando(true);
      const [rm, rc, rp] = await Promise.all([
        sb.from("barbara_metricas_actuales")
          .select("barbara_memoria_id,programacion_id,plataforma,capturado_en,me_gusta,comentarios,compartidos,guardados,alcance,impresiones,reproducciones,clics,seguidores,interacciones")
          .eq("barbara_cliente_id", barbaraClienteId),
        sb.from("barbara_canales").select("plataforma,activo,account_ref").eq("barbara_cliente_id", barbaraClienteId),
        sb.from("barbara_programaciones")
          .select("id,tipo,programada_para,titulo,barbara_memoria(angulo)")
          .eq("barbara_cliente_id", barbaraClienteId).eq("estado", "publicada")
          .order("programada_para", { ascending: true }).limit(90),
      ]);
      if (!vivo) return;
      setMetricas(rm.error ? [] : ((rm.data ?? []) as Metrica[]));
      setCanales(rc.error ? [] : ((rc.data ?? []) as Canal[]));
      setProgramaciones(rp.error ? [] : ((rp.data ?? []) as unknown as ProgramacionMetrica[]));
      setError(rc.error?.message || "");
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const puntos = useMemo<Punto[]>(() => {
    const porId = new Map(programaciones.map((p) => [p.id, p]));
    return metricas.map((m) => {
      const p = porId.get(m.programacion_id);
      return {
        ...m,
        fecha: p?.programada_para || m.capturado_en,
        titulo: p?.titulo || memoriaDe(p)?.angulo || "Publicación",
        tipo: p?.tipo || "pieza",
        tasa: Number(m.alcance) > 0 ? (Number(m.interacciones) / Number(m.alcance)) * 100 : 0,
      };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [metricas, programaciones]);

  const porRed = useMemo(() => {
    const mapa = new Map<Plataforma, Metrica[]>();
    for (const metrica of metricas) {
      if (!mapa.has(metrica.plataforma)) mapa.set(metrica.plataforma, []);
      mapa.get(metrica.plataforma)!.push(metrica);
    }
    return mapa;
  }, [metricas]);

  if (cargando) return <p className="vacio">Cargando análisis…</p>;
  if (error) return <p className="error">{error}</p>;

  const alcance = suma(metricas, "alcance");
  const interacciones = suma(metricas, "interacciones");
  const reproducciones = suma(metricas, "reproducciones");
  const tasa = alcance > 0 ? (interacciones / alcance) * 100 : 0;
  const algunaConDatos = metricas.length > 0;

  return (
    <div className="barbara-analisis">
      {!algunaConDatos ? (
        <EstadoAnaliticaVacia conectadas={canales.filter((c) => c.activo).length} />
      ) : (
        <>
          <section className="barbara-analisis-resumen" aria-label="Resumen de rendimiento">
            <div><small>Alcance acumulado</small><b>{formato(alcance)}</b><span>personas alcanzadas por las piezas medidas</span></div>
            <div><small>Interacciones</small><b>{formato(interacciones)}</b><span>likes, comentarios, guardados, compartidos y clics</span></div>
            <div><small>Tasa de interacción</small><b>{tasa.toFixed(1)}%</b><span>interacciones sobre alcance</span></div>
            <div><small>Reproducciones</small><b>{formato(reproducciones)}</b><span>cuando la red reporta video</span></div>
          </section>

          <div className="barbara-graficas-grid">
            <GraficaRendimiento puntos={puntos} />
            <MezclaInteracciones metricas={metricas} />
          </div>
          <div className="barbara-graficas-grid inferior">
            <MejoresPiezas puntos={puntos} />
            <LecturaBarbara puntos={puntos} />
          </div>
        </>
      )}

      <section className="barbara-analisis-redes">
        <div className="barbara-analisis-seccion-titulo">
          <span className="barbara-rotulo">Por canal</span><h2>Estado de tus cuentas</h2>
        </div>
        <div className="barbara-redes">
          {REDES.map((red) => <PanelRed key={red.id} nombre={red.nombre} cuenta={red.cuenta}
            canal={canales.find((c) => c.plataforma === red.id)} filas={porRed.get(red.id) ?? []} />)}
        </div>
      </section>
    </div>
  );
}

function EstadoAnaliticaVacia({ conectadas }: { conectadas: number }) {
  return <section className="barbara-analisis-vacio">
    <span className="barbara-analisis-orbita" aria-hidden="true"><i /></span>
    <div><span className="barbara-rotulo">Esperando señal</span><h2>Todavía no hay publicaciones medidas</h2>
      <p>{conectadas
        ? "La cuenta está conectada para publicar. Las curvas aparecerán cuando el recolector envíe las primeras métricas confirmadas."
        : "Conecta al menos una cuenta social y su recolector para ver alcance, interacción, reproducciones y rendimiento por pieza."}</p></div>
  </section>;
}

function GraficaRendimiento({ puntos }: { puntos: Punto[] }) {
  const datos = puntos.slice(-10);
  const ancho = 720, alto = 250;
  const margen = { arriba: 38, derecha: 28, abajo: 22, izquierda: 58 };
  const maximoDatos = Math.max(1, ...datos.map((p) => Number(p.alcance || 0)));
  const paso = pasoBonito(maximoDatos);
  const maximo = Math.ceil(maximoDatos / paso) * paso;
  const marcasY = Array.from({ length: Math.round(maximo / paso) + 1 }, (_, i) => i * paso);
  const yDe = (valor: number) => alto - margen.abajo
    - (valor / maximo) * (alto - margen.arriba - margen.abajo);
  const coordenadas = datos.map((p, i) => ({
    x: datos.length === 1
      ? (margen.izquierda + ancho - margen.derecha) / 2
      : margen.izquierda + (i / (datos.length - 1)) * (ancho - margen.izquierda - margen.derecha),
    y: yDe(Number(p.alcance || 0)), p,
  }));
  const linea = coordenadas.map((p) => `${p.x},${p.y}`).join(" ");
  const area = coordenadas.length
    ? `${coordenadas[0].x},${alto - margen.abajo} ${linea} ${coordenadas.at(-1)?.x},${alto - margen.abajo}`
    : "";
  return <section className="barbara-grafica barbara-grafica-evolucion">
    <header><div><small>Rendimiento reciente</small><h3>Alcance por publicación</h3></div><span>Últimas {datos.length}</span></header>
    <div className="barbara-grafica-lienzo">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Evolución del alcance de las publicaciones recientes">
        <defs><linearGradient id="barbara-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDFB3E" stopOpacity=".26" /><stop offset="1" stopColor="#CDFB3E" stopOpacity="0" /></linearGradient></defs>
        {marcasY.map((valor) => <g key={valor}>
          <line x1={margen.izquierda} y1={yDe(valor)} x2={ancho - margen.derecha} y2={yDe(valor)} className="guia" />
          <text x={margen.izquierda - 10} y={yDe(valor) + 3} textAnchor="end" className="eje-y">{formato(valor)}</text>
        </g>)}
        <polygon points={area} fill="url(#barbara-area)" /><polyline points={linea} className="linea" />
        {coordenadas.map(({ x, y, p }) => <g key={p.programacion_id}>
          <text x={x} y={y - 12} textAnchor="middle" className="valor-punto">{formato(p.alcance)}</text>
          <circle cx={x} cy={y} r="5"><title>{p.titulo}: {formato(p.alcance)} de alcance</title></circle>
        </g>)}
      </svg>
      <div className="barbara-grafica-etiquetas">{datos.map((p) => <span key={p.programacion_id}>{new Date(p.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>)}</div>
    </div>
  </section>;
}

function MezclaInteracciones({ metricas }: { metricas: Metrica[] }) {
  const segmentos = [
    { nombre: "Me gusta", valor: suma(metricas, "me_gusta"), clase: "likes" },
    { nombre: "Guardados", valor: suma(metricas, "guardados"), clase: "guardados" },
    { nombre: "Compartidos", valor: suma(metricas, "compartidos"), clase: "compartidos" },
    { nombre: "Comentarios", valor: suma(metricas, "comentarios"), clase: "comentarios" },
    { nombre: "Clics", valor: suma(metricas, "clics"), clase: "clics" },
  ];
  const total = segmentos.reduce((acc, s) => acc + s.valor, 0);
  return <section className="barbara-grafica barbara-mezcla">
    <header><div><small>Calidad de respuesta</small><h3>Qué hace la audiencia</h3></div><span>{formato(total)} acciones</span></header>
    <div className="barbara-mezcla-barra" aria-label="Distribución de interacciones">{segmentos.filter((s) => s.valor > 0).map((s) => <i key={s.nombre} className={s.clase} style={{ width: `${(s.valor / Math.max(1, total)) * 100}%` }} title={`${s.nombre}: ${formato(s.valor)}`} />)}</div>
    <div className="barbara-mezcla-lista">{segmentos.map((s) => <div key={s.nombre}><i className={s.clase} /><span>{s.nombre}</span><b>{formato(s.valor)}</b><small>{total ? `${((s.valor / total) * 100).toFixed(0)}%` : "0%"}</small></div>)}</div>
  </section>;
}

function MejoresPiezas({ puntos }: { puntos: Punto[] }) {
  const mejores = [...puntos].sort((a, b) => b.tasa - a.tasa).slice(0, 5);
  const maxima = Math.max(1, ...mejores.map((p) => p.tasa));
  return <section className="barbara-grafica barbara-ranking">
    <header><div><small>Comparativa</small><h3>Piezas con mejor respuesta</h3></div><span>por tasa</span></header>
    <ol>{mejores.map((p) => <li key={p.programacion_id}>
      <div><b>{p.titulo}</b><small>{p.tipo} · {p.plataforma}</small></div>
      <span><i style={{ width: `${(p.tasa / maxima) * 100}%` }} /></span><strong>{p.tasa.toFixed(1)}%</strong>
    </li>)}</ol>
  </section>;
}

function LecturaBarbara({ puntos }: { puntos: Punto[] }) {
  const porTipo = new Map<string, Punto[]>();
  for (const punto of puntos) { if (!porTipo.has(punto.tipo)) porTipo.set(punto.tipo, []); porTipo.get(punto.tipo)!.push(punto); }
  const formatos = [...porTipo.entries()].map(([tipo, filas]) => ({
    tipo, alcance: filas.reduce((a, f) => a + f.alcance, 0) / filas.length,
    tasa: filas.reduce((a, f) => a + f.tasa, 0) / filas.length,
  })).sort((a, b) => b.tasa - a.tasa);
  const mejor = formatos[0];
  const guardables = puntos.reduce((a, p) => a + p.guardados + p.compartidos, 0);
  return <section className="barbara-grafica barbara-lectura">
    <header><div><small>Lectura de Bárbara</small><h3>Qué conviene repetir</h3></div></header>
    {mejor ? <><p>El formato con mejor respuesta media es <b>{mejor.tipo}</b>, con una tasa de <b>{mejor.tasa.toFixed(1)}%</b> y {formato(Math.round(mejor.alcance))} de alcance medio.</p>
      <div className="barbara-lectura-dato"><span>{formato(guardables)}</span><p>guardados + compartidos: señales de contenido que la audiencia quiso conservar o enviar.</p></div>
      <small>Conclusión calculada sólo con las publicaciones medidas.</small></> : <p>Aún no hay suficientes publicaciones comparables.</p>}
  </section>;
}

function PanelRed({ nombre, cuenta, canal, filas }: { nombre: string; cuenta: string; canal: Canal | undefined; filas: Metrica[] }) {
  const alcance = suma(filas, "alcance"), interacciones = suma(filas, "interacciones"), reproducciones = suma(filas, "reproducciones");
  const ultima = filas.reduce<Metrica | null>((mejor, m) => !mejor || m.capturado_en > mejor.capturado_en ? m : mejor, null);
  const seguidores = ultima?.seguidores ?? null, tasa = alcance > 0 ? (interacciones / alcance) * 100 : null, conectada = Boolean(canal?.activo);
  return <section className="barbara-red">
    <header><div><b>{nombre}</b>{canal?.account_ref && <small>{canal.account_ref}</small>}</div><span className={"pill " + (conectada ? "ok" : "gris")}>{conectada ? "Conectada" : "Sin conectar"}</span></header>
    {!filas.length ? <p className="tenue">{conectada ? "Conectada para publicar; falta recibir analítica." : `Falta dar de alta la ${cuenta}.`}</p> : <>
      <div className="barbara-red-cifras">{seguidores !== null && <div><small>Seguidores</small><b>{formato(seguidores)}</b></div>}<div><small>Alcance</small><b>{formato(alcance)}</b></div><div><small>Interacciones</small><b>{formato(interacciones)}</b></div>{tasa !== null && <div><small>Tasa</small><b>{tasa.toFixed(1)}%</b></div>}{reproducciones > 0 && <div><small>Reproducciones</small><b>{formato(reproducciones)}</b></div>}<div><small>Piezas medidas</small><b>{filas.length}</b></div></div>
      {ultima && <p className="tenue barbara-red-pie">Última medición: {fecha(ultima.capturado_en)}</p>}
    </>}
  </section>;
}
