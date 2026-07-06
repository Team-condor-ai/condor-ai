// condor.ai · Empleada IA "Barbara" — 3 carruseles por semana (GitHub Actions)
// Lun = Noticiero IA (investiga la web) · Mié = IA por industria · Vie = Filosofía IA.
// Imágenes con HIGGSFIELD (nano_banana_2). Memoria anti-repetición en content-log.json:
// el director lee lo último creado y recibe la orden de NO repetir e INNOVAR.
// Manda a Telegram para revisar antes de subir.
//
// Secrets: ANTHROPIC_API_KEY, HIGGSFIELD_ACCESS_TOKEN, HIGGSFIELD_REFRESH_TOKEN,
//          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Variables: DIA (lunes|miercoles|viernes|test) · RETRY=1 (reintento del comando "Denuevo barbara")

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const isTest = (process.env.DIA || "").trim().toLowerCase() === "test" || process.env.TEST === "1";
const isRetry = process.env.RETRY === "1";

const N_SLIDES = 6;
const LOG = "services/barbara/content-log.json";

// Día → tipo
const rawDia = (process.env.DIA || "").trim().toLowerCase();
let dia = rawDia;
if (!["lunes", "miercoles", "viernes"].includes(dia)) {
  const wd = new Date().getUTCDay(); // 1=Lun 3=Mié 5=Vie
  dia = wd === 3 ? "miercoles" : wd === 5 ? "viernes" : "lunes";
}

const TEMAS = {
  lunes: {
    titulo: "📰 Noticiero IA — la semana en IA",
    investiga: true,
    instruccion: "Carrusel NOTICIERO con las 3-4 noticias de IA más importantes de los últimos 7 días (reales, de la búsqueda web), explicadas para un dueño de negocio.",
    template: `EDITORIAL TECH NEWSLETTER style (tipo "The Rundown AI"): fondo crema #f2efe6, texto NEGRO, UN acento verde menta #9ef0c0 como marcador detrás de 1-2 palabras clave. Tipografía rounded grotesque bold, muy legible. Portada con foto cinematográfica real + efecto papel rasgado. Slides con foto arriba + titular + dato + sección "Cómo afecta". Minimal, premium, serio. Badge de número arriba a la derecha. NO colorido, NO clip-art.`,
  },
  miercoles: {
    titulo: "🏭 IA por industria — casos concretos",
    investiga: false,
    instruccion: "Carrusel de una INDUSTRIA específica (restaurantes, retail, clínicas, inmobiliarias, talleres, etc.) con ejemplos CONCRETOS de qué puede hacer la IA ahí y el beneficio.",
    template: `Diseño infografía premium colorida tipo Canva pro: foto realista de la industria + bloque de color vibrante (familia cromática coherente del día), ícono grande, tipografía rounded bold, bastante texto útil. Alegre, visual, profesional. NO logos.`,
  },
  viernes: {
    titulo: "🌅 Filosofía IA — el futuro positivo",
    investiga: true,
    instruccion: "Carrusel FILOSÓFICO/aspiracional sobre lo positivo de la IA para los negocios y las personas, apoyado en un dato o estudio real (búsqueda web).",
    template: `Editorial aspiracional cinematográfico: imágenes cálidas y luminosas del futuro con IA (personas reales viviendo mejor, ciudades, naturaleza + tecnología), paleta cálida con acentos pastel, frases inspiradoras grandes + un dato de estudio. Elegante, colorido. NO logos.`,
  },
};
const tema = TEMAS[dia];

async function tg(method, payload, isForm = false) {
  const opt = { method: "POST" };
  if (isForm) opt.body = payload;
  else { opt.headers = { "Content-Type": "application/json" }; opt.body = JSON.stringify(payload); }
  return fetch(`https://api.telegram.org/bot${TG}/${method}`, opt);
}
async function claude(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Claude " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.json();
}
const textOf = (d) => (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");

// ---- Memoria anti-repetición ----
function leerLog() { try { return JSON.parse(readFileSync(LOG, "utf8")); } catch { return []; } }
function guardarEnLog(entry) {
  const log = leerLog();
  log.push(entry);
  writeFileSync(LOG, JSON.stringify(log.slice(-100), null, 2) + "\n"); // máximo 100 últimas
}

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    angulo: { type: "string", description: "El ángulo/idea ÚNICO de hoy en una frase (para registrar y no repetir)." },
    slides: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      titulo: { type: "string" },
      prompt: { type: "string", description: "Prompt EN INGLÉS para generar la imagen del slide, art-directed, repitiendo el template del día e incluyendo el TEXTO EXACTO en español a renderizar (titular + dato). Última slide = CTA de texto 'Síguenos para más'. NO logos ni marcas." },
    }, required: ["titulo", "prompt"] } },
    caption: { type: "string", description: "Caption educativa para Instagram con hook, valor real, invita a seguir + 5-8 hashtags (mezcla IA/negocios/Perú/Chile)." },
  },
  required: ["angulo", "slides", "caption"],
};

// ---- Higgsfield: generar imagen y devolver buffer ----
function genImagen(prompt, idx) {
  // execFileSync (sin shell) para que saltos de línea/comillas del prompt no rompan el comando.
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);
  const args = ["generate", "create", "nano_banana_2", "--prompt", safe, "--aspect_ratio", "4:5", "--resolution", "1k", "--wait", "--wait-timeout", "8m"];
  // Reintentos ante fallos transitorios de Higgsfield (respuesta vacía).
  let ultimo = "";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const out = execFileSync("higgsfield", args, { encoding: "utf8", timeout: 9 * 60 * 1000, stdio: ["ignore", "pipe", "pipe"] });
      const url = (out.trim().split("\n").pop() || "").trim();
      if (/^https?:\/\//.test(url)) return url;
      ultimo = out.slice(-160);
    } catch (e) {
      ultimo = String(e.stderr || e.message || e).slice(-300);
    }
    // Errores de config/auth (workspace, sesión, token) NO son transitorios: reintentar
    // 18 veces con backoff sólo quema 10 min y la cuota. Aborta el run entero de inmediato.
    if (/no workspace|session expired|unauthor|forbidden|invalid.*(token|credential)|\b(401|403)\b|auth login/i.test(ultimo)) {
      const err = new Error("Higgsfield config/auth (no reintentable): " + ultimo.slice(-160));
      err.permanent = true;
      throw err;
    }
    if (intento < 3) {
      console.log(`slide ${idx + 1}: intento ${intento}/3 falló (${ultimo.slice(-60)}), esperando 45s…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 45000); // backoff sync
    }
  }
  throw new Error("Higgsfield no devolvió URL (slide " + (idx + 1) + ") tras 3 intentos: " + ultimo);
}

async function main() {
  console.log("Barbara | dia:", dia, "| retry:", isRetry, "| TG:", !!TG, "| ANTHROPIC:", !!AK);
  if (isTest) {
    const j = await (await tg("sendMessage", { chat_id: CHAT, text: "✅ Barbara (Higgsfield): conexión OK" })).json();
    if (!j.ok) throw new Error("Telegram: " + (j.description || "")); return;
  }

  // 0) Candado anti-doble-publicación: si ya se publicó UN CARRUSEL hoy, no volver a generar.
  //    OJO: filtra por tipo de carrusel (lunes/miercoles/viernes). El content-log es COMPARTIDO
  //    con los reels (mar/jue), así que NO debe bloquear si lo de hoy fue un reel u otra cosa.
  //    Un RETRY=1 sí permite re-generar (cuando el equipo rechaza el contenido).
  if (!isRetry) {
    const hoyISO = new Date().toISOString().slice(0, 10);
    const tiposCarrusel = ["lunes", "miercoles", "viernes"];
    const yaHoy = leerLog().some(e => e.fecha === hoyISO && tiposCarrusel.includes(e.tipo));
    if (yaHoy) {
      console.log("Barbara ya publicó un carrusel hoy (" + hoyISO + "). No se vuelve a generar. Usa RETRY=1 para rehacerlo.");
      return;
    }
  }

  // 1) Investigación (solo lunes/viernes)
  let research = "";
  if (tema.investiga) {
    try {
      const r = await claude({
        model: "claude-haiku-4-5", max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: `Investiga datos ACTUALES y reales para: ${tema.instruccion}\nResumen con cifras y fuentes recientes.` }],
      });
      research = textOf(r);
    } catch (e) { console.log("research falló:", String(e).slice(0, 120)); }
  }

  // 2) Memoria: últimas 15 piezas para NO repetir
  const log = leerLog();
  const recientes = log.slice(-15).map(e => `- [${e.fecha} ${e.tipo}] ${e.angulo}`).join("\n") || "(sin historial)";

  // 3) Director (lee memoria, innova)
  const extra = isRetry ? "\n\n⚠️ ESTE ES UN REINTENTO: el contenido anterior fue rechazado por el equipo. Genera una versión CLARAMENTE MEJOR y distinta (mejor diseño, mejor texto, otro enfoque del mismo tema)." : "";
  const dir = await claude({
    model: "claude-sonnet-4-6", max_tokens: 4000,
    system: `Eres Barbara, directora creativa de condor.ai. Diseñas carruseles de Instagram (${N_SLIDES} slides) de nivel agencia, educativos y que hacen seguir la cuenta. Sigues EXACTAMENTE el template del día. Incluyes el texto exacto a renderizar en cada slide. NUNCA repites ángulos, protagonistas ni textos de las piezas recientes (te las paso). Innova siempre. Responde SOLO con el JSON.`,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: `Tipo de hoy (${dia}): ${tema.instruccion}\n\nTEMPLATE OBLIGATORIO:\n${tema.template}\n\nPIEZAS RECIENTES (NO repitas estos ángulos, innova):\n${recientes}\n${research ? "\nInvestigación web:\n" + research : ""}${extra}\n\nCrea el carrusel de ${N_SLIDES} slides con un ángulo NUEVO.` }],
  });
  const plan = JSON.parse(textOf(dir));
  const slides = (plan.slides || []).slice(0, N_SLIDES);

  // 4) Imágenes con Higgsfield
  const imgs = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      const url = genImagen(slides[i].prompt + "\n\n" + tema.template, i);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      imgs.push(buf);
    } catch (e) {
      if (e.permanent) throw e; // config/auth: no tiene sentido seguir con los demás slides
      console.log("slide", i + 1, "falló:", String(e).slice(0, 140));
    }
  }
  if (!imgs.length) throw new Error("No se generó ninguna imagen");

  // 5) Enviar a Telegram
  for (let i = 0; i < imgs.length; i++) {
    const fd = new FormData();
    fd.append("chat_id", CHAT);
    fd.append("caption", `${tema.titulo} · slide ${i + 1}/${imgs.length}`);
    fd.append("photo", new Blob([imgs[i]], { type: "image/png" }), `slide_${i + 1}.png`);
    const j = await (await tg("sendPhoto", fd, true)).json();
    if (!j.ok) throw new Error("Telegram sendPhoto: " + (j.description || ""));
  }
  await tg("sendMessage", { chat_id: CHAT, text: `🤖 *Barbara* — ${tema.titulo}\nListo para revisar y subir.\n\n📝 *Caption:*\n\n${plan.caption || ""}\n\n_Si quedó mal, responde "Denuevo barbara" en el grupo._`, parse_mode: "Markdown" });

  // 6) Registrar en memoria (anti-repetición)
  guardarEnLog({ fecha: new Date().toISOString().slice(0, 10), tipo: dia, angulo: plan.angulo || slides[0]?.titulo || "", titulo: tema.titulo });
  console.log("OK", dia, "| ángulo:", plan.angulo);
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("sendMessage", { chat_id: CHAT, text: "⚠️ Barbara falló (" + dia + "): " + String(e).slice(0, 300) }); } catch {}
  process.exit(1);
});
