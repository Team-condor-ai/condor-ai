// condor.ai · Edge Function "mcp-condor"
//
// El backend del servidor MCP: le da a cada Claude del equipo acceso de
// lectura y escritura a reuniones y biblioteca del portal, igual que se hizo
// con Veci Leads — pero acá SÍ contra el Supabase real de Cóndor, porque este
// es el mismo producto y separar la base no tendría sentido.
//
// AUTENTICACIÓN: TOKEN, NO EL LOGIN DEL PORTAL
// ---------------------------------------------------------------------------
// El portal entra por magic link, pensado para un navegador. Un MCP que corre
// en la máquina de cada uno necesita algo de larga duración. El token viaja
// en `x-clave` y se resuelve contra `admins.token` — nunca se acepta un JWT
// de Supabase acá, para no mezclar los dos mecanismos.
//
// El token SOLO se genera desde dentro del portal ya autenticado (función
// `mcp-condor-token`, que sí valida el JWT): así nadie puede sacarse un token
// sin ser antes un admin real.
//
// AUTORÍA: LA PONE ESTA FUNCIÓN, NUNCA EL CLIENTE
// ---------------------------------------------------------------------------
// `creado_por` / `actualizado_por` se escriben con el nombre resuelto del
// token, ignorando cualquier valor que venga en el cuerpo de la petición.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-clave, x-tipo",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/* Tablas permitidas y sus columnas escribibles. Lista blanca de las dos cosas
   a la vez: el nombre de una tabla no se puede ligar como parámetro, así que
   la única defensa real es que solo existan estos valores posibles. */
const TABLAS: Record<string, { columnas: string[]; autor?: string; editor?: string }> = {
  reuniones: {
    columnas: ["titulo", "descripcion", "fecha_hora", "duracion_min", "notas"],
    editor: "notas_actualizado_por",
  },
  biblioteca_carpetas: { columnas: ["nombre", "padre_id"] },
  biblioteca: { columnas: ["nombre", "carpeta_id", "archivo_url", "archivo_nombre", "peso_bytes", "mime"] },
};

const TOPE = 24 * 1024 * 1024; // tope razonable por archivo, mismo criterio que Veci Leads

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.pathname.endsWith("/salud")) return json({ ok: true });

  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SB_URL, SB_KEY);

  // ── Quién está pidiendo ────────────────────────────────────────────────
  const credencial = req.headers.get("x-clave") || "";
  if (!credencial) return json({ error: "falta x-clave" }, 401);

  const { data: yo, error: errYo } = await sb
    .from("admins")
    .select("email, nombre, token")
    .eq("token", credencial)
    .maybeSingle();
  if (errYo || !yo) return json({ error: "clave incorrecta" }, 401);

  if (url.pathname.endsWith("/yo")) return json(yo);

  if (url.pathname.endsWith("/equipo")) {
    const { data } = await sb.from("admins").select("nombre").order("nombre");
    return json(data ?? []);
  }

  // ── Documentos: los bytes van por su propia ruta, no por la de las tablas.
  //    Suben a Storage (bucket `biblioteca`, ya existente y usado por la web)
  //    y la fila de metadatos se crea acá mismo, con el mismo patrón que usa
  //    Biblioteca.tsx: nombre limpio para la ruta, original guardado aparte. */
  if (url.pathname.endsWith("/doc")) {
    if (req.method === "PUT") {
      const nombre = url.searchParams.get("nombre") || "archivo";
      const carpeta = url.searchParams.get("carpeta") || null;
      const cuerpo = await req.arrayBuffer();
      if (cuerpo.byteLength > TOPE) return json({ error: "El archivo pasa los 24 MB." }, 413);

      const limpio = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpio}`;
      const tipo = req.headers.get("x-tipo") || "application/octet-stream";

      const { error: errSubir } = await sb.storage
        .from("biblioteca")
        .upload(ruta, cuerpo, { upsert: false, contentType: tipo });
      if (errSubir) return json({ error: errSubir.message }, 500);

      const { data: pub } = sb.storage.from("biblioteca").getPublicUrl(ruta);
      const { data: fila, error: errFila } = await sb
        .from("biblioteca")
        .insert({
          nombre: nombre.replace(/\.[^.]+$/, ""),
          archivo_url: pub.publicUrl,
          archivo_nombre: nombre,
          peso_bytes: cuerpo.byteLength,
          mime: tipo,
          carpeta_id: carpeta,
        })
        .select()
        .single();
      if (errFila) return json({ error: errFila.message }, 500);
      return json([fila]);
    }
  }

  const tabla = url.searchParams.get("tabla") || "";
  const def = TABLAS[tabla];
  if (!def) return json({ error: "tabla no permitida" }, 400);

  try {
    if (req.method === "GET") {
      const { data, error } = await sb.from(tabla).select("*").order("creado_en", { ascending: false });
      if (error) {
        // `reuniones` ordena por `created_at`, no por `creado_en` — dos
        // convenciones distintas conviven en este portal. Se reintenta con
        // la otra en vez de exigirle a cada tabla el mismo nombre.
        const r2 = await sb.from(tabla).select("*").order("created_at", { ascending: false });
        if (r2.error) return json({ error: r2.error.message }, 500);
        return json(r2.data ?? []);
      }
      return json(data ?? []);
    }

    if (req.method === "POST") {
      const cuerpo = await req.json();
      const fila: Record<string, unknown> = {};
      for (const c of def.columnas) if (cuerpo[c] !== undefined) fila[c] = cuerpo[c];
      if (def.autor) fila[def.autor] = yo.nombre;
      const { data, error } = await sb.from(tabla).insert(fila).select().single();
      if (error) return json({ error: error.message }, 500);
      return json([data]);
    }

    const id = url.searchParams.get("id");
    if (!id) return json({ error: "falta id" }, 400);

    if (req.method === "PATCH") {
      const cuerpo = await req.json();
      const fila: Record<string, unknown> = {};
      for (const c of def.columnas) if (cuerpo[c] !== undefined) fila[c] = cuerpo[c];
      if (!Object.keys(fila).length) return json({ error: "nada que cambiar" }, 400);
      if (def.editor) {
        fila[def.editor] = yo.nombre;
        fila["notas_actualizado_en"] = new Date().toISOString();
      }
      const { data, error } = await sb.from(tabla).update(fila).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json([data]);
    }

    if (req.method === "DELETE") {
      const { error } = await sb.from(tabla).delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json([]);
    }

    return json({ error: "método no permitido" }, 405);
  } catch (e) {
    return json({ error: String(e).slice(0, 240) }, 500);
  }
});
