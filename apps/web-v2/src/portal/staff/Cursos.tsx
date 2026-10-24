import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";

type Curso = { id: string; titulo: string; descripcion: string | null; categoria: string | null; para_clientes: boolean; orden: number };
type Leccion = { id: string; curso_id: string; titulo: string; descripcion: string | null; url: string | null; archivo_ruta: string | null; archivo_nombre: string | null; duracion_min: number | null; orden: number };

const GRADIENTES = ["linear-gradient(135deg,#014CFD,#7A3CFF)", "linear-gradient(135deg,#0A8FE0,#014CFD)", "linear-gradient(135deg,#7A3CFF,#D6336C)", "linear-gradient(135deg,#147A42,#0A8FE0)", "linear-gradient(135deg,#E5602B,#D6336C)", "linear-gradient(135deg,#151517,#014CFD)"];

/** YouTube, Vimeo y Loom se ven dentro del portal; cualquier otro enlace se abre aparte. */
function embed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (h.endsWith("youtube.com")) { const v = u.searchParams.get("v"); return v ? `https://www.youtube.com/embed/${v}` : u.pathname.startsWith("/embed/") ? url : null; }
    if (h === "vimeo.com") return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean)[0]}`;
    if (h.endsWith("loom.com")) return url.replace("/share/", "/embed/");
  } catch { /* enlace inválido */ }
  return null;
}

/**
 * Cursos del equipo y de los clientes (24-oct-2026). Un curso son lecciones en orden (video, enlace o archivo de la Bóveda);
 * cada persona marca las que ya hizo y ve su avance. `editable` = equipo; los clientes solo ven los cursos marcados «para clientes».
 */
export function Cursos({ editable }: { editable: boolean }) {
  const yo = useSesion().email;
  const confirmar = useConfirmacion();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [lecciones, setLecciones] = useState<Leccion[]>([]);
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [activa, setActiva] = useState<string | null>(null);
  const [editCurso, setEditCurso] = useState<Curso | "nuevo" | null>(null);
  const [editLeccion, setEditLeccion] = useState<Leccion | "nueva" | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    const [c, l, p] = await Promise.all([
      sb.from("cursos").select("*").order("orden").order("creado_en"),
      sb.from("lecciones").select("*").order("orden").order("creado_en"),
      sb.from("curso_progreso").select("leccion_id"),
    ]);
    if (c.error || l.error) setError("No se pudo cargar: " + (c.error ?? l.error)!.message); else setError("");
    setCursos((c.data ?? []) as Curso[]);
    setLecciones((l.data ?? []) as Leccion[]);
    setHechas(new Set((p.data ?? []).map((x: { leccion_id: string }) => x.leccion_id)));
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, []);

  const deCurso = (id: string) => lecciones.filter((l) => l.curso_id === id);
  const avance = (id: string) => { const ls = deCurso(id); return ls.length ? Math.round((ls.filter((l) => hechas.has(l.id)).length / ls.length) * 100) : 0; };
  const curso = cursos.find((c) => c.id === abierto) ?? null;
  const lecs = useMemo(() => (curso ? deCurso(curso.id) : []), [curso, lecciones]); // eslint-disable-line react-hooks/exhaustive-deps
  const leccionActiva = lecs.find((l) => l.id === activa) ?? lecs[0] ?? null;

  async function marcar(l: Leccion) {
    if (!yo) return;
    const ya = hechas.has(l.id);
    setHechas((h) => { const n = new Set(h); if (ya) n.delete(l.id); else n.add(l.id); return n; });
    const r = ya ? await sb.from("curso_progreso").delete().eq("leccion_id", l.id).eq("email", yo) : await sb.from("curso_progreso").insert({ email: yo, leccion_id: l.id });
    if (r.error) void cargar();
  }
  async function archivo(l: Leccion) {
    if (!l.archivo_ruta) return;
    const { data } = await sb.storage.from("boveda").createSignedUrl(l.archivo_ruta, 120, { download: l.archivo_nombre ?? true });
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function borrarCurso(c: Curso) {
    if (!(await confirmar(`Borrar el curso «${c.titulo}»`, "Se borran también sus lecciones y el avance de todos.", "Borrar"))) return;
    const { error: e } = await sb.from("cursos").delete().eq("id", c.id);
    if (e) setError(e.message); else { setAbierto(null); void cargar(); }
  }
  async function borrarLeccion(l: Leccion) {
    if (!(await confirmar(`Borrar la lección «${l.titulo}»`, undefined, "Borrar"))) return;
    const { error: e } = await sb.from("lecciones").delete().eq("id", l.id);
    if (e) setError(e.message); else void cargar();
  }

  if (cargando) return <p className="vacio">Cargando…</p>;

  /* ── Vista de un curso ── */
  if (curso) {
    const url = leccionActiva ? embed(leccionActiva.url) : null;
    return (
      <div className="cur-detalle">
        <button className="btn chico" onClick={() => { setAbierto(null); setActiva(null); }}>← Todos los cursos</button>
        <header className="cur-cab" style={{ background: GRADIENTES[cursos.indexOf(curso) % GRADIENTES.length] }}>
          <div>
            {curso.categoria && <span className="cur-cat">{curso.categoria}</span>}
            <h2>{curso.titulo}</h2>
            {curso.descripcion && <p>{curso.descripcion}</p>}
          </div>
          <div className="cur-cab-der">
            <b>{avance(curso.id)}%</b><span>completado</span>
            {editable && <div className="cur-acc"><button className="btn chico" onClick={() => setEditCurso(curso)}>Editar</button><button className="btn chico" onClick={() => borrarCurso(curso)}>Borrar</button></div>}
          </div>
        </header>
        {error && <p className="aviso-error" role="alert">{error}</p>}
        <div className="cur-cuerpo">
          <section className="cur-visor">
            {leccionActiva ? (
              <>
                {url ? <div className="cur-video"><iframe src={url} title={leccionActiva.titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div> : (
                  <div className="cur-enlace">
                    <h3>{leccionActiva.titulo}</h3>
                    {leccionActiva.descripcion && <p>{leccionActiva.descripcion}</p>}
                    {leccionActiva.url && <a className="btn solido" href={leccionActiva.url} target="_blank" rel="noreferrer">{Ico.abrirWeb({ t: 15 })} Abrir material</a>}
                    {leccionActiva.archivo_ruta && <button className="btn" onClick={() => archivo(leccionActiva)}>{Ico.descargar({ t: 15 })} Descargar {leccionActiva.archivo_nombre}</button>}
                  </div>
                )}
                {url && <div className="cur-info"><h3>{leccionActiva.titulo}</h3>{leccionActiva.descripcion && <p>{leccionActiva.descripcion}</p>}{leccionActiva.archivo_ruta && <button className="btn chico" onClick={() => archivo(leccionActiva)}>{Ico.descargar({ t: 14 })} {leccionActiva.archivo_nombre}</button>}</div>}
                <button className={`btn${hechas.has(leccionActiva.id) ? "" : " solido"}`} onClick={() => marcar(leccionActiva)}>{hechas.has(leccionActiva.id) ? "✓ Hecha · deshacer" : "Marcar como hecha"}</button>
              </>
            ) : <p className="vacio">Este curso todavía no tiene lecciones.</p>}
          </section>
          <aside className="cur-lista" aria-label="Lecciones">
            <header><h3>Lecciones</h3>{editable && <button className="btn chico" onClick={() => setEditLeccion("nueva")}>＋ Lección</button>}</header>
            <ol>
              {lecs.map((l, i) => (
                <li key={l.id} className={`${leccionActiva?.id === l.id ? "on" : ""}${hechas.has(l.id) ? " hecha" : ""}`}>
                  <button onClick={() => setActiva(l.id)}>
                    <span className="cur-n">{hechas.has(l.id) ? "✓" : i + 1}</span>
                    <span className="cur-t"><b>{l.titulo}</b>{l.duracion_min ? <small>{l.duracion_min} min</small> : null}</span>
                  </button>
                  {editable && <span className="cur-mini"><button title="Editar" onClick={() => setEditLeccion(l)}>{Ico.editar({ t: 13 })}</button><button title="Borrar" onClick={() => borrarLeccion(l)}>×</button></span>}
                </li>
              ))}
            </ol>
          </aside>
        </div>
        {editLeccion && <FormLeccion curso={curso} leccion={editLeccion === "nueva" ? null : editLeccion} orden={lecs.length} onCerrar={() => setEditLeccion(null)} onListo={() => { setEditLeccion(null); void cargar(); }} />}
        {editCurso && <FormCurso curso={editCurso === "nuevo" ? null : editCurso} yo={yo} onCerrar={() => setEditCurso(null)} onListo={() => { setEditCurso(null); void cargar(); }} />}
      </div>
    );
  }

  /* ── Catálogo ── */
  return (
    <div>
      {editable && <div className="cur-barra"><button className="btn solido" onClick={() => setEditCurso("nuevo")}>{Ico.mas({ t: 15 })} Nuevo curso</button></div>}
      {error && <p className="aviso-error" role="alert">{error}</p>}
      {cursos.length === 0 ? (
        <div className="cl-vacio"><b>Aquí vivirán los cursos</b><span>{editable ? "Crea el primero: inducción del equipo, cómo usar el CRM, cómo cobrar…" : "Pronto habrá cursos para ti."}</span></div>
      ) : (
        <div className="cur-rejilla">
          {cursos.map((c, i) => (
            <button key={c.id} className="cur-tarjeta" onClick={() => setAbierto(c.id)}>
              <span className="cur-portada" style={{ background: GRADIENTES[i % GRADIENTES.length] }}>
                {c.categoria && <em>{c.categoria}</em>}
                {c.para_clientes && editable && <i title="Visible para clientes">Clientes</i>}
              </span>
              <span className="cur-texto"><b>{c.titulo}</b><small>{deCurso(c.id).length} lecciones</small></span>
              <span className="cur-barra-av"><i style={{ width: `${avance(c.id)}%` }} /></span>
            </button>
          ))}
        </div>
      )}
      {editCurso && <FormCurso curso={editCurso === "nuevo" ? null : editCurso} yo={yo} onCerrar={() => setEditCurso(null)} onListo={() => { setEditCurso(null); void cargar(); }} />}
    </div>
  );
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => { const t = (e: KeyboardEvent) => e.key === "Escape" && onCerrar(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onCerrar]);
  return (
    <div className="bg-fondo" style={{ alignItems: "center", paddingTop: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="bg-caja cur-modal" role="dialog" aria-modal="true" aria-label={titulo}><h3>{titulo}</h3>{children}</div>
    </div>
  );
}

function FormCurso({ curso, yo, onCerrar, onListo }: { curso: Curso | null; yo: string | null; onCerrar: () => void; onListo: () => void }) {
  const [f, setF] = useState({ titulo: curso?.titulo ?? "", descripcion: curso?.descripcion ?? "", categoria: curso?.categoria ?? "", para_clientes: curso?.para_clientes ?? false });
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un título."); return; }
    const datos = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, categoria: f.categoria.trim() || null, para_clientes: f.para_clientes };
    const r = curso ? await sb.from("cursos").update(datos).eq("id", curso.id) : await sb.from("cursos").insert({ ...datos, creado_por: yo });
    if (r.error) setError(r.error.message); else onListo();
  }
  return (
    <Modal titulo={curso ? "Editar curso" : "Nuevo curso"} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="cur-form">
        <label>Título<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoFocus /></label>
        <label>De qué trata<textarea rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        <label>Categoría<input value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} placeholder="Ej.: Equipo, Clientes, Ventas" /></label>
        <label className="ficha-check"><input type="checkbox" checked={f.para_clientes} onChange={(e) => setF({ ...f, para_clientes: e.target.checked })} /> Visible para los clientes en su portal</label>
        {error && <p className="aviso-error">{error}</p>}
        <div className="cur-form-pie"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button className="btn solido">Guardar</button></div>
      </form>
    </Modal>
  );
}

function FormLeccion({ curso, leccion, orden, onCerrar, onListo }: { curso: Curso; leccion: Leccion | null; orden: number; onCerrar: () => void; onListo: () => void }) {
  const [f, setF] = useState({ titulo: leccion?.titulo ?? "", descripcion: leccion?.descripcion ?? "", url: leccion?.url ?? "", duracion: leccion?.duracion_min?.toString() ?? "" });
  const [arch, setArch] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un título."); return; }
    setGuardando(true);
    const datos: Record<string, unknown> = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, url: f.url.trim() || null, duracion_min: f.duracion ? Number(f.duracion) : null };
    if (arch) {
      const ruta = `cursos/${crypto.randomUUID()}/${arch.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: es } = await sb.storage.from("boveda").upload(ruta, arch, { contentType: arch.type || undefined });
      if (es) { setGuardando(false); setError("No se pudo subir el archivo: " + es.message); return; }
      datos.archivo_ruta = ruta; datos.archivo_nombre = arch.name;
    }
    const r = leccion ? await sb.from("lecciones").update(datos).eq("id", leccion.id) : await sb.from("lecciones").insert({ ...datos, curso_id: curso.id, orden });
    setGuardando(false);
    if (r.error) setError(r.error.message); else onListo();
  }
  return (
    <Modal titulo={leccion ? "Editar lección" : "Nueva lección"} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="cur-form">
        <label>Título<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoFocus /></label>
        <label>Enlace (YouTube, Vimeo, Loom, Drive…)<input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></label>
        <label>O un archivo<input type="file" onChange={(e) => setArch(e.target.files?.[0] ?? null)} /></label>
        <label>Notas de la lección<textarea rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        <label>Duración (minutos)<input inputMode="numeric" value={f.duracion} onChange={(e) => setF({ ...f, duracion: e.target.value.replace(/\D/g, "") })} /></label>
        {error && <p className="aviso-error">{error}</p>}
        <div className="cur-form-pie"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button className="btn solido" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></div>
      </form>
    </Modal>
  );
}
