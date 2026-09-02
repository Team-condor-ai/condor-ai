/**
 * Sincroniza la comisión de Tecnobox con la contabilidad, leyendo las
 * ventas reales directo de la API de Shopify (no de la base de Tecnobox
 * Track — se pidió explícitamente "con la API de Shopify en tiempo real").
 *
 * El % y el piso mínimo NO se calculan acá: los resuelve el RPC
 * `contabilizar_comision_cliente` mirando la tabla `comision_tramos`. Este
 * script solo hace una cosa — sumar la venta neta real del mes — igual que
 * `sincronizar-egresos.mjs` solo trae el gasto de Meta y deja el tipo de
 * cambio para el RPC.
 *
 * VENTA NETA = total - impuestos - envío. Misma fórmula, línea por línea,
 * que usa el webhook de Tecnobox Track (functions/api/webhook-shopify.js)
 * para no reportar un número que no calza con lo que el otro sistema ya
 * calculó para cada venta.
 *
 * Se excluyen las canceladas (cancelled_at != null): la plata no entró.
 *
 * Variables requeridas:
 *   TECNOBOX_SHOPIFY_TIENDA (ej: veivfr-21)
 *   TECNOBOX_SHOPIFY_TOKEN
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (las de condor-ai/Bárbara)
 *
 * Uso:
 *   node services/ingresos-clientes/sincronizar-ingreso-tecnobox.mjs
 *   node services/ingresos-clientes/sincronizar-ingreso-tecnobox.mjs --meses 3
 *   node services/ingresos-clientes/sincronizar-ingreso-tecnobox.mjs --dry-run
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

const limpio = (v) => String(v || "").trim();

// El mes en curso, hora de Chile — un asiento fechado "hoy" en UTC podría
// caer en el mes siguiente para alguien mirando desde Chile a última hora.
function mesesAContar(cuantos, ahora) {
  const hoyChile = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santiago",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(ahora),
  );
  const meses = [];
  for (let i = cuantos - 1; i >= 0; i -= 1) {
    const d = new Date(hoyChile.getFullYear(), hoyChile.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

export function parsearOpciones(argv) {
  const valorDe = (bandera) => {
    const i = argv.indexOf(bandera);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  // Por defecto, 2 meses: el actual (que sigue subiendo) y el anterior
  // (por si Shopify todavía estaba ajustando algo al primer corte).
  const meses = Math.max(1, Number(valorDe("--meses")) || 2);
  return { meses, dryRun: argv.includes("--dry-run") };
}

async function leerJson(respuesta, etiqueta) {
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    const detalle = datos?.errors || `${respuesta.status} ${respuesta.statusText}`;
    throw new Error(`${etiqueta}: ${JSON.stringify(detalle).slice(0, 300)}`);
  }
  return datos;
}

/** Todas las órdenes del mes (rango en hora de Chile), paginado por cursor. */
async function ordenesDelMes(tienda, token, mes, fetchImpl) {
  const [anio, mesNum] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(anio, mesNum - 1, 1, 4, 0, 0)); // 00:00 Chile = 04:00 UTC (invierno)
  const hasta = new Date(Date.UTC(anio, mesNum, 1, 4, 0, 0));

  let url = `https://${tienda}.myshopify.com/admin/api/2024-01/orders.json` +
    `?status=any&limit=250&created_at_min=${desde.toISOString()}&created_at_max=${hasta.toISOString()}`;

  const ordenes = [];
  while (url) {
    const respuesta = await fetchImpl(url, {
      headers: { "X-Shopify-Access-Token": token, "User-Agent": "Mozilla/5.0" },
    });
    const cuerpo = await leerJson(respuesta, "Shopify");
    ordenes.push(...(cuerpo.orders || []));

    // Paginación por Link header (cursor), no por page= — Shopify la retiró.
    const link = respuesta.headers.get("link") || "";
    const siguiente = link.split(",").find((p) => p.includes('rel="next"'));
    url = siguiente ? siguiente.split(";")[0].trim().replace(/^<|>$/g, "") : null;
  }
  return ordenes;
}

/** total - impuestos - envío. Idéntico a webhook-shopify.js, a propósito. */
function ventaNeta(orden) {
  if (orden.cancelled_at) return 0; // la plata no entró
  const total = Math.round(Number(orden.total_price) || 0);
  const impuestos = Math.round(Number(orden.total_tax) || 0);
  const envio = Math.round(
    Number(orden.total_shipping_price_set?.shop_money?.amount) || 0,
  );
  return Math.max(0, total - impuestos - envio);
}

async function contabilizar(supabaseUrl, serviceKey, cuerpo, fetchImpl) {
  const respuesta = await fetchImpl(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/contabilizar_comision_cliente`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
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
  const tienda = limpio(env.TECNOBOX_SHOPIFY_TIENDA);
  const token = limpio(env.TECNOBOX_SHOPIFY_TOKEN);
  const supabaseUrl = limpio(env.SUPABASE_URL);
  const serviceKey = limpio(env.SUPABASE_SERVICE_ROLE_KEY);
  const opciones = parsearOpciones(argv);

  if (!tienda || !token) {
    throw new Error("Faltan TECNOBOX_SHOPIFY_TIENDA o TECNOBOX_SHOPIFY_TOKEN");
  }
  if (!opciones.dryRun && (!supabaseUrl || !serviceKey)) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const resultados = [];
  for (const mes of mesesAContar(opciones.meses, ahora)) {
    const ordenes = await ordenesDelMes(tienda, token, mes, fetchImpl);
    const canceladas = ordenes.filter((o) => o.cancelled_at).length;
    const ventaNetaMes = ordenes.reduce((suma, o) => suma + ventaNeta(o), 0);

    let comision = null;
    if (!opciones.dryRun) {
      comision = await contabilizar(
        supabaseUrl,
        serviceKey,
        {
          p_cliente: "tecnobox",
          p_mes: mes,
          p_venta_neta: ventaNetaMes,
          p_datos: {
            plataforma: "shopify",
            tienda,
            ordenes: ordenes.length,
            canceladas,
          },
        },
        fetchImpl,
      );
    }

    resultados.push({
      mes, ordenes: ordenes.length, canceladas, ventaNetaMes,
      comisionId: comision,
    });
  }
  return { dryRun: opciones.dryRun, resultados };
}

async function main() {
  cargarEnv();
  const { dryRun, resultados } = await ejecutar();
  for (const r of resultados) {
    const accion = dryRun ? "(simulado)" : "";
    console.log(
      `${r.mes}: ${r.ordenes} órdenes (${r.canceladas} canceladas) · ` +
        `venta neta $${r.ventaNetaMes.toLocaleString("es-CL")} ${accion}`,
    );
  }
}

const esPrincipal =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  main().catch((error) => {
    console.error(`No se pudo sincronizar el ingreso de Tecnobox: ${error.message || error}`);
    process.exitCode = 1;
  });
}
