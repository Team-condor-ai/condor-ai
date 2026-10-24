import { useCallback, useEffect, useState } from "react";
import { sb } from "../../lib/supabase";

export type Curso = { id: string; titulo: string; descripcion: string | null; categoria: string | null; para_clientes: boolean; orden: number; portada_ruta: string | null; profesor: string | null; nivel: string | null; publicado: boolean };
export type Fase = { id: string; curso_id: string; titulo: string; descripcion: string | null; orden: number };
export type Leccion = {
  id: string; curso_id: string; fase_id: string | null; titulo: string; descripcion: string | null; url: string | null;
  archivo_ruta: string | null; archivo_nombre: string | null; duracion_min: number | null; duracion_seg: number | null;
  video_ruta: string | null; poster_ruta: string | null; orden: number;
};

/** Duración legible: 754 s → «12 min»; 4 300 s → «1 h 12 min». */
export function duracion(seg: number) {
  if (!seg) return "";
  const m = Math.round(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${Math.max(1, m)} min`;
}
export const segDe = (l: Leccion) => l.duracion_seg ?? (l.duracion_min ? l.duracion_min * 60 : 0);

/** YouTube, Vimeo y Loom se ven dentro del portal; otro enlace se abre aparte. */
export function embed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url), h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (h.endsWith("youtube.com")) { const v = u.searchParams.get("v"); return v ? `https://www.youtube.com/embed/${v}` : u.pathname.startsWith("/embed/") ? url : null; }
    if (h === "vimeo.com") return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean)[0]}`;
    if (h.endsWith("loom.com")) return url.replace("/share/", "/embed/");
  } catch { /* enlace inválido */ }
  return null;
}

/** Carga cursos, fases, lecciones y el avance propio, con miniaturas firmadas (el bucket `cursos` es privado). */
export function useCursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [fases, setFases] = useState<Fase[]>([]);
  const [lecciones, setLecciones] = useState<Leccion[]>([]);
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const [imagenes, setImagenes] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [c, f, l, p] = await Promise.all([
      sb.from("cursos").select("*").order("orden").order("creado_en"),
      sb.from("curso_fases").select("*").order("orden"),
      sb.from("lecciones").select("*").order("orden").order("creado_en"),
      sb.from("curso_progreso").select("leccion_id"),
    ]);
    const fallo = c.error ?? f.error ?? l.error;
    setError(fallo ? "No se pudieron cargar los cursos: " + fallo.message : "");
    const cs = (c.data ?? []) as Curso[], ls = (l.data ?? []) as Leccion[];
    setCursos(cs); setFases((f.data ?? []) as Fase[]); setLecciones(ls);
    setHechas(new Set((p.data ?? []).map((x: { leccion_id: string }) => x.leccion_id)));
    setCargando(false);
    const rutas = [...cs.map((x) => x.portada_ruta), ...ls.map((x) => x.poster_ruta)].filter((x): x is string => !!x);
    if (rutas.length) {
      const { data } = await sb.storage.from("cursos").createSignedUrls([...new Set(rutas)], 3600);
      setImagenes(Object.fromEntries((data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string])));
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function marcar(leccionId: string, email: string | null, hecha: boolean) {
    if (!email) return;
    setHechas((h) => { const n = new Set(h); if (hecha) n.add(leccionId); else n.delete(leccionId); return n; });
    const r = hecha
      ? await sb.from("curso_progreso").upsert({ email, leccion_id: leccionId }, { onConflict: "email,leccion_id" })
      : await sb.from("curso_progreso").delete().eq("leccion_id", leccionId).eq("email", email);
    if (r.error) void cargar();
  }

  return { cursos, fases, lecciones, hechas, imagenes, cargando, error, cargar, marcar };
}

/** Lecciones de un curso en el orden en que se ven: por fase y, dentro de cada fase, por su orden. */
export function ordenadas(cursoId: string, fases: Fase[], lecciones: Leccion[]) {
  const fs = fases.filter((f) => f.curso_id === cursoId).sort((a, b) => a.orden - b.orden);
  const ls = lecciones.filter((l) => l.curso_id === cursoId);
  const sinFase = ls.filter((l) => !l.fase_id || !fs.some((f) => f.id === l.fase_id)).sort((a, b) => a.orden - b.orden);
  return [...fs.flatMap((f) => ls.filter((l) => l.fase_id === f.id).sort((a, b) => a.orden - b.orden)), ...sinFase];
}

const RESUME = "curso:pos:";
export const guardarPosicion = (id: string, t: number) => { try { localStorage.setItem(RESUME + id, String(Math.floor(t))); } catch { /* */ } };
export const leerPosicion = (id: string) => { try { return Number(localStorage.getItem(RESUME + id) || 0); } catch { return 0; } };
