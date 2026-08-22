// Motor alternativo de Bárbara: investigación + carrusel generados dentro de Blotato.
// No publica. Envía a Telegram y guarda el artefacto que luego requiere aprobación.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { crearClienteBlotato, esperarFuente, esperarVisual } from "./blotato.mjs";

const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const OUTBOX = process.env.BARBARA_OUTBOX_DIR || ".barbara-outbox";
const LOG = "services/barbara/content-log.json";
const runId = process.env.GITHUB_RUN_ID || "local";
const tipo = String(process.env.DIA || "viernes").trim().toLowerCase();
const TEMPLATE_ID = "2491f97b-1b47-4efa-8b96-8c651fa7b3d5";

const TEMAS = {
  lunes: {
    titulo: "📰 Siete noticias de IA",
    consulta: "Investiga exactamente las 7 noticias de inteligencia artificial más relevantes publicadas durante los últimos 7 días. Confirma fechas y fuentes. Selecciona las 4 con mayor impacto práctico para dueños de negocios en Chile y Latinoamérica.",
  },
  viernes: {
    titulo: "🌅 IA para trabajar y vivir mejor",
    consulta: "Investiga un estudio o dato reciente y verificable sobre un impacto positivo de la inteligencia artificial en productividad, calidad del trabajo, accesibilidad o crecimiento de pequeñas empresas. Prioriza evidencia de los últimos 12 meses y explica su aplicación práctica.",
  },
};

function leerLog() {
  try { return JSON.parse(readFileSync(LOG, "utf8")); } catch { return []; }
}

function guardarLog(entry) {
  const log = leerLog();
  log.push(entry);
  writeFileSync(LOG, JSON.stringify(log.slice(-100), null, 2) + "\n");
}

async function tg(method, payload, isForm = false) {
  const options = { method: "POST" };
  if (isForm) options.body = payload;
  else {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(`https://api.telegram.org/bot${TG}/${method}`, options);
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || response.status}`);
  return data;
}

function extraerPlan(content, tema) {
  const limpio = String(content || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const plan = JSON.parse(limpio);
    if (plan.caption && Array.isArray(plan.slides)) return plan;
  } catch {}
  return {
    angulo: tema.titulo,
    caption: `${tema.titulo}\n\nLa IA tiene valor cuando convierte información en decisiones y tiempo recuperado. Guarda este carrusel y cuéntanos qué proceso automatizarías primero.\n\n#InteligenciaArtificial #Negocios #Automatización #Productividad #CondorAI`,
    slides: [],
    research: limpio.slice(0, 8000),
  };
}

async function main() {
  const tema = TEMAS[tipo];
  if (!tema) throw new Error("DIA debe ser lunes o viernes para el motor Blotato");
  if (!TG || !CHAT) throw new Error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");

  const cliente = crearClienteBlotato();
  console.log("Bárbara Blotato | tipo:", tipo, "| run:", runId);

  const fuenteCreada = await cliente.crearFuente({
    source: { sourceType: "perplexity-query", text: tema.consulta },
    customInstructions: `Responde SOLO JSON válido en español con esta estructura: {"angulo":"idea central única","caption":"caption de Instagram con hook, valor, CTA y 5-8 hashtags","slides":[{"titulo":"máximo 45 caracteres","texto":"máximo 150 caracteres"}]}. Crea exactamente 4 slides de contenido; la plantilla agregará portada y CTA. Evita exageraciones, conserva cifras y menciona brevemente la fuente.`,
  });
  const sourceId = fuenteCreada?.id || fuenteCreada?.item?.id;
  if (!sourceId) throw new Error("Blotato no devolvió ID de investigación");
  const fuente = await esperarFuente(cliente, sourceId);
  const plan = extraerPlan(fuente.content, tema);

  const prompt = `Crea un carrusel de Instagram en español para Condor.AI, empresa latinoamericana de automatización con inteligencia artificial. Tema: ${tema.titulo}. Ángulo: ${plan.angulo}. Contenido investigado: ${JSON.stringify(plan.slides.length ? plan.slides : plan.research)}. Debe tener portada, 4 slides útiles y CTA final. Copy breve, concreto y perfectamente legible. No inventes cifras ni fuentes. No uses palabras meta como título, subtítulo, slide o CTA. Paleta obligatoria: negro #111111, crema #F2EFE6 y verde lima #C8FF00. Estética tecnológica editorial, premium y limpia. CTA: Sigue a @condor.ai para automatizar con criterio.`;
  const visualCreado = await cliente.crearVisual({
    templateId: TEMPLATE_ID,
    inputs: {
      backgroundColor: "#111111",
      borderColor: "#C8FF00",
      textColor: "#F2EFE6",
      authorName: "Condor.AI",
      profileName: "Condor.AI",
      profileTitle: "Automatización con inteligencia artificial",
      aspectRatio: "4:5",
    },
    prompt,
    render: true,
  });
  const visualId = visualCreado?.item?.id || visualCreado?.id;
  if (!visualId) throw new Error("Blotato no devolvió ID del carrusel");
  const visual = await esperarVisual(cliente, visualId);
  const urls = Array.isArray(visual.imageUrls) ? visual.imageUrls : [];
  if (!urls.length) throw new Error("La plantilla terminó sin imageUrls");

  mkdirSync(OUTBOX, { recursive: true });
  const files = [];
  const media = [];
  for (let i = 0; i < urls.length; i++) {
    const response = await fetch(urls[i]);
    if (!response.ok) throw new Error(`No pude descargar slide ${i + 1}: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = String(response.headers.get("content-type") || "image/png").split(";")[0];
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    const nombre = `slide-${String(i + 1).padStart(2, "0")}.${extension}`;
    writeFileSync(`${OUTBOX}/${nombre}`, buffer);
    files.push(nombre);
    media.push({ buffer, mime, nombre });
  }

  writeFileSync(`${OUTBOX}/manifest.json`, JSON.stringify({
    version: 1,
    runId,
    generatedAt: new Date().toISOString(),
    type: "carousel",
    platform: "instagram",
    caption: plan.caption,
    angle: plan.angulo,
    files,
    visualId,
  }, null, 2) + "\n");

  for (let i = 0; i < media.length; i++) {
    const form = new FormData();
    form.append("chat_id", CHAT);
    form.append("caption", `${tema.titulo} · slide ${i + 1}/${media.length}`);
    form.append("photo", new Blob([media[i].buffer], { type: media[i].mime }), media[i].nombre);
    await tg("sendPhoto", form, true);
  }
  await tg("sendMessage", {
    chat_id: CHAT,
    parse_mode: "Markdown",
    text: `🤖 *Bárbara + Blotato* — ${tema.titulo}\nListo para revisar. ID: \`${runId}\`\n\n📝 *Caption:*\n\n${plan.caption}\n\n_Si está aprobado: "Aprobar barbara"._`,
  });

  guardarLog({
    fecha: new Date().toISOString().slice(0, 10),
    tipo,
    angulo: plan.angulo,
    titulo: tema.titulo,
    runId,
    motor: "blotato",
    visualId,
  });
  console.log("OK", tipo, "| visual:", visualId, "| slides:", files.length);
}

main().catch(async (error) => {
  console.error(error);
  try { await tg("sendMessage", { chat_id: CHAT, text: `⚠️ Bárbara + Blotato falló: ${String(error).slice(0, 300)}` }); } catch {}
  process.exit(1);
});
