import { useEffect, useMemo, useState } from "react";
import { plata } from "../lib/supabase";
import { Lineas, corto, proximosMeses } from "./graficos";

export type DatosProyeccion = {
  recurrente: number;
  altaPromedio: number;
  altaMejor: number;
  ingresoUnicoPromedio: number;
  gastoFijoOperativo: number;
  costoEntrega: number;
  metaMensual: number;
  liquido: number;
  activas: number;
  mayorCliente: number;
  nombreMayor: string;
  mesesUsados: number;
};

type Metrica = "mrr" | "ingresos" | "egresos" | "resultado" | "caja";
type Supuestos = {
  horizonte: number;
  fugaMensual: number;
  altasMensuales: number;
  crecimientoAltas: number;
  ajustePreciosAnual: number;
  ingresoUnicoMensual: number;
  cobranza: number;
  gastosFijos: number;
  costoVariable: number;
  metaMensual: number;
  crecimientoMeta: number;
  inflacionAnual: number;
  impuesto: number;
  cajaInicial: number;
  inversion: number;
  mesInversion: number;
  nominaNueva: number;
  mesNomina: number;
  servicioDeuda: number;
};
type MesProyectado = {
  mrr: number;
  ingresos: number;
  egresos: number;
  resultado: number;
  caja: number;
  impuesto: number;
};
type Escenario = {
  nombre: string;
  color: string;
  guion?: boolean;
  meses: MesProyectado[];
};
type AjusteEscenario = {
  nombre: string;
  color: string;
  guion?: boolean;
  altas: number;
  fuga: number;
  ingresoUnico: number;
  costos: number;
  cobranza: number;
};

const STORAGE = "condor.proyeccion-financiera.v2";
const ESCENARIOS: AjusteEscenario[] = [
  { nombre: "Expansión", color: "var(--ok-tx)", altas: 1.25, fuga: 0.7, ingresoUnico: 1.15, costos: 0.96, cobranza: 2 },
  { nombre: "Base", color: "var(--azul)", altas: 1, fuga: 1, ingresoUnico: 1, costos: 1, cobranza: 0 },
  { nombre: "Estrés", color: "var(--mal-tx)", guion: true, altas: 0.65, fuga: 1.35, ingresoUnico: 0.7, costos: 1.1, cobranza: -5 },
];
const METRICAS: { id: Metrica; nombre: string }[] = [
  { id: "mrr", nombre: "MRR" },
  { id: "ingresos", nombre: "Ingresos" },
  { id: "egresos", nombre: "Egresos" },
  { id: "resultado", nombre: "Resultado" },
  { id: "caja", nombre: "Caja" },
];
const limitar = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/**
 * Modelo mensual auditable:
 * ingreso reconocido = MRR + ventas únicas;
 * resultado operativo = ingreso reconocido - costos operativos;
 * caja = caja anterior + cobros efectivos - todas las salidas.
 * La inversión sale de caja, pero no se disfraza como gasto operativo.
 */
function calcularEscenario(
  d: DatosProyeccion,
  s: Supuestos,
  ajuste: AjusteEscenario,
): MesProyectado[] {
  const salida: MesProyectado[] = [];
  const precioMensual = Math.pow(1 + limitar(s.ajustePreciosAnual, -90, 300) / 100, 1 / 12);
  const inflacionMensual = Math.pow(1 + limitar(s.inflacionAnual, -50, 300) / 100, 1 / 12);
  const fuga = limitar((s.fugaMensual / 100) * ajuste.fuga, 0, 0.95);
  const cobranza = limitar((s.cobranza + ajuste.cobranza) / 100, 0, 1);
  let mrr = Math.max(0, d.recurrente);
  let caja = s.cajaInicial;

  for (let i = 0; i < s.horizonte; i += 1) {
    const factorAltas = Math.pow(1 + limitar(s.crecimientoAltas, -90, 300) / 100, i);
    const altas = Math.max(0, s.altasMensuales * ajuste.altas * factorAltas);
    mrr = Math.max(0, mrr * (1 - fuga) * precioMensual + altas);

    const ingresoUnico = Math.max(0, s.ingresoUnicoMensual * ajuste.ingresoUnico * factorAltas);
    const ingresos = mrr + ingresoUnico;
    const fijos = Math.max(0, s.gastosFijos * Math.pow(inflacionMensual, i) * ajuste.costos);
    const variables = Math.max(0, mrr * (s.costoVariable / 100) * ajuste.costos);
    const meta = Math.max(0, s.metaMensual * Math.pow(1 + limitar(s.crecimientoMeta, -90, 300) / 100, i) * ajuste.costos);
    const nomina = i + 1 >= s.mesNomina
      ? Math.max(0, s.nominaNueva * Math.pow(inflacionMensual, i - s.mesNomina + 1))
      : 0;
    const costoOperativo = fijos + variables + meta + nomina;
    const resultado = ingresos - costoOperativo;
    const impuesto = Math.max(0, resultado * (s.impuesto / 100));
    const inversion = i + 1 === s.mesInversion ? Math.max(0, s.inversion) : 0;
    const egresos = costoOperativo + impuesto + Math.max(0, s.servicioDeuda) + inversion;
    caja += ingresos * cobranza - egresos;
    salida.push({
      mrr: Math.round(mrr),
      ingresos: Math.round(ingresos),
      egresos: Math.round(egresos),
      resultado: Math.round(resultado),
      caja: Math.round(caja),
      impuesto: Math.round(impuesto),
    });
  }
  return salida;
}

function Control({ etiqueta, valor, sufijo, min = 0, max, step = 1, nota, onChange }: {
  etiqueta: string;
  valor: number;
  sufijo?: string;
  min?: number;
  max?: number;
  step?: number;
  nota?: string;
  onChange: (valor: number) => void;
}) {
  return (
    <label className="proy-control">
      <span>{etiqueta}</span>
      <span className="proy-input">
        <input type="number" value={valor} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
        {sufijo && <i>{sufijo}</i>}
      </span>
      {nota && <small>{nota}</small>}
    </label>
  );
}

export function Proyeccion({ d }: { d: DatosProyeccion }) {
  const base = useMemo<Supuestos>(() => ({
    horizonte: 12,
    fugaMensual: 5,
    altasMensuales: d.altaPromedio,
    crecimientoAltas: 0,
    ajustePreciosAnual: 0,
    ingresoUnicoMensual: d.ingresoUnicoPromedio,
    cobranza: 95,
    gastosFijos: d.gastoFijoOperativo,
    costoVariable: d.recurrente > 0 ? Math.round((d.costoEntrega / d.recurrente) * 1000) / 10 : 0,
    metaMensual: d.metaMensual,
    crecimientoMeta: 0,
    inflacionAnual: 4,
    impuesto: 0,
    cajaInicial: d.liquido,
    inversion: 0,
    mesInversion: 1,
    nominaNueva: 0,
    mesNomina: 4,
    servicioDeuda: 0,
  }), [d]);
  const [s, setS] = useState<Supuestos>(() => {
    if (typeof window === "undefined") return base;
    try {
      const guardado = JSON.parse(window.localStorage.getItem(STORAGE) ?? "null");
      return guardado && typeof guardado === "object" ? { ...base, ...guardado } : base;
    } catch {
      return base;
    }
  });
  const [metrica, setMetrica] = useState<Metrica>("caja");
  const [abierto, setAbierto] = useState<"ingresos" | "costos" | "caja">("ingresos");

  useEffect(() => window.localStorage.setItem(STORAGE, JSON.stringify(s)), [s]);
  const cambiar = <K extends keyof Supuestos>(llave: K, valor: Supuestos[K]) =>
    setS((actual) => ({ ...actual, [llave]: valor }));

  const p = useMemo(() => {
    const horizonte = Math.round(limitar(s.horizonte, 6, 24));
    const supuestos = { ...s, horizonte };
    const meses = proximosMeses(horizonte);
    const escenarios: Escenario[] = ESCENARIOS.map((e) => ({ nombre: e.nombre, color: e.color, guion: e.guion, meses: calcularEscenario(d, supuestos, e) }));
    const baseEscenario = escenarios[1].meses;
    const suma = (campo: keyof MesProyectado) => baseEscenario.reduce((total, mes) => total + mes[campo], 0);
    const equilibrio = baseEscenario.findIndex((_, i) =>
      baseEscenario.slice(i).every((mes) => mes.resultado >= 0),
    );
    const cajaNegativa = baseEscenario.findIndex((mes) => mes.caja < 0);
    const fuga = limitar(s.fugaMensual, 0, 95) / 100;
    return {
      etiquetas: meses.map((m, i) => horizonte <= 12 || i % 2 === 0 || i === horizonte - 1 ? m.et : ""),
      escenarios,
      ingresoAcumulado: suma("ingresos"),
      resultadoAcumulado: suma("resultado"),
      final: baseEscenario.at(-1),
      equilibrio: equilibrio >= 0 ? equilibrio + 1 : null,
      runway: cajaNegativa >= 0 ? cajaNegativa + 1 : null,
      fugaAnual: (1 - Math.pow(1 - fuga, 12)) * 100,
      mrrPerdido: Math.round(d.recurrente * fuga),
      clientesPerdidos: d.activas * fuga,
      altasNecesarias: Math.round(d.recurrente * fuga),
    };
  }, [d, s]);

  if (d.recurrente <= 0) return (
    <section className="proy-shell"><div className="proy-vacio"><span>SIMULADOR FINANCIERO</span><h2>Proyección de 6 a 24 meses</h2><p>Hace falta al menos una mensualidad activa para construir el punto de partida.</p></div></section>
  );

  return (
    <section className="proy-shell" aria-labelledby="titulo-proyeccion">
      <header className="proy-cabecera">
        <div><span className="sobrelinea">Simulador financiero</span><h2 id="titulo-proyeccion">Proyección de 6 a 24 meses</h2><p>Modifica los supuestos y compara su efecto en ingresos, egresos, resultado y caja.</p></div>
        <div className="proy-horizonte" aria-label="Horizonte de la proyección">
          {[6, 12, 18, 24].map((meses) => <button key={meses} className={`chip${s.horizonte === meses ? " on" : ""}`} onClick={() => cambiar("horizonte", meses)}>{meses} meses</button>)}
          <button className="btn chico" onClick={() => setS(base)}>Restaurar base</button>
        </div>
      </header>

      <div className="proy-kpis">
        <div><small>Caja final · base</small><b className={(p.final?.caja ?? 0) >= 0 ? "positivo" : "negativo"}>{plata(p.final?.caja ?? 0)}</b><span>{p.runway ? `se vuelve negativa en el mes ${p.runway}` : "permanece positiva"}</span></div>
        <div><small>MRR final · base</small><b>{plata(p.final?.mrr ?? 0)}</b><span>desde {plata(d.recurrente)} actuales</span></div>
        <div><small>Resultado acumulado</small><b className={p.resultadoAcumulado >= 0 ? "positivo" : "negativo"}>{plata(p.resultadoAcumulado)}</b><span>antes de inversión y deuda</span></div>
        <div><small>Punto de equilibrio</small><b>{p.equilibrio ? `Mes ${p.equilibrio}` : "No se alcanza"}</b><span>{plata(p.ingresoAcumulado)} de ingreso proyectado</span></div>
      </div>

      <div className="proy-trabajo">
        <aside className="proy-supuestos">
          <nav aria-label="Grupos de supuestos">
            {(["ingresos", "costos", "caja"] as const).map((grupo) => <button key={grupo} className={abierto === grupo ? "on" : ""} onClick={() => setAbierto(grupo)}>{grupo === "caja" ? "Caja y capital" : grupo[0].toUpperCase() + grupo.slice(1)}</button>)}
          </nav>
          {abierto === "ingresos" && <div className="proy-controles">
            <Control etiqueta="Fuga mensual" valor={s.fugaMensual} sufijo="%" min={0} max={50} step={0.1} nota="Supuesto editable; aún no existe una serie histórica de bajas." onChange={(v) => cambiar("fugaMensual", limitar(v, 0, 50))} />
            <input className="proy-range" aria-label="Fuga mensual" type="range" min="0" max="50" step="0.1" value={s.fugaMensual} onChange={(e) => cambiar("fugaMensual", Number(e.target.value))} />
            <Control etiqueta="MRR nuevo al mes" valor={s.altasMensuales} sufijo="CLP" max={1_000_000_000} nota={`Promedio real observado: ${plata(d.altaPromedio)}.`} onChange={(v) => cambiar("altasMensuales", Math.max(0, v))} />
            <Control etiqueta="Crecimiento mensual de altas" valor={s.crecimientoAltas} sufijo="%" min={-90} max={300} step={0.1} onChange={(v) => cambiar("crecimientoAltas", limitar(v, -90, 300))} />
            <Control etiqueta="Ajuste anual de precios" valor={s.ajustePreciosAnual} sufijo="%" min={-90} max={300} step={0.1} onChange={(v) => cambiar("ajustePreciosAnual", limitar(v, -90, 300))} />
            <Control etiqueta="Ventas únicas al mes" valor={s.ingresoUnicoMensual} sufijo="CLP" max={1_000_000_000} onChange={(v) => cambiar("ingresoUnicoMensual", Math.max(0, v))} />
            <Control etiqueta="Cobranza efectiva" valor={s.cobranza} sufijo="%" min={0} max={100} step={0.1} nota="Afecta caja; el ingreso reconocido no cambia." onChange={(v) => cambiar("cobranza", limitar(v, 0, 100))} />
          </div>}
          {abierto === "costos" && <div className="proy-controles">
            <Control etiqueta="Gasto fijo operativo" valor={s.gastosFijos} sufijo="CLP" max={1_000_000_000} onChange={(v) => cambiar("gastosFijos", Math.max(0, v))} />
            <Control etiqueta="Costo variable sobre MRR" valor={s.costoVariable} sufijo="%" min={0} max={100} step={0.1} nota={`Derivado de productos asignados: ${plata(d.costoEntrega)}.`} onChange={(v) => cambiar("costoVariable", limitar(v, 0, 100))} />
            <Control etiqueta="Meta Ads mensual" valor={s.metaMensual} sufijo="CLP" max={1_000_000_000} nota="Parte desde el gasto sincronizado o presupuestado." onChange={(v) => cambiar("metaMensual", Math.max(0, v))} />
            <Control etiqueta="Crecimiento mensual de Ads" valor={s.crecimientoMeta} sufijo="%" min={-90} max={300} step={0.1} onChange={(v) => cambiar("crecimientoMeta", limitar(v, -90, 300))} />
            <Control etiqueta="Inflación anual de costos" valor={s.inflacionAnual} sufijo="%" min={-50} max={300} step={0.1} onChange={(v) => cambiar("inflacionAnual", limitar(v, -50, 300))} />
            <Control etiqueta="Nueva nómina mensual" valor={s.nominaNueva} sufijo="CLP" max={1_000_000_000} onChange={(v) => cambiar("nominaNueva", Math.max(0, v))} />
            <Control etiqueta="Inicio de nueva nómina" valor={s.mesNomina} sufijo="mes" min={1} max={24} onChange={(v) => cambiar("mesNomina", Math.round(limitar(v, 1, 24)))} />
          </div>}
          {abierto === "caja" && <div className="proy-controles">
            <Control etiqueta="Caja inicial" valor={s.cajaInicial} sufijo="CLP" min={-1_000_000_000} max={1_000_000_000} nota={`Cuentas líquidas hoy: ${plata(d.liquido)}.`} onChange={(v) => cambiar("cajaInicial", v)} />
            <Control etiqueta="Impuesto sobre resultado" valor={s.impuesto} sufijo="%" min={0} max={100} step={0.1} nota="Configúralo con el contador según régimen; no modela IVA." onChange={(v) => cambiar("impuesto", limitar(v, 0, 100))} />
            <Control etiqueta="Servicio de deuda mensual" valor={s.servicioDeuda} sufijo="CLP" max={1_000_000_000} nota="Capital e intereses que salen de caja." onChange={(v) => cambiar("servicioDeuda", Math.max(0, v))} />
            <Control etiqueta="Inversión extraordinaria" valor={s.inversion} sufijo="CLP" max={1_000_000_000} onChange={(v) => cambiar("inversion", Math.max(0, v))} />
            <Control etiqueta="Mes de la inversión" valor={s.mesInversion} sufijo="mes" min={1} max={24} onChange={(v) => cambiar("mesInversion", Math.round(limitar(v, 1, 24)))} />
            <Control etiqueta="Horizonte exacto" valor={s.horizonte} sufijo="meses" min={6} max={24} onChange={(v) => cambiar("horizonte", Math.round(limitar(v, 6, 24)))} />
            <input className="proy-range" aria-label="Horizonte exacto" type="range" min="6" max="24" step="1" value={s.horizonte} onChange={(e) => cambiar("horizonte", Number(e.target.value))} />
          </div>}
        </aside>

        <div className="proy-grafico">
          <div className="proy-grafico-cab"><div><small>Comparación de escenarios</small><b>{METRICAS.find((m) => m.id === metrica)?.nombre}</b></div><div className="proy-metricas">{METRICAS.map((m) => <button key={m.id} className={`chip${metrica === m.id ? " on" : ""}`} onClick={() => setMetrica(m.id)}>{m.nombre}</button>)}</div></div>
          <Lineas etiquetas={p.etiquetas} formato={corto} series={p.escenarios.map((e) => ({ nombre: e.nombre, color: e.color, guion: e.guion, valores: e.meses.map((mes) => mes[metrica]) }))} />
          <p className="proy-escenario-nota"><b>Base</b> usa exactamente tus números. <b>Expansión</b> aumenta altas 25%, reduce fuga 30%, mejora cobranza 2 puntos y baja costos 4%. <b>Estrés</b> reduce altas 35%, eleva fuga 35%, baja cobranza 5 puntos y eleva costos 10%.</p>
        </div>
      </div>

      <div className="proy-impacto">
        <div><span>Fuga mensual</span><b>{s.fugaMensual.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%</b></div><i aria-hidden="true">→</i>
        <div><span>Equivale al año</span><b>{p.fugaAnual.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%</b></div><i aria-hidden="true">→</i>
        <div><span>MRR expuesto el mes 1</span><b>{plata(p.mrrPerdido)}</b></div><i aria-hidden="true">→</i>
        <div><span>Altas para no caer</span><b>{plata(p.altasNecesarias)}</b></div>
        <div className="proy-impacto-clientes">≈ {p.clientesPerdidos.toLocaleString("es-CL", { maximumFractionDigits: 1 })} clientes/mes</div>
      </div>

      <footer className="proy-pie">
        <p><b>Dato real:</b> MRR, altas históricas, ventas únicas, costos de productos, Meta Ads y caja contable.</p>
        <p><b>Supuesto:</b> fuga, crecimiento, cobranza, inflación, impuestos, nómina, deuda e inversión. Se guardan solo en este navegador.</p>
      </footer>
    </section>
  );
}
