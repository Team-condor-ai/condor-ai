import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useCambio } from "../lib/cambio";
import {
  Barras,
  Delta,
  NavAnio,
  corto,
  mesDe,
  mesesCerrados,
  mesesDelAnio,
} from "./graficos";
import { Proyeccion } from "./Proyeccion";
import {
  nombreCobro,
  type Cliente,
  type Cobro,
  type IngresoRatia,
  type Reunion,
  type SuscriptorRatia,
} from "./tipos";
import type {
  Asiento,
  Cuenta,
  GastoFijo,
  GastoMeta,
  IngresoCliente,
} from "./contabilidad/tipos";
import { IngresoEcommerce } from "./contabilidad/IngresoEcommerce";

type PagoLite = {
  cliente_id: string;
  cobro_id: string | null;
  monto: number | null;
  estado: string | null;
  fecha: string | null;
  creado_en: string | null;
};

/**
 * El resumen de todo, de una mirada.
 *
 * QUÉ ES "TODO"
 * ---------------------------------------------------------------------------
 * El negocio son dos cosas distintas: la agencia (clientes, cobros) y Rat.IA
 * (suscripciones cobradas por Flow). Esta pantalla las suma para el número
 * grande y las separa cuando la diferencia importa — mezclarlas siempre haría
 * imposible saber de dónde viene la plata.
 *
 * LO QUE REQUIERE ATENCIÓN VA ARRIBA, NO ABAJO
 * ---------------------------------------------------------------------------
 * Un panel que solo felicita no sirve para decidir nada. Lo vencido y lo sin
 * cobrar aparece antes que las gráficas, porque es lo único que pide una
 * acción hoy.
 */
export function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<PagoLite[]>([]);
  const [ratia, setRatia] = useState<SuscriptorRatia[]>([]);
  const [ingresos, setIngresos] = useState<IngresoRatia[]>([]);
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosMeta, setGastosMeta] = useState<GastoMeta[]>([]);
  const [ingresosClientes, setIngresosClientes] = useState<IngresoCliente[]>(
    [],
  );
  const [cargando, setCargando] = useState(true);
  const cambio = useCambio();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [ahora] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const [cl, co, pa, ra, ig, re, cu, as, gf, gm, ic] =
        await Promise.all([
          sb.from("clientes").select("*"),
          sb.from("cobros").select("*"),
          sb
            .from("pagos")
            .select("cliente_id,cobro_id,monto,estado,fecha,creado_en"),
          sb.from("suscriptores_ratia").select("*"),
          sb.from("ingresos_ratia").select("*"),
          sb.from("reuniones").select("*").order("fecha_hora"),
          sb.from("cuentas").select("*"),
          sb.from("asientos").select("*, asiento_lineas(*)").order("fecha"),
          sb.from("gastos_fijos").select("*"),
          sb
            .from("gastos_meta")
            .select("*")
            .order("fecha", { ascending: false })
            .limit(2000),
          sb.from("ingresos_clientes").select("*").order("mes"),
        ]);
      setClientes((cl.data ?? []) as Cliente[]);
      setCobros((co.data ?? []) as Cobro[]);
      setPagos((pa.data ?? []) as PagoLite[]);
      setRatia((ra.data ?? []) as SuscriptorRatia[]);
      setIngresos((ig.data ?? []) as IngresoRatia[]);
      setReuniones((re.data ?? []) as Reunion[]);
      setCuentas((cu.data ?? []) as Cuenta[]);
      setAsientos((as.data ?? []) as Asiento[]);
      setGastosFijos((gf.data ?? []) as GastoFijo[]);
      setGastosMeta((gm.data ?? []) as GastoMeta[]);
      setIngresosClientes((ic.data ?? []) as IngresoCliente[]);
      setCargando(false);
    })();
  }, []);

  const d = useMemo(() => {
    const meses = mesesDelAnio(anio);
    // Los KPIs miran SIEMPRE el mes real, no el año que se esté viendo.
    const h = new Date();
    const clave = (dd: Date) =>
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
    const mesHoy = clave(h);
    const mesAntes = clave(new Date(h.getFullYear(), h.getMonth() - 1, 1));
    const hoy = new Date().toISOString().slice(0, 10);

    const monedaCobro = new Map(cobros.map((c) => [c.id, c.moneda]));
    const monedaCliente = new Map(
      clientes.map((c) => [c.id, c.moneda ?? "CLP"]),
    );
    const monedaDe = (p: PagoLite) =>
      (p.cobro_id ? monedaCobro.get(p.cobro_id) : null) ??
      monedaCliente.get(p.cliente_id) ??
      "CLP";

    // Agencia y Rat.IA por mes, por separado y sumadas.
    const agencia = new Map<string, number>();
    for (const p of pagos.filter((x) => x.estado === "pagado")) {
      const k = mesDe(p.fecha ?? p.creado_en);
      agencia.set(k, (agencia.get(k) ?? 0) + cambio.aCLP(p.monto, monedaDe(p)));
    }
    const rat = new Map<string, number>();
    for (const g of ingresos) {
      const k = mesDe(g.creado_en);
      rat.set(k, (rat.get(k) ?? 0) + (g.monto_bruto ?? 0));
    }
    const total = (k: string) => (agencia.get(k) ?? 0) + (rat.get(k) ?? 0);

    const vivos = new Set(
      clientes.filter((c) => !c.archivado).map((c) => c.id),
    );
    const mensualesActivos = cobros.filter(
      (c) =>
        c.tipo === "mensual" &&
        c.estado === "activa" &&
        vivos.has(c.cliente_id),
    );
    const ratActivas = ratia.filter((s) => s.estado === "activa");

    const recurrente =
      mensualesActivos.reduce((t, c) => t + cambio.aCLP(c.monto, c.moneda), 0) +
      ratActivas.reduce((t, s) => t + (s.monto ?? 0), 0);

    const vencidos = cobros.filter(
      (c) =>
        c.tipo === "mensual" &&
        (c.estado === "activa" || c.estado === "pendiente") &&
        !!c.proximo_cobro &&
        c.proximo_cobro < hoy &&
        vivos.has(c.cliente_id),
    );
    const sinPagar = cobros.filter(
      (c) =>
        c.tipo === "unico" &&
        c.estado === "pendiente" &&
        vivos.has(c.cliente_id),
    );

    // CRECIMIENTO: cuánto recurrente NUEVO se dio de alta cada mes. Se mide
    // sobre los 6 meses cerrados anteriores (sin contar el actual, que va a
    // medias y tiraría el promedio hacia abajo).
    const VENTANA = 6;
    const cerrados = mesesCerrados(VENTANA);
    const enCerrados = (k: string) => cerrados.includes(k);

    // Altas de recurrente mes a mes: el promedio y el mejor mes salen de acá.
    const altasMes = new Map<string, number>(cerrados.map((k) => [k, 0]));
    for (const c of cobros) {
      const k = mesDe(c.creado_en);
      if (c.tipo !== "mensual" || !altasMes.has(k)) continue;
      altasMes.set(k, (altasMes.get(k) ?? 0) + cambio.aCLP(c.monto, c.moneda));
    }
    for (const su of ratia) {
      const k = mesDe(su.inicio ?? su.creado_en);
      if (!altasMes.has(k)) continue;
      altasMes.set(k, (altasMes.get(k) ?? 0) + (su.monto ?? 0));
    }
    const nuevoRecurrente = [...altasMes.values()].reduce((t, v) => t + v, 0);
    const altaMejor = Math.max(...altasMes.values(), 0);

    // Quién aporta cuánto del recurrente. La concentración es riesgo puro: si
    // uno solo pone la mitad, perderlo no es una baja, es un problema.
    const porCliente = new Map<string, number>();
    for (const c of mensualesActivos) {
      const n = clientes.find((x) => x.id === c.cliente_id);
      const nom = n?.negocio || n?.nombre || "Sin nombre";
      porCliente.set(
        nom,
        (porCliente.get(nom) ?? 0) + cambio.aCLP(c.monto, c.moneda),
      );
    }
    if (ratActivas.length) {
      porCliente.set(
        "Rat.IA (suscriptores)",
        ratActivas.reduce((t, su) => t + (su.monto ?? 0), 0),
      );
    }
    const ranking = [...porCliente.entries()].sort((a, b) => b[1] - a[1]);

    // Calidad del ingreso: lo que se repite vs lo que hay que salir a buscar
    // otra vez el mes que viene.
    const recurrenteMes = new Map<string, number>();
    const puntualMes = new Map<string, number>();
    for (const pg of pagos) {
      if (pg.estado !== "pagado") continue;
      const k = mesDe(pg.fecha ?? pg.creado_en);
      const co = pg.cobro_id ? cobros.find((x) => x.id === pg.cobro_id) : null;
      const monto = cambio.aCLP(pg.monto, monedaDe(pg));
      const destino = co?.tipo === "mensual" ? recurrenteMes : puntualMes;
      destino.set(k, (destino.get(k) ?? 0) + monto);
    }
    for (const g of ingresos) {
      const k = mesDe(g.creado_en);
      recurrenteMes.set(k, (recurrenteMes.get(k) ?? 0) + (g.monto_bruto ?? 0));
    }

    let unicosTotal = 0;
    for (const p of pagos) {
      if (p.estado !== "pagado") continue;
      const co = p.cobro_id ? cobros.find((x) => x.id === p.cobro_id) : null;
      if (co?.tipo === "mensual") continue;
      if (!enCerrados(mesDe(p.fecha ?? p.creado_en))) continue;
      unicosTotal += cambio.aCLP(p.monto, monedaDe(p));
    }

    // Egresos reales: en partida doble una cuenta de gasto aumenta por el
    // debe y disminuye por el haber. No se infieren desde transferencias.
    const tipoCuenta = new Map(cuentas.map((c) => [c.id, c.tipo]));
    const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
    const egresosMes = new Map<string, number>();
    let liquido = 0;
    for (const a of asientos) {
      const k = mesDe(a.fecha);
      for (const l of a.asiento_lineas ?? []) {
        const cuenta = cuentaPorId.get(l.cuenta_id);
        if (cuenta?.tipo === "activo" && cuenta.liquida) {
          liquido += Number(l.debe ?? 0) - Number(l.haber ?? 0);
        }
        if (tipoCuenta.get(l.cuenta_id) !== "gasto") continue;
        egresosMes.set(
          k,
          (egresosMes.get(k) ?? 0) + Number(l.debe ?? 0) - Number(l.haber ?? 0),
        );
      }
    }

    // Meta Ads llega por la tabla de detalle y, contablemente, por los
    // asientos meta_ads. El libro manda para el total; la tabla explica qué
    // campaña lo produjo y cuándo fue la última lectura automática.
    const metaAsientoMes = asientos
      .filter((a) => a.origen === "meta_ads" && mesDe(a.fecha) === mesHoy)
      .reduce(
        (suma, a) =>
          suma +
          (a.asiento_lineas ?? []).reduce(
            (subtotal, l) =>
              tipoCuenta.get(l.cuenta_id) === "gasto"
                ? subtotal + Number(l.debe ?? 0) - Number(l.haber ?? 0)
                : subtotal,
            0,
          ),
        0,
      );
    const metaPorCampana = new Map<
      string,
      { nombre: string; monto: number; dias: Set<string>; sincronizado: string }
    >();
    for (const gasto of gastosMeta.filter((g) => mesDe(g.fecha) === mesHoy)) {
      const actual = metaPorCampana.get(gasto.campana_id) ?? {
        nombre: gasto.campana_nombre,
        monto: 0,
        dias: new Set<string>(),
        sincronizado: gasto.sincronizado_en,
      };
      actual.monto += Number(gasto.monto_clp ?? 0);
      actual.dias.add(gasto.fecha);
      if (gasto.sincronizado_en > actual.sincronizado)
        actual.sincronizado = gasto.sincronizado_en;
      metaPorCampana.set(gasto.campana_id, actual);
    }
    if (!metaPorCampana.size && metaAsientoMes > 0) {
      for (const a of asientos.filter(
        (asiento) =>
          asiento.origen === "meta_ads" && mesDe(asiento.fecha) === mesHoy,
      )) {
        const nombre =
          a.glosa.replace(/^Meta Ads\s*[·-]?\s*/i, "") || "Meta Ads";
        const monto = (a.asiento_lineas ?? []).reduce(
          (subtotal, l) =>
            tipoCuenta.get(l.cuenta_id) === "gasto"
              ? subtotal + Number(l.debe ?? 0) - Number(l.haber ?? 0)
              : subtotal,
          0,
        );
        const actual = metaPorCampana.get(nombre) ?? {
          nombre,
          monto: 0,
          dias: new Set<string>(),
          sincronizado: a.creado_en ?? `${a.fecha}T00:00:00Z`,
        };
        actual.monto += monto;
        actual.dias.add(a.fecha);
        metaPorCampana.set(nombre, actual);
      }
    }
    const campanasMeta = [...metaPorCampana.values()].sort(
      (a, b) => b.monto - a.monto,
    );
    const metaDetalleTotal = campanasMeta.reduce(
      (suma, c) => suma + c.monto,
      0,
    );
    const metaMes = metaAsientoMes || metaDetalleTotal;
    const metaUltimaSync =
      campanasMeta
        .map((c) => c.sincronizado)
        .filter(Boolean)
        .sort()
        .pop() ?? null;

    // Run-rate mensual basado en compromisos recurrentes registrados. Es una
    // estimación claramente separada del libro real.
    const fijosActivos = gastosFijos.filter((g) => g.activo);
    const baseFija = fijosActivos.reduce(
      (t, g) => t + cambio.aCLP(g.monto, g.moneda),
      0,
    );
    // Publicidad se modela aparte para evitar contarla dos veces al ajustar
    // Meta Ads dentro del simulador.
    const publicidadFija = fijosActivos
      .filter((g) => {
        const cuenta = g.cuenta_id ? cuentaPorId.get(g.cuenta_id) : null;
        return cuenta?.codigo === "5104" || /meta|facebook|instagram|publicidad|anuncios/i.test(g.nombre);
      })
      .reduce((t, g) => t + cambio.aCLP(g.monto, g.moneda), 0);
    const egresoEstimado = baseFija;
    const gastoAnio = meses.reduce(
      (t, m) => t + (egresosMes.get(m.clave) ?? 0),
      0,
    );

    return {
      proyeccion: {
        recurrente,
        altaPromedio: Math.round(nuevoRecurrente / VENTANA),
        altaMejor: Math.round(altaMejor),
        ingresoUnicoPromedio: Math.round(unicosTotal / VENTANA),
        gastoFijoOperativo: Math.max(0, baseFija - publicidadFija),
        metaMensual: Math.max(metaMes, publicidadFija),
        liquido: Math.round(liquido),
        activas: mensualesActivos.length + ratActivas.length,
        mayorCliente: ranking[0]?.[1] ?? 0,
        nombreMayor: ranking[0]?.[0] ?? "—",
        mesesUsados: VENTANA,
      },
      ranking: ranking.slice(0, 6),
      totalRanking: ranking.reduce((t, r) => t + r[1], 0),
      unicosPromedio: Math.round(unicosTotal / VENTANA),
      serieRecurrente: meses.map((m) => ({
        et: m.et,
        valor: recurrenteMes.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      seriePuntual: meses.map((m) => ({
        et: m.et,
        valor: puntualMes.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      totalAnio: meses.reduce((t, m) => t + total(m.clave), 0),
      recaudadoHoy: total(mesHoy),
      recaudadoAntes: total(mesAntes),
      agenciaHoy: agencia.get(mesHoy) ?? 0,
      ratHoy: rat.get(mesHoy) ?? 0,
      clientes: vivos.size,
      ratActivas: ratActivas.length,
      recurrente,
      egresoMes: egresosMes.get(mesHoy) ?? 0,
      metaMes,
      metaParticipacion:
        (egresosMes.get(mesHoy) ?? 0) > 0
          ? Math.round((metaMes / (egresosMes.get(mesHoy) ?? 1)) * 100)
          : 0,
      campanasMeta,
      metaUltimaSync,
      egresoEstimado,
      baseFija,
      margenEstimado: recurrente - egresoEstimado,
      gastoAnio,
      principalesCostos: [
        ...fijosActivos.map(
          (g) => [g.nombre, cambio.aCLP(g.monto, g.moneda)] as const,
        ),
      ]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      vencidos,
      sinPagar,
      proximas: reuniones
        .filter((r) => new Date(r.fecha_hora).getTime() > ahora)
        .slice(0, 3),
      serieTotal: meses.map((m) => ({
        et: m.et,
        valor: total(m.clave),
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      serieRat: meses.map((m) => ({
        et: m.et,
        valor: rat.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
      serieEgreso: meses.map((m) => ({
        et: m.et,
        valor: egresosMes.get(m.clave) ?? 0,
        futuro: m.futuro,
        esHoy: m.esHoy,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientes,
    cobros,
    pagos,
    ratia,
    ingresos,
    reuniones,
    cuentas,
    asientos,
    gastosFijos,
    gastosMeta,
    anio,
    ahora,
    cambio.listo,
    cambio.fecha,
  ]);

  if (cargando)
    return (
      <div className="cuerpo">
        <p className="vacio">Cargando…</p>
      </div>
    );

  const nombreDe = (id: string) => {
    const c = clientes.find((x) => x.id === id);
    return c?.negocio || c?.nombre || "—";
  };

  return (
    <>
      <div className="barra">
        <h1>Resumen</h1>
      </div>

      <div className="cuerpo">
        <section className="dashboard-agenda">
          <header>
            <div>
              <span className="dashboard-agenda-icono">
                {Ico.reuniones({ t: 17 })}
              </span>
              <div>
                <h2>Próximas reuniones</h2>
                <p>Lo siguiente que requiere presencia del equipo</p>
              </div>
            </div>
            <Link to="/acceso/organizacion/calendario" className="btn chico">
              Abrir calendario
            </Link>
          </header>
          {d.proximas.length ? (
            <div className="dashboard-agenda-lista">
              {d.proximas.map((r) => {
                const rd = new Date(r.fecha_hora);
                return (
                  <article key={r.id}>
                    <time dateTime={r.fecha_hora}>
                      <b>{rd.getDate()}</b>
                      <span>
                        {rd.toLocaleDateString("es-CL", { month: "short" })}
                      </span>
                    </time>
                    <div>
                      <b>{r.titulo}</b>
                      <small>
                        {rd.toLocaleTimeString("es-CL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {r.cliente || "Cóndor"} · {r.duracion_min ?? 60} min
                      </small>
                    </div>
                    {r.meet_url && (
                      <a
                        className="icono-btn"
                        href={r.meet_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Entrar a la videollamada"
                      >
                        {Ico.video({ t: 15 })}
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-agenda-vacia">No hay reuniones próximas.</p>
          )}
        </section>

        <div className="kpis tres">
          <div className="kpi">
            <div className="tile">{Ico.cobros({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(d.recaudadoHoy)}</b>
              <Delta hoy={d.recaudadoHoy} antes={d.recaudadoAntes} />
            </div>
            <p>
              Cobrado este mes · agencia {plata(d.agenciaHoy)} + Rat.IA{" "}
              {plata(d.ratHoy)}
            </p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            <div className="cifra">
              <b>{plata(d.recurrente)}</b>
            </div>
            <p>Recurrente al mes · las dos líneas juntas</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.clientes({ t: 18 })}</div>
            <div className="cifra">
              <b>{d.clientes}</b>
            </div>
            <p>Clientes de la agencia</p>
          </div>
        </div>

        <IngresoEcommerce ingresos={ingresosClientes} />

        <section className="bloque dashboard-egresos">
          <header className="dashboard-seccion-cab">
            <div>
              <h3>Egresos y costos</h3>
              <p>
                Libro real frente al costo mensual que ya está comprometido.
              </p>
            </div>
            <Link to="/acceso/contabilidad" className="btn chico">
              Abrir contabilidad
            </Link>
          </header>
          <div className="dashboard-egresos-grid">
            <div>
              <small>Egreso real este mes</small>
              <b>{plata(d.egresoMes)}</b>
              <span>registrado en el libro diario</span>
            </div>
            <div>
              <small>Base fija estimada</small>
              <b>{plata(d.baseFija)}</b>
              <span>sueldos, software y compromisos</span>
            </div>
            <div className={d.margenEstimado >= 0 ? "positivo" : "negativo"}>
              <small>Margen recurrente estimado</small>
              <b>{plata(d.margenEstimado)}</b>
              <span>recurrente menos egreso mensual estimado</span>
            </div>
          </div>
          <div className="dashboard-egresos-detalle">
            <div>
              <h3>
                Egresos por mes{" "}
                <span className="tenue" style={{ fontWeight: 400 }}>
                  · {plata(d.gastoAnio)} en {anio}
                </span>
              </h3>
              <Barras datos={d.serieEgreso} formato={corto} alto={138} />
            </div>
            <div className="costos-principales">
              <h3>Próximo mes · estimación de {plata(d.egresoEstimado)}</h3>
              {d.principalesCostos.length ? (
                d.principalesCostos.map(([nombre, monto], i) => (
                  <div key={`${nombre}-${i}`}>
                    <span>{nombre}</span>
                    <b>{plata(monto)}</b>
                  </div>
                ))
              ) : (
                <p className="vacio">
                  Carga gastos fijos para construir la estimación.
                </p>
              )}
            </div>
          </div>

          <div className="dashboard-meta">
            <header>
              <div className="meta-titulo">
                <span className="meta-marca" aria-hidden="true">
                  f
                </span>
                <div>
                  <h3>Campañas de Facebook e Instagram</h3>
                  <p>
                    Gasto real importado automáticamente desde la cuenta
                    publicitaria.
                  </p>
                </div>
              </div>
              <Link
                to="/acceso/contabilidad?tab=desglose"
                className="btn chico"
              >
                Ver desglose
              </Link>
            </header>

            <div className="dashboard-meta-resumen">
              <div>
                <small>Invertido este mes</small>
                <b>{plata(d.metaMes)}</b>
              </div>
              <div>
                <small>Peso en los egresos</small>
                <b>{d.metaParticipacion}%</b>
              </div>
              <div>
                <small>Campañas con gasto</small>
                <b>{d.campanasMeta.length}</b>
              </div>
              <div>
                <small>Estado</small>
                <span className={d.metaUltimaSync ? "pill ok" : "pill warn"}>
                  {d.metaUltimaSync
                    ? "Sincronización activa"
                    : "Esperando primera lectura"}
                </span>
                {d.metaUltimaSync && (
                  <em>
                    {new Date(d.metaUltimaSync).toLocaleString("es-CL", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </em>
                )}
              </div>
            </div>

            {d.campanasMeta.length > 0 ? (
              <div className="dashboard-meta-campanas">
                {d.campanasMeta.slice(0, 5).map((campana) => (
                  <div key={campana.nombre}>
                    <span>
                      <b>{campana.nombre}</b>
                      <small>{campana.dias.size} días con gasto</small>
                    </span>
                    <i aria-hidden="true">
                      <i
                        style={{
                          width: `${d.metaMes > 0 ? Math.max(2, (campana.monto / d.metaMes) * 100) : 0}%`,
                        }}
                      />
                    </i>
                    <strong>{plata(campana.monto)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-meta-vacio">
                Todavía no hay consumo reportado por Meta para este mes.
              </p>
            )}
          </div>
        </section>

        {/* Lo que pide una acción HOY va antes que las gráficas. */}
        {(d.vencidos.length > 0 || d.sinPagar.length > 0) && (
          <section className="bloque">
            <h3>Requiere atención</h3>
            <div className="tabla-caja">
              <table>
                <tbody>
                  {d.vencidos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="pill mal">vencido</span>
                      </td>
                      <td>
                        <Link
                          to={`/acceso/clientes?ver=${c.cliente_id}`}
                          className="enlace-tabla"
                        >
                          <b>{nombreDe(c.cliente_id)}</b>
                          <small>
                            {nombreCobro(c)} · venció el{" "}
                            {fecha(c.proximo_cobro)}
                          </small>
                        </Link>
                      </td>
                      <td className="num">{plata(c.monto, c.moneda)}</td>
                    </tr>
                  ))}
                  {d.sinPagar.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="pill warn">sin pagar</span>
                      </td>
                      <td>
                        <Link
                          to={`/acceso/clientes?ver=${c.cliente_id}`}
                          className="enlace-tabla"
                        >
                          <b>{nombreDe(c.cliente_id)}</b>
                          <small>{nombreCobro(c)}</small>
                        </Link>
                      </td>
                      <td className="num">{plata(c.monto, c.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <Proyeccion d={d.proyeccion} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <NavAnio anio={anio} setAnio={setAnio} />
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            marginBottom: 18,
          }}
        >
          <section className="bloque" style={{ margin: 0 }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 22,
                margin: "0 0 6px",
              }}
            >
              Cobrado por mes{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · {plata(d.totalAnio)} en {anio}
              </span>
            </h3>
            <Barras datos={d.serieTotal} formato={corto} />
          </section>
          <section className="bloque" style={{ margin: 0 }}>
            <h3>
              Rat.IA por mes{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · lo que registró Flow
              </span>
            </h3>
            <Barras datos={d.serieRat} formato={corto} />
          </section>
        </div>

        {/* CALIDAD DEL INGRESO
            No es lo mismo facturar lo mismo con suscripciones que con trabajos
            sueltos: lo recurrente vuelve solo el mes que viene, lo puntual hay
            que salir a venderlo otra vez. Verlos separados es lo que permite
            notar que un mes "bueno" fue en realidad un cobro grande que no se
            repite. */}
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            marginBottom: 18,
          }}
        >
          <section className="bloque" style={{ margin: 0 }}>
            <h3>
              Ingreso que se repite{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · suscripciones · {anio}
              </span>
            </h3>
            <Barras datos={d.serieRecurrente} formato={corto} alto={130} />
          </section>
          <section className="bloque" style={{ margin: 0 }}>
            <h3>
              Ingreso de una vez{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · trabajos puntuales · {anio}
              </span>
            </h3>
            <Barras datos={d.seriePuntual} formato={corto} alto={130} />
          </section>
        </div>

        {/* CONCENTRACIÓN
            Quién sostiene el recurrente. Un cliente que aporta la mitad no es
            un buen cliente: es un riesgo con nombre. */}
        {d.ranking.length > 0 && (
          <section className="bloque">
            <h3>
              De dónde viene lo recurrente{" "}
              <span className="tenue" style={{ fontWeight: 400 }}>
                · {plata(d.totalRanking)} al mes
              </span>
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 9,
                marginTop: 10,
              }}
            >
              {d.ranking.map(([nombre, monto]) => {
                const pct = d.totalRanking
                  ? Math.round((monto / d.totalRanking) * 100)
                  : 0;
                return (
                  <div
                    key={nombre}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        width: 150,
                        flex: "none",
                        fontSize: 12.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {nombre}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        height: 9,
                        background: "var(--gris-bg)",
                        borderRadius: 5,
                        overflow: "hidden",
                      }}
                    >
                      <i
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: 5,
                          // Por encima del 40% deja de ser reparto y pasa a ser
                          // dependencia: el color lo dice sin tener que leer.
                          background:
                            pct >= 40 ? "var(--warn-tx)" : "var(--azul)",
                        }}
                      />
                    </span>
                    <b
                      style={{
                        width: 108,
                        textAlign: "right",
                        fontSize: 12.5,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {plata(monto)}
                    </b>
                    <span
                      className="conteo"
                      style={{ width: 38, textAlign: "right" }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
