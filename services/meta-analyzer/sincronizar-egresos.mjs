/**
 * Sincroniza el gasto diario por campana de Meta Ads con la contabilidad.
 *
 * Variables requeridas:
 *   META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node services/meta-analyzer/sincronizar-egresos.mjs
 *   node services/meta-analyzer/sincronizar-egresos.mjs --dias 90
 *   node services/meta-analyzer/sincronizar-egresos.mjs --desde 2026-08-01 --hasta 2026-08-21
 *   node services/meta-analyzer/sincronizar-egresos.mjs --dry-run
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

const limpio = (valor) =>
  String(valor || "")
    .replace(/[\s\r\n]+/g, "")
    .trim();

export function normalizarCuenta(valor) {
  const id = limpio(valor)
    .replace(/^act_/i, "")
    .replace(/[^0-9]/g, "");
  return id ? `act_${id}` : "";
}

const fechaISO = (fecha) => fecha.toISOString().slice(0, 10);

export function parsearOpciones(argv, ahora = new Date()) {
  const valorDe = (bandera) => {
    const i = argv.indexOf(bandera);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const hoyChile = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  const dias = Math.max(1, Number(valorDe("--dias")) || 35);
  const hasta = valorDe("--hasta") || hoyChile;
  const desdeCalculado = new Date(`${hasta}T12:00:00Z`);
  desdeCalculado.setUTCDate(desdeCalculado.getUTCDate() - (dias - 1));
  const desde = valorDe("--desde") || fechaISO(desdeCalculado);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(desde) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(hasta)
  ) {
    throw new Error("Las fechas deben usar el formato YYYY-MM-DD");
  }
  if (desde > hasta)
    throw new Error("--desde no puede ser posterior a --hasta");
  return { desde, hasta, dryRun: argv.includes("--dry-run") };
}

async function leerJson(respuesta, etiqueta) {
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    const detalle =
      datos?.error?.message ||
      datos?.message ||
      `${respuesta.status} ${respuesta.statusText}`;
    throw new Error(`${etiqueta}: ${detalle}`);
  }
  if (datos?.error)
    throw new Error(
      `${etiqueta}: ${datos.error.message || JSON.stringify(datos.error)}`,
    );
  return datos;
}

async function metaGet(url, token, fetchImpl) {
  let ultimoError;
  for (let intento = 1; intento <= 4; intento += 1) {
    try {
      const respuesta = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (
        (respuesta.status === 429 || respuesta.status >= 500) &&
        intento < 4
      ) {
        await new Promise((resolve) => setTimeout(resolve, intento * 1_500));
        continue;
      }
      return await leerJson(respuesta, "Meta API");
    } catch (error) {
      ultimoError = error;
      if (String(error).startsWith("Error: Meta API:") || intento === 4)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, intento * 1_500));
    }
  }
  throw ultimoError;
}

async function todosLosInsights(urlInicial, token, fetchImpl) {
  const filas = [];
  let siguiente = urlInicial;
  while (siguiente) {
    const pagina = await metaGet(siguiente, token, fetchImpl);
    filas.push(...(pagina.data || []));
    siguiente = pagina.paging?.next || "";
  }
  return filas;
}

/**
 * Fecha desde la cual el gasto entra al libro.
 *
 * La barrera de verdad vive en `contabilizar_gasto_meta` (ver la migracion
 * 20260826_meta_ads_reset_y_corte): aunque este script se equivoque, el RPC
 * devuelve null y no escribe nada. Leerla aca sirve para NO pedirle a Meta
 * dias que igual se van a descartar y para que el resumen diga la verdad.
 *
 * Si la tabla todavia no existe en ese proyecto se sigue de largo sin corte:
 * una instalacion sin la migracion debe comportarse como antes, no fallar.
 */
async function leerCorte(base, serviceKey, fetchImpl) {
  try {
    const respuesta = await fetchImpl(
      `${base.replace(/\/$/, "")}/rest/v1/meta_ads_ajustes?select=contabilizar_desde&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!respuesta.ok) return "";
    const filas = await respuesta.json();
    const desde = Array.isArray(filas) ? filas[0]?.contabilizar_desde : null;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(desde || "")) ? String(desde) : "";
  } catch {
    return "";
  }
}

async function guardarGasto(base, serviceKey, gasto, fetchImpl) {
  const respuesta = await fetchImpl(
    `${base.replace(/\/$/, "")}/rest/v1/rpc/contabilizar_gasto_meta`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gasto),
    },
  );
  return leerJson(respuesta, "Supabase");
}

export async function ejecutar({
  env = process.env,
  argv = process.argv.slice(2),
  ahora = new Date(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const token = limpio(env.META_ACCESS_TOKEN);
  const cuenta = normalizarCuenta(env.META_AD_ACCOUNT_ID);
  const supabaseUrl = limpio(env.SUPABASE_URL);
  const serviceKey = limpio(env.SUPABASE_SERVICE_ROLE_KEY);
  const version = limpio(env.META_GRAPH_VERSION) || "v21.0";
  const opciones = parsearOpciones(argv, ahora);

  if (!token || !cuenta)
    throw new Error("Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID");
  if (!opciones.dryRun && (!supabaseUrl || !serviceKey)) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  // El corte recorta la ventana antes de salir a la red. Si la ventana entera
  // queda antes del corte no hay nada que pedir y se termina en silencio: es
  // lo que pasa todos los dias hasta que llega la fecha.
  const corte = opciones.dryRun
    ? ""
    : await leerCorte(supabaseUrl, serviceKey, fetchImpl);
  const desde = corte && corte > opciones.desde ? corte : opciones.desde;
  if (corte && desde > opciones.hasta) {
    return {
      cuenta,
      moneda: "CLP",
      desde,
      hasta: opciones.hasta,
      corte,
      filas: 0,
      guardados: 0,
      omitidos: 0,
      total: 0,
      dryRun: opciones.dryRun,
    };
  }

  const api = `https://graph.facebook.com/${version}`;
  const cuentaUrl = new URL(`${api}/${cuenta}`);
  cuentaUrl.searchParams.set("fields", "id,name,currency,timezone_name");
  const datosCuenta = await metaGet(cuentaUrl, token, fetchImpl);

  const insightsUrl = new URL(`${api}/${cuenta}/insights`);
  insightsUrl.searchParams.set(
    "fields",
    "campaign_id,campaign_name,spend,date_start,date_stop",
  );
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set("time_increment", "1");
  insightsUrl.searchParams.set(
    "time_range",
    JSON.stringify({ since: desde, until: opciones.hasta }),
  );
  insightsUrl.searchParams.set("limit", "500");

  const insights = await todosLosInsights(insightsUrl, token, fetchImpl);
  const conGasto = insights.filter((fila) => Number(fila.spend || 0) > 0);
  let guardados = 0;
  let total = 0;

  let omitidos = 0;

  for (const fila of conGasto) {
    const monto = Number(fila.spend);
    total += monto;
    if (opciones.dryRun) continue;
    // El RPC responde null cuando la fecha queda antes del corte. Se cuenta
    // en vez de tratarlo como error: es el reset funcionando.
    const guardado = await guardarGasto(
      supabaseUrl,
      serviceKey,
      {
        p_fecha: fila.date_start,
        p_cuenta_publicitaria: cuenta,
        p_nombre_cuenta: datosCuenta.name || null,
        p_campana_id: fila.campaign_id,
        p_campana_nombre: fila.campaign_name || `Campana ${fila.campaign_id}`,
        p_monto: monto,
        p_moneda: datosCuenta.currency || "CLP",
        p_datos: {
          plataforma: "meta",
          date_stop: fila.date_stop,
          timezone: datosCuenta.timezone_name || null,
        },
      },
      fetchImpl,
    );
    if (guardado === null) omitidos += 1;
    else guardados += 1;
  }

  return {
    cuenta: datosCuenta.name || cuenta,
    moneda: datosCuenta.currency || "CLP",
    desde,
    hasta: opciones.hasta,
    corte,
    filas: conGasto.length,
    guardados,
    omitidos,
    total: Number(total.toFixed(4)),
    dryRun: opciones.dryRun,
  };
}

async function main() {
  cargarEnv();
  const resumen = await ejecutar();
  const accion = resumen.dryRun ? "leidos" : "sincronizados";
  const corte = resumen.corte ? ` · corte ${resumen.corte}` : "";
  const omitidos = resumen.omitidos
    ? ` · ${resumen.omitidos} omitidos por el corte`
    : "";
  console.log(
    `Meta Ads: ${resumen.filas} gastos ${accion} (${resumen.desde} a ${resumen.hasta})${corte} · ` +
      `${resumen.moneda} ${resumen.total} · ${resumen.cuenta}${omitidos}`,
  );
}

const esPrincipal =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  main().catch((error) => {
    console.error(
      `No se pudieron sincronizar los egresos de Meta: ${error.message || error}`,
    );
    process.exitCode = 1;
  });
}
