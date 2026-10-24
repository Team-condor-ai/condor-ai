import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "../../lib/supabase";
import { type Persona, useEquipo } from "../personas";

/**
 * Compañeros en los cursos (24-oct-2026, pedido de Max): ver hasta dónde llegó cada persona del equipo
 * y encontrarse con quien está viendo la misma lección.
 *
 * - Lo guardado: `curso_progreso` (lecciones vistas) y `curso_avance` (en qué segundo va cada uno de
 *   cada lección). El equipo puede leer las de todos; un cliente, solo las suyas.
 * - Lo en vivo: presencia de Realtime en el canal privado `cursos-equipo` (solo el equipo entra, por RLS en
 *   `realtime.messages`). Cada uno anuncia en qué curso, lección y segundo va; al cerrar la pestaña desaparece solo.
 *
 * Para los clientes (`activo = false`) no se conecta nada: solo se guarda su propio avance.
 */
export type Avance = { leccion_id: string; segundo: number; total: number; actualizado_en: string };
export type EnVivo = { email: string; curso: string; leccion: string | null; t: number; desde: number };
export type Companero = Persona & {
  hechas: Set<string>;
  avance: Map<string, Avance>;
  /** La última lección que tocó (vista o empezada): ahí «está» en el curso. */
  ultima: Map<string, { leccion: string; cuando: number }>;
  vivo: EnVivo | null;
};

const CANAL = "cursos-equipo";

export function useCompaneros(activo: boolean, yo: string | null, cursoDe: (leccion: string) => string | undefined) {
  const equipo = useEquipo();
  const [progreso, setProgreso] = useState<{ email: string; leccion_id: string; hecha_en: string }[]>([]);
  const [avances, setAvances] = useState<(Avance & { email: string })[]>([]);
  const [vivos, setVivos] = useState<EnVivo[]>([]);
  const canal = useRef<RealtimeChannel | null>(null);
  const listo = useRef(false);
  const ultimoAnuncio = useRef<EnVivo | null>(null);

  const recargar = useCallback(async () => {
    const [p, a] = await Promise.all([
      sb.from("curso_progreso").select("email, leccion_id, hecha_en"),
      sb.from("curso_avance").select("email, leccion_id, segundo, total, actualizado_en"),
    ]);
    setProgreso(p.data ?? []);
    setAvances(a.data ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar();
    if (!activo || !yo) return;
    let vivo = true;
    (async () => {
      await sb.realtime.setAuth();
      if (!vivo) return;
      const ch = sb.channel(CANAL, { config: { private: true, presence: { key: yo } } });
      ch.on("presence", { event: "sync" }, () => {
        const estado = ch.presenceState<EnVivo>();
        setVivos(Object.values(estado).map((xs) => xs[xs.length - 1] as EnVivo | undefined).filter((x): x is EnVivo => !!x?.email));
      });
      ch.subscribe((s) => {
        if (s !== "SUBSCRIBED") return;
        listo.current = true;
        if (ultimoAnuncio.current) void ch.track(ultimoAnuncio.current);
      });
      canal.current = ch;
    })();
    // El avance guardado de los demás se refresca cada minuto (lo en vivo llega solo por presencia).
    const iv = window.setInterval(() => void recargar(), 60_000);
    return () => {
      vivo = false; listo.current = false; window.clearInterval(iv);
      if (canal.current) void sb.removeChannel(canal.current);
      canal.current = null;
    };
  }, [activo, yo, recargar]);

  /** Cuenta dónde estoy. Se llama al abrir una lección y cada pocos segundos mientras se ve. */
  const anunciar = useCallback((curso: string | null, leccion: string | null, t = 0) => {
    if (!activo || !yo) return;
    const previo = ultimoAnuncio.current;
    const mismo = previo && previo.curso === curso && previo.leccion === leccion;
    const d: EnVivo = { email: yo, curso: curso ?? "", leccion, t: Math.floor(t), desde: mismo ? previo.desde : Date.now() };
    ultimoAnuncio.current = d;
    if (listo.current && canal.current) void canal.current.track(d);
  }, [activo, yo]);

  /** Guarda en qué segundo voy (para retomar en otro equipo y para que los demás lo vean). */
  const guardarAvance = useCallback(async (leccion: string, segundo: number, total: number) => {
    if (!yo) return;
    const fila = { email: yo, leccion_id: leccion, segundo: Math.floor(segundo), total: Math.floor(total), actualizado_en: new Date().toISOString() };
    setAvances((xs) => [...xs.filter((x) => !(x.email === yo && x.leccion_id === leccion)), fila]);
    await sb.from("curso_avance").upsert(fila, { onConflict: "email,leccion_id" });
  }, [yo]);

  const companeros = useMemo<Companero[]>(() => {
    if (!activo) return [];
    return equipo.filter((p) => p.email !== yo?.toLowerCase()).map((p) => {
      const hechas = new Set(progreso.filter((x) => x.email.toLowerCase() === p.email).map((x) => x.leccion_id));
      const avance = new Map(avances.filter((x) => x.email.toLowerCase() === p.email).map((x) => [x.leccion_id, x]));
      const ultima = new Map<string, { leccion: string; cuando: number }>();
      const tocar = (leccion: string, cuando: number) => {
        const curso = cursoDe(leccion); if (!curso) return;
        const u = ultima.get(curso); if (!u || cuando > u.cuando) ultima.set(curso, { leccion, cuando });
      };
      progreso.filter((x) => x.email.toLowerCase() === p.email).forEach((x) => tocar(x.leccion_id, Date.parse(x.hecha_en)));
      avance.forEach((x) => tocar(x.leccion_id, Date.parse(x.actualizado_en)));
      const vivo = vivos.find((v) => v.email.toLowerCase() === p.email) ?? null;
      return { ...p, hechas, avance, ultima, vivo };
    });
  }, [activo, equipo, yo, progreso, avances, vivos, cursoDe]);

  /** Mi propio segundo guardado en una lección (para retomar aunque cambie de computador). */
  const miSegundo = useCallback((leccion: string) => avances.find((x) => x.email === yo && x.leccion_id === leccion)?.segundo ?? 0, [avances, yo]);

  return { companeros, anunciar, guardarAvance, miSegundo };
}
