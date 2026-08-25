// Revela una credencial guardada, SÓLO al equipo de Cóndor.
//
// (Claude, 25-ago-2026) Codex había dejado este endpoint devolviendo 410
// para todo el 24-ago. Joaquín pidió explícitamente reactivarlo: quiere que
// el equipo pueda ver y copiar las keys desde el portal de staff, en vez de
// tener que pedírselas a alguien o buscarlas en los secretos de GitHub.
//
// Lo que NO se relajó al reactivarlo: sigue verificando `es_admin` contra la
// tabla `admins` en cada llamada, sin caché, y `api_credenciales` sigue sin
// ninguna policy de SELECT para `authenticated` — esta función es la única
// puerta. Un cliente externo con la anon key no puede leer nada.
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
    proveedor = String(((await req.json()) as { proveedor?: string })?.proveedor || "").trim();
  } catch { /* se valida abajo */ }
  if (!proveedor) return json({ error: "falta el proveedor" }, 400);

  const { data: fila, error } = await sb
    .from("api_credenciales")
    .select("proveedor, valor, nota, actualizado_en, actualizado_por")
    .eq("proveedor", proveedor)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!fila) {
    return json({
      error: `No hay una credencial guardada para "${proveedor}". Se agrega desde la base (tabla api_credenciales).`,
    }, 404);
  }

  // Queda registrado QUIÉN reveló QUÉ y cuándo. Una key que el equipo
  // entero puede copiar necesita una traza: si algún día aparece filtrada,
  // esto es lo único que permite acotar por dónde salió.
  console.log(`[revelar-credencial] ${user.email} reveló "${proveedor}"`);

  return json({
    proveedor: fila.proveedor,
    valor: fila.valor,
    nota: fila.nota,
    actualizado_en: fila.actualizado_en,
    actualizado_por: fila.actualizado_por,
  });
});
