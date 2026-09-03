import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import {
  type ContenidoMarketing,
  type SeguimientoDiario,
  type SeguidoresSnapshot,
  EQUIPO_CONDOR,
  TEMAS_CONTENIDO,
  CALENDARIO_CONTENIDO,
  CUENTAS_MARKETING,
  responsableSeguimiento,
  diasContenidoDeLaSemana,
  publicadoEnTodas,
  META_SEGUIDOS_DIA,
  META_SEGUIDOS_SEMANA,
  META_SEGUIDORES_NUEVOS_SEMANA,
  semanaLaboral,
} from "./tipos";

const DIAS_ET = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function fotoDe(email: string) {
  return EQUIPO_CONDOR.find((p) => p.email === email);
}

/** Los 7 días de la semana en curso (lunes a domingo), como fecha ISO. */
function diasDeLaSemana(ahora: Date): Date[] {
  const { inicio } = semanaLaboral(ahora);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Delta de un campo del snapshot de Instagram (seguidores o seguidos):
 *  el más reciente contra el de hace ~7 días. El cron corre una vez al
 *  día, así que el snapshot de "hace una semana" es el primero con fecha
 *  <= hoy-7 que tenga ese campo cargado (los anteriores al 3-sept no
 *  tienen `siguiendo`) -- no necesariamente exacto al día si el cron
 *  falló alguna corrida. */
function deltaSnapshot(
  snapshots: SeguidoresSnapshot[],
  campo: "cantidad" | "siguiendo",
): { actual: number; nuevos: number; desde: string } | null {
  if (snapshots.length === 0) return null;
  const ultimo = snapshots[0];
  const actual = ultimo[campo];
  if (actual == null) return null;
  const hace7 = new Date(ultimo.fecha + "T12:00:00");
  hace7.setDate(hace7.getDate() - 7);
  const hace7Iso = iso(hace7);
  const referencia = snapshots.find((s) => s.fecha <= hace7Iso && s[campo] != null) ?? snapshots[snapshots.length - 1];
  if (referencia.id === ultimo.id || referencia[campo] == null) return null; // no hay suficiente historial todavía
  return { actual, nuevos: actual - (referencia[campo] as number), desde: referencia.fecha };
}

/** Genera (sin pisar lo existente) las filas de contenido + seguimiento de
 *  la semana en curso. La usan tanto el módulo completo como el resumen
 *  del Panel, para que cualquiera de los dos que se abra primero deje la
 *  semana lista -- no depende de que alguien entre justo a Marketing. */
async function asegurarSemana() {
  const ahora = new Date();
  const dias = diasDeLaSemana(ahora);
  const lunesIso = iso(dias[0]);
  const diasValidos = new Set(diasContenidoDeLaSemana(lunesIso));

  const filasContenido = dias
    .map((d) => ({ fecha: iso(d), dow: d.getDay() === 0 ? 7 : d.getDay() }))
    .flatMap(({ fecha, dow }) => {
      if (!diasValidos.has(dow)) return [];
      const cfg = CALENDARIO_CONTENIDO.find((c) => c.dow === dow);
      return cfg ? [{ fecha, tema: cfg.tema, responsable_email: cfg.email }] : [];
    });
  const filasSeguimiento = dias.map((d) => ({
    fecha: iso(d),
    responsable_email: responsableSeguimiento(d),
  }));

  await Promise.all([
    sb.from("marketing_contenido").upsert(filasContenido, { onConflict: "fecha", ignoreDuplicates: true }),
    sb.from("marketing_seguimiento_diario").upsert(filasSeguimiento, { onConflict: "fecha", ignoreDuplicates: true }),
  ]);
}

/**
 * Marketing — calendario de contenido + seguimiento diario de Instagram
 * (2-sept-2026, pedido de Joaquín).
 *
 * POR QUÉ LAS FILAS DE LA SEMANA SE GENERAN SOLAS, Y POR QUÉ TAMBIÉN HAY
 * UN CRON (no solo esto)
 * ---------------------------------------------------------------------------
 * El calendario es fijo y se repite cada semana (mismo tema, mismo
 * responsable, cada lunes/martes/jueves/viernes; seguimiento todos los
 * días) -- pedido explícito: "quede en el calendario para siempre".
 * `asegurarSemana()` corre al entrar al módulo (upsert sin pisar lo que ya
 * existe), pero eso solo genera la semana si ALGUIEN abre el módulo esa
 * semana. Por las dudas de que nadie entre, `.github/workflows/
 * marketing-generar-semana.yml` corre lo mismo cada lunes temprano -- así
 * la semana existe se abra o no se abra el portal.
 *
 * ESTA SEMANA ES DISTINTA (2-sept-2026, miércoles en la noche)
 * ---------------------------------------------------------------------------
 * El módulo se armó a mitad de semana. Lunes y martes ya habían pasado
 * sin que existiera nada que marcar -- contarlos como incumplidos sería
 * injusto. `EXCEPCIONES_CONTENIDO_SEMANA` en tipos.ts declara que la
 * semana del 31-ago solo genera jueves y viernes; semanas futuras usan el
 * calendario completo automáticamente.
 *
 * EL CONTADOR DE SEGUIDOS ES REAL; EL DE SEGUIDORES TAMBIÉN, DESDE EL 3-SEPT
 * ---------------------------------------------------------------------------
 * Cuántas cuentas se siguieron esta semana sale de sumar lo que cada
 * persona ya registra (no depende de ninguna API externa). Cuántos
 * seguidores nuevos ganó @condor.ai se conecta con la API oficial de
 * Instagram (Instagram Login, `graph.instagram.com` -- NO
 * `graph.facebook.com`, son flujos distintos) -- confirmado en vivo el
 * 3-sept-2026 con la cuenta real. `services/marketing/sincronizar-
 * seguidores-instagram.mjs` corre una vez al día (cron
 * `instagram-seguidores.yml`) y guarda el total en
 * `marketing_seguidores_snapshot`; acá solo se calcula el delta entre el
 * snapshot más reciente y el de hace 7 días. El token es de corta
 * duración -- si el cron empieza a fallar por auth, hay que renovarlo
 * (ver el comentario del propio script de sincronización).
 */
export function Marketing() {
  const [contenido, setContenido] = useState<ContenidoMarketing[]>([]);
  const [seguimiento, setSeguimiento] = useState<SeguimientoDiario[]>([]);
  const [snapshots, setSnapshots] = useState<SeguidoresSnapshot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const [{ data: co, error: eco }, { data: se }, { data: sn }] = await Promise.all([
      sb.from("marketing_contenido").select("*").order("fecha"),
      sb.from("marketing_seguimiento_diario").select("*").order("fecha"),
      sb.from("marketing_seguidores_snapshot").select("*").order("fecha", { ascending: false }).limit(14),
    ]);
    if (eco) setError(eco.message);
    else setError("");
    setContenido((co ?? []) as ContenidoMarketing[]);
    setSeguimiento((se ?? []) as SeguimientoDiario[]);
    setSnapshots((sn ?? []) as SeguidoresSnapshot[]);
    if (!silencioso) setCargando(false);
  }

  useEffect(() => {
    (async () => {
      await asegurarSemana();
      await cargar();
    })();
  }, []);

  const semana = useMemo(() => diasDeLaSemana(new Date()), []);
  const semanaIso = useMemo(() => new Set(semana.map(iso)), [semana]);

  const contenidoSemana = useMemo(
    () => contenido.filter((c) => semanaIso.has(c.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [contenido, semanaIso],
  );
  const seguimientoSemana = useMemo(
    () => seguimiento.filter((s) => semanaIso.has(s.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [seguimiento, semanaIso],
  );

  const totalSeguidosSemana = seguimientoSemana.reduce(
    (t, s) => t + (s.hecho ? (s.cantidad ?? META_SEGUIDOS_DIA) : 0), 0,
  );

  const seguidoresDelta = useMemo(() => deltaSnapshot(snapshots, "cantidad"), [snapshots]);
  const siguiendoDelta = useMemo(() => deltaSnapshot(snapshots, "siguiendo"), [snapshots]);

  async function actualizarContenido(c: ContenidoMarketing, cambios: Partial<ContenidoMarketing>) {
    setContenido((ls) => ls.map((x) => (x.id === c.id ? { ...x, ...cambios } : x)));
    const { error } = await sb.from("marketing_contenido").update(cambios).eq("id", c.id);
    if (error) { setError(error.message); void cargar(true); }
  }

  async function actualizarSeguimiento(s: SeguimientoDiario, cambios: Partial<SeguimientoDiario>) {
    setSeguimiento((ls) => ls.map((x) => (x.id === s.id ? { ...x, ...cambios } : x)));
    const { error } = await sb.from("marketing_seguimiento_diario").update(cambios).eq("id", s.id);
    if (error) { setError(error.message); void cargar(true); }
  }

  // Cumplimiento de Joaquín/Max en contenido, para el resumen de fin de semana.
  const cumplimientoContenido = useMemo(() => {
    const personas = [...new Set(CALENDARIO_CONTENIDO.map((c) => c.email))];
    return personas.map((email) => {
      const suyos = contenidoSemana.filter((c) => c.responsable_email === email);
      const hechos = suyos.filter((c) => c.hecho).length;
      const enTodas = suyos.filter((c) => publicadoEnTodas(c)).length;
      return { persona: fotoDe(email), total: suyos.length, hechos, enTodas };
    });
  }, [contenidoSemana]);

  if (cargando) return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  return (
    <>
      <div className="barra"><h1>Marketing</h1></div>
      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        <h3>Resumen de la semana</h3>
        <div className="kpis" style={{ marginBottom: 18 }}>
          {cumplimientoContenido.map(({ persona, total, hechos, enTodas }) => persona && (
            <div className="kpi" key={persona.email}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <img src={persona.foto} alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                <b style={{ fontSize: 13 }}>{persona.nombre}</b>
              </div>
              <div className="cifra"><b>{hechos}</b>/{total}</div>
              <p>Contenido creado</p>
              <span className={"pill " + (enTodas === total && total > 0 ? "ok" : enTodas > 0 ? "warn" : "mal")} style={{ marginTop: 4, display: "inline-block" }}>
                {enTodas}/{total} en las 4 redes
              </span>
            </div>
          ))}
          <div className="kpi">
            <div className="tile">{Ico.chat({ t: 18 })}</div>
            <div className="cifra"><b>{totalSeguidosSemana}</b>/{META_SEGUIDOS_SEMANA}</div>
            <p>Cuentas seguidas esta semana (marcado a mano por Samuel/Alejandro)</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            {seguidoresDelta ? (
              <>
                <div className="cifra"><b>{seguidoresDelta.nuevos >= 0 ? "+" : ""}{seguidoresDelta.nuevos}</b>/{META_SEGUIDORES_NUEVOS_SEMANA}</div>
                <p>Seguidores nuevos desde el {seguidoresDelta.desde} · {seguidoresDelta.actual.toLocaleString("es-CL")} en total</p>
              </>
            ) : (
              <>
                <div className="cifra"><b>{snapshots[0]?.cantidad.toLocaleString("es-CL") ?? "—"}</b></div>
                <p>Seguidores totales hoy (real, Instagram) — falta una semana de historial para calcular el delta</p>
              </>
            )}
          </div>
          <div className="kpi">
            <div className="tile">{Ico.grafo({ t: 18 })}</div>
            {siguiendoDelta ? (
              <>
                <div className="cifra"><b>{siguiendoDelta.nuevos >= 0 ? "+" : ""}{siguiendoDelta.nuevos}</b></div>
                <p>Cuentas seguidas nuevas, real (Instagram) desde el {siguiendoDelta.desde} · {siguiendoDelta.actual.toLocaleString("es-CL")} en total</p>
              </>
            ) : (
              <>
                <div className="cifra"><b>{snapshots[0]?.siguiendo?.toLocaleString("es-CL") ?? "—"}</b></div>
                <p>Total de cuentas que seguimos hoy (real, Instagram) — falta una semana de historial para el delta</p>
              </>
            )}
          </div>
        </div>

        <h3>Calendario de contenido</h3>
        <div className="tabla-caja" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Día</th><th>Tema</th><th>Responsable</th><th>Creado</th>
                {CUENTAS_MARKETING.map((c) => <th key={c.id}>{c.texto}</th>)}
              </tr>
            </thead>
            <tbody>
              {contenidoSemana.map((c) => {
                const persona = fotoDe(c.responsable_email);
                const fecha = new Date(c.fecha + "T12:00:00");
                return (
                  <tr key={c.id}>
                    <td style={{ textTransform: "capitalize" }}>{DIAS_ET[fecha.getDay()]}<br /><small className="conteo">{c.fecha}</small></td>
                    <td>{TEMAS_CONTENIDO[c.tema]}</td>
                    <td>
                      {persona && (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <img src={persona.foto} alt="" width={22} height={22} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                          {persona.nombre}
                        </span>
                      )}
                    </td>
                    <td>
                      <input type="checkbox" checked={c.hecho} onChange={(e) => actualizarContenido(c, { hecho: e.target.checked })} />
                    </td>
                    {CUENTAS_MARKETING.map((cta) => {
                      const campo = `publicado_${cta.id}` as keyof ContenidoMarketing;
                      return (
                        <td key={cta.id}>
                          <input
                            type="checkbox"
                            checked={Boolean(c[campo])}
                            onChange={(e) => actualizarContenido(c, { [campo]: e.target.checked } as Partial<ContenidoMarketing>)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {contenidoSemana.length === 0 && (
            <p className="vacio">Sin tareas de contenido esta semana (semana parcial, ver nota arriba).</p>
          )}
        </div>

        <h3>Seguimiento diario — seguir {META_SEGUIDOS_DIA} cuentas desde @condor.ai</h3>
        <p className="conteo" style={{ marginBottom: 8 }}>
          Samuel de lunes a jueves, Alejandro de viernes a domingo. Meta: {META_SEGUIDOS_SEMANA} seguidos/semana,
          {" "}{META_SEGUIDORES_NUEVOS_SEMANA} seguidores nuevos/semana.
          {" "}"Hecho" y "Cantidad" se verifican solos contra el contador real de Instagram cada 2 horas — no hace
          falta marcarlos a mano, aunque el casillero sigue disponible por si la conexión falla algún día.
        </p>
        <div className="tabla-caja">
          <table>
            <thead><tr><th>Día</th><th>Responsable</th><th>Hecho</th><th className="num">Cantidad (real)</th></tr></thead>
            <tbody>
              {seguimientoSemana.map((s) => {
                const persona = fotoDe(s.responsable_email);
                const fecha = new Date(s.fecha + "T12:00:00");
                return (
                  <tr key={s.id}>
                    <td style={{ textTransform: "capitalize" }}>{DIAS_ET[fecha.getDay()]}<br /><small className="conteo">{s.fecha}</small></td>
                    <td>
                      {persona && (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <img src={persona.foto} alt="" width={22} height={22} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                          {persona.nombre}
                        </span>
                      )}
                    </td>
                    <td>
                      <input type="checkbox" checked={s.hecho} onChange={(e) => actualizarSeguimiento(s, { hecho: e.target.checked })} />
                    </td>
                    <td className="num">
                      <input
                        className="campo-vivo"
                        type="number"
                        defaultValue={s.cantidad ?? ""}
                        placeholder={String(META_SEGUIDOS_DIA)}
                        style={{ width: 80, textAlign: "right" }}
                        onBlur={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          if (v !== s.cantidad) actualizarSeguimiento(s, { cantidad: v });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Versión compacta para el Panel general (pedido de Joaquín, 2-sept):
 *  cumplimiento de contenido (Joaquín/Max) + seguimiento diario de
 *  Instagram (Alejandro/Samuel), con link al módulo completo. Mismo
 *  criterio que ResumenProspeccion() en Prospeccion.tsx. */
export function ResumenMarketing() {
  const [contenido, setContenido] = useState<ContenidoMarketing[]>([]);
  const [seguimiento, setSeguimiento] = useState<SeguimientoDiario[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      await asegurarSemana();
      const [{ data: co }, { data: se }] = await Promise.all([
        sb.from("marketing_contenido").select("*"),
        sb.from("marketing_seguimiento_diario").select("*"),
      ]);
      setContenido((co ?? []) as ContenidoMarketing[]);
      setSeguimiento((se ?? []) as SeguimientoDiario[]);
      setCargando(false);
    })();
  }, []);

  const semanaIso = useMemo(() => new Set(diasDeLaSemana(new Date()).map(iso)), []);
  const contenidoSemana = useMemo(() => contenido.filter((c) => semanaIso.has(c.fecha)), [contenido, semanaIso]);
  const seguimientoSemana = useMemo(() => seguimiento.filter((s) => semanaIso.has(s.fecha)), [seguimiento, semanaIso]);

  const porPersonaContenido = useMemo(() => {
    const personas = [...new Set(CALENDARIO_CONTENIDO.map((c) => c.email))];
    return personas.map((email) => {
      const suyos = contenidoSemana.filter((c) => c.responsable_email === email);
      return { persona: fotoDe(email), total: suyos.length, hechos: suyos.filter((c) => c.hecho).length };
    });
  }, [contenidoSemana]);

  const porPersonaSeguimiento = useMemo(() => {
    const personas = [...new Set(seguimientoSemana.map((s) => s.responsable_email))];
    return personas.map((email) => {
      const suyos = seguimientoSemana.filter((s) => s.responsable_email === email);
      const hechos = suyos.filter((s) => s.hecho).length;
      const seguidos = suyos.reduce((t, s) => t + (s.hecho ? (s.cantidad ?? META_SEGUIDOS_DIA) : 0), 0);
      return { persona: fotoDe(email), diasHechos: hechos, diasTotal: suyos.length, seguidos };
    });
  }, [seguimientoSemana]);

  if (cargando) return null;

  return (
    <section className="bloque">
      <div className="cabecera-bloque">
        <div>
          <h3>Marketing — @condor.ai</h3>
          <p>Contenido de la semana y seguimiento diario en Instagram</p>
        </div>
        <Link className="btn chico" to="/acceso/marketing">Ver módulo completo</Link>
      </div>
      <div className="kpis" style={{ marginTop: 10 }}>
        {porPersonaContenido.map(({ persona, total, hechos }) => persona && (
          <div className="kpi" key={"c-" + persona.email}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <img src={persona.foto} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
              <b style={{ fontSize: 12.5 }}>{persona.nombre}</b>
            </div>
            <div className="cifra"><b>{hechos}</b>/{total}</div>
            <p>Contenido creado</p>
          </div>
        ))}
        {porPersonaSeguimiento.map(({ persona, diasHechos, diasTotal, seguidos }) => persona && (
          <div className="kpi" key={"s-" + persona.email}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <img src={persona.foto} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
              <b style={{ fontSize: 12.5 }}>{persona.nombre}</b>
            </div>
            <div className="cifra"><b>{diasHechos}</b>/{diasTotal} días</div>
            <p>{seguidos} cuentas seguidas</p>
          </div>
        ))}
      </div>
    </section>
  );
}
