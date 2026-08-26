// Bárbara · Edge Function "mcp-barbara"
//
// Backend del MCP propio de Bárbara (Fase 4, MVP de 3 tools). Mismo
// esqueleto que mcp-condor (D:\Proyectos\condor-mcp / supabase/functions/
// mcp-condor/index.ts), pero con un modelo de identidad distinto: mcp-condor
// resuelve "soy staff de Cóndor" (token contra admins.token); acá cada token
// de `barbara_clientes.mcp_token` resuelve EXACTAMENTE un
// barbara_cliente_id, nunca una lista — no hay concepto de "ver todo".
//
// El token viaja en `x-clave`, igual que mcp-condor, y solo se genera desde
// el portal ya autenticado (RPC `barbara_generar_token_mcp`, solo staff por
// ahora) — nunca se acepta un JWT de Supabase acá.
//
// Escritura SIEMPRE como propuesta pendiente: `proponer_nota` nunca toca un
// nodo activo directo, pasa por la RPC `barbara_mcp_proponer_nota` (gateada
// por service_role) que inserta en `barbara_memoria_propuestas` — el mismo
// control humano que ya usa cualquier otra propuesta del sistema.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-clave",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.pathname.endsWith("/salud")) return json({ ok: true });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Quién está pidiendo: el token resuelve un único cliente de Bárbara ──
  const credencial = req.headers.get("x-clave") || "";
  if (!credencial) return json({ error: "falta x-clave" }, 401);

  const { data: cliente, error: errCliente } = await sb
    .from("barbara_clientes")
    .select("id, clientes(negocio)")
    .eq("mcp_token", credencial)
    .maybeSingle();
  if (errCliente || !cliente) return json({ error: "clave incorrecta" }, 401);
  const barbaraClienteId = cliente.id as string;

  if (url.pathname.endsWith("/memoria") && req.method === "GET") {
    const { data, error } = await sb
      .from("barbara_memoria_nodos")
      .select("id,tipo,titulo,contenido,peso,fuente_tipo,actualizado_en")
      .eq("barbara_cliente_id", barbaraClienteId)
      .eq("activo", true)
      .order("peso", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  }

  if (url.pathname.endsWith("/calendario") && req.method === "GET") {
    const { data, error } = await sb
      .from("barbara_programaciones")
      .select("id,tipo,plataforma,programada_para,estado")
      .eq("barbara_cliente_id", barbaraClienteId)
      .in("estado", ["borrador", "programada"])
      .order("programada_para");
    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  }

  if (url.pathname.endsWith("/proponer") && req.method === "POST") {
    let body: { tipo?: string; titulo?: string; contenido?: string };
    try { body = await req.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
    const { data, error } = await sb.rpc("barbara_mcp_proponer_nota", {
      p_barbara_cliente_id: barbaraClienteId,
      p_tipo: String(body.tipo || "").trim(),
      p_titulo: String(body.titulo || "").trim(),
      p_contenido: String(body.contenido || "").trim(),
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  }

  return json({ error: "ruta no encontrada" }, 404);
});
