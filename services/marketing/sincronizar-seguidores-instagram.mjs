/**
 * Lee el total real de seguidores/seguidos de @condor.ai desde la API
 * oficial de Instagram y lo guarda en `marketing_seguidores_snapshot`,
 * para que el módulo Marketing del Portal Cóndor deje de mostrar "—".
 *
 * QUÉ API ES ESTA, EXACTAMENTE (2-sept-2026)
 * ---------------------------------------------------------------------------
 * El token que generó Joaquín es de "Instagram API con Instagram Login"
 * (empieza con `IGAA`), no del flujo viejo vía Facebook Login + Página.
 * Eso cambia la URL base: es `https://graph.instagram.com`, NO
 * `graph.facebook.com` -- probado en vivo, el segundo devuelve
 * "Invalid OAuth access token" para este tipo de token. No hace falta
 * ningún ID de Página ni de Facebook Business -- el propio token ya
 * identifica la cuenta de Instagram.
 *
 * ID de la cuenta verificado en vivo: 27061666863509883 (@condor.ai,
 * Business). 308 seguidores / 1351 seguidos al momento de conectar esto.
 *
 * ⚠️ EL TOKEN ES DE CORTA DURACIÓN
 * ---------------------------------------------------------------------------
 * Sin intercambiarlo por uno de larga duración (60 días, requiere el App
 * Secret de la app de Meta), este token vence pronto. Cuando eso pase,
 * este job va a empezar a fallar con un error de autenticación -- hay que
 * generar uno nuevo (o hacer el exchange a largo plazo) y actualizar
 * `INSTAGRAM_ACCESS_TOKEN` acá y en `api_credenciales` (proveedor
 * 'instagram') del Portal Cóndor. Las dos copias no se sincronizan solas,
 * mismo patrón ya documentado para el resto de credenciales de
 * api_creditos (ver `agregar-credito-api`).
 *
 * Variables requeridas:
 *   INSTAGRAM_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node services/marketing/sincronizar-seguidores-instagram.mjs
 *   node services/marketing/sincronizar-seguidores-instagram.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function cargarEnv(directorio = process.cwd(), env = process.env) {
  for (const nombre of [".env.local", ".env"]) {
    const ruta = path.resolve(directorio, nombre);
    if (!fs.existsSync(ruta)) continue;
    for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

async function leerSeguidores(token, fetchImpl) {
  const url = `https://graph.instagram.com/v21.0/me?fields=followers_count,follows_count,username&access_token=${encodeURIComponent(token)}`;
  const r = await fetchImpl(url);
  const datos = await r.json();
  if (!r.ok || datos.error) {
    throw new Error(`Instagram API: ${datos?.error?.message || r.status}`);
  }
  return datos;
}

async function guardarSnapshot(supabaseUrl, serviceKey, fecha, cantidad, fetchImpl) {
  const r = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/marketing_seguidores_snapshot`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([{ fecha, cantidad, creado_por: "cron:instagram" }]),
  });
  if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`);
}

export async function ejecutar({ env = process.env, argv = process.argv.slice(2), ahora = new Date(), fetchImpl = globalThis.fetch } = {}) {
  const token = String(env.INSTAGRAM_ACCESS_TOKEN || "").trim();
  const supabaseUrl = String(env.SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const dryRun = argv.includes("--dry-run");
  if (!token) throw new Error("Falta INSTAGRAM_ACCESS_TOKEN");
  if (!dryRun && (!supabaseUrl || !serviceKey)) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const datos = await leerSeguidores(token, fetchImpl);
  const fecha = ahora.toISOString().slice(0, 10);

  if (!dryRun) {
    await guardarSnapshot(supabaseUrl, serviceKey, fecha, datos.followers_count, fetchImpl);
  }
  return { fecha, ...datos };
}

async function main() {
  cargarEnv();
  const r = await ejecutar();
  console.log(`@${r.username}: ${r.followers_count} seguidores, sigue a ${r.follows_count} (${r.fecha})`);
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  main().catch((error) => {
    console.error(`No se pudo sincronizar seguidores de Instagram: ${error.message || error}`);
    process.exitCode = 1;
  });
}
