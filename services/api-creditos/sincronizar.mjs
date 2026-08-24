import { execFileSync } from "node:child_process";

const SUPABASE_URL = limpio(process.env.SUPABASE_URL);
const SERVICE_KEY = limpio(process.env.SUPABASE_SERVICE_ROLE_KEY);
const AHORA = new Date();
const DESDE = new Date(AHORA.getTime() - 30 * 86400000);

function limpio(valor) { return String(valor ?? "").trim(); }

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

async function guardar(fila) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/api_creditos?on_conflict=proveedor`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      saldo: null,
      uso_periodo: null,
      tokens_entrada: null,
      tokens_salida: null,
      costo_usd: null,
      periodo_desde: DESDE.toISOString(),
      actualizado_en: AHORA.toISOString(),
      ...fila,
    }),
  });
  if (!respuesta.ok) throw new Error(`Supabase ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
}

function ejecutarHiggsfield(argumentos) {
  return JSON.parse(execFileSync("higgsfield", argumentos, {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000,
  }));
}

async function higgsfield() {
  try {
    const estado = ejecutarHiggsfield(["account", "status", "--json"]);
    const transacciones = ejecutarHiggsfield(["account", "transactions", "--json", "--size", "100", "--cursor", "0"]);
    const recientes = Array.isArray(transacciones)
      ? transacciones.filter((t) => new Date(t.created_at) >= DESDE)
      : [];
    const usado = recientes
      .filter((t) => t.action === "spend")
      .reduce((total, t) => total + Math.abs(Number(t.credits) || 0), 0);
    const saldoBruto = estado?.credits ?? estado?.balance?.credits ?? estado?.balance;
    const saldo = Number(saldoBruto);
    await guardar({
      proveedor: "higgsfield", nombre: "Higgsfield", estado: "ok",
      saldo: Number.isFinite(saldo) ? saldo : null, unidad_saldo: "créditos",
      uso_periodo: usado, unidad_uso: "créditos", fuente: "Higgsfield CLI", orden: 20,
      detalle: `${recientes.length} movimientos revisados en los últimos 30 días.`,
    });
  } catch (error) {
    await guardar({
      proveedor: "higgsfield", nombre: "Higgsfield", estado: "error",
      unidad_saldo: "créditos", unidad_uso: "créditos", fuente: "Higgsfield CLI", orden: 20,
      detalle: `No se pudo consultar Higgsfield: ${String(error.message ?? error).slice(0, 180)}`,
    });
  }
}

async function paginasAnthropic(ruta, clave) {
  const filas = [];
  let pagina = "";
  do {
    const url = new URL(`https://api.anthropic.com${ruta}`);
    url.searchParams.set("starting_at", DESDE.toISOString());
    url.searchParams.set("ending_at", AHORA.toISOString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (pagina) url.searchParams.set("page", pagina);
    const respuesta = await fetch(url, {
      headers: {
        "x-api-key": clave,
        "anthropic-version": "2023-06-01",
        "user-agent": "Condor-API-Credits/1.0 (https://condor.cl)",
      },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(`Anthropic ${respuesta.status}: ${JSON.stringify(datos).slice(0, 220)}`);
    filas.push(...(datos.data ?? []));
    pagina = datos.has_more ? datos.next_page : "";
  } while (pagina);
  return filas;
}

async function anthropic() {
  const clave = limpio(process.env.ANTHROPIC_ADMIN_KEY);
  if (!clave) {
    await guardar({
      proveedor: "anthropic", nombre: "Anthropic", estado: "requiere_configuracion",
      unidad_uso: "tokens", fuente: "Usage & Cost Admin API", orden: 10,
      detalle: "Falta el secret ANTHROPIC_ADMIN_KEY. La API key normal no puede leer uso organizacional.",
    });
    return;
  }
  try {
    const [uso, costos] = await Promise.all([
      paginasAnthropic("/v1/organizations/usage_report/messages", clave),
      paginasAnthropic("/v1/organizations/cost_report", clave),
    ]);
    let entrada = 0;
    let salida = 0;
    for (const cubo of uso) for (const r of cubo.results ?? []) {
      entrada += Number(r.uncached_input_tokens ?? 0);
      entrada += Number(r.cache_read_input_tokens ?? 0);
      entrada += Number(r.cache_creation?.ephemeral_1h_input_tokens ?? 0);
      entrada += Number(r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      salida += Number(r.output_tokens ?? 0);
    }
    let centavos = 0;
    for (const cubo of costos) for (const r of cubo.results ?? []) centavos += Number(r.amount ?? 0);
    await guardar({
      proveedor: "anthropic", nombre: "Anthropic", estado: "ok",
      unidad_uso: "tokens", tokens_entrada: entrada, tokens_salida: salida,
      costo_usd: Math.round(centavos) / 100, fuente: "Usage & Cost Admin API", orden: 10,
      detalle: "Uso y costo organizacional de los últimos 30 días. El saldo prepago no está expuesto por API.",
    });
  } catch (error) {
    await guardar({
      proveedor: "anthropic", nombre: "Anthropic", estado: "error",
      unidad_uso: "tokens", fuente: "Usage & Cost Admin API", orden: 10,
      detalle: `No se pudo consultar Anthropic: ${String(error.message ?? error).slice(0, 180)}`,
    });
  }
}

async function kie() {
  const clave = limpio(process.env.KIE_API_KEY);
  if (!clave) {
    await guardar({
      proveedor: "kie", nombre: "Kie.ai", estado: "requiere_configuracion",
      unidad_saldo: "créditos", fuente: "Kie.ai API", orden: 15,
      detalle: "Falta el secret KIE_API_KEY.",
    });
    return;
  }
  try {
    const respuesta = await fetch("https://api.kie.ai/api/v1/chat/credit", {
      headers: { Authorization: `Bearer ${clave}` },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok || datos.code !== 200) throw new Error(`Kie ${respuesta.status}: ${JSON.stringify(datos).slice(0, 180)}`);
    await guardar({
      proveedor: "kie", nombre: "Kie.ai", estado: "ok",
      saldo: Number(datos.data), unidad_saldo: "créditos",
      fuente: "Kie.ai API", orden: 15,
      // 1 crédito = $0,005 USD, tarifa publicada de Kie.ai (24-ago-2026).
      detalle: `≈ $${(Number(datos.data) * 0.005).toFixed(2)} USD de saldo. gpt-image-2 (imagen) + seedance-2-0 (video), reemplaza a Higgsfield.`,
    });
  } catch (error) {
    await guardar({
      proveedor: "kie", nombre: "Kie.ai", estado: "error",
      unidad_saldo: "créditos", fuente: "Kie.ai API", orden: 15,
      detalle: `No se pudo consultar Kie.ai: ${String(error.message ?? error).slice(0, 180)}`,
    });
  }
}

async function blotato() {
  const clave = limpio(process.env.BLOTATO_API_KEY);
  if (!clave) {
    await guardar({
      proveedor: "blotato", nombre: "Blotato", estado: "requiere_configuracion",
      unidad_saldo: "créditos", fuente: "Blotato API", orden: 30,
      detalle: "Falta el secret BLOTATO_API_KEY.",
    });
    return;
  }
  try {
    const respuesta = await fetch("https://backend.blotato.com/v2/users/me/accounts", {
      headers: { "blotato-api-key": clave },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(`Blotato ${respuesta.status}: ${JSON.stringify(datos).slice(0, 180)}`);
    const cuentas = Array.isArray(datos) ? datos.length : Array.isArray(datos?.accounts) ? datos.accounts.length : 0;
    await guardar({
      proveedor: "blotato", nombre: "Blotato", estado: "advertencia",
      unidad_saldo: "créditos", fuente: "Blotato API", orden: 30,
      detalle: `Conexión verificada (${cuentas} cuentas). Blotato no publica el saldo de créditos por API.`,
    });
  } catch (error) {
    await guardar({
      proveedor: "blotato", nombre: "Blotato", estado: "error",
      unidad_saldo: "créditos", fuente: "Blotato API", orden: 30,
      detalle: `No se pudo verificar Blotato: ${String(error.message ?? error).slice(0, 180)}`,
    });
  }
}

await Promise.all([higgsfield(), anthropic(), kie(), blotato()]);
console.log("Créditos API sincronizados:", AHORA.toISOString());
