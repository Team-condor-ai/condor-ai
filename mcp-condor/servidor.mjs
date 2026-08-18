#!/usr/bin/env node
/**
 * Cóndor MCP · servidor.
 *
 * QUE ES ESTO
 * ---------------------------------------------------------------------------
 * Le da a cada Claude del equipo acceso de lectura y escritura al portal de
 * Cóndor: reuniones (con sus notas) y la biblioteca de documentos. Mismo
 * patrón que se armó ayer para Veci Leads, pero acá SÍ contra el Supabase
 * real de Cóndor — es el mismo producto, separar la base no tendría sentido.
 *
 * AUTENTICACIÓN
 * ---------------------------------------------------------------------------
 * Un token personal, `CONDOR_TOKEN`, que se saca desde el módulo MCP / CLI
 * del portal (ya logueado). Nunca se acepta el login del portal directo acá:
 * ese es para un navegador con magic link, esto corre en la máquina de cada
 * uno y necesita algo de larga duración.
 *
 * CONTEXTO AUTOMÁTICO
 * ---------------------------------------------------------------------------
 * Al conectarse, el servidor le entrega a Claude un panorama: reuniones
 * próximas, lo aún sin resumen, y qué hay en la biblioteca. Así cada Claude
 * arranca sabiendo qué existe, sin que nadie tenga que explicárselo.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.CONDOR_API ||
  "https://ogmvdthxwcmvqjlxhpsr.supabase.co/functions/v1/mcp-condor";
const ANON = process.env.CONDOR_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbXZkdGh4d2NtdnFqbHhocHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDEwMTksImV4cCI6MjA5NzIxNzAxOX0.wo6zSUlMejjYu1hSweZcWEBBdCvBgVNWg3xtLzFTIrI";
const TOKEN = process.env.CONDOR_TOKEN || "";

if (!TOKEN) {
  // A stderr y no a stdout: por stdout viaja el protocolo MCP y cualquier
  // texto suelto ahí rompe la conexión con un error de JSON ilegible.
  console.error("Falta CONDOR_TOKEN. Sácalo del módulo MCP / CLI en el portal de Cóndor.");
  process.exit(1);
}

/* `new URL(ruta, API)` se descartó a propósito: API ya trae un path propio
   (`/functions/v1/mcp-condor`), y resolver un `ruta` que empieza con "/"
   contra una base CON path reemplaza el path entero en vez de agregarle algo
   — quedaba pegándole a la raíz del proyecto de Supabase, sin función. Acá se
   concatena el path de la API con el sufijo, nunca se resuelve como base. */
async function pedir(ruta, opciones = {}) {
  const u = new URL(API);
  u.pathname = u.pathname.replace(/\/$/, "") + (ruta === "/" ? "" : ruta);
  for (const [k, v] of Object.entries(opciones.params || {})) {
    if (v !== undefined && v !== null) u.searchParams.set(k, v);
  }
  const r = await fetch(u, {
    method: opciones.metodo || "GET",
    headers: {
      apikey: ANON,
      "x-clave": TOKEN,
      ...(opciones.cuerpo ? { "Content-Type": "application/json" } : {}),
      ...(opciones.cabeceras || {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : opciones.crudo,
  });
  if (r.status === 401) throw new Error("Token incorrecto (revisa CONDOR_TOKEN).");
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `La API respondió ${r.status}`);
  }
  return opciones.texto ? r.text() : r.json();
}

const tabla = (t) => pedir("/", { params: { tabla: t } });

function rutaDe(id, carpetas) {
  const partes = [];
  let actual = id;
  for (let i = 0; actual && i < 30; i++) {
    const c = carpetas.find((x) => x.id === actual);
    if (!c) break;
    partes.unshift(c.nombre);
    actual = c.padre_id;
  }
  return partes.join(" / ") || "(raíz)";
}

const fmtFecha = (iso) => {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short",
    });
  } catch { return iso; }
};

async function todo() {
  const [reuniones, carpetas, docs] = await Promise.all([
    tabla("reuniones"), tabla("biblioteca_carpetas"), tabla("biblioteca"),
  ]);
  return { reuniones, carpetas, docs };
}

/** El panorama que ve Claude al conectarse. Texto plano y corto. */
function resumir(d) {
  const l = [];
  const ahora = Date.now();
  const proximas = d.reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() > ahora)
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const pasadasSinNotas = d.reuniones
    .filter((r) => new Date(r.fecha_hora).getTime() <= ahora && !r.notas)
    .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
    .slice(0, 8);

  l.push(`CÓNDOR — ${d.reuniones.length} reuniones registradas, ` +
         `${d.docs.length} documentos en ${d.carpetas.length} carpetas.`);

  if (proximas.length) {
    l.push("", "PRÓXIMAS REUNIONES:");
    for (const r of proximas.slice(0, 10)) {
      l.push(`  · ${fmtFecha(r.fecha_hora)} — ${r.titulo}` +
             `${r.descripcion ? ` — ${r.descripcion}` : ""} — id: ${r.id}`);
    }
  }
  if (pasadasSinNotas.length) {
    l.push("", "REUNIONES PASADAS SIN NOTAS (ofrece resumirlas si el usuario cuenta qué pasó):");
    for (const r of pasadasSinNotas) {
      l.push(`  · ${fmtFecha(r.fecha_hora)} — ${r.titulo} — id: ${r.id}`);
    }
  }
  if (d.docs.length) {
    l.push("", "BIBLIOTECA (usa `leer_documento` con el id para ver el contenido):");
    for (const doc of d.docs.slice(0, 40)) {
      l.push(`  · ${doc.archivo_nombre || doc.nombre} — ${rutaDe(doc.carpeta_id, d.carpetas)} — id: ${doc.id}`);
    }
  }
  if (!d.reuniones.length && !d.docs.length) l.push("", "Todavía no hay nada guardado.");
  return l.join("\n");
}

const texto = (s) => ({ content: [{ type: "text", text: s }] });

let inicial = "";
let yo = null;
try {
  yo = await pedir("/yo");
  inicial = resumir(await todo());
} catch (e) {
  inicial = `No se pudo leer el portal de Cóndor al arrancar: ${e.message}`;
}

const server = new McpServer(
  { name: "condor-portal", version: "1.0.0" },
  {
    instructions:
      "Este es el portal interno de Cóndor AI: reuniones del equipo y la " +
      "biblioteca de documentos. Todo lo que se guarde acá lo puede leer el " +
      "resto del equipo desde su propio Claude, así que sirve como memoria " +
      "común.\n\n" +
      (yo ? `Estás hablando con ${yo.nombre}.\n\n` : "") +
      "Cuando el usuario cuente qué se habló en una reunión, ofrece guardarlo " +
      "con `anotar_reunion` — así queda registrado el contexto y no solo la " +
      "hora. Cuando cuente algo que valga la pena que el equipo sepa " +
      "(un documento, una decisión, un acuerdo), ofrece guardarlo con " +
      "`guardar_documento`. Busca antes de responder que no sabes.\n\n" +
      "Este es el estado al conectarse (usa `panorama` para refrescarlo si " +
      "la conversación se alarga):\n\n" + inicial,
  },
);

server.registerTool("panorama", {
  title: "Panorama de Cóndor",
  description:
    "Todo el contexto del portal: reuniones próximas, reuniones pasadas sin " +
    "notas todavía, y qué hay en la biblioteca. Úsalo para refrescar el " +
    "contexto o antes de afirmar que algo no existe.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, async () => texto(resumir(await todo())));

server.registerTool("buscar", {
  title: "Buscar",
  description: "Busca por texto entre reuniones (título, descripción, notas) y documentos.",
  inputSchema: { consulta: z.string().describe("Texto a buscar (no distingue mayúsculas)") },
  annotations: { readOnlyHint: true },
}, async ({ consulta }) => {
  const d = await todo();
  const q = consulta.toLowerCase();
  const r = d.reuniones.filter((x) =>
    [x.titulo, x.descripcion, x.notas].some((c) => (c || "").toLowerCase().includes(q)));
  const docs = d.docs.filter((x) =>
    (x.archivo_nombre || x.nombre || "").toLowerCase().includes(q));
  if (!r.length && !docs.length) return texto(`Nada calza con "${consulta}".`);
  const l = [];
  if (r.length) {
    l.push("REUNIONES:");
    r.forEach((x) => l.push(`  · ${fmtFecha(x.fecha_hora)} — ${x.titulo}` +
      `${x.notas ? ` — ${x.notas.slice(0, 80)}` : ""} — id: ${x.id}`));
  }
  if (docs.length) {
    if (l.length) l.push("");
    l.push("DOCUMENTOS:");
    docs.forEach((x) => l.push(`  · ${x.archivo_nombre || x.nombre} — ${rutaDe(x.carpeta_id, d.carpetas)} — id: ${x.id}`));
  }
  return texto(l.join("\n"));
});

server.registerTool("reuniones", {
  title: "Ver reuniones",
  description: "Lista las reuniones registradas, con sus notas si ya las tienen.",
  inputSchema: {
    solo: z.enum(["proximas", "pasadas", "todas"]).default("proximas")
      .describe("Filtrar por próximas, pasadas, o todas"),
  },
  annotations: { readOnlyHint: true },
}, async ({ solo }) => {
  const d = await todo();
  const ahora = Date.now();
  let lista = d.reuniones;
  if (solo === "proximas") lista = lista.filter((r) => new Date(r.fecha_hora).getTime() > ahora);
  if (solo === "pasadas") lista = lista.filter((r) => new Date(r.fecha_hora).getTime() <= ahora);
  lista = [...lista].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  if (!lista.length) return texto("No hay reuniones en ese filtro.");
  return texto(lista.map((r) =>
    `· ${fmtFecha(r.fecha_hora)} — ${r.titulo}` +
    `${r.descripcion ? `\n  ${r.descripcion}` : ""}` +
    `${r.notas ? `\n  Notas: ${r.notas}` : "\n  (sin notas todavía)"}` +
    `\n  id: ${r.id}`
  ).join("\n\n"));
});

server.registerTool("crear_reunion", {
  title: "Crear una reunión",
  description: "Agenda una reunión en el portal.",
  inputSchema: {
    titulo: z.string(),
    fecha_hora: z.string().describe("Fecha y hora en ISO 8601, ej: 2026-08-20T15:00:00-04:00"),
    duracion_min: z.number().optional().default(60),
    descripcion: z.string().optional(),
  },
}, async ({ titulo, fecha_hora, duracion_min, descripcion }) => {
  const [r] = await pedir("/", { metodo: "POST", params: { tabla: "reuniones" },
    cuerpo: { titulo, fecha_hora, duracion_min, descripcion: descripcion || null } });
  return texto(`Reunión "${r.titulo}" agendada para ${fmtFecha(r.fecha_hora)}. id: ${r.id}`);
});

server.registerTool("anotar_reunion", {
  title: "Anotar el contexto de una reunión",
  description:
    "Guarda o actualiza las notas/resumen de una reunión: qué se habló, " +
    "acuerdos, próximos pasos. Esto es lo que queda como contexto real para " +
    "el resto del equipo — la fecha y el título solos no dicen qué pasó.",
  inputSchema: {
    id: z.string().describe("Id de la reunión, sale de `reuniones` o `buscar`"),
    notas: z.string(),
  },
}, async ({ id, notas }) => {
  const [r] = await pedir("/", { metodo: "PATCH", params: { tabla: "reuniones", id },
    cuerpo: { notas } });
  return texto(`Notas guardadas en "${r.titulo}". Quedan a la vista del equipo.`);
});

server.registerTool("leer_documento", {
  title: "Leer un documento",
  description:
    "Devuelve el contenido de un documento de la biblioteca. Sirve para los " +
    "que son texto. Un PDF o una imagen no se pueden leer como texto: para " +
    "esos avisa que hay que abrirlos en el portal.",
  inputSchema: { id: z.string().describe("Id del documento, sale de `panorama` o `buscar`") },
  annotations: { readOnlyHint: true },
}, async ({ id }) => {
  const d = await todo();
  const doc = d.docs.find((x) => x.id === id);
  if (!doc) return texto(`No existe un documento con id ${id}. Usa \`buscar\` para encontrarlo.`);
  const binario = /^(image|video|audio)\//.test(doc.mime || "") ||
    /\.(pdf|docx|xlsx|pptx|zip|png|jpe?g|gif|webp|heic)$/i.test(doc.archivo_nombre || "");
  if (binario || !doc.archivo_url) {
    return texto(`"${doc.archivo_nombre || doc.nombre}" es un ${doc.mime || "archivo binario"}: ` +
      `no se puede leer como texto desde acá. Está en la biblioteca del portal.`);
  }
  const cuerpo = await fetch(doc.archivo_url).then((r) => r.text());
  return texto(`# ${doc.archivo_nombre || doc.nombre}\n(${rutaDe(doc.carpeta_id, d.carpetas)})\n\n${cuerpo}`);
});

server.registerTool("guardar_documento", {
  title: "Guardar un documento",
  description:
    "Escribe un documento de texto en la biblioteca del portal: notas, " +
    "decisiones, resúmenes. Queda visible para todo el equipo. Si la carpeta " +
    "que nombras no existe, se crea.",
  inputSchema: {
    nombre: z.string().describe("Nombre del archivo, con extensión. Ej: 'Roadmap Q3.md'"),
    contenido: z.string(),
    carpeta: z.string().optional().describe("Nombre de la carpeta. Si no se dice, va a la raíz."),
  },
}, async ({ nombre, contenido, carpeta }) => {
  let carpetaId = null;
  if (carpeta) {
    const d = await todo();
    const existente = d.carpetas.find((c) => c.nombre.toLowerCase() === carpeta.toLowerCase());
    if (existente) carpetaId = existente.id;
    else {
      const [nueva] = await pedir("/", { metodo: "POST", params: { tabla: "biblioteca_carpetas" },
        cuerpo: { nombre: carpeta, padre_id: null } });
      carpetaId = nueva.id;
    }
  }
  const [fila] = await pedir("/doc", {
    metodo: "PUT", params: { nombre, carpeta: carpetaId },
    cabeceras: { "x-tipo": nombre.endsWith(".md") ? "text/markdown" : "text/plain" },
    crudo: contenido,
  });
  return texto(`Guardado "${fila.archivo_nombre}" en ${carpeta || "la raíz"} de la biblioteca ` +
    `(${Math.max(1, Math.round(fila.peso_bytes / 1024))} KB). id: ${fila.id}`);
});

server.registerTool("crear_carpeta", {
  title: "Crear una carpeta en la biblioteca",
  description: "Crea una carpeta en la biblioteca de documentos.",
  inputSchema: { nombre: z.string(), padre: z.string().optional().describe("Nombre de la carpeta madre") },
}, async ({ nombre, padre }) => {
  let padreId = null;
  if (padre) {
    const d = await todo();
    const existente = d.carpetas.find((c) => c.nombre.toLowerCase() === padre.toLowerCase());
    if (existente) padreId = existente.id;
  }
  const [c] = await pedir("/", { metodo: "POST", params: { tabla: "biblioteca_carpetas" },
    cuerpo: { nombre, padre_id: padreId } });
  return texto(`Carpeta "${c.nombre}" creada.`);
});

/* No hay herramienta para borrar a propósito. Es memoria compartida: si un
   Claude se equivoca al borrar, el equipo pierde algo que quizás nadie más
   tenía. Borrar se hace a mano en el portal, donde además hay confirmación. */

await server.connect(new StdioServerTransport());
