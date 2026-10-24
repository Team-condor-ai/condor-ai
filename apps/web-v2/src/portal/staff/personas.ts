import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

/** Quién es quién en el equipo: nombre corto (apodo) y foto. La usan el ranking y los cursos. */
export type Persona = { email: string; nombre: string; foto?: string };

const FOTOS: Record<string, string> = {
  "maximilianopinocv@gmail.com": "/assets/avatares/maximiliano-mini.jpg",
  "alejandrotobarq@gmail.com": "/assets/avatares/alejandro-mini.jpg",
};

export const iniciales = (t: string) => {
  const p = t.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
};

/** Colores fijos por persona para las iniciales (siempre el mismo para el mismo correo). */
const TONOS = ["#014CFD", "#7A3CFF", "#0A8FE0", "#147A42", "#E5602B", "#D6336C"];
export const tono = (email: string) => TONOS[[...email].reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS.length];

let cache: Persona[] | null = null;

export function useEquipo() {
  const [personas, setPersonas] = useState<Persona[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    void sb.from("admins").select("email, nombre, apodo").then(({ data }) => {
      cache = (data ?? []).map((a: { email: string; nombre: string | null; apodo: string | null }) => {
        const email = a.email.toLowerCase();
        return { email, nombre: a.apodo || a.nombre || email.split("@")[0], foto: FOTOS[email] };
      });
      setPersonas(cache);
    });
  }, []);
  return personas;
}

/** Mi nombre corto en el equipo (el que usan `leads.responsable` y `tareas.asignados`). */
export function useMiApodo(email: string | null): string | null {
  const equipo = useEquipo();
  return equipo.find((p) => p.email === email?.toLowerCase())?.nombre ?? null;
}

/** Fecha de hoy en hora local (Chile) como AAAA-MM-DD. */
export function hoyLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
