import { useEffect, useState } from "react";
import { sb, FUNCIONES } from "../lib/supabase";

export type Rol = "staff" | "cliente" | "ninguno";

export type Sesion = {
  cargando: boolean;
  email: string | null;
  rol: Rol;
  tieneClave: boolean;
};

/**
 * Quién está usando el portal.
 *
 * EL ROL SE PREGUNTA A LA BASE, NO SE DEDUCE EN EL NAVEGADOR
 * ---------------------------------------------------------------------------
 * `es_admin()` corre en Postgres con `security definer`, así que un usuario no
 * puede mentir sobre su rol tocando el JavaScript. Ocultar el menú de staff en
 * el front es comodidad visual; lo que de verdad impide que un cliente lea la
 * cartera completa son las políticas RLS (`admin_all_clientes` vs
 * `cliente_ve_lo_suyo`).
 *
 * Dicho de otra forma: si algún día este hook se equivoca y devuelve "staff"
 * para un cliente, la base sigue sin entregarle datos ajenos.
 */
export function useSesion(): Sesion {
  const [s, setS] = useState<Sesion>({
    cargando: true,
    email: null,
    rol: "ninguno",
    tieneClave: false,
  });

  useEffect(() => {
    let vivo = true;

    async function resolver() {
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) {
        if (vivo)
          setS({ cargando: false, email: null, rol: "ninguno", tieneClave: false });
        return;
      }
      const { data: admin } = await sb.rpc("es_admin");
      if (!vivo) return;
      setS({
        cargando: false,
        email: user.email ?? null,
        rol: admin ? "staff" : "cliente",
        tieneClave: Boolean(user.user_metadata?.password_set),
      });
    }

    resolver();
    const { data: sub } = sb.auth.onAuthStateChange(() => resolver());
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return s;
}

/**
 * Pide el código de acceso.
 *
 * Va contra la Edge Function `solicitar-acceso` y NO contra `signInWithOtp`
 * directo. Esa función existe porque el login directo dejaba entrar a
 * cualquier correo (el caso Max): ahora solo reciben código los correos que
 * están en `admins` o en `clientes` activos. Además trae rate limit y
 * responde genérico para no revelar quién es cliente.
 */
export async function pedirCodigo(email: string) {
  const r = await fetch(`${FUNCIONES}/solicitar-acceso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || "No se pudo enviar el código.");
  }
  return true;
}

export async function entrarConCodigo(email: string, codigo: string) {
  const { error } = await sb.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.trim(),
    type: "email",
  });
  if (error) throw error;
}

export async function entrarConClave(email: string, clave: string) {
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: clave,
  });
  if (error) throw error;
}

export async function fijarClave(clave: string) {
  const { error } = await sb.auth.updateUser({
    password: clave,
    data: { password_set: true },
  });
  if (error) throw error;
}

export async function salir() {
  await sb.auth.signOut();
}
