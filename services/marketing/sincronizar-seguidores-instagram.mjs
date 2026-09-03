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
 * SOBRE LA DURACIÓN DEL TOKEN (probado en vivo, 3-sept-2026)
 * ---------------------------------------------------------------------------
 * El primer token (del Graph API Explorer genérico) SÍ era de corta
 * duración. El token actual se generó directo desde el panel de la app
 * de Meta ("Panel de marketing de Condor-IG" → Instagram → API setup
 * with Instagram login → Generar token) y se intentó pasar por el
 * intercambio a 60 días (`grant_type=ig_exchange_token`) -- ese
 * intercambio falló con "Session key invalid" pese a tener el formato
 * exacto de la documentación. Todo indica que un token generado así
 * (para el propio Tester/Admin de la app) YA viene de larga duración y
 * no es candidato a ese endpoint, no que algo esté mal configurado.
 *
 * Si este job empieza a fallar con un error de autenticación de todos
 * modos: generar uno nuevo desde el mismo panel (Instagram → API setup
 * with Instagram login) y actualizar `INSTAGRAM_ACCESS_TOKEN` acá Y en
 * `api_credenciales` (proveedor 'instagram') del Portal Cóndor. Las dos
 * copias no se sincronizan solas, mismo patrón ya documentado para el
 * resto de credenciales de api_creditos (ver `agregar-credito-api`).
 *
 * VERIFICACIÓN REAL DE LA META DIARIA (agregado 3-sept-2026)
 * ---------------------------------------------------------------------------
 * Pedido de Joaquín: que el casillero de "seguí 200 hoy" en
 * `marketing_seguimiento_diario` se marque solo cuando el número REAL de
 * Instagram lo respalda, no solo porque Samuel o Alejandro lo tildaron.
 *
 * Cómo se calcula: cada corrida compara el `siguiendo` de ahora contra el
 * PRIMER snapshot de HOY (si ya corrió antes hoy) o, si es la primera
 * corrida del día, contra la última fila de un día anterior -- esa
 * diferencia es el crecimiento real desde que arrancó el día. Preferir el
 * primer snapshot de HOY (en vez de exigir siempre uno de ayer) es lo que
 * permite verificar la meta EL MISMO DÍA que se conecta esto, sin esperar
 * a que exista un día completo de historial. Con el cron corriendo cada
 * 2 horas (ver `instagram-seguidores.yml`), ese número se acerca a
 * "en vivo" sin exponer el token al navegador ni construir un endpoint
 * aparte.
 *
 * El resultado SOBRESCRIBE `cantidad` de la fila de hoy en
 * `marketing_seguimiento_diario` en cada corrida. `hecho` solo pasa a
 * `true` cuando el delta llega a la meta -- y una vez en `true` no
 * vuelve a `false` aunque el número baje después (alguien podría dejar
 * de seguir cuentas spam más tarde y no hay que penalizar eso).
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

async function guardarSnapshot(supabaseUrl, serviceKey, fecha, cantidad, siguiendo, fetchImpl) {
  const r = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/marketing_seguidores_snapshot`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([{ fecha, cantidad, siguiendo, creado_por: "cron:instagram" }]),
  });
  if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`);
}

const META_SEGUIDOS_DIA = 200; // mismo valor que META_SEGUIDOS_DIA en tipos.ts

/**
 * El punto de partida contra el que se mide "cuánto se siguió hoy":
 * preferentemente el PRIMER snapshot de HOY (para que, con el cron
 * corriendo cada 2 horas, ya se pueda verificar dentro del mismo día en
 * vez de recién al día siguiente) -- si hoy es el primer día que corre
 * esto y todavía no hay un segundo snapshot, cae a la última fila de un
 * día anterior. Si ninguna de las dos existe (primera corrida de todas),
 * no hay con qué comparar todavía.
 */
async function siguiendoDeReferencia(supabaseUrl, serviceKey, fecha, fetchImpl) {
  const base = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/marketing_seguidores_snapshot`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const qsHoy = new URLSearchParams({
    select: "siguiendo", fecha: `eq.${fecha}`, siguiendo: "not.is.null",
    order: "creado_en.asc", limit: "1",
  });
  const rHoy = await fetchImpl(`${base}?${qsHoy}`, { headers });
  if (!rHoy.ok) throw new Error(`Supabase (referencia de hoy): ${rHoy.status} ${await rHoy.text()}`);
  const [primeroDeHoy] = await rHoy.json();
  if (primeroDeHoy) return primeroDeHoy.siguiendo;

  const qsAyer = new URLSearchParams({
    select: "siguiendo", fecha: `lt.${fecha}`, siguiendo: "not.is.null",
    order: "fecha.desc,creado_en.desc", limit: "1",
  });
  const rAyer = await fetchImpl(`${base}?${qsAyer}`, { headers });
  if (!rAyer.ok) throw new Error(`Supabase (referencia de ayer): ${rAyer.status} ${await rAyer.text()}`);
  const [ultimoDeAyer] = await rAyer.json();
  return ultimoDeAyer?.siguiendo ?? null;
}

/** Marca en `marketing_seguimiento_diario` cuánto se siguió REALMENTE hoy
 *  (delta real desde el inicio del día) y si con eso se cumplió la meta.
 *  No hace nada si no hay fila para hoy (no debería pasar: la genera
 *  `generar-semana.mjs`/`asegurarSemana()` de antemano) ni si todavía no
 *  hay un snapshot de referencia (primer día que corre esto). */
async function verificarMetaDeHoy(supabaseUrl, serviceKey, fecha, siguiendoHoy, fetchImpl) {
  const referencia = await siguiendoDeReferencia(supabaseUrl, serviceKey, fecha, fetchImpl);
  if (referencia == null) return null; // sin historial todavía, no se puede calcular un delta real

  const deltaReal = siguiendoHoy - referencia;

  const rGet = await fetchImpl(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/marketing_seguimiento_diario?fecha=eq.${fecha}&select=id,hecho`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!rGet.ok) throw new Error(`Supabase (fila de hoy): ${rGet.status} ${await rGet.text()}`);
  const [fila] = await rGet.json();
  if (!fila) return null; // no existe la fila de hoy todavía

  const hecho = Boolean(fila.hecho) || deltaReal >= META_SEGUIDOS_DIA;
  const rPatch = await fetchImpl(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/marketing_seguimiento_diario?id=eq.${fila.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ cantidad: deltaReal, hecho }),
    },
  );
  if (!rPatch.ok) throw new Error(`Supabase (marcar hoy): ${rPatch.status} ${await rPatch.text()}`);
  return { deltaReal, hecho };
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

  let verificacion = null;
  if (!dryRun) {
    await guardarSnapshot(supabaseUrl, serviceKey, fecha, datos.followers_count, datos.follows_count, fetchImpl);
    verificacion = await verificarMetaDeHoy(supabaseUrl, serviceKey, fecha, datos.follows_count, fetchImpl);
  }
  return { fecha, ...datos, verificacion };
}

async function main() {
  cargarEnv();
  const r = await ejecutar();
  console.log(`@${r.username}: ${r.followers_count} seguidores, sigue a ${r.follows_count} (${r.fecha})`);
  if (r.verificacion) {
    console.log(`  Seguidas hoy (real): ${r.verificacion.deltaReal} · meta cumplida: ${r.verificacion.hecho ? "sí" : "no"}`);
  } else {
    console.log("  Sin snapshot de referencia todavía para verificar la meta de hoy.");
  }
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  main().catch((error) => {
    console.error(`No se pudo sincronizar seguidores de Instagram: ${error.message || error}`);
    process.exitCode = 1;
  });
}
