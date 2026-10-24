// condor.ai · Edge Function "crear-acceso" (24-oct-2026)
// Le da acceso al portal a una persona NUEVA con una clave inicial común, o se la restablece.
// La persona entra con su correo + la clave inicial y el portal le pide elegir la suya al tiro
// (marca `cambiar_clave` en su perfil). No depende del correo: sirve aunque Resend no esté verificado.
//
// Solo lo puede llamar el equipo (el correo del JWT tiene que estar en `admins`).
// Body: { email, rol: "equipo" | "cliente", nombre?, accion?: "crear" | "restablecer" | "ver_clave" | "quitar" }
// «quitar» borra el usuario de acceso de un cliente ya eliminado (nunca el de alguien del equipo).
// Secreto opcional: CLAVE_INICIAL (si no existe se usa la de abajo).
// Deploy: supabase functions deploy crear-acceso   (verify_jwt = true)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const CLAVE_INICIAL = Deno.env.get("CLAVE_INICIAL") || "Condor-Inicio-2026";

// deno-lint-ignore no-explicit-any
async function buscarUsuario(sb: any, email: string): Promise<{ id: string; user_metadata?: Record<string, unknown> } | null> {
  for (let pag = 1; pag <= 10; pag++) {
    const { data } = await sb.auth.admin.listUsers({ page: pag, perPage: 200 });
    // deno-lint-ignore no-explicit-any
    const u = (data?.users ?? []).find((x: any) => (x.email || "").toLowerCase() === email);
    if (u) return u;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const yo = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await yo.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: admin } = await sb.from("admins").select("email").ilike("email", user.email).maybeSingle();
  if (!admin) return json({ error: "solo el equipo puede dar accesos" }, 403);

  let b: { email?: string; rol?: string; nombre?: string; accion?: string } = {};
  try { b = await req.json(); } catch { /* */ }
  if (b.accion === "ver_clave") return json({ ok: true, clave: CLAVE_INICIAL });

  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "correo inválido" }, 400);

  if (b.accion === "quitar") {
    const { data: esEquipo } = await sb.from("admins").select("email").ilike("email", email).maybeSingle();
    if (esEquipo) return json({ error: "Ese correo es del equipo; se quita desde Personas." }, 400);
    const { data: sigue } = await sb.from("clientes").select("id").ilike("email", email).limit(1).maybeSingle();
    if (sigue) return json({ error: "Todavía hay un cliente con ese correo." }, 400);
    const u = await buscarUsuario(sb, email);
    if (u) await sb.auth.admin.deleteUser(u.id);
    console.log(`[crear-acceso] ${user.email} quitó el acceso de ${email}`);
    return json({ ok: true, quitado: Boolean(u) });
  }
  const rol = b.rol === "cliente" ? "cliente" : "equipo";

  if (rol === "equipo") {
    const { data: ya } = await sb.from("admins").select("email").ilike("email", email).maybeSingle();
    if (!ya) {
      const { error } = await sb.from("admins").insert({ email, nombre: String(b.nombre || "").trim() || null });
      if (error) return json({ error: "no se pudo agregar al equipo: " + error.message }, 500);
    }
  } else {
    const { data: c } = await sb.from("clientes").select("id").ilike("email", email).eq("archivado", false).limit(1).maybeSingle();
    if (!c) return json({ error: "Ese correo no es de un cliente activo. Ponlo primero en la ficha del cliente." }, 404);
  }

  // ¿ya existe el usuario de acceso?
  const existente = await buscarUsuario(sb, email);
  const meta = { ...(existente?.user_metadata ?? {}), password_set: true, cambiar_clave: true };
  if (existente) {
    const { error } = await sb.auth.admin.updateUserById(existente.id, { password: CLAVE_INICIAL, email_confirm: true, user_metadata: meta });
    if (error) return json({ error: error.message }, 500);
  } else {
    const { error } = await sb.auth.admin.createUser({ email, password: CLAVE_INICIAL, email_confirm: true, user_metadata: meta });
    if (error) return json({ error: error.message }, 500);
  }
  console.log(`[crear-acceso] ${user.email} ${existente ? "restableció" : "creó"} el acceso de ${email} (${rol})`);
  return json({ ok: true, clave: CLAVE_INICIAL, nuevo: !existente });
});
