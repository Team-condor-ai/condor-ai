import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { useSesion } from "../../auth/sesion";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import { type Curso, type Fase, type Leccion, duracion, embed, guardarPosicion, leerPosicion, ordenadas, segDe, useCursos } from "./datos";
import { VideoHls } from "./VideoHls";
import { FormCurso, FormFase, FormLeccion } from "./Formularios";

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
        <Leccion curso={curso} leccion={l} anterior={lista[i - 1]} siguiente={lista[i + 1]} lista={lista} fases={d.fases.filter((f) => f.curso_id === curso.id)}
          hechas={d.hechas} poster={l.poster_ruta ? d.imagenes[l.poster_ruta] : undefined} avance={avance(curso.id)}
          onIr={(id) => ir(curso.id, id)} onVolver={() => ir(curso.id)} onMarcar={(id, v) => d.marcar(id, yo, v)}
          editable={editable} onEditar={() => setEditLeccion({ curso, leccion: l, faseId: l.fase_id })} />
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
                <span className="cur-texto"><b>{c.titulo}</b><small>{d.fases.filter((f) => f.curso_id === c.id).length || 1} fases · {lista.length} lecciones{total ? ` · ${duracion(total)}` : ""}</small></span>
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

function Leccion({ curso, leccion: l, anterior, siguiente, lista, fases, hechas, poster, avance, onIr, onVolver, onMarcar, editable, onEditar }: {
  curso: Curso; leccion: Leccion; anterior?: Leccion; siguiente?: Leccion; lista: Leccion[]; fases: Fase[]; hechas: Set<string>; poster?: string; avance: number;
  onIr: (id: string) => void; onVolver: () => void; onMarcar: (id: string, v: boolean) => void; editable: boolean; onEditar: () => void;
}) {
  const inicio = useMemo(() => leerPosicion(l.id), [l.id]);
  const marcada = useRef(false);
  marcada.current = hechas.has(l.id);
  const ext = embed(l.url);
  const faseDe = (id: string | null) => fases.find((f) => f.id === id)?.titulo ?? "";
  const tiempo = (t: number, total: number) => {
    if (Math.floor(t) % 5 === 0) guardarPosicion(l.id, total - t < 15 ? 0 : t);
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
          {l.video_ruta ? <VideoHls key={l.id} ruta={l.video_ruta} poster={poster} inicio={inicio} onTiempo={tiempo} onFin={() => { guardarPosicion(l.id, 0); if (!marcada.current) onMarcar(l.id, true); }} />
            : ext ? <div className="cur-video"><iframe src={ext} title={l.titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            : l.url || l.archivo_ruta ? <div className="cur-enlace">{Ico.documentos({ t: 28 })}<b>Esta lección es material para leer o descargar</b>{l.url && <a className="btn solido" href={l.url} target="_blank" rel="noreferrer">{Ico.abrirWeb({ t: 15 })} Abrir material</a>}</div>
            : <div className="cur-enlace">{Ico.video({ t: 28 })}<b>El video de esta lección todavía se está subiendo</b><span>Vuelve en unas horas; el resto del curso ya está disponible.</span></div>}
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
        <aside className="cur-lista" aria-label="Temario">
          {grupos.map((g) => (
            <div key={g.f?.id ?? "sin"} className="cur-lista-fase">
              <p>{g.f?.titulo ?? "Otras lecciones"}</p>
              <ol>
                {g.ls.map((x) => (
                  <li key={x.id} className={`${x.id === l.id ? "on" : ""}${hechas.has(x.id) ? " hecha" : ""}`}>
                    <button onClick={() => onIr(x.id)}><span className="cur-n">{hechas.has(x.id) ? "✓" : lista.indexOf(x) + 1}</span><span className="cur-t"><b>{x.titulo}</b>{segDe(x) ? <small>{duracion(segDe(x))}</small> : null}</span></button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
