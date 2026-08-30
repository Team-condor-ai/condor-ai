// Da de alta un proveedor nuevo en `api_creditos`, y opcionalmente guarda
// su credencial en `api_credenciales`. Solo staff.
//
// POR QUÉ EXISTE ESTA FUNCIÓN (y no un insert directo desde el portal)
// ---------------------------------------------------------------------------
// `api_creditos` tiene RLS con SELECT solo para admins; no hay policy de
// INSERT para `authenticated`. `api_credenciales` no tiene ninguna policy
// para `authenticated` (a propósito — ver la migración `20260824…`). Esa
// tabla se toca solo con `service_role`, dentro de esta función, después de
// verificar `admins` a mano.
//
// Antes esto se hacía "abrir Supabase Studio → insertar fila a mano",
// que es exactamente el tipo de tarea manual que Joaquín pidió evitar el
// 25-ago (misma tanda de pedidos que reactivó `revelar-credencial`).
//
// LA COPIA QUE ESTO NO RESUELVE
// ---------------------------------------------------------------------------
// La key que se guarda acá es la copia de lectura para el portal. Si el
// proveedor se usa en un workflow de GitHub Actions, la key TAMBIÉN va en
// los secrets del repo — no hay sincronización automática entre las dos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

type Entrada = {
  proveedor?: string;
  nombre?: string;
  fuente?: string;
  unidad_saldo?: string;
  unidad_uso?: string;
  detalle?: string;
  orden?: number;
  credencial?: string;
  nota?: string;
};

const SLUG = /^[a-z0-9_-]+$/;

function limpiar(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

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
  if (!admin) return json({ error: "solo el equipo puede agregar proveedores" }, 403);

  let cuerpo: Entrada = {};
  try {
    cuerpo = (await req.json()) as Entrada;
  } catch {
    return json({ error: "el cuerpo no es JSON válido" }, 400);
  }

  const proveedor = (cuerpo.proveedor || "").trim().toLowerCase();
  const nombre = limpiar(cuerpo.nombre);
  if (!proveedor) return json({ error: "falta el proveedor" }, 400);
  if (proveedor.length > 40) return json({ error: "el proveedor no puede tener más de 40 caracteres" }, 400);
  if (!SLUG.test(proveedor)) {
    return json({ error: "el proveedor solo puede tener letras minúsculas, números, guion y guion bajo" }, 400);
  }
  if (!nombre) return json({ error: "falta el nombre visible" }, 400);

  const credencial = limpiar(cuerpo.credencial);
  const nota = limpiar(cuerpo.nota);
  const estado = credencial ? "sin_datos" : "requiere_configuracion";

  const fila = {
    proveedor,
    nombre,
    estado,
    fuente: limpiar(cuerpo.fuente),
    unidad_saldo: limpiar(cuerpo.unidad_saldo),
    unidad_uso: limpiar(cuerpo.unidad_uso),
    detalle: limpiar(cuerpo.detalle),
    orden: Number.isFinite(cuerpo.orden) ? Number(cuerpo.orden) : 100,
  };

  // Upsert: si el proveedor ya existía (por ejemplo se sembró en una
  // migración vieja), esta llamada actualiza los metadatos editables sin
  // pisar saldo/uso/tokens/costo/actualizado_en, que los sincronizan los
  // jobs — no el staff a mano.
  const { error: errCredito } = await sb
    .from("api_creditos")
    .upsert(fila, { onConflict: "proveedor" });
  if (errCredito) return json({ error: errCredito.message }, 500);

  let credencial_guardada = false;
  if (credencial) {
    const { error: errCred } = await sb.from("api_credenciales").upsert({
      proveedor,
      valor: credencial,
      nota,
      actualizado_en: new Date().toISOString(),
      actualizado_por: user.email,
    }, { onConflict: "proveedor" });
    if (errCred) return json({ error: `proveedor guardado, pero falló la credencial: ${errCred.message}` }, 500);

    // Marca la fila como revelable: es lo que le dice al portal que dibuje
    // el botón "Revelar" en esa fila (ver `20260829_api_creditos_revelable.sql`).
    const { error: errFlag } = await sb
      .from("api_creditos")
      .update({ revelable: true })
      .eq("proveedor", proveedor);
    if (errFlag) return json({ error: `credencial guardada, pero no se marcó como revelable: ${errFlag.message}` }, 500);

    credencial_guardada = true;
  }

  // Traza: una alta de proveedor toca dos tablas sensibles; conviene saber
  // quién lo hizo si algo aparece raro después.
  console.log(`[agregar-credito-api] ${user.email} agregó "${proveedor}" (credencial: ${credencial_guardada ? "si" : "no"})`);

  return json({ ok: true, proveedor, credencial_guardada });
});
