import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "./sesion";

/**
 * El nombre REAL de quien está usando el portal, para saludarlo por su nombre.
 *
 * POR QUÉ NO ALCANZA CON EL CORREO
 * ---------------------------------------------------------------------------
 * `Portal.tsx` arma el nombre visible con `correo.split("@")[0]`. Para el menú
 * lateral alcanza, pero para un saludo no: los correos reales de la base dan
 * "j.ignaciomunozsilva", "maximilianopinocv", "alejandrotobarq". Saludar con
 * eso es peor que no usar el nombre.
 *
 * Los nombres de verdad ya están guardados, solo que en otra tabla:
 *   · staff   → `admins.nombre`    ("Joaquín", "Alejandro", "Maximiliano")
 *   · cliente → `clientes.nombre`  (la persona de contacto, distinta de
 *                                   `negocio`, que es la marca)
 *
 * Las dos tienen RLS que deja leer SOLO la fila propia
 * (`email = auth.jwt()->>'email'`), así que esta consulta no expone nada que
 * el usuario no pueda ver ya. No hay tabla de perfiles unificada, y crear una
 * para esto sería una migración y un lugar más que mantener sincronizado.
 *
 * Devuelve `null` mientras carga y si no encuentra nada — `saludo.ts` sabe
 * armar un saludo natural sin nombre, así que nunca hay un hueco raro ni un
 * "Hola undefined".
 */
export function useNombreUsuario(): string | null {
  const sesion = useSesion();
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    if (sesion.cargando || !sesion.email) return;
    let vivo = true;

    (async () => {
      const tabla = sesion.rol === "staff" ? "admins" : "clientes";
      const { data } = await sb
        .from(tabla)
        .select("nombre")
        .eq("email", sesion.email)
        .maybeSingle();
      // `vivo` evita el warning de actualizar un componente desmontado si el
      // usuario sale de Bárbara antes de que llegue la respuesta.
      if (vivo) setNombre((data as { nombre: string | null } | null)?.nombre || null);
    })();

    return () => {
      vivo = false;
    };
  }, [sesion.cargando, sesion.email, sesion.rol]);

  return nombre;
}
