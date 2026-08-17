import { useCallback, useEffect, useMemo, useState } from "react";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { IconoCarpeta } from "../disenio/iconosArchivo";
import { CrearPlanSuscripcion } from "./CrearPlanSuscripcion";
import type { PlanSuscripcion, Suscriptor } from "./tipos";

/**
 * Suscripciones masivas: un link por plan, muchos suscriptores.
 *
 * POR QUÉ ES UN MÓDULO APARTE DE CLIENTES
 * ---------------------------------------------------------------------------
 * `clientes` es la cartera de la agencia — nueve fichas con setup, mensualidad
 * y notas internas. Cientos de suscriptores de $2.990 ahí taparían a los
 * clientes reales en la misma lista, y ninguno de esos campos les aplica.
 *
 * LOS SUSCRIPTORES NO SE CREAN ACÁ
 * ---------------------------------------------------------------------------
 * Los crea el webhook de Mercado Pago cuando alguien paga por el link. Esta
 * pantalla los muestra; el alta manual no existe a propósito, porque un
 * suscriptor sin suscripción real en MP no se cobraría nunca.
 */

export function Suscripciones() {
  const [planes, setPlanes] = useState<PlanSuscripcion[]>([]);
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [grupo, setGrupo] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rp, rs] = await Promise.all([
      sb.from("planes_suscripcion").select("*").order("creado_en", { ascending: false }),
      sb.from("suscriptores").select("*").order("creado_en", { ascending: false }),
    ]);
    if (rp.error || rs.error) setError(rp.error?.message ?? rs.error?.message ?? "");
    else {
      setPlanes((rp.data ?? []) as PlanSuscripcion[]);
      setSuscriptores((rs.data ?? []) as Suscriptor[]);
      setError("");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const grupos = useMemo(() => {
    const m = new Map<string, { planes: number; suscriptores: number; mrr: number }>();
    for (const p of planes) {
      const g = m.get(p.grupo) ?? { planes: 0, suscriptores: 0, mrr: 0 };
      g.planes++;
      const suyos = suscriptores.filter((s) => s.plan_id === p.id && s.estado === "activa");
      g.suscriptores += suyos.length;
      g.mrr += suyos.length * (p.monto ?? 0);
      m.set(p.grupo, g);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planes, suscriptores]);

  const planesAqui = useMemo(
    () => (grupo ? planes.filter((p) => p.grupo === grupo) : []),
    [planes, grupo],
  );
  const suscriptoresAqui = useMemo(() => {
    const ids = new Set(planesAqui.map((p) => p.id));
    return suscriptores.filter((s) => s.plan_id && ids.has(s.plan_id));
  }, [suscriptores, planesAqui]);

  // Ingreso recurrente: solo cuentan las suscripciones activas. Sumar las
  // canceladas infla la cifra justo cuando más importa que sea honesta.
  const mrr = useMemo(
    () =>
      suscriptoresAqui
        .filter((s) => s.estado === "activa")
        .reduce((t, s) => t + (s.monto ?? 0), 0),
    [suscriptoresAqui],
  );

  async function copiar(p: PlanSuscripcion) {
    if (!p.init_point) return;
    try {
      await navigator.clipboard.writeText(p.init_point);
      setCopiado(p.id);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      setError("No se pudo copiar. Abre el link y cópialo de la barra del navegador.");
    }
  }

  async function alternarActivo(p: PlanSuscripcion) {
    // No se borra el plan: existe en Mercado Pago y puede tener gente pagando.
    // Desactivarlo solo lo saca de circulación de este lado.
    const { error } = await sb
      .from("planes_suscripcion")
      .update({ activo: !p.activo })
      .eq("id", p.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <h1>Suscripciones</h1>
        <button className="btn solido" onClick={() => setCreando(true)}>
          {Ico.mas({ t: 15 })} Nuevo plan
        </button>
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}
        {cargando && <p className="vacio">Cargando…</p>}

        {/* Vista de carpetas: una por grupo (Rat.IA, Bárbara…) */}
        {!cargando && !grupo && (
          <>
            {grupos.length === 0 ? (
              <p className="vacio">
                Todavía no hay planes. Crea el primero y te damos un link para
                compartir: quien lo pague se registra solo.
              </p>
            ) : (
              <div className="fnd-grilla">
                {grupos.map(([g, d]) => (
                  <button key={g} className="fnd-item" onClick={() => setGrupo(g)}>
                    <IconoCarpeta t={62} />
                    <span className="fnd-nombre">{g}</span>
                    <span className="sus-conteo">
                      {d.suscriptores} activo{d.suscriptores === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Dentro de una carpeta */}
        {!cargando && grupo && (
          <>
            <div className="fnd-barra">
              <button
                className="icono-btn"
                title="Atrás"
                onClick={() => setGrupo(null)}
              >
                {Ico.volver({ t: 15 })}
              </button>
              <nav className="fnd-ruta">
                <button className="fnd-migaja" onClick={() => setGrupo(null)}>
                  Suscripciones
                </button>
                <span className="fnd-sep-migaja">
                  <span aria-hidden="true">›</span>
                  <button className="fnd-migaja on">{grupo}</button>
                </span>
              </nav>
            </div>

            <div className="rejilla-datos" style={{ marginBottom: 20 }}>
              <div className="dato">
                <small>Suscriptores activos</small>
                <b>{suscriptoresAqui.filter((s) => s.estado === "activa").length}</b>
              </div>
              <div className="dato">
                <small>Ingreso recurrente</small>
                <b>{plata(mrr, planesAqui[0]?.moneda)}</b>
              </div>
              <div className="dato">
                <small>Planes</small>
                <b>{planesAqui.length}</b>
              </div>
              <div className="dato">
                <small>Bajas</small>
                <b>{suscriptoresAqui.filter((s) => s.estado !== "activa").length}</b>
              </div>
            </div>

            <section className="bloque">
              <h3>Planes y su link</h3>
              {planesAqui.map((p) => (
                <div key={p.id} className="sus-plan">
                  <div className="sus-plan-txt">
                    <b>
                      {p.nombre}{" "}
                      {!p.activo && <span className="pill gris">pausado</span>}
                    </b>
                    <span>
                      {plata(p.monto, p.moneda)} cada{" "}
                      {p.frecuencia_meses === 1 ? "mes" : `${p.frecuencia_meses} meses`}
                      {p.descripcion ? ` · ${p.descripcion}` : ""}
                    </span>
                    {p.init_point && (
                      <input className="campo sus-link" readOnly value={p.init_point}
                        onFocus={(e) => e.target.select()} />
                    )}
                  </div>
                  <div className="botonera">
                    <button className="btn chico" onClick={() => copiar(p)}>
                      {copiado === p.id ? "¡Copiado!" : "Copiar link"}
                    </button>
                    <button className="btn chico" onClick={() => alternarActivo(p)}>
                      {p.activo ? "Pausar" : "Reactivar"}
                    </button>
                  </div>
                </div>
              ))}
              <p className="parrafo" style={{ color: "var(--texto-3)", marginTop: 10 }}>
                El mismo link sirve para todos. Quien lo pague queda registrado acá
                solo y puede entrar al portal con su correo.
              </p>
            </section>

            <section className="bloque">
              <h3>Suscriptores</h3>
              {suscriptoresAqui.length === 0 ? (
                <p className="vacio">
                  Todavía nadie se ha suscrito. Comparte el link de arriba.
                </p>
              ) : (
                <div className="tabla-caja">
                  <table>
                    <thead>
                      <tr>
                        <th>Correo</th>
                        <th>Plan</th>
                        <th className="num">Monto</th>
                        <th>Estado</th>
                        <th>Desde</th>
                        <th>Próximo cobro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suscriptoresAqui.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <b>{s.nombre || s.email}</b>
                            {s.nombre && <small>{s.email}</small>}
                          </td>
                          <td>{planes.find((p) => p.id === s.plan_id)?.nombre ?? "—"}</td>
                          <td className="num">{plata(s.monto, s.moneda)}</td>
                          <td>
                            <span className={"pill " + (s.estado === "activa" ? "ok" : "gris")}>
                              {s.estado}
                            </span>
                          </td>
                          <td>{fecha(s.creado_en)}</td>
                          <td>{fecha(s.proximo_cobro)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {creando && (
        <CrearPlanSuscripcion
          grupoSugerido={grupo ?? ""}
          gruposExistentes={grupos.map(([g]) => g)}
          cerrar={() => setCreando(false)}
          guardado={() => {
            setCreando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
