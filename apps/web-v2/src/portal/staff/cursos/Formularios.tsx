import { useState } from "react";
import { sb } from "../../lib/supabase";
import { Modal } from "../../disenio/Dialogos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import type { Curso, Fase, Leccion } from "./datos";

/** Un curso para clientes se puede dejar solo para una línea (p. ej. «Cómo usar tu CRM» solo para clientes CRM). */
const LINEAS = [{ id: "sites", texto: "Sites" }, { id: "ecommerce", texto: "Ecommerce" }, { id: "crm", texto: "CRM" }];

/** «Nombre | enlace» por línea → recursos; el tipo se adivina por el enlace (copia de Google, carpeta de Drive…). */
function leerRecursos(t: string) {
  return t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.lastIndexOf("|"); const titulo = (i >= 0 ? l.slice(0, i) : l).trim(); const url = (i >= 0 ? l.slice(i + 1) : l).trim();
    const tipo = /docs\.google\.com\/.*\/copy/.test(url) ? "plantilla" : /drive\.google\.com\/drive\/folders/.test(url) ? "carpeta" : /drive\.google\.com\/file/.test(url) ? "archivo" : /canva\.com|notion\.site|docs\.google\.com/.test(url) ? "documento" : "enlace";
    return { titulo: titulo || url, url, tipo };
  }).filter((r) => /^https?:\/\//.test(r.url));
}

const limpio = (n: string) => n.replace(/[^\w.-]+/g, "_");
async function subir(ruta: string, f: File) {
  const { error } = await sb.storage.from("cursos").upload(ruta, f, { upsert: true, contentType: f.type || undefined });
  if (error) throw new Error(/exceeded|too large/i.test(error.message) ? "El archivo pesa más de 50 MB." : error.message);
}

export function FormCurso({ curso, yo, onCerrar, onListo }: { curso: Curso | null; yo: string | null; onCerrar: () => void; onListo: (id?: string) => void }) {
  const [f, setF] = useState({ titulo: curso?.titulo ?? "", descripcion: curso?.descripcion ?? "", categoria: curso?.categoria ?? "", nivel: curso?.nivel ?? "", profesor: curso?.profesor ?? "", para_clientes: curso?.para_clientes ?? false, publicado: curso?.publicado ?? true, lineas: curso?.lineas ?? [] as string[] });
  const [portada, setPortada] = useState<File | null>(null);
  const [error, setError] = useState(""); const [guardando, setGuardando] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un título."); return; }
    setGuardando(true); setError("");
    try {
      const datos = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, categoria: f.categoria.trim() || null, nivel: f.nivel.trim() || null, profesor: f.profesor.trim() || null, para_clientes: f.para_clientes, publicado: f.publicado, lineas: f.para_clientes ? f.lineas : [] };
      let id = curso?.id;
      if (curso) { const r = await sb.from("cursos").update(datos).eq("id", curso.id); if (r.error) throw new Error(r.error.message); }
      else { const r = await sb.from("cursos").insert({ ...datos, creado_por: yo }).select("id").single(); if (r.error) throw new Error(r.error.message); id = r.data.id; }
      if (portada && id) { const ruta = `${id}/portada-${Date.now()}-${limpio(portada.name)}`; await subir(ruta, portada); await sb.from("cursos").update({ portada_ruta: ruta }).eq("id", id); }
      onListo(curso ? undefined : id);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    setGuardando(false);
  }
  return (
    <Modal tamano="md" titulo={curso ? "Editar curso" : "Nuevo curso"} onCerrar={onCerrar}
      pie={<><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button form="f-curso" className="btn solido" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
      <form id="f-curso" onSubmit={guardar} className="dlg-rejilla">
        <label className="ancho">Título<input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus /></label>
        <label className="ancho">De qué trata<textarea rows={3} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Qué va a saber hacer quien lo termine." /></label>
        <label>Categoría<input value={f.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ej.: Marketing, Equipo" /></label>
        <label>Nivel<input value={f.nivel} onChange={(e) => set("nivel", e.target.value)} placeholder="Ej.: Inicial" /></label>
        <label>Quién lo enseña<input value={f.profesor} onChange={(e) => set("profesor", e.target.value)} /></label>
        <label>Portada (imagen)<input type="file" accept="image/*" onChange={(e) => setPortada(e.target.files?.[0] ?? null)} /></label>
        <label className="check ancho"><input type="checkbox" checked={f.publicado} onChange={(e) => set("publicado", e.target.checked)} /> Publicado (si no, solo lo ve el equipo como borrador)</label>
        <label className="check ancho"><input type="checkbox" checked={f.para_clientes} onChange={(e) => set("para_clientes", e.target.checked)} /> Visible también para los clientes en su portal</label>
        {f.para_clientes && (
          <fieldset className="ancho dlg-lineas">
            <legend>¿Para qué clientes? <small>Sin marcar ninguno = todos los clientes</small></legend>
            {LINEAS.map((l) => (
              <label key={l.id} className="check"><input type="checkbox" checked={f.lineas.includes(l.id)} onChange={(e) => set("lineas", e.target.checked ? [...f.lineas, l.id] : f.lineas.filter((x) => x !== l.id))} /> Clientes {l.texto}</label>
            ))}
          </fieldset>
        )}
        {error && <p className="aviso-error ancho">{error}</p>}
      </form>
    </Modal>
  );
}

export function FormFase({ curso, fase, orden, onCerrar, onListo }: { curso: Curso; fase: Fase | null; orden: number; onCerrar: () => void; onListo: () => void }) {
  const confirmar = useConfirmacion();
  const [f, setF] = useState({ titulo: fase?.titulo ?? "", descripcion: fase?.descripcion ?? "", orden: String(fase?.orden ?? orden) });
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un título."); return; }
    const datos = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, orden: Number(f.orden) || 0 };
    const r = fase ? await sb.from("curso_fases").update(datos).eq("id", fase.id) : await sb.from("curso_fases").insert({ ...datos, curso_id: curso.id });
    if (r.error) setError(r.error.message); else onListo();
  }
  async function borrar() {
    if (!fase || !(await confirmar(`Borrar la fase «${fase.titulo}»`, "Sus lecciones no se borran: quedan en «Otras lecciones».", "Borrar fase"))) return;
    const { error: e } = await sb.from("curso_fases").delete().eq("id", fase.id);
    if (e) setError(e.message); else onListo();
  }
  return (
    <Modal tamano="md" titulo={fase ? "Editar fase" : "Nueva fase"} subtitulo={curso.titulo} onCerrar={onCerrar}
      pie={<>{fase && <button type="button" className="btn izq" onClick={borrar}>Borrar</button>}<button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button form="f-fase" className="btn solido">Guardar</button></>}>
      <form id="f-fase" onSubmit={guardar} className="dlg-rejilla">
        <label className="ancho">Título<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej.: Fase 1 · Fundamentos" autoFocus /></label>
        <label className="ancho">Qué se aprende en esta fase<textarea rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        <label>Orden<input inputMode="numeric" value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value.replace(/\D/g, "") })} /></label>
        {error && <p className="aviso-error ancho">{error}</p>}
      </form>
    </Modal>
  );
}

export function FormLeccion({ curso, leccion, faseId, fases, orden, onCerrar, onListo }: { curso: Curso; leccion: Leccion | null; faseId: string | null; fases: Fase[]; orden: number; onCerrar: () => void; onListo: () => void }) {
  const confirmar = useConfirmacion();
  const [f, setF] = useState({ titulo: leccion?.titulo ?? "", descripcion: leccion?.descripcion ?? "", url: leccion?.url ?? "", fase_id: leccion?.fase_id ?? faseId ?? "", duracion: leccion?.duracion_seg ? String(Math.round(leccion.duracion_seg / 60)) : leccion?.duracion_min ? String(leccion.duracion_min) : "", orden: String(leccion?.orden ?? orden), recursos: (leccion?.recursos ?? []).map((r) => `${r.titulo} | ${r.url}`).join("\n") });
  const [video, setVideo] = useState<File | null>(null);
  const [material, setMaterial] = useState<File | null>(null);
  const [error, setError] = useState(""); const [guardando, setGuardando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un título."); return; }
    setGuardando(true); setError("");
    try {
      const datos: Record<string, unknown> = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, url: f.url.trim() || null, fase_id: f.fase_id || null, orden: Number(f.orden) || 0, recursos: leerRecursos(f.recursos) };
      if (f.duracion && !leccion?.duracion_seg) datos.duracion_min = Number(f.duracion);
      if (video) { const ruta = `${curso.id}/videos/${Date.now()}-${limpio(video.name)}`; await subir(ruta, video); datos.video_ruta = ruta; }
      if (material) { const ruta = `${curso.id}/material/${Date.now()}-${limpio(material.name)}`; await subir(ruta, material); datos.archivo_ruta = ruta; datos.archivo_nombre = material.name; }
      const r = leccion ? await sb.from("lecciones").update(datos).eq("id", leccion.id) : await sb.from("lecciones").insert({ ...datos, curso_id: curso.id });
      if (r.error) throw new Error(r.error.message);
      onListo();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    setGuardando(false);
  }
  async function borrar() {
    if (!leccion || !(await confirmar(`Borrar la lección «${leccion.titulo}»`, undefined, "Borrar lección"))) return;
    const { error: e } = await sb.from("lecciones").delete().eq("id", leccion.id);
    if (e) setError(e.message); else onListo();
  }
  return (
    <Modal tamano="lg" titulo={leccion ? "Editar lección" : "Nueva lección"} subtitulo={curso.titulo} onCerrar={onCerrar}
      pie={<>{leccion && <button type="button" className="btn izq" onClick={borrar}>Borrar</button>}<button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button form="f-leccion" className="btn solido" disabled={guardando}>{guardando ? "Subiendo…" : "Guardar"}</button></>}>
      <form id="f-leccion" onSubmit={guardar} className="dlg-rejilla">
        <label className="ancho">Título<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoFocus /></label>
        <label>Fase<select value={f.fase_id} onChange={(e) => setF({ ...f, fase_id: e.target.value })}><option value="">Sin fase</option>{fases.map((x) => <option key={x.id} value={x.id}>{x.titulo}</option>)}</select></label>
        <label>Orden<input inputMode="numeric" value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value.replace(/\D/g, "") })} /></label>
        <label className="ancho">Qué se ve en esta lección<textarea rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        <label className="ancho">Recursos <small style={{ fontWeight: 400, color: "var(--texto-3)" }}>· uno por línea: Nombre | enlace</small><textarea rows={3} value={f.recursos} onChange={(e) => setF({ ...f, recursos: e.target.value })} placeholder="Calculadora ecommerce | https://docs.google.com/…" /></label>
        <label className="ancho">Video desde un enlace (YouTube, Vimeo, Loom)<input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></label>
        <label>O un video corto (mp4, hasta 50 MB)<input type="file" accept="video/mp4" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} /></label>
        <label>Material descargable<input type="file" onChange={(e) => setMaterial(e.target.files?.[0] ?? null)} /></label>
        {!leccion?.duracion_seg && <label>Duración (minutos)<input inputMode="numeric" value={f.duracion} onChange={(e) => setF({ ...f, duracion: e.target.value.replace(/\D/g, "") })} /></label>}
        {leccion?.video_ruta?.endsWith(".m3u8") && <p className="dlg-texto ancho">Esta lección tiene un video largo optimizado (HLS). Para reemplazarlo hay que volver a procesarlo.</p>}
        {error && <p className="aviso-error ancho">{error}</p>}
      </form>
    </Modal>
  );
}
