import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { useSesion } from "../../auth/sesion";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import { type Curso, type Fase, type Leccion, duracion, embed, guardarPosicion, leerPosicion, ordenadas, segDe, useCursos } from "./datos";
import { VideoHls } from "./VideoHls";
import { FormCurso, FormFase, FormLeccion } from "./Formularios";
import { type Companero, useCompaneros } from "./companeros";
import { iniciales, tono } from "../personas";

const GRADIENTES = ["linear-gradient(135deg,#014CFD,#7A3CFF)", "linear-gradient(135deg,#0A8FE0,#014CFD)", "linear-gradient(135deg,#7A3CFF,#D6336C)", "linear-gradient(135deg,#147A42,#0A8FE0)", "linear-gradient(135deg,#E5602B,#D6336C)", "linear-gradient(135deg,#151517,#014CFD)"];

/**
 * Plataforma de cursos (24-oct-2026), con la forma de cualquier plataforma de cursos:
 *  1. Catálogo: tarjetas con portada, duración, lecciones y tu avance.
 *  2. Página del curso: de qué trata, qué vas a aprender por fase (cada fase con su descripción) y el temario.
 *  3. Lección: el video grande, sus notas, anterior/siguiente y el temario al lado. Retoma donde quedaste
 *     y se marca vista sola al llegar al 90 %.
 * La navegación vive en la URL (?curso=…&leccion=…): el botón «atrás» del navegador funciona y se puede
 * mandar el enlace a una lección. `editable` = equipo (crea y edita); los clientes solo ven los cursos para clientes.
 */
export function Cursos({ editable }: { editable: boolean }) {
  const yo = useSesion().email;
  const confirmar = useConfirmacion();
  const d = useCursos();
  const [params, setParams] = useSearchParams();
  const cursoId = params.get("curso"), leccionId = params.get("leccion");
  const ir = (curso: string | null, leccion?: string | null) => {
    const p = new URLSearchParams(params);
    if (curso) p.set("curso", curso); else p.delete("curso");
    if (leccion) p.set("leccion", leccion); else p.delete("leccion");
    setParams(p); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [editCurso, setEditCurso] = useState<Curso | "nuevo" | null>(null);
  const [editFase, setEditFase] = useState<{ curso: Curso; fase: Fase | null } | null>(null);
  const [editLeccion, setEditLeccion] = useState<{ curso: Curso; leccion: Leccion | null; faseId: string | null } | null>(null);

  const curso = d.cursos.find((c) => c.id === cursoId) ?? null;
  const cursoDe = useCallback((leccion: string) => d.lecciones.find((l) => l.id === leccion)?.curso_id, [d.lecciones]);
  const eq = useCompaneros(editable, yo, cursoDe);
  const { anunciar } = eq;
  useEffect(() => { anunciar(cursoId, leccionId, 0); }, [anunciar, cursoId, leccionId]);
  /** Dónde «está» cada compañero en un curso: si lo está viendo ahora, esa lección; si no, la última que tocó. */
  const dondeVa = (p: Companero, c: string) => (p.vivo?.curso === c && p.vivo.leccion ? p.vivo.leccion : p.ultima.get(c)?.leccion ?? null);
  const enLeccion = (c: string, leccion: string) => eq.companeros.filter((p) => dondeVa(p, c) === leccion);
  const enCurso = (c: string) => eq.companeros.filter((p) => p.vivo?.curso === c || p.ultima.has(c));
  const avanceDe = (p: Companero, c: string) => { const ls = d.lecciones.filter((l) => l.curso_id === c); return ls.length ? Math.round((ls.filter((l) => p.hechas.has(l.id)).length / ls.length) * 100) : 0; };
  const visibles = d.cursos.filter((c) => editable || c.publicado);
  const avance = (id: string) => { const ls = d.lecciones.filter((l) => l.curso_id === id); return ls.length ? Math.round((ls.filter((l) => d.hechas.has(l.id)).length / ls.length) * 100) : 0; };
  const portada = (c: Curso) => {
    if (c.portada_ruta && d.imagenes[c.portada_ruta]) return d.imagenes[c.portada_ruta];
    const primera = ordenadas(c.id, d.fases, d.lecciones).find((l) => l.poster_ruta && d.imagenes[l.poster_ruta!]);
    return primera ? d.imagenes[primera.poster_ruta!] : null;
  };

  const formularios = (
    <>
      {editCurso && <FormCurso curso={editCurso === "nuevo" ? null : editCurso} yo={yo} onCerrar={() => setEditCurso(null)} onListo={(id) => { setEditCurso(null); void d.cargar(); if (id) ir(id); }} />}
      {editFase && <FormFase curso={editFase.curso} fase={editFase.fase} orden={d.fases.filter((f) => f.curso_id === editFase.curso.id).length} onCerrar={() => setEditFase(null)} onListo={() => { setEditFase(null); void d.cargar(); }} />}
      {editLeccion && <FormLeccion curso={editLeccion.curso} leccion={editLeccion.leccion} faseId={editLeccion.faseId} fases={d.fases.filter((f) => f.curso_id === editLeccion.curso.id)} orden={d.lecciones.filter((l) => l.curso_id === editLeccion.curso.id).length} onCerrar={() => setEditLeccion(null)} onListo={() => { setEditLeccion(null); void d.cargar(); }} />}
    </>
  );

  if (d.cargando) return <p className="vacio">Cargando cursos…</p>;
  if (d.error) return <p className="aviso-error">{d.error}</p>;

  /* ── 3. Lección ── */
  if (curso && leccionId) {
    const lista = ordenadas(curso.id, d.fases, d.lecciones);
    const i = lista.findIndex((l) => l.id === leccionId);
    const l = lista[i];
    if (!l) return <><button className="btn chico" onClick={() => ir(curso.id)}>← Volver al curso</button><p className="vacio">Esa lección ya no existe.</p></>;
    return (
      <>
        <Leccion key={l.id} curso={curso} leccion={l} anterior={lista[i - 1]} siguiente={lista[i + 1]} lista={lista} fases={d.fases.filter((f) => f.curso_id === curso.id)}
          hechas={d.hechas} poster={l.poster_ruta ? d.imagenes[l.poster_ruta] : undefined} avance={avance(curso.id)}
          onIr={(id) => ir(curso.id, id)} onVolver={() => ir(curso.id)} onMarcar={(id, v) => d.marcar(id, yo, v)}
          editable={editable} onEditar={() => setEditLeccion({ curso, leccion: l, faseId: l.fase_id })}
          companeros={eq.companeros.filter((p) => !p.yo)} enLeccion={(id) => enLeccion(curso.id, id)} miSegundo={eq.miSegundo(l.id)}
          onAvance={(t, total) => { anunciar(curso.id, l.id, t); void eq.guardarAvance(l.id, t, total); }} />
        {formularios}
      </>
    );
  }

  /* ── 2. Página del curso ── */
  if (curso) {
    const fs = d.fases.filter((f) => f.curso_id === curso.id).sort((a, b) => a.orden - b.orden);
    const lista = ordenadas(curso.id, d.fases, d.lecciones);
    const total = lista.reduce((a, l) => a + segDe(l), 0);
    const siguiente = lista.find((l) => !d.hechas.has(l.id)) ?? lista[0];
    const empezado = lista.some((l) => d.hechas.has(l.id));
    const grupos: { fase: Fase | null; lecciones: Leccion[] }[] = [...fs.map((f) => ({ fase: f, lecciones: lista.filter((l) => l.fase_id === f.id) })), { fase: null, lecciones: lista.filter((l) => !l.fase_id || !fs.some((f) => f.id === l.fase_id)) }].filter((g) => g.fase || g.lecciones.length);
    const img = portada(curso);
    let n = 0;
    return (
      <div className="cur-pagina">
        <button className="btn chico" onClick={() => ir(null)}>← Todos los cursos</button>
        <header className="cur-hero" style={{ background: GRADIENTES[d.cursos.indexOf(curso) % GRADIENTES.length] }}>
          {img && <img className="cur-hero-img" src={img} alt="" />}
          <div className="cur-hero-txt">
            <p className="cur-cat">{[curso.categoria, curso.nivel].filter(Boolean).join(" · ") || "Curso"}</p>
            <h2>{curso.titulo}</h2>
            {curso.descripcion && <p className="cur-hero-desc">{curso.descripcion}</p>}
            <div className="cur-datos">
              <span>{fs.length || 1} fase{fs.length === 1 ? "" : "s"}</span><span>{lista.length} lecciones</span>{total > 0 && <span>{duracion(total)}</span>}{curso.profesor && <span>Por {curso.profesor}</span>}
            </div>
            <div className="cur-hero-acc">
              {siguiente && <button className="btn blanco" onClick={() => ir(curso.id, siguiente.id)}>{Ico.video({ t: 15 })} {empezado ? "Continuar" : "Empezar el curso"}</button>}
              {editable && <><button className="btn vidrio" onClick={() => setEditCurso(curso)}>Editar curso</button><button className="btn vidrio" onClick={async () => { if (await confirmar(`Borrar el curso «${curso.titulo}»`, "Se borran sus fases, lecciones y el avance de todos. Los videos quedan en el almacenamiento.", "Borrar curso")) { await sb.from("cursos").delete().eq("id", curso.id); ir(null); void d.cargar(); } }}>Borrar</button></>}
            </div>
          </div>
          <div className="cur-anillo" style={{ ["--p" as string]: avance(curso.id) }}><b>{avance(curso.id)}%</b><span>completado</span></div>
        </header>

        {editable && <EquipoEnCurso personas={[...enCurso(curso.id), ...eq.companeros.filter((p) => p.yo && !enCurso(curso.id).includes(p))]} total={eq.companeros.length} avance={(p) => avanceDe(p, curso.id)}
          leccion={(p) => lista.find((l) => l.id === dondeVa(p, curso.id)) ?? null} numero={(id) => lista.findIndex((l) => l.id === id) + 1}
          onIr={(id) => ir(curso.id, id)} />}

        <div className="cur-temario-cab">
          <h3>Contenido del curso</h3>
          {editable && <div className="cur-temario-acc"><button className="btn chico" onClick={() => setEditFase({ curso, fase: null })}>{Ico.mas({ t: 13 })} Fase</button><button className="btn chico" onClick={() => setEditLeccion({ curso, leccion: null, faseId: fs[fs.length - 1]?.id ?? null })}>{Ico.mas({ t: 13 })} Lección</button></div>}
        </div>
        <div className="cur-fases">
          {grupos.map((g, gi) => {
            const hechasFase = g.lecciones.filter((l) => d.hechas.has(l.id)).length;
            const segs = g.lecciones.reduce((a, l) => a + segDe(l), 0);
            return (
              <details key={g.fase?.id ?? "sin"} className="cur-fase" open={gi === 0 || g.lecciones.some((l) => l.id === siguiente?.id)}>
                <summary>
                  <span className={`cur-fase-n${hechasFase && hechasFase === g.lecciones.length ? " lista" : ""}`}>{hechasFase && hechasFase === g.lecciones.length ? "✓" : g.fase ? gi + 1 : "·"}</span>
                  <span className="cur-fase-txt"><b>{g.fase?.titulo ?? "Otras lecciones"}</b><small>{g.lecciones.length} lecciones{segs ? ` · ${duracion(segs)}` : ""}{hechasFase ? ` · ${hechasFase}/${g.lecciones.length} vistas` : ""}</small></span>
                  {editable && g.fase && <span className="cur-mini" onClick={(e) => e.preventDefault()}><button title="Editar fase" onClick={() => setEditFase({ curso, fase: g.fase })}>{Ico.editar({ t: 13 })}</button><button title="Lección en esta fase" onClick={() => setEditLeccion({ curso, leccion: null, faseId: g.fase!.id })}>{Ico.mas({ t: 13 })}</button></span>}
                  <span className="cur-fase-chev" aria-hidden="true">{Ico.galon({ t: 14 })}</span>
                </summary>
                {g.fase?.descripcion && <p className="cur-fase-desc">{g.fase.descripcion}</p>}
                <ol>
                  {g.lecciones.map((l) => { n += 1; return (
                    <li key={l.id} className={d.hechas.has(l.id) ? "hecha" : ""}>
                      <button onClick={() => ir(curso.id, l.id)}>
                        <span className="cur-n">{d.hechas.has(l.id) ? "✓" : n}</span>
                        <span className="cur-t"><b>{l.titulo}</b>{l.descripcion && <small>{l.descripcion}</small>}</span>
                        <Caritas personas={enLeccion(curso.id, l.id)} />
                        <span className="cur-dur">{l.video_ruta || embed(l.url) ? Ico.video({ t: 13 }) : Ico.documentos({ t: 13 })}{segDe(l) ? duracion(segDe(l)) : ""}</span>
                      </button>
                    </li>
                  ); })}
                </ol>
              </details>
            );
          })}
          {grupos.length === 0 && <div className="bv-vacio"><b>Este curso todavía no tiene contenido</b>{editable && <span>Agrega una fase y sus lecciones.</span>}</div>}
        </div>
        {formularios}
      </div>
    );
  }

  /* ── 1. Catálogo ── */
  return (
    <div className="cur-catalogo">
      {editable && <div className="cur-barra"><p className="rotulo-mini">{visibles.length} curso{visibles.length === 1 ? "" : "s"}</p><button className="btn solido" onClick={() => setEditCurso("nuevo")}>{Ico.mas({ t: 15 })} Nuevo curso</button></div>}
      {visibles.length === 0 ? (
        <div className="bv-vacio"><b>{editable ? "Aquí vivirán los cursos del equipo" : "Pronto habrá cursos para ti"}</b>{editable && <span>Crea el primero: inducción, cómo usar el CRM, cómo cobrar…</span>}</div>
      ) : (
        <div className="cur-rejilla">
          {visibles.map((c, i) => {
            const lista = ordenadas(c.id, d.fases, d.lecciones);
            const total = lista.reduce((a, l) => a + segDe(l), 0);
            const img = portada(c), p = avance(c.id);
            return (
              <button key={c.id} className="cur-tarjeta" onClick={() => ir(c.id)}>
                <span className="cur-portada" style={{ background: GRADIENTES[i % GRADIENTES.length] }}>
                  {img && <img src={img} alt="" loading="lazy" />}
                  <span className="cur-portada-tags">{c.categoria && <em>{c.categoria}</em>}{editable && c.para_clientes && <em>Visible para clientes</em>}{editable && !c.publicado && <em>Borrador</em>}</span>
                  {p > 0 && <span className="cur-portada-p">{p === 100 ? "✓ Completado" : `${p}%`}</span>}
                </span>
                <span className="cur-texto"><b>{c.titulo}</b><small>{d.fases.filter((f) => f.curso_id === c.id).length || 1} fases · {lista.length} lecciones{total ? ` · ${duracion(total)}` : ""}</small>
                  {enCurso(c.id).length > 0 && <span className="cur-tarjeta-eq"><Caritas personas={enCurso(c.id)} max={5} /><small>{textoGente(enCurso(c.id), c.id)}</small></span>}</span>
                <span className="cur-barra-av"><i style={{ width: `${p}%` }} /></span>
              </button>
            );
          })}
        </div>
      )}
      {formularios}
    </div>
  );
}

function Leccion({ curso, leccion: l, anterior, siguiente, lista, fases, hechas, poster, avance, onIr, onVolver, onMarcar, editable, onEditar, companeros, enLeccion, miSegundo, onAvance }: {
  curso: Curso; leccion: Leccion; anterior?: Leccion; siguiente?: Leccion; lista: Leccion[]; fases: Fase[]; hechas: Set<string>; poster?: string; avance: number;
  onIr: (id: string) => void; onVolver: () => void; onMarcar: (id: string, v: boolean) => void; editable: boolean; onEditar: () => void;
  companeros: Companero[]; enLeccion: (id: string) => Companero[]; miSegundo: number; onAvance: (t: number, total: number) => void;
}) {
  // Retoma donde quedó: lo guardado en este navegador o, si es más adelante, lo guardado en la cuenta (otro computador).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inicio = useMemo(() => Math.max(leerPosicion(l.id), miSegundo), [l.id]);
  const video = useRef<HTMLVideoElement>(null);
  const ultimoEnvio = useRef(0);
  const aviso = useAvisoLlegada(l.id, enLeccion(l.id));
  const marcada = useRef(false);
  useEffect(() => { marcada.current = hechas.has(l.id); }, [hechas, l.id]);
  const ext = embed(l.url);
  const faseDe = (id: string | null) => fases.find((f) => f.id === id)?.titulo ?? "";
  const tiempo = (t: number, total: number) => {
    if (Math.floor(t) % 5 === 0) guardarPosicion(l.id, total - t < 15 ? 0 : t);
    if (Math.abs(t - ultimoEnvio.current) >= 10) { ultimoEnvio.current = t; onAvance(t, total); }
    if (!marcada.current && total > 0 && t / total >= 0.9) { marcada.current = true; onMarcar(l.id, true); }
  };
  const grupos = [...[...fases].sort((a, b) => a.orden - b.orden).map((f) => ({ f, ls: lista.filter((x) => x.fase_id === f.id) })), { f: null as Fase | null, ls: lista.filter((x) => !x.fase_id) }].filter((g) => g.ls.length);
  return (
    <div className="cur-leccion">
      <div className="cur-leccion-barra">
        <button className="btn chico" onClick={onVolver}>← {curso.titulo}</button>
        <span className="cur-leccion-av"><span className="cur-pista"><i style={{ width: `${avance}%` }} /></span><small>{avance}% del curso</small></span>
      </div>
      <div className="cur-leccion-cuerpo">
        <section className="cur-visor">
          {l.video_ruta ? <VideoHls key={l.id} videoRef={video} ruta={l.video_ruta} poster={poster} inicio={inicio} onTiempo={tiempo} onFin={() => { guardarPosicion(l.id, 0); onAvance(segDe(l), segDe(l)); if (!marcada.current) onMarcar(l.id, true); }} />
            : ext ? <div className="cur-video"><iframe src={ext} title={l.titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            : l.url || l.archivo_ruta ? <div className="cur-enlace">{Ico.documentos({ t: 28 })}<b>Esta lección es material para leer o descargar</b>{l.url && <a className="btn solido" href={l.url} target="_blank" rel="noreferrer">{Ico.abrirWeb({ t: 15 })} Abrir material</a>}</div>
            : <div className="cur-enlace">{Ico.video({ t: 28 })}<b>El video de esta lección todavía se está subiendo</b><span>Vuelve en unas horas; el resto del curso ya está disponible.</span></div>}
          {aviso && <p className="cur-llega" role="status"><Caritas personas={[aviso]} />{aviso.nombre} acaba de entrar a esta lección</p>}
          {editable && <JuntosEnLeccion leccion={l} companeros={companeros} onSaltar={l.video_ruta ? (t) => { const v = video.current; if (v) { v.currentTime = t; void v.play().catch(() => {}); } } : undefined} />}
          <div className="cur-info">
            <p className="rotulo-mini">{faseDe(l.fase_id) || curso.titulo}</p>
            <h2>{l.titulo}</h2>
            {l.descripcion && <p>{l.descripcion}</p>}
            {l.archivo_ruta && <button className="btn chico" onClick={async () => { const { data } = await sb.storage.from("cursos").createSignedUrl(l.archivo_ruta!, 300, { download: l.archivo_nombre ?? true }); if (data) window.open(data.signedUrl, "_blank", "noopener"); }}>{Ico.descargar({ t: 14 })} {l.archivo_nombre ?? "Material"}</button>}
          </div>
          <div className="cur-nav">
            <button className="btn" disabled={!anterior} onClick={() => anterior && onIr(anterior.id)}>← Anterior</button>
            <button className={`btn${hechas.has(l.id) ? "" : " solido"}`} onClick={() => onMarcar(l.id, !hechas.has(l.id))}>{hechas.has(l.id) ? "✓ Vista" : "Marcar como vista"}</button>
            {editable && <button className="btn" onClick={onEditar}>{Ico.editar({ t: 14 })} Editar</button>}
            <button className="btn solido" disabled={!siguiente} onClick={() => siguiente && onIr(siguiente.id)}>Siguiente →</button>
          </div>
        </section>
        <div className="cur-lista" role="navigation" aria-label="Temario">
          {grupos.map((g) => (
            <div key={g.f?.id ?? "sin"} className="cur-lista-fase">
              <p>{g.f?.titulo ?? "Otras lecciones"}</p>
              <ol>
                {g.ls.map((x) => (
                  <li key={x.id} className={`${x.id === l.id ? "on" : ""}${hechas.has(x.id) ? " hecha" : ""}`}>
                    <button onClick={() => onIr(x.id)}><span className="cur-n">{hechas.has(x.id) ? "✓" : lista.indexOf(x) + 1}</span><span className="cur-t"><b>{x.titulo}</b>{segDe(x) ? <small>{duracion(segDe(x))}</small> : null}</span><Caritas personas={enLeccion(x.id)} max={3} /></button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Compañeros ── */

const reloj = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Una cara por persona (foto o iniciales). Con anillo verde quien está viendo en este momento. */
function Caritas({ personas, max = 4 }: { personas: Companero[]; max?: number }) {
  if (!personas.length) return null;
  const orden = [...personas].sort((a, b) => Number(!!b.vivo) - Number(!!a.vivo) || Number(b.yo) - Number(a.yo));
  const resto = orden.length - max;
  return (
    <span className="caritas" aria-label={orden.map((p) => p.nombre + (p.vivo ? " (viendo ahora)" : "")).join(", ")}>
      {orden.slice(0, max).map((p) => <Cara key={p.email} p={p} />)}
      {resto > 0 && <span className="cara mas">+{resto}</span>}
    </span>
  );
}
function Cara({ p, grande }: { p: Companero; grande?: boolean }) {
  return (
    <span className={`cara${p.vivo ? " vivo" : ""}${p.yo ? " yo" : ""}${grande ? " grande" : ""}`} title={p.yo ? "Tú quedaste acá" : p.nombre + (p.vivo ? " · viendo ahora" : "")} style={{ background: p.foto ? undefined : tono(p.email) }}>
      {p.foto ? <img src={p.foto} alt="" /> : iniciales(p.apodo)}
    </span>
  );
}

function textoGente(ps: Companero[], curso: string) {
  const vivos = ps.filter((p) => p.vivo?.curso === curso);
  if (vivos.length) return `${vivos.map((p) => p.nombre).join(" y ")} ${vivos.length === 1 ? "lo está" : "lo están"} viendo ahora`;
  const otros = ps.filter((p) => !p.yo), yoVoy = ps.some((p) => p.yo);
  if (!otros.length) return "Vas en este curso";
  const quienes = otros.length === 1 ? otros[0].nombre : `${otros[0].nombre} y ${otros.length - 1} más`;
  if (yoVoy) return `${quienes} y tú van en este curso`;
  return `${quienes} ${otros.length === 1 ? "va" : "van"} en este curso`;
}

/** En la página del curso: dónde va cada persona del equipo, con su avance. */
function EquipoEnCurso({ personas, total, avance, leccion, numero, onIr }: {
  personas: Companero[]; total: number; avance: (p: Companero) => number; leccion: (p: Companero) => Leccion | null; numero: (id: string) => number; onIr: (id: string) => void;
}) {
  const orden = [...personas].sort((a, b) => Number(!!b.vivo) - Number(!!a.vivo) || avance(b) - avance(a));
  const otros = personas.filter((p) => !p.yo).length;
  // Uno mismo aparece siempre en la lista (aunque no haya empezado); en la cuenta solo entra quien empezó.
  const empezaron = personas.filter((p) => !p.yo || leccion(p)).length;
  return (
    <section className="cur-equipo">
      <div className="cur-equipo-cab"><h3>El equipo en este curso</h3><small>{empezaron} de {total} lo {empezaron === 1 ? "empezó" : "empezaron"}</small></div>
      {otros === 0 && <p className="conteo">Nadie más del equipo lo ha empezado todavía.</p>}
      {orden.length > 0 && (
        <ul>
          {orden.map((p) => {
            const l = leccion(p), a = avance(p);
            return (
              <li key={p.email}>
                <Cara p={p} grande />
                <span className="cur-equipo-txt">
                  <b>{p.nombre}{p.vivo && <em className="en-vivo">viendo ahora</em>}</b>
                  {l ? <button className="enlace-btn" onClick={() => onIr(l.id)}>{p.vivo ? "En" : p.yo ? "Vas en" : "Va en"} la lección {numero(l.id)} · {l.titulo}</button> : <small>{p.yo ? "Todavía no empiezas: dale a «Empezar el curso»" : "Todavía no empieza"}</small>}
                </span>
                <span className="cur-equipo-av"><span className="cur-pista"><i style={{ width: `${a}%` }} /></span><small>{a}%</small></span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Bajo el video: quién más está (o estuvo) en esta lección y en qué minuto, con un salto a su punto. */
function JuntosEnLeccion({ leccion: l, companeros, onSaltar }: { leccion: Leccion; companeros: Companero[]; onSaltar?: (t: number) => void }) {
  const total = segDe(l);
  const gente = companeros
    .map((p) => {
      const vivo = p.vivo?.leccion === l.id ? p.vivo : null;
      const guardado = p.avance.get(l.id);
      const t = vivo ? vivo.t : guardado?.segundo ?? (p.hechas.has(l.id) ? total : null);
      return t === null ? null : { p, t, vivo: !!vivo, vista: p.hechas.has(l.id) };
    })
    .filter((x): x is { p: Companero; t: number; vivo: boolean; vista: boolean } => !!x)
    .sort((a, b) => Number(b.vivo) - Number(a.vivo) || b.t - a.t);
  if (!gente.length) return null;
  const vivos = gente.filter((g) => g.vivo);
  return (
    <div className="cur-juntos">
      <p className="cur-juntos-tit">
        {vivos.length ? <><span className="punto-vivo" />{vivos.map((g) => g.p.nombre).join(" y ")} {vivos.length === 1 ? "está" : "están"} viendo esta lección contigo</> : "El equipo en esta lección"}
      </p>
      {total > 0 && (
        <div className="cur-juntos-pista">
          {gente.map((g) => (
            <button key={g.p.email} className="cur-juntos-marca" style={{ left: `${Math.min(100, (g.t / total) * 100)}%` }} disabled={!onSaltar} onClick={() => onSaltar?.(g.t)} title={`${g.p.nombre} · ${g.vista && !g.vivo ? "la terminó" : reloj(g.t)}${onSaltar ? " · ir a ese punto" : ""}`}>
              <Cara p={g.p} />
            </button>
          ))}
        </div>
      )}
      <ul>
        {gente.map((g) => (
          <li key={g.p.email}>
            <b>{g.p.nombre}</b>
            <span>{g.vivo ? `viendo · min ${reloj(g.t)}` : g.vista ? "ya la vio" : `quedó en el min ${reloj(g.t)}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Avisa unos segundos cuando otra persona entra a la misma lección mientras uno la está viendo. */
function useAvisoLlegada(leccion: string, aca: Companero[]): Companero | null {
  const [aviso, setAviso] = useState<Companero | null>(null);
  // Solo cuenta quien entró DESPUÉS que uno: el que ya estaba no «acaba de entrar» (su `desde` es anterior).
  // (La lección se monta con `key` = su id, así esta hora se reinicia al cambiar de lección.)
  const [entre] = useState(() => Date.now());
  const nuevo = aca.find((p) => p.vivo?.leccion === leccion && p.vivo.desde > entre);
  const clave = nuevo ? nuevo.email + nuevo.vivo!.desde : "";
  useEffect(() => {
    if (!nuevo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAviso(nuevo);
    const t = window.setTimeout(() => setAviso(null), 7000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return aviso;
}
