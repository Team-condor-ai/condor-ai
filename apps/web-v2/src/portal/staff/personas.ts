import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

/**
 * Quién es quién en el equipo (24-oct-2026):
 *  · `nombre`   = nombre de pila («Joaquín»). Es la llave con que se asignan tareas y leads, y lo que se ve
 *                 en lugares chicos (caritas de los cursos, chips).
 *  · `completo` = nombre y apellido («Joaquín Bustamante»): lo que ven los clientes en el chat.
 *  · `apodo`    = el usuario informal («orkut»), que cada uno cambia en «Mi cuenta».
 */
export type Persona = { email: string; nombre: string; completo: string; apodo: string | null; foto?: string };

const FOTOS: Record<string, string> = {
  "maximilianopinocv@gmail.com": "/assets/avatares/maximiliano-mini.jpg",
  "alejandrotobarq@gmail.com": "/assets/avatares/alejandro-mini.jpg",
  "ahu3rta8888@gmail.com": "/assets/avatares/alberto-mini.jpg",
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
  const [version, setVersion] = useState(0);
  // Cuando alguien cambia su apodo, todas las pantallas abiertas vuelven a leer el equipo.
  useEffect(() => {
    const otraVez = () => setVersion((v) => v + 1);
    window.addEventListener("equipo:cambio", otraVez);
    return () => window.removeEventListener("equipo:cambio", otraVez);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cache) { setPersonas(cache); return; }
    void sb.from("admins").select("email, nombre, apodo").then(({ data }) => {
      cache = (data ?? []).map((a: { email: string; nombre: string | null; apodo: string | null }) => {
        const email = a.email.toLowerCase();
        const completo = a.nombre?.trim() || email.split("@")[0];
        return { email, nombre: completo.split(/\s+/)[0], completo, apodo: a.apodo, foto: FOTOS[email] };
      });
      setPersonas(cache);
    });
  }, [version]);
  return personas;
}

/** Mi nombre de pila en el equipo (el que usan `leads.responsable` y `tareas.asignados`). */
export function useMiNombre(email: string | null): string | null {
  return useYo(email)?.nombre ?? null;
}

/** Mi ficha en el equipo (nombre, nombre completo, apodo y foto). */
export function useYo(email: string | null): Persona | null {
  const equipo = useEquipo();
  return equipo.find((p) => p.email === email?.toLowerCase()) ?? null;
}

/** Tras cambiar un apodo: la próxima lectura vuelve a la base. */
export function olvidarEquipo() { cache = null; window.dispatchEvent(new Event("equipo:cambio")); }

/** Fecha de hoy en hora local (Chile) como AAAA-MM-DD. */
export function hoyLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
