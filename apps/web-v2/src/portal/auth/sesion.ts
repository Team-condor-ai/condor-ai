import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { sb, FUNCIONES } from "../lib/supabase";

export type Rol = "staff" | "cliente" | "ninguno";

export type Sesion = {
  cargando: boolean;
  email: string | null;
  rol: Rol;
  tieneClave: boolean;
  /** Entró con la clave inicial: el portal le pide elegir la suya antes de seguir. */
  debeCambiarClave: boolean;
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
function useSesionReal(): Sesion {
  const [s, setS] = useState<Sesion>({
    cargando: true,
    email: null,
    rol: "ninguno",
    tieneClave: false,
    debeCambiarClave: false,
  });

  useEffect(() => {
    let vivo = true;

    async function resolver() {
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) {
        if (vivo)
          setS({ cargando: false, email: null, rol: "ninguno", tieneClave: false, debeCambiarClave: false });
        return;
      }
      const { data: admin } = await sb.rpc("es_admin");
      if (!vivo) return;
      setS({
        cargando: false,
        email: user.email ?? null,
        rol: admin ? "staff" : "cliente",
        tieneClave: Boolean(user.user_metadata?.password_set),
        // También quien entró con código y nunca eligió contraseña: sin esto seguía dependiendo del correo
        // (que hoy no sale) y quedaba afuera la vez siguiente (Kalfu y Alejandro, 24-oct-2026).
        debeCambiarClave: Boolean(user.user_metadata?.cambiar_clave) || !user.user_metadata?.password_set,
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

const ContextoSesion = createContext<Sesion | null>(null);

/**
 * La sesión se resuelve UNA vez para todo el portal (24-oct-2026). Antes cada pantalla llamaba a `useSesion`
 * por su cuenta y cada una repetía `getUser` + `es_admin` + su propia suscripción a cambios de sesión.
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  return createElement(ContextoSesion.Provider, { value: useSesionReal() }, children);
}

export function useSesion(): Sesion {
  const s = useContext(ContextoSesion);
  if (!s) throw new Error("useSesion debe usarse dentro de SesionProvider");
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
  if (error) throw new Error(traducir(error.message));
}

export async function entrarConClave(email: string, clave: string) {
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: clave,
  });
  if (error) throw new Error(traducir(error.message));
}

export async function fijarClave(clave: string) {
  const { error } = await sb.auth.updateUser({
    password: clave,
    data: { password_set: true, cambiar_clave: false },
  });
  if (error) throw new Error(traducir(error.message));
}

/** Supabase responde en inglés; acá se dice qué pasó y qué hacer. */
export function traducir(m: string): string {
  if (/invalid login credentials/i.test(m))
    return "El correo o la contraseña no coinciden. Si es tu primera vez, entra con la clave inicial que te dio el equipo.";
  if (/expired|invalid.*(otp|token)/i.test(m)) return "El código no es válido o ya venció. Pide uno nuevo.";
  if (/email not confirmed/i.test(m)) return "Tu correo todavía no está confirmado. Pídele al equipo que te restablezca el acceso.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  if (/should be different/i.test(m)) return "La nueva contraseña tiene que ser distinta de la actual.";
  if (/weak|pwned|leaked|at least/i.test(m)) return "Esa contraseña es muy débil o apareció en filtraciones. Elige otra más larga.";
  if (/failed to fetch|network/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet y vuelve a probar.";
  return m;
}

export async function salir() {
  await sb.auth.signOut();
}
