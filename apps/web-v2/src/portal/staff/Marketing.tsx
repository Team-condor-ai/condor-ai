import { useEffect, useMemo, useState } from "react";
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

/**
 * Marketing — calendario de contenido + seguimiento diario de Instagram
 * (2-sept-2026, pedido de Joaquín).
 *
 * POR QUÉ LAS FILAS DE LA SEMANA SE GENERAN SOLAS
 * ---------------------------------------------------------------------------
 * El calendario es fijo y se repite cada semana (mismo tema, mismo
 * responsable, cada lunes/martes/jueves/viernes; seguimiento todos los
 * días). Pedirle a alguien que "cree la tarea del lunes" cada semana es
 * trabajo de más que nadie pidió — al entrar al módulo se hace upsert
 * (sin pisar lo que ya existe, `ignoreDuplicates`) de la semana en curso,
 * y de ahí en más solo se marcan casilleros.
 *
 * EL CONTADOR DE SEGUIDOS ES REAL, EL DE SEGUIDORES ES MANUAL POR AHORA
 * ---------------------------------------------------------------------------
 * Cuántas cuentas se siguieron esta semana sale de sumar lo que cada
 * persona ya registra (no depende de ninguna API externa). Cuántos
 * seguidores nuevos ganó @condor.ai SÍ necesitaría una fuente externa —
 * Blotato no tiene ese dato hoy (confirmado, no es un endpoint que
 * exista), y la API oficial de Instagram sí lo tiene pero requiere un
 * token de Meta que todavía no existe. Mientras tanto es un número que
 * alguien anota a mano una vez por semana (`marketing_seguidores_snapshot`).
 */
export function Marketing() {
  const [contenido, setContenido] = useState<ContenidoMarketing[]>([]);
  const [seguimiento, setSeguimiento] = useState<SeguimientoDiario[]>([]);
  const [snapshots, setSnapshots] = useState<SeguidoresSnapshot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nuevoSnapshot, setNuevoSnapshot] = useState("");

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const [{ data: co, error: eco }, { data: se }, { data: sn }] = await Promise.all([
      sb.from("marketing_contenido").select("*").order("fecha"),
      sb.from("marketing_seguimiento_diario").select("*").order("fecha"),
      sb.from("marketing_seguidores_snapshot").select("*").order("fecha", { ascending: false }).limit(8),
    ]);
    if (eco) setError(eco.message);
    else setError("");
    setContenido((co ?? []) as ContenidoMarketing[]);
    setSeguimiento((se ?? []) as SeguimientoDiario[]);
    setSnapshots((sn ?? []) as SeguidoresSnapshot[]);
    if (!silencioso) setCargando(false);
  }

  // Genera (sin pisar lo existente) las filas de la semana en curso.
  async function asegurarSemana() {
    const ahora = new Date();
    const dias = diasDeLaSemana(ahora);

    const filasContenido = dias
      .map((d) => ({ fecha: iso(d), dow: d.getDay() === 0 ? 7 : d.getDay() }))
      .flatMap(({ fecha, dow }) => {
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

  const ultimoSnapshot = snapshots[0];
  const penultimoSnapshot = snapshots[1];
  const seguidoresNuevos = ultimoSnapshot && penultimoSnapshot ? ultimoSnapshot.cantidad - penultimoSnapshot.cantidad : null;

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

  async function guardarSnapshot() {
    const cantidad = Number(nuevoSnapshot);
    if (!cantidad || cantidad <= 0) return;
    const { error } = await sb.from("marketing_seguidores_snapshot").insert({
      fecha: iso(new Date()), cantidad,
    });
    if (error) setError(error.message);
    else { setNuevoSnapshot(""); void cargar(true); }
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
            <p>Cuentas seguidas esta semana</p>
          </div>
          <div className="kpi">
            <div className="tile">{Ico.repetir({ t: 18 })}</div>
            <div className="cifra"><b>{seguidoresNuevos ?? "—"}</b>/{META_SEGUIDORES_NUEVOS_SEMANA}</div>
            <p>Seguidores nuevos (última semana registrada)</p>
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
        </div>

        <h3>Seguimiento diario — seguir {META_SEGUIDOS_DIA} cuentas desde @condor.ai</h3>
        <p className="conteo" style={{ marginBottom: 8 }}>
          Samuel de lunes a jueves, Alejandro de viernes a domingo. Meta: {META_SEGUIDOS_SEMANA} seguidos/semana,
          {" "}{META_SEGUIDORES_NUEVOS_SEMANA} seguidores nuevos/semana.
        </p>
        <div className="tabla-caja" style={{ marginBottom: 20 }}>
          <table>
            <thead><tr><th>Día</th><th>Responsable</th><th>Hecho</th><th className="num">Cantidad</th></tr></thead>
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

        <h3>Seguidores de @condor.ai</h3>
        <p className="conteo" style={{ marginBottom: 8 }}>
          Manual por ahora: Blotato todavía no tiene un endpoint de seguidores (confirmado, está en su roadmap).
          La API oficial de Instagram sí lo tiene de forma segura y de solo lectura, pero requiere un token de Meta
          que hay que generar — mientras tanto, se anota el total una vez por semana.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input
            className="campo" type="number" placeholder="Total de seguidores hoy" style={{ width: 220 }}
            value={nuevoSnapshot} onChange={(e) => setNuevoSnapshot(e.target.value)}
          />
          <button className="btn chico" onClick={() => void guardarSnapshot()}>Guardar</button>
        </div>
        {snapshots.length > 0 && (
          <div className="tabla-caja">
            <table>
              <thead><tr><th>Fecha</th><th className="num">Seguidores</th></tr></thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}><td>{s.fecha}</td><td className="num">{s.cantidad.toLocaleString("es-CL")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
