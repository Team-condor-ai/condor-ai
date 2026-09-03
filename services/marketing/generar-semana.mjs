/**
 * Genera (sin pisar lo existente) las filas de Marketing de la semana en
 * curso: calendario de contenido + seguimiento diario de Instagram.
 *
 * POR QUÉ EXISTE ESTE SCRIPT ADEMÁS DEL `asegurarSemana()` DEL FRONTEND
 * ---------------------------------------------------------------------------
 * `Marketing.tsx` ya genera la semana al abrirse, pero eso solo pasa si
 * alguien entra al módulo esa semana. Pedido explícito de Joaquín
 * (2-sept-2026): "quiero que quede en el calendario para siempre" — este
 * cron corre cada lunes temprano y deja la semana lista se abra o no se
 * abra el portal. El calendario fijo (día → tema/responsable) se duplica
 * acá a propósito, chico y estable: los scripts de `services/` no
 * importan del frontend en este repo (sin build step compartido), mismo
 * patrón que el resto de `services/ingresos-clientes` y `services/barbara`.
 *
 * Si el calendario de tipos.ts cambia (nuevo tema, nuevo responsable),
 * hay que reflejarlo acá también.
 *
 * Variables requeridas:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node services/marketing/generar-semana.mjs
 *   node services/marketing/generar-semana.mjs --dry-run
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

// Mismo calendario que CALENDARIO_CONTENIDO en apps/web-v2/.../tipos.ts.
const CALENDARIO_CONTENIDO = [
  { dow: 1, tema: "noticias_ia", email: "maximilianopinocv@gmail.com" },
  { dow: 2, tema: "carrusel_educativo", email: "j.ignaciomunozsilva@gmail.com" },
  { dow: 4, tema: "frase_motivacional", email: "j.ignaciomunozsilva@gmail.com" },
  { dow: 5, tema: "digitalizar_nicho", email: "maximilianopinocv@gmail.com" },
];

// Mismo criterio que EXCEPCIONES_CONTENIDO_SEMANA en tipos.ts.
const EXCEPCIONES_CONTENIDO_SEMANA = [
  { lunes: "2026-08-31", diasValidos: [4, 5] },
];

function responsableSeguimiento(fecha) {
  const dow = fecha.getDay();
  return dow >= 1 && dow <= 4
    ? "samuelisaacospitiaquintero@gmail.com"
    : "alejandrotobarq@gmail.com";
}

function lunesDeEstaSemana(ahora) {
  const dia = ahora.getDay();
  const diasDesdeLunes = (dia + 6) % 7;
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - diasDesdeLunes);
  return inicio;
}

const iso = (d) => d.toISOString().slice(0, 10);

function diasDeLaSemana(ahora) {
  const inicio = lunesDeEstaSemana(ahora);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

async function upsert(supabaseUrl, serviceKey, tabla, filas, fetchImpl) {
  if (!filas.length) return;
  const r = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${tabla}?on_conflict=fecha`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(filas),
  });
  if (!r.ok) throw new Error(`Supabase ${tabla}: ${r.status} ${await r.text()}`);
}

export async function ejecutar({ env = process.env, argv = process.argv.slice(2), ahora = new Date(), fetchImpl = globalThis.fetch } = {}) {
  const supabaseUrl = String(env.SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const dryRun = argv.includes("--dry-run");
  if (!supabaseUrl || !serviceKey) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const dias = diasDeLaSemana(ahora);
  const lunesIso = iso(dias[0]);
  const excepcion = EXCEPCIONES_CONTENIDO_SEMANA.find((e) => e.lunes === lunesIso);
  const diasValidos = new Set(excepcion?.diasValidos ?? CALENDARIO_CONTENIDO.map((c) => c.dow));

  const filasContenido = dias
    .map((d) => ({ fecha: iso(d), dow: d.getDay() === 0 ? 7 : d.getDay() }))
    .flatMap(({ fecha, dow }) => {
      if (!diasValidos.has(dow)) return [];
      const cfg = CALENDARIO_CONTENIDO.find((c) => c.dow === dow);
      return cfg ? [{ fecha, tema: cfg.tema, responsable_email: cfg.email }] : [];
    });
  const filasSeguimiento = dias.map((d) => ({ fecha: iso(d), responsable_email: responsableSeguimiento(d) }));

  if (dryRun) {
    return { lunesIso, filasContenido, filasSeguimiento };
  }
  await upsert(supabaseUrl, serviceKey, "marketing_contenido", filasContenido, fetchImpl);
  await upsert(supabaseUrl, serviceKey, "marketing_seguimiento_diario", filasSeguimiento, fetchImpl);
  return { lunesIso, filasContenido, filasSeguimiento };
}

async function main() {
  cargarEnv();
  const { lunesIso, filasContenido, filasSeguimiento } = await ejecutar();
  console.log(`Semana del ${lunesIso}: ${filasContenido.length} tarea(s) de contenido, ${filasSeguimiento.length} de seguimiento.`);
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  main().catch((error) => {
    console.error(`No se pudo generar la semana de Marketing: ${error.message || error}`);
    process.exitCode = 1;
  });
}
