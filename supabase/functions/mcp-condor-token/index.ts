// condor.ai · Edge Function "mcp-condor-token"
//
// Genera (o rota) el token MCP de quien la llama. Es la ÚNICA forma de
// conseguir un token: valida el JWT real del portal primero, así que nadie
// puede sacarse uno sin ser antes un admin real ya logueado. `mcp-condor`
// (el backend que usa el MCP en sí) nunca acepta un JWT, solo este token —
// separar los dos mecanismos evita mezclarlos.
//
// GET  -> token actual (lo crea si es la primera vez)
// POST -> rota: genera uno nuevo y el anterior deja de servir en el acto
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

function nuevoToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "cd_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sbUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user?.email) return json({ error: "sin sesión" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: admin } = await sb
    .from("admins")
    .select("email, nombre, token")
    .eq("email", user.email)
    .maybeSingle();
  if (!admin) return json({ error: "solo el equipo" }, 403);

  if (req.method === "GET" && admin.token) {
    return json({ token: admin.token, nombre: admin.nombre });
  }

  // Primera vez, o POST (rotar): se genera uno nuevo. `on conflict` no hace
  // falta — el token es aleatorio de 24 bytes, chocar es prácticamente cero.
  const token = nuevoToken();
  const { error } = await sb.from("admins").update({ token }).eq("email", user.email);
  if (error) return json({ error: error.message }, 500);
  return json({ token, nombre: admin.nombre });
});
