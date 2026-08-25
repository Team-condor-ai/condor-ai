// El portal no revela secretos. Las claves viven únicamente en secretos de
// GitHub/Supabase y esta función conserva el endpoint sólo para responder de
// forma explícita si una versión antigua del frontend intenta usarlo.
//
// POR QUÉ ESTO ES SU PROPIA FUNCIÓN Y NO UN SELECT DIRECTO
// ---------------------------------------------------------------------------
// `api_credenciales` no tiene ninguna policy de SELECT para `authenticated`
// a propósito (ver la migración) — la única puerta es esta función, que
// verifica `es_admin()` cada vez y no cachea nada. Un select directo desde
// el cliente habría significado que la key completa viaja en la respuesta
// de CUALQUIER carga de la pantalla de créditos, la vea alguien o no.
//
// LAS DOS COPIAS QUE ESTO NO RESUELVE
// ---------------------------------------------------------------------------
// El valor que se guarda acá es una COPIA de lectura para el portal. La key
// que de verdad usan los workflows de GitHub Actions vive en sus secrets
// (write-only: GitHub no la devuelve). Si se rota una, hay que actualizar
// las dos a mano — no hay sincronización automática.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const sbUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await sbUsuario.auth.getUser();
  if (!user?.email) return json({ error: "no autenticado" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: admin } = await sb.from("admins").select("email").eq("email", user.email).maybeSingle();
  if (!admin) return json({ error: "solo el equipo puede revelar credenciales" }, 403);

  return json({
    error: "Las credenciales no se revelan desde el portal. Gestiona la clave en los secretos del proveedor o de GitHub.",
  }, 410);
});
