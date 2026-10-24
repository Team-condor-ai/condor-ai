import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { FichaLead } from "./FichaLead";
import { useSesion } from "../auth/sesion";
import { hoyLocal, useMiApodo } from "./personas";
import { useConfirmacion } from "../disenio/Confirmacion";
import {
  type Lead,
  type EtapaLead,
  ETAPAS_TABLERO,
  ETAPAS_CAJON,
  SERVICIOS_LEAD,
  textoEtapa,
  diasEnEtapa,
  atrasoLead,
  dinero,
  hace,
  nombreLead,
  inicialesLead,
  colorLead,
  esFrio,
  DIAS_FRIO,
} from "./leadsTipos";

/**
 * Leads en etapas (24-oct-2026).
 *
 * LAS IDEAS VIENEN DE DOS CRM QUE YA USAMOS
 * ---------------------------------------------------------------------------
 * De GHL: etapas que se arrastran, el valor sumado por columna y la línea de
 * tiempo de cada lead. Del CRM de Neisstech: la etapa avanza sola con señales
 * reales (agendó una reunión, le escribimos, pagó) y no por lo que alguien
 * recuerde anotar; lo que no contesta sale del tablero a un cajón («Sin
 * respuesta») y lo que necesita a una persona se marca aparte («Requiere
 * humano»). Esas reglas viven en la base (trigger `leads_antes_de_guardar`),
 * no acá: cualquier función del sitio que cree o actualice un lead las cumple.
 */
export function Leads() {
  const confirmar = useConfirmacion();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reuniones, setReuniones] = useState<Record<string, { fecha_hora: string; asistio: boolean | null }>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [busca, setBusca] = useState("");
  const [servicio, setServicio] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<EtapaLead | null>(null);
  const [cajon, setCajon] = useState(false);
  const [nuevo, setNuevo] = useState(false);

  async function cargar() {
    const { data, error: e } = await sb.from("leads").select("*").order("creado_en", { ascending: false }).limit(800);
    if (e) { setError("No se pudieron cargar los leads: " + e.message); setCargando(false); return; }
    const filas = (data ?? []) as Lead[];
    setLeads(filas);
    const ids = filas.map((l) => l.reunion_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: r } = await sb.from("reuniones").select("id,fecha_hora,asistio").in("id", ids);
      setReuniones(Object.fromEntries((r ?? []).map((x) => [x.id, { fecha_hora: x.fecha_hora, asistio: x.asistio }])));
    }
    setError("");
    setCargando(false);
  }
  const [params] = useSearchParams();
  useEffect(() => { void cargar(); }, []);
  useEffect(() => { const id = Number(params.get("lead")); if (id) setAbierto(id); }, [params]);

  const miApodo = useMiApodo(useSesion().email);
  const [mios, setMios] = useState(false);
  const hoy = hoyLocal();
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (servicio && l.servicio_interes !== servicio) return false;
      if (mios && l.responsable !== miApodo) return false;
      if (!q) return true;
      return [l.negocio, l.nombre, l.email, l.whatsapp, l.origen, l.campana].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [leads, busca, servicio, mios, miApodo]);

  const porEtapa = (e: EtapaLead) => visibles.filter((l) => l.etapa === e);

  const resumen = useMemo(() => {
    const abiertos = visibles.filter((l) => !["ganado", "perdido", "sin_respuesta"].includes(l.etapa));
    const enJuego = abiertos.reduce((a, l) => a + (l.valor_estimado ?? 0), 0);
    const atrasados = abiertos.filter((l) => atrasoLead(l, reuniones[l.reunion_id ?? ""]) !== null).length;
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const ganados = visibles.filter((l) => l.etapa === "ganado" && new Date(l.etapa_en) >= mes);
    return { abiertos: abiertos.length, enJuego, atrasados, ganadosMes: ganados.length, valorMes: ganados.reduce((a, l) => a + (l.valor_estimado ?? 0), 0) };
  }, [visibles, reuniones]);

  async function mover(id: number, etapa: EtapaLead) {
    const antes = leads;
    const actual = leads.find((l) => l.id === id);
    if (!actual || actual.etapa === etapa) return;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, etapa, etapa_en: new Date().toISOString() } : l)));
    const { error: e } = await sb.from("leads").update({ etapa }).eq("id", id);
    if (e) { setLeads(antes); setError("No se pudo mover el lead: " + e.message); }
    else { setError(""); if (etapa === "ganado") confeti(); void cargar(); }
  }

  const frios = useMemo(() => leads.filter(esFrio), [leads]);
  async function enfriar() {
    if (!(await confirmar(`Mandar ${frios.length} leads a «Sin respuesta»`, `Llevan más de ${DIAS_FRIO} días sin avanzar. No se borran: quedan en el cajón y se pueden recuperar arrastrándolos.`, "Mandarlos"))) return;
    const { error: e } = await sb.from("leads").update({ etapa: "sin_respuesta" }).in("id", frios.map((l) => l.id));
    if (e) setError("No se pudo mover: " + e.message); else void cargar();
  }

  function soltar(ev: DragEvent, etapa: EtapaLead) {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain")) || arrastrando;
    setSobre(null); setArrastrando(null);
    if (id) void mover(id, etapa);
  }

  const tarjeta = (l: Lead) => {
    const atraso = atrasoLead(l, reuniones[l.reunion_id ?? ""]);
    const frio = esFrio(l);
    const sv = SERVICIOS_LEAD.find((x) => x.id === l.servicio_interes);
    const sinWeb = /no tengo/i.test(l.web ?? "");
    return (
      <article
        key={l.id}
        className={`lead-tarjeta${arrastrando === l.id ? " arrastrando" : ""}${atraso ? " atrasada" : ""}${frio ? " fria" : ""}`}
        style={{ ["--av" as string]: colorLead(l.id) }}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(l.id)); e.dataTransfer.effectAllowed = "move"; setArrastrando(l.id); }}
        onDragEnd={() => { setArrastrando(null); setSobre(null); }}
        onClick={() => setAbierto(l.id)}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setAbierto(l.id); }}
      >
        <div className="lead-top">
          <span className="lead-av" aria-hidden="true">{inicialesLead(l)}</span>
          <div className="lead-quien">
            <b>{nombreLead(l)}</b>
            <span className="lead-sub">{[l.tipo, l.pais].filter(Boolean).join(" · ") || "—"}</span>
          </div>
        </div>
        {l.problema && <p className="lead-nota">{l.problema}</p>}
        <div className="lead-meta">
          {l.requiere_humano && <span className="lead-sello humano" title="Lo atiende una persona">Humano</span>}
          {sv && <span className={`lead-chip ${sv.id}`}>{sv.texto}</span>}
          {sinWeb && <span className="lead-chip aviso">Sin web</span>}
          {frio && <span className="lead-chip frio">Frío</span>}
          {l.valor_estimado ? <span className="lead-valor">{dinero(l.valor_estimado)}</span> : null}
        </div>
        {l.proxima_accion_en && !["ganado", "perdido", "sin_respuesta"].includes(l.etapa) && (
          <p className={`lead-proxima${l.proxima_accion_en < hoy ? " vencida" : l.proxima_accion_en === hoy ? " hoy" : ""}`}>
            → {l.proxima_accion || "Seguimiento"} · {l.proxima_accion_en < hoy ? "venció " : l.proxima_accion_en === hoy ? "hoy " : ""}{l.proxima_accion_en === hoy ? "" : new Date(l.proxima_accion_en + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
          </p>
        )}
        <div className="lead-pie">
          <span title={new Date(l.etapa_en).toLocaleString("es-CL")}>{hace(diasEnEtapa(l))}</span>
          {atraso && <span className="lead-atraso">{atraso}</span>}
          {l.responsable && <span className="lead-resp">{l.responsable}</span>}
        </div>
      </article>
    );
  };

  const columna = (e: { id: EtapaLead; texto: string; ayuda: string }) => {
    const filas = porEtapa(e.id);
    const suma = filas.reduce((a, l) => a + (l.valor_estimado ?? 0), 0);
    return (
      <section
        key={e.id}
        className={`lead-col${sobre === e.id ? " sobre" : ""}`}
        data-etapa={e.id}
        onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }}
        onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
        onDrop={(ev) => soltar(ev, e.id)}
      >
        <header>
          <div><h2>{e.texto}</h2><small>{e.ayuda}</small></div>
          <span className="lead-cuenta">{filas.length}</span>
        </header>
        {suma > 0 && <div className="lead-suma">{dinero(suma)}</div>}
        <div className="lead-lista">
          {filas.length === 0 ? <p className="lead-vacio">Suelta un lead aquí</p> : filas.map(tarjeta)}
        </div>
      </section>
    );
  };

  const cajonFilas = [...porEtapa("sin_respuesta"), ...porEtapa("perdido")];

  return (
    <>
      <div className="barra">
        <h1>Leads</h1>
        <div className="lead-vistas" role="tablist" aria-label="Vista">
          <button className={vista === "tablero" ? "on" : ""} onClick={() => setVista("tablero")} role="tab" aria-selected={vista === "tablero"}>Tablero</button>
          <button className={vista === "lista" ? "on" : ""} onClick={() => setVista("lista")} role="tab" aria-selected={vista === "lista"}>Lista</button>
        </div>
        <button className="btn solido" onClick={() => setNuevo(true)}>{Ico.mas({ t: 15 })} Nuevo lead</button>
      </div>

      <div className="cuerpo">
        <div className="lead-resumen">
          <div><span>Abiertos</span><b>{resumen.abiertos}</b></div>
          <div><span>En juego</span><b>{dinero(resumen.enJuego)}</b></div>
          <div className={resumen.atrasados ? "alerta" : ""}><span>Piden atención</span><b>{resumen.atrasados}</b></div>
          <div><span>Ganados este mes</span><b>{resumen.ganadosMes}{resumen.valorMes ? ` · ${dinero(resumen.valorMes)}` : ""}</b></div>
        </div>

        <div className="lead-filtros">
          <label className="lead-busca">{Ico.buscar({ t: 15 })}<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por negocio, nombre, correo o WhatsApp" /></label>
          <div className="lead-chips">
            <button className={!servicio ? "on" : ""} onClick={() => setServicio("")}>Todos</button>
            {SERVICIOS_LEAD.map((s) => <button key={s.id} className={servicio === s.id ? "on" : ""} onClick={() => setServicio(servicio === s.id ? "" : s.id)}>{s.texto}</button>)}
          </div>
          {miApodo && <div className="lead-chips"><button className={mios ? "on" : ""} onClick={() => setMios(!mios)} title={`Solo los leads con responsable ${miApodo}`}>Solo míos</button></div>}
        </div>

        {frios.length > 0 && (
          <div className="lead-frios">
            <span aria-hidden="true">❄</span>
            <p><b>{frios.length} leads llevan más de {DIAS_FRIO} días sin avanzar.</b> Ya no cuentan como urgentes. Mándalos a «Sin respuesta» para dejar el tablero limpio.</p>
            <button className="btn" onClick={enfriar}>Mandarlos</button>
          </div>
        )}
        {error && <p className="aviso-error" role="alert">{error}</p>}
        {cargando ? <p className="vacio">Cargando…</p> : vista === "tablero" ? (
          <>
            <div className="lead-tablero">{ETAPAS_TABLERO.map(columna)}</div>
            <div className={`lead-cajon${cajon ? " abierto" : ""}`}>
              <button className="lead-cajon-tit" onClick={() => setCajon(!cajon)} aria-expanded={cajon}>
                <span>Sin respuesta y perdidos</span><span className="lead-cuenta">{cajonFilas.length}</span>
                <span className="lead-cajon-flecha" aria-hidden="true">{cajon ? "−" : "+"}</span>
              </button>
              {cajon && (
                <div className="lead-cajon-cuerpo">
                  {ETAPAS_CAJON.map((e) => (
                    <section key={e.id} className={`lead-col chica${sobre === e.id ? " sobre" : ""}`} data-etapa={e.id}
                      onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }} onDragLeave={() => setSobre((s) => (s === e.id ? null : s))} onDrop={(ev) => soltar(ev, e.id)}>
                      <header><div><h2>{e.texto}</h2><small>{e.ayuda}</small></div><span className="lead-cuenta">{porEtapa(e.id).length}</span></header>
                      <div className="lead-lista">{porEtapa(e.id).length === 0 ? <p className="lead-vacio">Nada por aquí.</p> : porEtapa(e.id).map(tarjeta)}</div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla lead-tabla">
              <thead><tr><th>Negocio</th><th>Etapa</th><th>Servicio</th><th>Valor</th><th>Origen</th><th>Responsable</th><th>Entró</th></tr></thead>
              <tbody>
                {visibles.map((l) => (
                  <tr key={l.id} onClick={() => setAbierto(l.id)} className="fila-click">
                    <td><b>{nombreLead(l)}</b><small>{l.tipo ?? ""}</small></td>
                    <td><span className={`lead-etapa-pil e-${l.etapa}`}>{textoEtapa(l.etapa)}</span></td>
                    <td>{SERVICIOS_LEAD.find((s) => s.id === l.servicio_interes)?.texto ?? "—"}</td>
                    <td>{l.valor_estimado ? dinero(l.valor_estimado) : "—"}</td>
                    <td>{l.origen || l.campana || "—"}</td>
                    <td>{l.responsable || "—"}</td>
                    <td>{new Date(l.creado_en).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</td>
                  </tr>
                ))}
                {visibles.length === 0 && <tr><td colSpan={7} className="vacio">No hay leads con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(abierto !== null || nuevo) && (
        <FichaLead
          lead={nuevo ? null : leads.find((l) => l.id === abierto) ?? null}
          reunion={abierto !== null ? reuniones[leads.find((l) => l.id === abierto)?.reunion_id ?? ""] : undefined}
          onCerrar={() => { setAbierto(null); setNuevo(false); }}
          onCambio={cargar}
        />
      )}
    </>
  );
}

/** Un puñado de confeti de la marca al ganar un lead. Solo CSS; se limpia solo. */
function confeti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colores = ["#014CFD", "#7A3CFF", "#0A8FE0", "#E5602B", "#147A42", "#C77A00", "#D6336C"];
  const caja = document.createElement("div");
  caja.className = "confeti";
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("i");
    p.style.setProperty("--x", `${(Math.random() - 0.5) * 120}vw`);
    p.style.setProperty("--y", `${-20 - Math.random() * 60}vh`);
    p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    p.style.background = colores[i % colores.length];
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    caja.appendChild(p);
  }
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 2200);
}
