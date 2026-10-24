import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { Cajon } from "../disenio/Dialogos";
import {
  type Lead,
  type EventoLead,
  type EtapaLead,
  ETAPAS_TABLERO,
  ETAPAS_CAJON,
  SERVICIOS_LEAD,
  RESPONSABLES,
  textoEtapa,
  nombreLead,
  diasEnEtapa,
  hace,
} from "./leadsTipos";

type Reunion = { fecha_hora: string; asistio: boolean | null } | undefined;

const soloDigitos = (s: string | null) => (s ?? "").replace(/\D/g, "");

/**
 * La ficha de un lead, en un panel lateral (idea de la «ficha única» del CRM de Neisstech).
 * Arriba lo que se hace con él (etapa, quién, qué sigue); abajo lo que sabemos (origen y diagnóstico);
 * al final su recorrido, que se llena solo y también con las notas de quien lo atiende.
 * `lead === null` abre la misma ficha en blanco para ingresar uno a mano.
 */
export function FichaLead({ lead, reunion, onCerrar, onCambio }: { lead: Lead | null; reunion: Reunion; onCerrar: () => void; onCambio: () => Promise<void> | void }) {
  const sesion = useSesion();
  const [d, setD] = useState<Partial<Lead>>(lead ?? { etapa: "nuevo", requiere_humano: false });
  const [eventos, setEventos] = useState<EventoLead[]>([]);
  const [nota, setNota] = useState("");
  const [tipoNota, setTipoNota] = useState<EventoLead["tipo"]>("nota");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setD(lead ?? { etapa: "nuevo", requiere_humano: false }); }, [lead?.id, lead?.etapa]);

  async function cargarEventos() {
    if (!lead) return;
    const { data } = await sb.from("lead_eventos").select("*").eq("lead_id", lead.id).order("creado_en", { ascending: false }).limit(60);
    setEventos((data ?? []) as EventoLead[]);
  }
  useEffect(() => { void cargarEventos(); }, [lead?.id, lead?.etapa]);


  const poner = <K extends keyof Lead>(k: K, v: Lead[K] | null) => setD((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setGuardando(true); setError("");
    const campos = {
      negocio: d.negocio?.trim() || null, nombre: d.nombre?.trim() || null, email: d.email?.trim() || null, whatsapp: d.whatsapp?.trim() || null,
      etapa: d.etapa ?? "nuevo", responsable: d.responsable || null, valor_estimado: d.valor_estimado ? Number(d.valor_estimado) : null,
      servicio_interes: d.servicio_interes || null, requiere_humano: !!d.requiere_humano, motivo_perdida: d.etapa === "perdido" ? d.motivo_perdida || null : null,
      proxima_accion: d.proxima_accion?.trim() || null, proxima_accion_en: d.proxima_accion_en || null,
    };
    if (!campos.negocio && !campos.nombre) { setError("Escribe al menos el negocio o el nombre."); setGuardando(false); return; }
    const r = lead
      ? await sb.from("leads").update(campos).eq("id", lead.id)
      : await sb.from("leads").insert({ ...campos, origen: "Ingreso manual", estado: "activo" });
    setGuardando(false);
    if (r.error) { setError("No se pudo guardar: " + r.error.message); return; }
    await onCambio();
    if (!lead) onCerrar(); else void cargarEventos();
  }

  async function anotar() {
    if (!lead || !nota.trim()) return;
    const { error: e } = await sb.from("lead_eventos").insert({ lead_id: lead.id, tipo: tipoNota, texto: nota.trim(), autor: sesion.email });
    if (e) { setError("No se pudo anotar: " + e.message); return; }
    setNota(""); void cargarEventos();
  }

  async function marcarAsistencia(asistio: boolean) {
    if (!lead?.reunion_id) return;
    const { error: e } = await sb.from("reuniones").update({ asistio, cerrada_en: new Date().toISOString() }).eq("id", lead.reunion_id);
    if (e) { setError("No se pudo marcar la reunión: " + e.message); return; }
    await sb.from("lead_eventos").insert({ lead_id: lead.id, tipo: "reunion", texto: asistio ? "Asistió a la reunión" : "No asistió a la reunión", autor: sesion.email });
    await onCambio(); void cargarEventos();
  }

  const wa = soloDigitos(d.whatsapp ?? null);
  const problemas = Array.isArray(lead?.problemas) ? (lead!.problemas as unknown[]).map((p) => (typeof p === "string" ? p : JSON.stringify(p))) : [];
  const origen = [lead?.origen, lead?.campana, lead?.utm_source && `utm: ${lead.utm_source}${lead.utm_medium ? "/" + lead.utm_medium : ""}`].filter(Boolean).join(" · ");

  return (
    <Cajon
      ancho={560}
      titulo={nombreLead({ negocio: d.negocio ?? null, nombre: d.nombre ?? null, email: d.email ?? null, tipo: lead?.tipo ?? null, whatsapp: d.whatsapp ?? null })}
      subtitulo={lead ? `${textoEtapa(lead.etapa)} · ${hace(diasEnEtapa(lead))} en esta etapa · entró el ${new Date(lead.creado_en).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}` : "Nuevo lead"}
      onCerrar={onCerrar}
      pie={<>
        {error && <p className="aviso-error izq" role="alert">{error}</p>}
        <button className="btn" onClick={onCerrar}>Cerrar</button>
        <button className="btn solido" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : lead ? "Guardar cambios" : "Crear lead"}</button>
      </>}
    >
        <div className="ficha-lead-cuerpo">
          <div className="etapas-barra" role="group" aria-label="Etapa">
            {[...ETAPAS_TABLERO, ...ETAPAS_CAJON].map((e) => (
              <button key={e.id} type="button" className={`${d.etapa === e.id ? "on" : ""} e-${e.id}`} onClick={() => poner("etapa", e.id as EtapaLead)}>{e.texto}</button>
            ))}
          </div>

          <div className="ficha-acciones">
            {wa && <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${d.nombre?.split(" ")[0] ?? ""}, soy del equipo de Cóndor. Vi tu consulta y quería conversar.`)}`}>{Ico.chat({ t: 15 })} WhatsApp</a>}
            {d.email && <a className="btn" href={`mailto:${d.email}`}>{Ico.correos({ t: 15 })} Correo</a>}
            {lead?.web && <a className="btn" target="_blank" rel="noreferrer" href={lead.web.startsWith("http") ? lead.web : `https://${lead.web}`}>{Ico.abrirWeb({ t: 15 })} Su web</a>}
          </div>

          {lead?.reunion_id && reunion && (
            <div className={`ficha-reunion${reunion.asistio == null && new Date(reunion.fecha_hora).getTime() < Date.now() ? " pendiente" : ""}`}>
              <div><b>Reunión</b><span>{new Date(reunion.fecha_hora).toLocaleString("es-CL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span></div>
              {reunion.asistio == null && new Date(reunion.fecha_hora).getTime() < Date.now() ? (
                <div className="ficha-reunion-bot"><span>Falta marcar el resultado</span><button className="btn chico" onClick={() => marcarAsistencia(true)}>Asistió</button><button className="btn chico" onClick={() => marcarAsistencia(false)}>No asistió</button></div>
              ) : reunion.asistio != null ? <span className={`lead-etapa-pil ${reunion.asistio ? "e-ganado" : "e-perdido"}`}>{reunion.asistio ? "Asistió" : "No asistió"}</span> : null}
            </div>
          )}

          <section className="ficha-grupo">
            <h3>Contacto</h3>
            <div className="ficha-rejilla">
              <label>Negocio<input value={d.negocio ?? ""} onChange={(e) => poner("negocio", e.target.value)} /></label>
              <label>Nombre<input value={d.nombre ?? ""} onChange={(e) => poner("nombre", e.target.value)} /></label>
              <label>WhatsApp<input value={d.whatsapp ?? ""} onChange={(e) => poner("whatsapp", e.target.value)} placeholder="+56 9…" /></label>
              <label>Correo<input type="email" value={d.email ?? ""} onChange={(e) => poner("email", e.target.value)} /></label>
            </div>
          </section>

          <section className="ficha-grupo">
            <h3>Seguimiento</h3>
            <div className="ficha-rejilla">
              <label>Servicio de interés
                <select value={d.servicio_interes ?? ""} onChange={(e) => poner("servicio_interes", (e.target.value || null) as Lead["servicio_interes"])}>
                  <option value="">Sin definir</option>{SERVICIOS_LEAD.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
                </select>
              </label>
              <label>Valor estimado (CLP)<input inputMode="numeric" value={d.valor_estimado ?? ""} onChange={(e) => poner("valor_estimado", (e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null) as Lead["valor_estimado"])} placeholder="0" /></label>
              <label>Responsable
                <select value={d.responsable ?? ""} onChange={(e) => poner("responsable", e.target.value || null)}>
                  <option value="">Sin asignar</option>{RESPONSABLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label>Próxima acción<input value={d.proxima_accion ?? ""} onChange={(e) => poner("proxima_accion", e.target.value)} placeholder="Ej.: enviar cotización" /></label>
              <label>Para el día<input type="date" value={d.proxima_accion_en ?? ""} onChange={(e) => poner("proxima_accion_en", e.target.value || null)} /></label>
              {d.etapa === "perdido" && <label>Motivo<input value={d.motivo_perdida ?? ""} onChange={(e) => poner("motivo_perdida", e.target.value)} placeholder="Precio, eligió otra opción…" /></label>}
            </div>
            <label className="ficha-check"><input type="checkbox" checked={!!d.requiere_humano} onChange={(e) => poner("requiere_humano", e.target.checked)} /> Requiere a una persona (pidió hablar, caso especial)</label>
          </section>

          {lead && (origen || lead.problema || lead.diagnostico || lead.recomendacion || problemas.length > 0 || lead.como_cerrar) && (
            <section className="ficha-grupo">
              <h3>Lo que sabemos</h3>
              {origen && <p className="ficha-dato"><span>Origen</span>{origen}{lead.pais ? ` · ${lead.pais}` : ""}</p>}
              {lead.tipo && <p className="ficha-dato"><span>Tipo de negocio</span>{lead.tipo}{lead.clientes_mes ? ` · ${lead.clientes_mes} clientes al mes` : ""}</p>}
              {lead.problema && <p className="ficha-dato"><span>Su problema</span>{lead.problema}</p>}
              {problemas.length > 0 && <div className="ficha-dato"><span>Problemas detectados</span><ul>{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
              {lead.diagnostico && <p className="ficha-dato"><span>Diagnóstico</span>{lead.diagnostico}</p>}
              {lead.recomendacion && <p className="ficha-dato"><span>Recomendación</span>{lead.recomendacion}</p>}
              {lead.como_cerrar && <p className="ficha-dato"><span>Cómo cerrarlo</span>{lead.como_cerrar}</p>}
            </section>
          )}

          {lead && (
            <section className="ficha-grupo">
              <h3>Recorrido</h3>
              <div className="ficha-nota">
                <select value={tipoNota} onChange={(e) => setTipoNota(e.target.value as EventoLead["tipo"])} aria-label="Tipo de anotación">
                  <option value="nota">Nota</option><option value="llamada">Llamada</option><option value="whatsapp">WhatsApp</option><option value="correo">Correo</option>
                </select>
                <input value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === "Enter" && anotar()} placeholder="Qué pasó, qué quedó acordado…" />
                <button className="btn" onClick={anotar} disabled={!nota.trim()}>Anotar</button>
              </div>
              <ol className="ficha-linea">
                {eventos.map((ev) => (
                  <li key={ev.id} className={`t-${ev.tipo}`}>
                    <span className="punto" aria-hidden="true" />
                    <div>
                      <p>{ev.tipo === "etapa" ? <>Pasó de <b>{textoEtapa(ev.de_etapa ?? "")}</b> a <b>{textoEtapa(ev.a_etapa ?? "")}</b></> : ev.tipo === "sistema" ? ev.texto : <><b>{{ nota: "Nota", llamada: "Llamada", whatsapp: "WhatsApp", correo: "Correo", reunion: "Reunión" }[ev.tipo]}:</b> {ev.texto}</>}</p>
                      <small>{ev.autor ?? "—"} · {new Date(ev.creado_en).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                    </div>
                  </li>
                ))}
                {eventos.length === 0 && <li className="vacio-linea">Todavía no hay movimientos.</li>}
              </ol>
            </section>
          )}
        </div>

    </Cajon>
  );
}
