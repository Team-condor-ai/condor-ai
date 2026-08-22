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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const isTest = (process.env.DIA || "").trim().toLowerCase() === "test" || process.env.TEST === "1";
const isRetry = process.env.RETRY === "1";

const LOG = "services/barbara/content-log.json";
const OUTBOX = process.env.BARBARA_OUTBOX_DIR;

// Día → tipo
const rawDia = (process.env.DIA || "").trim().toLowerCase();
let dia = rawDia;
if (!["lunes", "miercoles", "viernes"].includes(dia)) {
  const wd = new Date().getUTCDay(); // 1=Lun 3=Mié 5=Vie
  dia = wd === 3 ? "miercoles" : wd === 5 ? "viernes" : "lunes";
}

// ── Piezas de marca compartidas ─────────────────────────────────────────────
// Los hex van LITERALES en el prompt a propósito. Pedirle "verde lima" a un
// modelo de imagen devuelve un verde distinto en cada slide y el carrusel se
// nota cosido de retazos; con el hex escrito, el color se sostiene de la
// portada al cierre. Salen del logo y de los 4 carruseles que aprobó Joaquín
// el 22-ago-2026.
const GRADIENTE = "the condor.ai brand gradient: royal blue #1B4DE4 into violet #7B2FBF into crimson #E8203A";
const LIMA = "#BCD530";

// ── Los 4 templates ─────────────────────────────────────────────────────────
// Describen SOLO el diseño: retícula, paleta, tipografía y ritmo. El contenido
// lo inventa Bárbara cada vez y nunca se repite — de eso ya se encarga
// content-log.json, que le pasa los últimos 15 ángulos con la orden de
// innovar. Mantener el patrón visual y cambiar el fondo es justo lo que hace
// que una cuenta se vea como una cuenta y no como piezas sueltas.

const T_NOTICIAS = `Editorial tech-news slide, 4:5. Background near-white #F7F7F8 with one soft out-of-focus bloom of blue and pink in a single corner. Top-left: a small geometric hummingbird mark in ${GRADIENTE}, beside the lowercase wordmark "condor.ai" in heavy black grotesque. Top-right: the slide counter in bold black. Layout is LEFT-ALIGNED with a wide empty right column. Above the headline, one rounded-square app-icon tile in flat solid blue #1B4DE4 or violet #7B2FBF or crimson #E8203A, with a thin white line icon centred inside. Headline in very heavy grotesque sans, near-black #0A0A0A, tight leading, three or four short lines, with one or two key words filled with the same gradient. Under the headline a short horizontal rule in that gradient. Below it two or three lines of small grey body text. In the empty right column, one floating 3D isometric render or thin-line illustration in blue-violet tones, soft drop shadow, lots of white space around it. Optionally one very large statistic set in the gradient at bottom-left with its explanation beside it. Premium, calm, airy. NO clip-art, NO stock-photo people.`;

const T_SERVICIOS = `Centred agency statement slide, 4:5. Background near-white #F7F7F8 with one soft blue-to-pink gradient bloom bleeding in from a corner. TOP-CENTRE: the geometric hummingbird mark in ${GRADIENTE} beside the lowercase wordmark "condor.ai" in heavy black grotesque. Top-right corner: the slide counter in bold black. EVERYTHING IS CENTRE-ALIGNED on one vertical axis. A very large headline in heavy grotesque sans, near-black #0A0A0A, tight leading, filling the middle of the frame, with one whole phrase filled in the same gradient. Optionally one simple thin-line icon centred above the headline drawn in the gradient (a circle, a coin, two chat bubbles) and never more than one. Under the headline two or three centred lines of medium-grey supporting copy at much smaller size. At the very bottom a short centred horizontal rule in the gradient. Enormous breathing room, symmetric margins, poster-like calm. NO photos, NO people, NO clip-art, NO cards or boxes.`;

const T_BARBARA_PRODUCTO = `Dark editorial slide, 4:5. Background PURE BLACK #000000 edge to edge. Top-left: small geometric hummingbird mark in ${GRADIENTE} beside the wordmark "condor.ai" in white grotesque. Top-right: the slide counter in lime ${LIMA}. Headline set in a high-contrast DISPLAY SERIF with Scotch or Didone flavour, cream #F5F1E8, with the emphasised words in lime ${LIMA}. When the slide is a numbered point, place a small rounded-square OUTLINE badge stroked in lime, holding the number in lime, centred above the headline. In the middle of the frame, one large thin-line icon drawn in lime strokes on the black — a speech bubble, a descending bar chart, a target with an arrow, a calendar, a pencil — line art only, never filled, never another colour. At the bottom, a wide rounded-rectangle OUTLINE stroked in lime holding a small lime line icon at the left and two lines of white sans-serif text, with the number or key phrase in lime bold. Confident, high contrast, generous negative space. NO photos, NO background gradients, NO colour other than black, cream and lime.`;

const T_BARBARA_DATOS = `Data-driven editorial slide, 4:5, same brand family as the dark Barbara series but on alternating grounds: this slide is EITHER pure black #000000 with cream #F5F1E8 text, OR warm cream #F2EFE6 with near-black text and olive accents — pick one and commit to it, never split the frame. Top-left: a SOLID rounded-square badge filled lime ${LIMA} with the number in black inside it. Headline in a high-contrast DISPLAY SERIF with the emphasised half in lime ${LIMA}, or in deeper olive #8FA524 when the ground is cream so it stays readable. Under it a short lime rule. Body copy in a geometric sans. For statistics, stack two or three wide rounded-rectangle OUTLINE cards, each with a thin-line icon at the left, one very large lime percentage, and a two-line label beside it. For comparisons, draw a bordered two-column panel with a circled-cross list on the left and a circled-check list on the right, split by a vertical rule with a small circled "VS" on it. Optionally one simple two-bar chart, grey against lime, labelled underneath. Bottom-left, a small grey source line. Editorial, dense but ordered. NO photos, NO clip-art.`;

const SERIES = {
  noticias: {
    titulo: "📰 Noticiero IA — la semana en IA",
    investiga: true, slides: 6, cta: "Síguenos para más",
    instruccion: "Investiga exactamente 7 noticias de IA de los últimos 7 días (reales, de la búsqueda web), contrasta su vigencia y arma un NOTICIERO con las 3-4 más importantes, explicadas para un dueño de negocio latinoamericano. Cada noticia necesita una cifra concreta y una línea de qué significa para su negocio. Nombra la fuente en el slide.",
    template: T_NOTICIAS,
  },
  servicios: {
    titulo: "🚀 Servicios Cóndor — agentes de IA",
    investiga: false, slides: 6, cta: "Escríbenos al DM",
    instruccion: "Carrusel de venta de los servicios de Cóndor AI (agentes de IA, automatización de procesos, páginas web, campañas). UN solo argumento por slide, nada de listas de características. Habla del costo de no automatizar, no de la tecnología.",
    template: T_SERVICIOS,
  },
  barbara_producto: {
    titulo: "🎀 Bárbara — tu agente de contenido",
    investiga: false, slides: 6, cta: "Escríbenos al DM",
    instruccion: "Carrusel sobre Bárbara, la agente de IA que crea y publica el contenido de una marca sola. Parte de un dolor concreto y cotidiano del dueño de negocio y muestra cómo Bárbara lo resuelve. Máximo 3 puntos numerados, cada uno con las horas que ahorra.",
    template: T_BARBARA_PRODUCTO,
  },
  barbara_datos: {
    titulo: "📊 Bárbara — el dato que lo cambia todo",
    investiga: true, slides: 7, cta: "Escríbenos al DM",
    instruccion: "Carrusel sobre el impacto MEDIBLE de usar IA en marketing y ventas, apoyado en estudios REALES encontrados en la búsqueda web (McKinsey, Gartner, HubSpot, Deloitte u otros). Cada cifra tiene que ir con su fuente citada. Incluye una comparación antes/después o con/sin IA.",
    template: T_BARBARA_DATOS,
  },
};

// ── El calendario ───────────────────────────────────────────────────────────
// Lunes es SIEMPRE el noticiero: es la pieza que exige investigación real y
// conviene que salga el mismo día para que la audiencia la espere.
//
// Miércoles y viernes rotan entre las otras TRES series. Son 3 series en 2
// espacios, así que el ciclo se cierra recién a las 3 semanas: ninguna serie
// cae dos veces en la misma semana y ningún par miércoles-viernes se repite
// hasta dar la vuelta entera. Con una serie fija por día, la tercera no
// saldría nunca.
const ROTATIVAS = ["servicios", "barbara_producto", "barbara_datos"];

// Semana ISO. El índice avanza por semana REAL y no por corrida: contando
// corridas, un reintento del mismo día adelantaría la rotación y el viernes
// saldría con la serie que le tocaba a la semana siguiente.
function semanaISO(d = new Date()) {
  const j = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  j.setUTCDate(j.getUTCDate() + 4 - (j.getUTCDay() || 7));
  return Math.ceil(((j - Date.UTC(j.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function serieDeHoy() {
  if (dia === "lunes") return "noticias";
  const slot = dia === "miercoles" ? 0 : 1;
  return ROTATIVAS[(semanaISO() * 2 + slot) % ROTATIVAS.length];
}

// SERIE=... fuerza una serie concreta (para probar una sin esperar su semana).
const serieForzada = (process.env.SERIE || "").trim().toLowerCase();
const claveSerie = SERIES[serieForzada] ? serieForzada : serieDeHoy();
const tema = SERIES[claveSerie];
const N_SLIDES = tema.slides;

// Regla dura anti "titular:/subtítulo:": el modelo tiende a renderizar literalmente
// cualquier palabra estructural del prompt, así que se lo prohibimos explícitamente
// en TODA imagen. Solo debe aparecer el copy final que lee la persona.
const REGLA_TEXTO = `TEXT RULE (critical): the only text rendered in the image must be the final Spanish copy the reader is meant to see, as polished editorial typography. Do NOT render meta words or field labels such as "titular", "título", "subtítulo", "subtitulo", "dato", "texto", "slide", "CTA", "headline", "subtitle" or "caption", and NEVER render a word followed by a colon used as a label. No placeholder labels, no field names on the image.`;

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
      // NO repetir el template acá: genImagen ya lo concatena a este prompt
      // antes de mandarlo. Pedírselo al modelo lo hacía escribirlo 6 o 7 veces
      // y el JSON se pasaba de max_tokens y llegaba cortado a la mitad de una
      // cadena (SyntaxError al parsear). Este campo describe SOLO lo propio
      // del slide.
      prompt: { type: "string", description: `Contenido EN INGLÉS de ESTE slide, breve (máx 60 palabras). NO describas el estilo, los colores ni la tipografía: eso ya lo pone el template. Di solo qué ilustración o ícono va, y el TEXTO EXACTO en español que debe aparecer, como copy FINAL (solo lo que lee la persona). PROHIBIDO que ese texto incluya rótulos ni meta-palabras como 'titular', 'título', 'subtítulo', 'dato', 'texto', 'slide' o 'CTA', ni una palabra seguida de dos puntos como etiqueta. Último slide = CTA con el texto '${tema.cta}'.` },
    }, required: ["titulo", "prompt"] } },
    caption: { type: "string", description: "Caption educativa para Instagram con hook, valor real, invita a seguir + MÁXIMO 5 hashtags (Instagram rechaza la publicación con más de 5). Mezcla IA/negocios/Perú/Chile." },
  },
  required: ["angulo", "slides", "caption"],
};

// ---- Higgsfield: generar imagen y devolver buffer ----
const MAX_PROMPT = 2600;
function genImagen(prompt, idx) {
  // execFileSync (sin shell) para que saltos de línea/comillas del prompt no rompan el comando.
  //
  // El tope subió de 1500 a 2600 el 22-ago-2026, al instalar los templates
  // reales de la marca. Con 1500 el prompt armado (copy del slide + template +
  // REGLA_TEXTO) pasaba de largo y lo que se cortaba era el FINAL — o sea la
  // REGLA_TEXTO entera, que es justo la que impide que el modelo escriba
  // "titular:" dentro de la imagen. Con los templates viejos (~300 chars) nunca
  // se notó; con art-direction de verdad se rompía en cada slide.
  const armado = prompt.replace(/\s+/g, " ").trim();
  if (armado.length > MAX_PROMPT) {
    console.log(`⚠️ slide ${idx + 1}: prompt de ${armado.length} chars, se corta en ${MAX_PROMPT}. Revisa el template.`);
  }
  const safe = armado.slice(0, MAX_PROMPT);
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
      // La fecha de hoy va EXPLÍCITA. Sin ella el modelo no sabe qué es "esta
      // semana" y devuelve noticias de hace meses como si fueran de ayer: el
      // 22-ago-2026 armó un noticiero "de esta semana" con el anuncio de los
      // agentes de WhatsApp, que es real pero del 3 de junio, y le puso fechas
      // de julio que no existen. Además ahora se exige URL y fecha de
      // publicación por noticia, para que lo no verificable se pueda descartar
      // en vez de llegar al diseño ya convertido en titular.
      const hoyTxt = new Date().toISOString().slice(0, 10);
      const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const r = await claude({
        model: "claude-sonnet-5", max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        messages: [{ role: "user", content: `Hoy es ${hoyTxt}. Investiga datos ACTUALES y reales para: ${tema.instruccion}\n\nREGLAS DE LA INVESTIGACIÓN:\n- Solo sirve lo publicado entre ${desde} y ${hoyTxt}. Si una noticia es anterior, DESCÁRTALA aunque sea importante.\n- Por cada hallazgo escribe: titular, cifra exacta, medio, FECHA DE PUBLICACIÓN y URL.\n- Si no encuentras la fecha o la URL, no lo incluyas.\n- NO completes ni redondees cifras de memoria: si el dato no está en la fuente, dilo.\n- Si en la semana no hubo suficientes noticias, dilo explícitamente en vez de rellenar.` }],
      });
      research = textOf(r);
    } catch (e) { console.log("research falló:", String(e).slice(0, 120)); }
  }

  // 2) Memoria: últimas 15 piezas para NO repetir
  const log = leerLog();
  const recientes = log.slice(-15).map(e => `- [${e.fecha} ${e.serie || e.tipo}] ${e.angulo}`).join("\n") || "(sin historial)";

  // 3) Director (lee memoria, innova)
  const extra = isRetry ? "\n\n⚠️ ESTE ES UN REINTENTO: el contenido anterior fue rechazado por el equipo. Genera una versión CLARAMENTE MEJOR y distinta (mejor diseño, mejor texto, otro enfoque del mismo tema)." : "";
  const dir = await claude({
    model: "claude-sonnet-5", max_tokens: 8000,
    system: `Eres Barbara, directora creativa de condor.ai. Diseñas carruseles de Instagram (${N_SLIDES} slides) de nivel agencia, educativos y que hacen seguir la cuenta. Sigues EXACTAMENTE el template del día. Incluyes el texto exacto a renderizar en cada slide COMO COPY FINAL: en la imagen SOLO aparece lo que lee la persona, JAMÁS palabras estructurales como "titular", "subtítulo", "título", "dato", "texto", "slide" o "CTA", ni rótulos con dos puntos. NUNCA repites ángulos, protagonistas ni textos de las piezas recientes (te las paso). Innova siempre.

REGLA DE VERACIDAD (no negociable): cada cifra, fecha, medio y hecho que pongas en un slide tiene que salir TAL CUAL de la investigación que te paso. Está PROHIBIDO inventar o estimar una estadística, atribuirle algo a un medio real (Bloomberg, Microsoft, Meta, Google, McKinsey…) que no venga en la investigación, o ponerle a una noticia una fecha que no sea la de su publicación real. Esto se publica en la cuenta real de una empresa: un dato inventado con el logo encima es un problema de verdad. Si la investigación no alcanza, haz un carrusel más corto o de ángulo más general — nunca lo rellenes.

Responde SOLO con el JSON.`,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: `Tipo de hoy (${dia}): ${tema.instruccion}\n\nTEMPLATE OBLIGATORIO:\n${tema.template}\n\nPIEZAS RECIENTES (NO repitas estos ángulos, innova):\n${recientes}\n${research ? "\nInvestigación web:\n" + research : ""}${extra}\n\nCrea el carrusel de ${N_SLIDES} slides con un ángulo NUEVO.` }],
  });
  // Si el modelo se queda sin tokens, el JSON llega cortado y JSON.parse tira
  // un "Unterminated string in JSON at position N" que no dice nada de la
  // causa real. Se traduce a un mensaje que sí, porque el arreglo es subir
  // max_tokens o acortar el template, no mirar el carácter 2884.
  const crudo = textOf(dir);
  let plan;
  try {
    plan = JSON.parse(crudo);
  } catch (e) {
    const corte = dir.stop_reason === "max_tokens";
    throw new Error(
      (corte ? "El director se quedó sin tokens y el JSON llegó cortado. Sube max_tokens o acorta el template. " : "El director devolvió un JSON inválido. ") +
      `(${crudo.length} chars, stop_reason=${dir.stop_reason}): ` + String(e).slice(0, 120)
    );
  }
  const slides = (plan.slides || []).slice(0, N_SLIDES);

  // 4) Imágenes con Higgsfield
  const imgs = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      // El contador va DICTADO, no insinuado. Dejándoselo al modelo salieron
      // "01", "01 / 05", "3/5", "05" y "04/10" en un mismo carrusel de 6: un
      // modelo de imagen no sabe en qué slide va ni cuántos hay.
      const contador = `\n\nSLIDE COUNTER: render exactly the text "${i + 1}/${slides.length}" in the top-right corner, nothing else there. Do not invent a different number or format.`;
      const url = genImagen(REGLA_TEXTO + "\n\n" + tema.template + contador + "\n\n" + slides[i].prompt, i);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      imgs.push(buf);
    } catch (e) {
      if (e.permanent) throw e; // config/auth: no tiene sentido seguir con los demás slides
      console.log("slide", i + 1, "falló:", String(e).slice(0, 140));
    }
  }
  if (!imgs.length) throw new Error("No se generó ninguna imagen");

  // 5) Guardar exactamente la pieza revisada como artefacto privado de GitHub.
  // La publicación posterior usa estas mismas imágenes; nunca regenera contenido al aprobar.
  const runId = process.env.GITHUB_RUN_ID || "local";
  if (OUTBOX) {
    mkdirSync(OUTBOX, { recursive: true });
    const files = imgs.map((buf, i) => {
      const nombre = `slide-${String(i + 1).padStart(2, "0")}.png`;
      writeFileSync(`${OUTBOX}/${nombre}`, buf);
      return nombre;
    });
    writeFileSync(`${OUTBOX}/manifest.json`, JSON.stringify({
      version: 1,
      runId,
      generatedAt: new Date().toISOString(),
      type: "carousel",
      platform: "instagram",
      caption: plan.caption || "",
      angle: plan.angulo || "",
      files,
    }, null, 2) + "\n");
  }

  // 6) Enviar a Telegram
  for (let i = 0; i < imgs.length; i++) {
    const fd = new FormData();
    fd.append("chat_id", CHAT);
    fd.append("caption", `${tema.titulo} · slide ${i + 1}/${imgs.length}`);
    fd.append("photo", new Blob([imgs[i]], { type: "image/png" }), `slide_${i + 1}.png`);
    const j = await (await tg("sendPhoto", fd, true)).json();
    if (!j.ok) throw new Error("Telegram sendPhoto: " + (j.description || ""));
  }
  // El mensaje de revisión lleva TODO lo necesario para decidir sin abrir el
  // repo: la caption tal cual se va a publicar, el ángulo (para saber si
  // repite algo), y las palancas exactas para rehacerlo o corregir una cosa
  // puntual. Antes decía solo "Denuevo barbara", y cualquier arreglo fino
  // obligaba a pedírselo a alguien que supiera dónde tocar.
  const comoCorregir = [
    "🔁 *Para rehacerlo o corregir*",
    "• Rehacer entero: escribe *Denuevo barbara*",
    "• Aprobar y publicar: escribe *Aprobar barbara*",
    "",
    "Para algo puntual, corre el workflow _Barbara_ a mano con:",
    "• `SERIE=" + claveSerie + "` — repite esta misma serie",
    "• `SERIE=noticias|servicios|barbara_producto|barbara_datos` — cambia de serie",
    "• `DIA=lunes|miercoles|viernes` — fuerza el día",
    "• `RETRY=1` — salta el candado de 1 pieza por día",
    "",
    "El diseño de cada serie vive en `services/barbara/barbara.mjs`, en la constante `T_" + claveSerie.toUpperCase() + "`. Ahí se cambian colores, tipografía y retícula — el contenido no se toca, lo escribe Bárbara cada vez.",
  ].join("\n");

  await tg("sendMessage", {
    chat_id: CHAT,
    text: `🤖 *Barbara* — ${tema.titulo}\n` +
          `Serie: \`${claveSerie}\` · ${imgs.length} slides · ID: \`${runId}\`\n` +
          `🎯 Ángulo: _${plan.angulo || "—"}_\n\n` +
          `📝 *Caption:*\n\n${plan.caption || ""}\n\n${comoCorregir}`,
    parse_mode: "Markdown",
  });

  // 7) Registrar en memoria (anti-repetición + artefacto aprobable)
  guardarEnLog({ fecha: new Date().toISOString().slice(0, 10), tipo: dia, serie: claveSerie, angulo: plan.angulo || slides[0]?.titulo || "", titulo: tema.titulo, runId });
  console.log("OK", dia, "|", claveSerie, "| ángulo:", plan.angulo);
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("sendMessage", { chat_id: CHAT, text: "⚠️ Barbara falló (" + dia + "): " + String(e).slice(0, 300) }); } catch {}
  process.exit(1);
});
