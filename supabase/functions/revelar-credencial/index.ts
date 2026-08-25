// Revela el valor real de una credencial de API para copiar desde el
// portal (Sistema > Créditos API > Revelar). Solo el equipo puede.
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

  let proveedor = "";
  try {
    proveedor = String((await req.json())?.proveedor || "").trim();
  } catch { /* validación abajo */ }
  if (!proveedor) return json({ error: "falta el proveedor" }, 400);

  const { data: fila, error } = await sb
    .from("api_credenciales")
    .select("valor, nota, actualizado_en")
    .eq("proveedor", proveedor)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!fila) return json({ error: `no hay una credencial guardada para "${proveedor}"` }, 404);

  return json({ valor: fila.valor, nota: fila.nota, actualizado_en: fila.actualizado_en });
});
