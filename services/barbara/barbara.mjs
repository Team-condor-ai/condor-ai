// condor.ai · Empleada IA "Barbara" — 4 piezas por semana (GitHub Actions)
// Lun = carrusel de Cóndor · Mar = anuncio de Cóndor (imagen única)
// Jue = carrusel de Bárbara · Vie = anuncio de Bárbara (imagen única)
// Cada marca alterna entre sus DOS templates por semana ISO, así los cuatro
// templates de carrusel se turnan sin repetirse dos semanas seguidas.
// Imágenes con HIGGSFIELD (nano_banana_2). Memoria anti-repetición en content-log.json:
// el director lee lo último creado y recibe la orden de NO repetir e INNOVAR.
// Manda a Telegram para revisar antes de subir.
//
// Secrets: ANTHROPIC_API_KEY, HIGGSFIELD_ACCESS_TOKEN, HIGGSFIELD_REFRESH_TOKEN,
//          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Variables: DIA (lunes|martes|jueves|viernes|test) · RETRY=1 (reintento del comando "Denuevo barbara")

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { pegarLogoCondor, pegarPersonajeBarbara, supabase } from "./motor.mjs";
import { elegirAngulo } from "./angulos.mjs";
import { apiDisponible, generarImagen as apiImagen } from "./higgsfield-api.mjs";
import { playbooksPara, bloquePrompt as bloquePlaybooks } from "./playbooks.mjs";
import { extraerCambios, instrucciones } from "./correccion.mjs";
import { leerReglas, bloquePrompt as bloqueReglas, aprenderDeCorreccion } from "./reglas.mjs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const isTest = (process.env.DIA || "").trim().toLowerCase() === "test" || process.env.TEST === "1";
const isRetry = process.env.RETRY === "1";
// Lo que el equipo escribio despues de "Denuevo barbara" en Telegram.
const CORRECCION = (process.env.CORRECCION || "").trim();

const LOG = "services/barbara/content-log.json";
const OUTBOX = process.env.BARBARA_OUTBOX_DIR;

// Día → tipo
const rawDia = (process.env.DIA || "").trim().toLowerCase();
let dia = rawDia;
if (!["lunes", "martes", "jueves", "viernes"].includes(dia)) {
  // 1=Lun 2=Mar 4=Jue 5=Vie — los 4 dias del calendario nuevo.
  const wd = new Date().getUTCDay();
  dia = { 1: "lunes", 2: "martes", 4: "jueves", 5: "viernes" }[wd] || "lunes";
}

// ── Piezas de marca compartidas ─────────────────────────────────────────────
// Los hex van LITERALES en el prompt a propósito. Pedirle "verde lima" a un
// modelo de imagen devuelve un verde distinto en cada slide y el carrusel se
// nota cosido de retazos; con el hex escrito, el color se sostiene de la
// portada al cierre. Salen del logo y de los 4 carruseles que aprobó Joaquín
// el 22-ago-2026.
const GRADIENTE = "the condor.ai brand gradient: royal blue #1B4DE4 into violet #7B2FBF into crimson #E8203A";
const LIMA = "#BCD530";

// El template ya NO le pide al modelo que dibuje el logo — solo que deje el
// espacio limpio. El archivo real se pega encima después, en genImagen
// (ver pegarLogoCondor en motor.mjs) y por eso acá no se menciona ni el
// colibrí ni la palabra "condor.ai": describirlo es lo que hacía que el
// modelo lo redibujara de memoria, distinto cada vez.
// "solid-colour safe zone" (la redacción anterior) hizo que el modelo
// dibujara una CAJA real ahí — un rectángulo gris apenas distinto del negro
// puro alrededor, visible en las 4 slides de la corrida de verificación del
// 22-ago-2026. La instrucción tiene que decir lo contrario: seguir exactamente
// igual que el resto del fondo, sin ningún borde ni panel que delate dónde
// va a pegarse el logo.
const ZONA_LOGO_IZQ = "Top-left corner, about one-tenth of the frame's width and height: this area must look EXACTLY like the rest of the background — same colour, same texture, same gradient, continuous with everything around it. Do NOT draw a box, card, panel, chip or any shape there, and do NOT place any text or icon there either. A real logo file gets placed on top of this untouched background afterward — any visible rectangle or colour shift there is a mistake.";
const ZONA_LOGO_CENTRO = "Top area, centred, about one-third of the frame's width and one-tenth of its height: this area must look EXACTLY like the rest of the background — same colour, same texture, same gradient, continuous with everything around it. Do NOT draw a box, card, panel, chip or any shape there, and do NOT place any text or icon there either. A real logo file gets placed on top of this untouched background afterward — any visible rectangle or colour shift there is a mistake.";

// El personaje "Bárbara" — la mascota, no el logo. Pedido de Joaquín el
// 22-ago-2026, a partir de 3 renders que mandó como referencia (mismo trío
// de color que ya usan estas dos series: negro, crema #F5F1E8, lima
// ${LIMA}). Va SOLO en las series que son literalmente sobre Bárbara — la
// referencia aprobada de noticias/servicios nunca la mostró, y meterla ahí
// contradiría ese diseño ya aprobado.
//
// Ya NO se le pide al modelo que dibuje a Bárbara — sólo que deje el espacio
// limpio. El archivo real se pega encima después (ver pegarPersonajeBarbara en
// motor.mjs). Es el mismo camino que el logo: describirla es justo lo que hacía
// que saliera distinta —y con la piel tostada— en cada slide.
//
// La redacción evita a propósito la palabra "espacio limpio" a secas: con el
// logo, "solid-colour safe zone" hizo que el modelo dibujara una CAJA real ahí.
// Por eso se insiste en continuidad exacta con el fondo y se prohíbe cualquier
// forma.
const PERSONAJE_BARBARA = `IMPORTANT — reserved circular area: leave a perfectly EMPTY circular region centred in the middle of the frame, about 30% of the frame's width. That circle must look EXACTLY like the rest of the background — same colour, same texture, same gradient, perfectly continuous with everything around it. Do NOT draw a circle, ring, badge, card, panel or any shape there. Do NOT draw a person, character, mascot, face, avatar or portrait anywhere in this slide. Do NOT place text or icons in that central area. A real character illustration gets composited on top of that untouched background afterward — any visible circle, outline or colour shift there is a mistake. Compose the rest of the slide (headline, stats, footer) so nothing important falls inside that central circle.`;

const SIN_PERSONAJE = "Do NOT include Bárbara, any illustrated character, mascot or human figure anywhere in this slide — icons and typography only.";

// ── QUÉ ES BÁRBARA (y qué NO es) ───────────────────────────────────────────
//
// El 23-ago-2026 se publicó un carrusel entero sobre detectar clientes a punto
// de irse y actuar antes de que cancelen. Nada de eso lo hace Bárbara: es un
// agente que crea y publica contenido visual, y punto. No sigue leads, no
// mide churn, no responde comentarios ni mensajes.
//
// El problema no fue que el dato estuviera mal — fue vender una capacidad que
// el producto no tiene, en la cuenta de la propia agencia. Un cliente que
// llega por ese carrusel llega esperando otra cosa.
const QUE_ES_BARBARA = `QUÉ ES BÁRBARA (límite duro, no negociable):
Bárbara es un agente de IA que CREA Y PUBLICA CONTENIDO VISUAL para la marca —
carruseles, historias y videos— con la identidad del cliente y sin que nadie
tenga que sentarse a diseñarlos.

Eso es TODO lo que hace hoy. Está PROHIBIDO insinuar, ilustrar o afirmar que
Bárbara:
  · hace seguimiento de leads, prospectos o clientes;
  · detecta o predice quién se va a ir (churn), ni retiene clientes;
  · responde comentarios, DMs, correos o mensajes de WhatsApp;
  · atiende clientes, vende, cotiza o agenda;
  · analiza campañas, mide resultados o gestiona pauta.

Si el ángulo del día necesita alguna de esas capacidades para funcionar, el
ángulo está mal: cambia de ángulo y quédate en lo que Bárbara sí hace. Esto se
publica en la cuenta de la propia agencia; prometer lo que el producto no hace
es el peor lugar donde equivocarse.`;

// ── La portada ─────────────────────────────────────────────────────────────
//
// La del 23-ago traía titular de dos líneas, subtítulo, el personaje, un
// cuadro comparativo VS y DOS cajas de estadísticas. Nadie desliza después de
// eso: la portada ya contó todo y encima no se lee en el feed.
//
// La portada tiene UN trabajo: que la persona deslice. Va dictada, no sugerida.
const PORTADA = `THIS IS THE COVER (slide 1). Its ONLY job is to make the reader swipe.

Compose it with EXACTLY three things and nothing else:
  1. ONE headline, very large — it must fill roughly the top third of the frame
     and be readable on a phone at a glance. Maximum 7 words.
  2. ONE short supporting line under it. Maximum 10 words.
  3. The reserved circular area for the Bárbara illustration.

FORBIDDEN on the cover: statistics boxes, percentage figures, comparison or
"VS" panels, bullet lists, numbered badges, source lines, multiple paragraphs,
or any second block of body text. If the idea needs a number to land, the
number goes on slide 2, not here.

Leave generous empty space. A cover that looks empty next to the other slides
is CORRECT — that contrast is what makes the headline hit.`;

// ── Texto dentro de la imagen ──────────────────────────────────────────────
//
// En el carrusel del 23-ago los encabezados de una tabla salieron como "Espar
// añados" y "Endor cliente": palabras que no existen. El modelo de imagen no
// escribe, DIBUJA texto — y cuando el prompt no le dicta la cadena exacta,
// inventa formas que parecen letras. Cuanto más texto y más chico, peor.
const REGLA_ORTOGRAFIA = `SPELLING (critical): every word rendered in the image must be a correctly spelled, real Spanish word, exactly as given to you. Do NOT invent, abbreviate, split or merge words, and do NOT render placeholder-looking text. If a label, table header or column title appears in the design, its exact wording must come from the copy provided — never improvised. Prefer FEWER words at a LARGER size: small dense text is where misspellings appear.`;

// ── Los 4 templates ─────────────────────────────────────────────────────────
// Describen SOLO el diseño: retícula, paleta, tipografía y ritmo. El contenido
// lo inventa Bárbara cada vez y nunca se repite — de eso ya se encarga
// content-log.json, que le pasa los últimos 15 ángulos con la orden de
// innovar. Mantener el patrón visual y cambiar el fondo es justo lo que hace
// que una cuenta se vea como una cuenta y no como piezas sueltas.

const T_NOTICIAS = `Editorial tech-news slide, 4:5. Background near-white #F7F7F8 with one soft out-of-focus bloom of blue and pink in a single corner. ${ZONA_LOGO_IZQ} Top-right: the slide counter in bold black. Layout is LEFT-ALIGNED with a wide empty right column. Above the headline, one rounded-square app-icon tile in flat solid blue #1B4DE4 or violet #7B2FBF or crimson #E8203A, with a thin white line icon centred inside. Headline in very heavy grotesque sans, near-black #0A0A0A, tight leading, three or four short lines, with one or two key words filled with the same gradient. Under the headline a short horizontal rule in that gradient. Below it two or three lines of small grey body text. In the empty right column, one floating 3D isometric render or thin-line illustration in blue-violet tones, soft drop shadow, lots of white space around it. Optionally one very large statistic set in the gradient at bottom-left with its explanation beside it. Premium, calm, airy. NO clip-art, NO stock-photo people.`;

const T_SERVICIOS = `Centred agency statement slide, 4:5. Background near-white #F7F7F8 with one soft blue-to-pink gradient bloom bleeding in from a corner. ${ZONA_LOGO_CENTRO} Top-right corner: the slide counter in bold black. EVERYTHING IS CENTRE-ALIGNED on one vertical axis. A very large headline in heavy grotesque sans, near-black #0A0A0A, tight leading, filling the middle of the frame, with one whole phrase filled in the same gradient. Optionally one simple thin-line icon centred above the headline drawn in the gradient (a circle, a coin, two chat bubbles) and never more than one. Under the headline two or three centred lines of medium-grey supporting copy at much smaller size. At the very bottom a short centred horizontal rule in the gradient. Enormous breathing room, symmetric margins, poster-like calm. NO photos, NO people, NO clip-art, NO cards or boxes.`;

const T_BARBARA_PRODUCTO = `Dark editorial slide, 4:5. Background PURE BLACK #000000 edge to edge. ${ZONA_LOGO_IZQ} Top-right: the slide counter in lime ${LIMA}. Headline set in a high-contrast DISPLAY SERIF with Scotch or Didone flavour, cream #F5F1E8, with the emphasised words in lime ${LIMA}. When the slide is a numbered point, place a small rounded-square OUTLINE badge stroked in lime, holding the number in lime, centred above the headline. In the middle of the frame, one large thin-line icon drawn in lime strokes on the black — a speech bubble, a descending bar chart, a target with an arrow, a calendar, a pencil — line art only, never filled, never another colour. At the bottom, a wide rounded-rectangle OUTLINE stroked in lime holding a small lime line icon at the left and two lines of white sans-serif text, with the number or key phrase in lime bold. Confident, high contrast, generous negative space. NO photos, NO background gradients, NO colour other than black, cream and lime.`;

const T_BARBARA_DATOS = `Data-driven editorial slide, 4:5, same brand family as the dark Barbara series but on alternating grounds: this slide is EITHER pure black #000000 with cream #F5F1E8 text, OR warm cream #F2EFE6 with near-black text and olive accents — pick one and commit to it, never split the frame. Top-left: a SOLID rounded-square badge filled lime ${LIMA} with the number in black inside it. Headline in a high-contrast DISPLAY SERIF with the emphasised half in lime ${LIMA}, or in deeper olive #8FA524 when the ground is cream so it stays readable. Under it a short lime rule. Body copy in a geometric sans. For statistics, stack two or three wide rounded-rectangle OUTLINE cards, each with a thin-line icon at the left, one very large lime percentage, and a two-line label beside it. For comparisons, draw a bordered two-column panel with a circled-cross list on the left and a circled-check list on the right, split by a vertical rule with a small circled "VS" on it. Optionally one simple two-bar chart, grey against lime, labelled underneath. Bottom-left, a small grey source line. Editorial, dense but ordered. NO photos, NO clip-art.`;

// ── Los 2 templates de imagen única (formato anuncio) ──────────────────────
//
// Pedido de Joaquín el 23-ago-2026: además de los carruseles, dos piezas
// semanales de UNA sola imagen, con lógica de anuncio — un titular grande que
// haga pensar y una invitación al DM. Poco texto, mucho aire.
//
// La diferencia con la portada de un carrusel no es cosmética: una portada
// invita a DESLIZAR y deja la respuesta adentro; un anuncio tiene que cerrar
// solo, porque no hay slide 2. Por eso acá sí va el CTA en la misma pieza.

const T_AD_CONDOR = `Single bold advertising image, 4:5 — this is a standalone ad, not a carousel cover. Background PURE BLACK #000000, or near-white #F7F7F8 with one soft blue-to-pink gradient bloom bleeding from a corner — pick one and commit. ${ZONA_LOGO_IZQ}

Composition, top to bottom, and NOTHING else:
· ONE enormous headline filling the upper half of the frame, in very heavy grotesque sans, tight leading, 2 or 3 short lines. On black it is cream #F5F1E8; on the light ground it is near-black #0A0A0A. ONE key phrase inside it is filled with ${GRADIENTE}.
· A short horizontal rule in that gradient.
· ONE line of supporting copy in medium grey at much smaller size — the invitation.
· At the bottom, a wide rounded-rectangle button OUTLINE stroked in the gradient, holding the call to action in bold.

Optionally ONE large thin-line icon or a single floating 3D isometric render in blue-violet tones, off to one side, with lots of empty space around it. NEVER more than one visual element.

FORBIDDEN: statistics, percentages, bullet lists, comparison panels, slide counters, source lines, photos, stock-photo people, clip-art. Enormous breathing room — this has to read from a thumbnail.`;

const T_AD_BARBARA = `Single bold advertising image, 4:5 — this is a standalone ad, not a carousel cover. Background PURE BLACK #000000 edge to edge. ${ZONA_LOGO_IZQ}

Composition, top to bottom, and NOTHING else:
· ONE enormous headline filling the upper half of the frame, set in a high-contrast DISPLAY SERIF with Scotch or Didone flavour, cream #F5F1E8, tight leading, 2 or 3 short lines, with the emphasised words in lime ${LIMA}.
· A short lime rule under it.
· ONE line of supporting copy in white geometric sans at much smaller size — the invitation.
· At the bottom, a wide rounded-rectangle button OUTLINE stroked in lime holding the call to action in lime bold.

FORBIDDEN: statistics, percentages, bullet lists, comparison panels, numbered badges, slide counters, source lines, photos, clip-art, any colour beyond black, cream and lime. Enormous breathing room — this has to read from a thumbnail.`;

const SERIES = {
  ad_condor: {
    titulo: "📣 Cóndor — anuncio",
    investiga: false, slides: 1, cta: "Escríbenos al DM",
    instruccion: "UNA sola imagen tipo anuncio de Cóndor AI (agentes de IA, automatización, páginas web, campañas). " +
      "Un titular corto que interpele al dueño de negocio y lo haga pensar, del estilo de " +
      "\"La IA ya despegó. ¿Y tú, te quedas en tierra?\", y debajo una invitación clara del tipo " +
      "\"Escríbenos al DM y te ayudamos a implementar IA en tu empresa\". " +
      "El titular NO explica: provoca. Nada de cifras ni listas.",
    template: T_AD_CONDOR, logo: "izquierda",
  },
  ad_barbara: {
    titulo: "📣 Bárbara — anuncio",
    investiga: false, slides: 1, cta: "Escríbenos al DM",
    instruccion: "UNA sola imagen tipo anuncio de Bárbara, la agente de IA que crea y publica el contenido " +
      "de una marca. Un titular corto y concreto que muestre cuánto trabajo se ahorra, del estilo de " +
      "\"Bárbara hace en un día lo que 3 community managers\", y debajo una invitación del tipo " +
      "\"Escríbenos al DM y la instalamos para ti\". " +
      "Habla del trabajo que deja de hacerse, no de la tecnología. Nada de cifras inventadas.",
    template: T_AD_BARBARA, logo: "izquierda", personaje: true,
  },
  noticias: {
    titulo: "📰 Noticiero IA — la semana en IA",
    investiga: true, slides: 6, cta: "Síguenos para más",
    instruccion: "Investiga exactamente 7 noticias de IA de los últimos 7 días (reales, de la búsqueda web), contrasta su vigencia y arma un NOTICIERO con las 3-4 más importantes, explicadas para un dueño de negocio latinoamericano. Cada noticia necesita una cifra concreta y una línea de qué significa para su negocio. Nombra la fuente en el slide.",
    template: T_NOTICIAS, logo: "izquierda",
  },
  servicios: {
    titulo: "🚀 Servicios Cóndor — agentes de IA",
    investiga: false, slides: 6, cta: "Escríbenos al DM",
    instruccion: "Carrusel de venta de los servicios de Cóndor AI (agentes de IA, automatización de procesos, páginas web, campañas). UN solo argumento por slide, nada de listas de características. Habla del costo de no automatizar, no de la tecnología.",
    template: T_SERVICIOS, logo: "centro",
  },
  barbara_producto: {
    titulo: "🎀 Bárbara — tu agente de contenido",
    investiga: false, slides: 6, cta: "Escríbenos al DM",
    instruccion: "Carrusel sobre Bárbara, la agente de IA que crea y publica el contenido de una marca sola. Parte de un dolor concreto y cotidiano del dueño de negocio y muestra cómo Bárbara lo resuelve. Máximo 3 puntos numerados, cada uno con las horas que ahorra.",
    template: T_BARBARA_PRODUCTO, logo: "izquierda", personaje: true,
  },
  barbara_datos: {
    titulo: "📊 Bárbara — el dato que lo cambia todo",
    investiga: true, slides: 7, cta: "Escríbenos al DM",
    instruccion: "Carrusel sobre el impacto MEDIBLE de usar IA en marketing y ventas, apoyado en estudios REALES encontrados en la búsqueda web (McKinsey, Gartner, HubSpot, Deloitte u otros). Cada cifra tiene que ir con su fuente citada. Incluye una comparación antes/después o con/sin IA.",
    template: T_BARBARA_DATOS, logo: null, personaje: true, // el logo no va (ver arriba); el personaje sí, es una serie de Bárbara
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

// ── El calendario NUEVO (23-ago-2026) ──────────────────────────────────────
//
// Joaquín lo redefinió: 4 piezas por semana, dos de cada marca.
//
//   Lunes     · carrusel de CÓNDOR   (noticias ↔ servicios)
//   Martes    · anuncio de CÓNDOR    (imagen única)
//   Jueves    · carrusel de BÁRBARA  (barbara_producto ↔ barbara_datos)
//   Viernes   · anuncio de BÁRBARA   (imagen única)
//
// Cada marca alterna entre SUS DOS templates por semana ISO, así los cuatro
// templates de carrusel se turnan sin que ninguno se repita dos semanas
// seguidas — que es lo que se pidió.
const CARRUSELES_CONDOR = ["noticias", "servicios"];
const CARRUSELES_BARBARA = ["barbara_producto", "barbara_datos"];

const CALENDARIO = {
  lunes: () => CARRUSELES_CONDOR[semanaISO() % 2],
  martes: () => "ad_condor",
  jueves: () => CARRUSELES_BARBARA[semanaISO() % 2],
  viernes: () => "ad_barbara",
};

// Semana ISO. El índice avanza por semana REAL y no por corrida: contando
// corridas, un reintento del mismo día adelantaría la rotación y el viernes
// saldría con la serie que le tocaba a la semana siguiente.
function semanaISO(d = new Date()) {
  const j = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  j.setUTCDate(j.getUTCDate() + 4 - (j.getUTCDay() || 7));
  return Math.ceil(((j - Date.UTC(j.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function serieDeHoy() {
  const elegir = CALENDARIO[dia];
  if (elegir) return elegir();
  // Día fuera del calendario (una corrida a mano un miércoles, por ejemplo):
  // se cae al carrusel de Cóndor que toque, que es la pieza más neutra.
  return CARRUSELES_CONDOR[semanaISO() % 2];
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

// Cuántas entradas guardan el PLAN completo (los slides, no sólo el ángulo).
// Sin el plan no se puede corregir: hay que saber qué decía el titular del
// slide 2 para poder acortarlo. Pero guardarlo en las 100 entradas infla el
// archivo sin que nadie lo lea — una corrección siempre es sobre la última.
const CON_CONTENIDO = 3;

function guardarEnLog(entry) {
  const log = leerLog();
  log.push(entry);
  const recortado = log.slice(-100);
  // Se despoja el plan de todas menos las últimas, en el momento de escribir.
  for (let i = 0; i < recortado.length - CON_CONTENIDO; i++) delete recortado[i].contenido;
  writeFileSync(LOG, JSON.stringify(recortado, null, 2) + "\n");
}

/** La última pieza del mismo tipo, con su plan, para poder corregirla. */
function piezaAnteriorLocal(tipoActual) {
  const log = leerLog();
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].contenido && log[i].tipo === tipoActual) return log[i];
  }
  // Si no hay del mismo tipo, sirve la última con contenido: el equipo pudo
  // haber forzado otra serie a mano y aun así querer corregir esa.
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].contenido) return log[i];
  }
  return null;
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
    // Corregido 22-ago-2026: la primera caption real salió como UN párrafo
    // corrido — Joaquín la aprobó igual porque el carrusel estaba bueno, pero
    // marcó que a la próxima tiene que venir estructurada. Se dicta el
    // formato explícito en vez de confiar en "hazla atractiva".
    caption: { type: "string", description: `Caption para Instagram, con SALTOS DE LÍNEA reales entre bloques (usa "\\n\\n" en el JSON) — NUNCA un solo párrafo corrido:
1. Gancho de 1-2 líneas cortas que para el scroll. Con 1-2 emojis, no más.
2. Un salto de línea, y el cuerpo en 2-4 líneas CORTAS (no una muralla de texto) — puede llevar una pregunta al lector.
3. Un salto de línea, y el cierre: qué hace condor.ai + invitación a seguir/DM.
4. Un salto de línea final y MÁXIMO 5 hashtags en una sola línea (Instagram rechaza la publicación con más de 5). Mezcla IA/negocios/Perú/Chile.
Objetivo: que se lea fácil en el feed del celular sin tener que abrir "ver más", con aire entre los bloques.` },
  },
  required: ["angulo", "slides", "caption"],
};

// ---- Higgsfield: generar imagen y devolver buffer ----
// Subido de 2600 a 3600 el 22-ago-2026: PERSONAJE_BARBARA agrega ~1000 chars
// más en las slides que la llevan, y con T_BARBARA_DATOS (el template más
// largo) el total worst-case pasaba los 2600 — mismo bug que ya se vio una
// vez con REGLA_TEXTO: lo que se corta es el FINAL del prompt armado, que es
// justo el contenido específico del slide.
// 23-ago: subido de 3600 a 4400 al agregar PORTADA y REGLA_ORTOGRAFIA. El
// peor caso (portada + personaje + T_BARBARA_DATOS) da 3758 y se pasaba por
// 172 — la TERCERA vez que alargar una constante desborda este tope en
// silencio. Se dejan ~640 de holgura, y la cuenta se verifica antes de
// commitear cualquier constante nueva.
const MAX_PROMPT = 4400;
async function genImagen(prompt, idx) {
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

  // API oficial si está configurada. Es el arreglo de raíz al problema que
  // dejó a Bárbara muda el 29-jun, el 22-ago y el 23-ago: el CLI se autentica
  // con OAuth (token que caduca + refresh que rota), y cada vez que la cadena
  // se corta hay que volver a loguearse por navegador. Las credenciales de la
  // API son estáticas. Ver higgsfield-api.mjs.
  if (apiDisponible()) return apiImagen(safe, { aspectRatio: "4:5", formato: "png" });

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

  // 2b) ÁNGULO: se elige ANTES de generar, con un juez semántico aparte.
  //
  // La línea "no repitas, acá van las últimas 15" que ya iba en el prompt del
  // director se queda (sirve de contexto), pero no puede ser la única defensa:
  // es el propio generador auto-vigilándose, y la ventana de 15 piezas se
  // agota en cinco semanas a 3 carruseles por semana. Acá se compara contra
  // el historial LARGO y con una llamada cuyo único trabajo es comparar.
  // Ver el encabezado de angulos.mjs.
  //
  // `claude` acá es (body) => …, y angulos.mjs espera (apiKey, body) porque
  // motor.mjs lo expone así. El adaptador evita tocar ninguna de las dos.
  // En una CORRECCION dirigida no se elige angulo nuevo: el equipo pidio
  // arreglar algo puntual de ESA pieza, y cambiarle el angulo seria
  // exactamente el "rehacer en vez de corregir" que esto vino a resolver.
  const esCorreccionDirigida = isRetry && Boolean(CORRECCION);
  const historial = log.map(e => e.angulo).filter(Boolean).slice(-80);
  let anguloElegido = null, avisoAngulo = "";

  if (esCorreccionDirigida) {
    console.log("corrección dirigida: se mantiene el ángulo de la pieza anterior");
  } else {
    try {
      const eleccion = await elegirAngulo((_k, body) => claude(body), AK, {
        instruccion: tema.instruccion, research, historial,
      });
      anguloElegido = eleccion.angulo;
      for (const d of eleccion.descartes) console.log(`ángulo descartado: se parecía a "${d.se_parece_a}" (${d.razon})`);
      if (eleccion.agotado) {
        // No se aborta: quedarse sin publicar es peor que publicar algo parecido.
        // Pero el equipo tiene que enterarse, porque agotarse dos veces seguidas
        // significa que la serie ya dio lo que tenía para dar.
        avisoAngulo = "\n\n⚠️ *Ojo*: el juez de repetición descartó todos los ángulos propuestos. Se publicó el mejor disponible, pero esta serie está quedándose sin terreno nuevo.";
        console.log("⚠️ ángulos agotados tras los reintentos — se sigue con el mejor disponible");
      }
      if (anguloElegido) console.log("ángulo elegido:", anguloElegido.angulo);
    } catch (e) {
      // Si el juez falla (red, JSON raro), se sigue con el comportamiento viejo:
      // el director elige el ángulo solo. Peor, pero publicable.
      console.log("elección de ángulo falló, sigo sin ella:", String(e).slice(0, 140));
    }
  }

  // 2c) MEMORIA FUNDACIONAL. Hasta acá la cuenta propia de Cóndor era el caso
  // "en casa de herrero, cuchillo de palo": los clientes tenían tres capas de
  // memoria y Cóndor sólo un content-log.json local.
  //
  // Es OPCIONAL a propósito: si el workflow no trae los secrets de Supabase,
  // barbara.mjs sigue corriendo igual que siempre. Este script publica en la
  // cuenta real tres veces por semana y no puede caerse por una tabla.
  let playbooks = "";
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = supabase(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      playbooks = bloquePlaybooks(await playbooksPara(db, { tipo: "carrusel" }));
    } catch (e) {
      console.log("playbooks no disponibles, sigo sin ellos:", String(e).slice(0, 120));
    }
  }

  // 2d) CORRECCIÓN DIRIGIDA. Si el equipo escribió "Denuevo barbara, <qué
  // arreglar>", se corrige ESO y se deja el resto igual — en vez de rehacer la
  // pieza entera y esperar que salga mejor de casualidad. Es el mismo salto
  // que correccion.mjs ya había dado para los clientes; la cuenta propia de
  // Cóndor se había quedado atrás.
  let previaLocal = null, cambios = [];
  if (isRetry && CORRECCION) {
    try {
      previaLocal = piezaAnteriorLocal(dia);
      const r = await extraerCambios(AK, [CORRECCION], previaLocal);
      cambios = r.cambios || [];
      console.log(`corrección pedida: ${cambios.length} cambio(s)` +
        (cambios.length ? " — " + cambios.map(c => c.que).join(", ") : " (no se entendió ninguno concreto)"));
    } catch (e) {
      console.log("no se pudo interpretar la corrección, sigo sin ella:", String(e).slice(0, 140));
    }
  }

  // LO QUE EL EQUIPO YA CORRIGIO. Es la capa de MAS peso: son las
  // preferencias de la propia marca, destiladas de correcciones reales.
  // Ver reglas.mjs.
  const reglasEquipo = bloqueReglas(leerReglas());

  // 3) Director (lee memoria, innova)
  //
  // Tres modos, de más preciso a menos: corrección dirigida con la lista de
  // cambios; reintento a secas (rehacer, el comportamiento viejo); o pieza
  // nueva.
  const extra = cambios.length
    ? instrucciones(cambios, previaLocal)
    : isRetry
      ? "\n\n⚠️ ESTE ES UN REINTENTO: el contenido anterior fue rechazado por el equipo." +
        (CORRECCION ? ` Pidieron esto: "${CORRECCION}". Aplícalo.` : "") +
        " Genera una versión CLARAMENTE MEJOR y distinta (mejor diseño, mejor texto, otro enfoque del mismo tema)."
      : "";
  // El ángulo se FIJA en los dos casos, y por razones opuestas:
  //   · pieza nueva → el que eligió el juez, para no repetir el historial;
  //   · corrección  → el de la pieza anterior, para no derivar a otro tema.
  //
  // Sin la segunda mitad, saltarse al juez sólo evitaba elegir uno nuevo pero
  // dejaba al director inventando el suyo: se pedía "acorta los titulares" y
  // volvía un carrusel de otro tema con titulares cortos. Visto en la primera
  // corrida real de esta función (23-ago-2026).
  // Para fijar el ángulo alcanza con el `angulo` de la última entrada — no
  // hace falta que tenga el plan completo. Importa en la transición: las
  // entradas anteriores al 23-ago-2026 no guardaban `contenido`, y sin este
  // respaldo la primera corrección sobre una de ellas volvía a derivar.
  const anguloPrevio = esCorreccionDirigida
    ? (previaLocal?.angulo || [...log].reverse().find((e) => e.angulo)?.angulo || "")
    : "";
  const anguloFijado = anguloElegido
    ? `\n\nÁNGULO YA ELEGIDO (no lo cambies, desarróllalo):\n"${anguloElegido.angulo}"\nQué lo hace distinto: ${anguloElegido.por_que_es_distinto}\nEn el campo "angulo" del JSON devuelve exactamente este ángulo.`
    : anguloPrevio
      ? `\n\nÁNGULO A MANTENER (es una corrección, NO cambies de tema):\n"${anguloPrevio}"\nEn el campo "angulo" del JSON devuelve exactamente este ángulo.`
      : "";
  const dir = await claude({
    model: "claude-sonnet-5", max_tokens: 8000,
    system: `Eres Barbara, directora creativa de condor.ai. Diseñas carruseles de Instagram (${N_SLIDES} slides) de nivel agencia, educativos y que hacen seguir la cuenta. Sigues EXACTAMENTE el template del día. Incluyes el texto exacto a renderizar en cada slide COMO COPY FINAL: en la imagen SOLO aparece lo que lee la persona, JAMÁS palabras estructurales como "titular", "subtítulo", "título", "dato", "texto", "slide" o "CTA", ni rótulos con dos puntos. NUNCA repites ángulos, protagonistas ni textos de las piezas recientes (te las paso). Innova siempre.

REGLA DE VERACIDAD (no negociable): cada cifra, fecha, medio y hecho que pongas en un slide tiene que salir TAL CUAL de la investigación que te paso. Está PROHIBIDO inventar o estimar una estadística, atribuirle algo a un medio real (Bloomberg, Microsoft, Meta, Google, McKinsey…) que no venga en la investigación, o ponerle a una noticia una fecha que no sea la de su publicación real. Esto se publica en la cuenta real de una empresa: un dato inventado con el logo encima es un problema de verdad. Si la investigación no alcanza, haz un carrusel más corto o de ángulo más general — nunca lo rellenes.

${QUE_ES_BARBARA}

LA PORTADA (slide 1) es la que decide si alguien lee el resto. Su titular tiene
que ser corto y con filo: máximo 7 palabras, más una línea de apoyo de máximo
10. NO pongas cifras, comparaciones ni listas en la portada — esos van del
slide 2 en adelante. Si tu portada necesita explicar, no es una portada.

FUENTES: sólo cita una fuente si viene textual de la investigación que te paso,
con su nombre real. Está PROHIBIDA una línea de fuente genérica inventada del
tipo "Análisis de Retención de Clientes 2024" o "Estudio Interno": si no
tienes la fuente real, la pieza va SIN línea de fuente y SIN cifras.

Responde SOLO con el JSON.`,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: `Tipo de hoy (${dia}): ${tema.instruccion}\n\nTEMPLATE OBLIGATORIO:\n${tema.template}\n\nPIEZAS RECIENTES (NO repitas estos ángulos, innova):\n${recientes}\n${research ? "\nInvestigación web:\n" + research : ""}${reglasEquipo}${playbooks}${anguloFijado}${extra}\n\nCrea el carrusel de ${N_SLIDES} slides con un ángulo NUEVO.` }],
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
  // SOLO_PORTADA=1 genera únicamente la primera imagen. Es para revisar un
  // diseño nuevo sin pagar el carrusel entero: 1 crédito en vez de 6 o 7. El
  // director igual escribe el plan completo, así que la portada es la misma
  // que saldría en la pieza real — no una portada "de prueba".
  const soloPortada = process.env.SOLO_PORTADA === "1";
  const slides = (plan.slides || []).slice(0, soloPortada ? 1 : N_SLIDES);
  if (soloPortada) console.log("SOLO_PORTADA=1 — se genera sólo la primera imagen");

  // 4) Imágenes con Higgsfield
  const imgs = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      // El contador va DICTADO, no insinuado. Dejándoselo al modelo salieron
      // "01", "01 / 05", "3/5", "05" y "04/10" en un mismo carrusel de 6: un
      // modelo de imagen no sabe en qué slide va ni cuántos hay.
      // Una pieza de UNA sola imagen no lleva contador: "1/1" en la esquina
      // delata que es una plantilla de carrusel y rompe la ilusión de anuncio.
      // Se mira N_SLIDES (lo que la SERIE define) y no slides.length: con
      // SOLO_PORTADA=1 un carrusel de 7 renderiza 1 sola imagen, y confundir
      // eso con un anuncio le sacaría el contador y la regla de portada — o
      // sea, la prueba mostraría un diseño distinto al real.
      const esUnica = N_SLIDES === 1;
      const contador = esUnica
        ? "\n\nDo NOT render any slide counter, page number or \"1/1\" anywhere in the frame."
        // El total es N_SLIDES, no slides.length: con SOLO_PORTADA la prueba
        // tiene que mostrar "1/7" como saldría de verdad, no "1/1".
        : `\n\nSLIDE COUNTER: render exactly the text "${i + 1}/${N_SLIDES}" in the top-right corner, nothing else there. Do not invent a different number or format.`;
      // Portada siempre, alternado, nunca dos seguidas, ≥50% del carrusel:
      // se calcula acá (par/impar, 0-indexado) en vez de dejárselo al
      // criterio del director. Pedido de Joaquín el 22-ago-2026 — con 6 o 7
      // slides, "un slide sí / uno no, empezando en la portada" YA cumple
      // las cuatro condiciones a la vez sin necesidad de negociarlas.
      const llevaPersonaje = Boolean(tema.personaje) && i % 2 === 0;
      const personaje = tema.personaje ? (llevaPersonaje ? PERSONAJE_BARBARA : SIN_PERSONAJE) : "";
      // La portada lleva su propia regla de composición: es la única slide
      // cuyo trabajo es que la persona deslice, no informar.
      const esPortada = i === 0 && !esUnica;
      const url = await genImagen(
        REGLA_TEXTO + "\n\n" + REGLA_ORTOGRAFIA + "\n\n" + tema.template + contador +
        (esPortada ? "\n\n" + PORTADA : "") +
        (personaje ? "\n\n" + personaje : "") + "\n\n" + slides[i].prompt, i);
      let buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      // El logo REAL se pega acá, no se le pide al modelo que lo dibuje (ver
      // el comentario junto a ZONA_LOGO_IZQ). tema.logo es null en las series
      // cuya referencia aprobada no lleva logo en cada slide.
      if (tema.logo) buf = await pegarLogoCondor(buf, tema.logo);
      // Y el personaje igual: archivo real encima del hueco que dejó el modelo.
      // `i / 2` para que las poses roten de a una entre slides CON personaje
      // (0, 2, 4 → retrato, brazos, carpeta) y no se repita dos veces seguidas.
      if (llevaPersonaje) buf = await pegarPersonajeBarbara(buf, Math.floor(i / 2));
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
    "• Corregir algo puntual: *Denuevo barbara, <qué arreglar>*",
    "   ej: _Denuevo barbara, el titular del slide 2 muy largo_ → cambia solo eso",
    "• Rehacer entero: escribe *Denuevo barbara* (sin explicación)",
    "• Aprobar y publicar: escribe *Aprobar barbara*",
    "",
    "Para algo puntual, corre el workflow _Barbara_ a mano con:",
    "• `SERIE=" + claveSerie + "` — repite esta misma serie",
    "• `SERIE=noticias|servicios|barbara_producto|barbara_datos|ad_condor|ad_barbara` — cambia de serie",
    "• `DIA=lunes|martes|jueves|viernes` — fuerza el día",
    "• `RETRY=1` — salta el candado de 1 pieza por día",
    "",
    "El diseño de cada serie vive en `services/barbara/barbara.mjs`, en la constante `T_" + claveSerie.toUpperCase() + "`. Ahí se cambian colores, tipografía y retícula — el contenido no se toca, lo escribe Bárbara cada vez.",
  ].join("\n");

  await tg("sendMessage", {
    chat_id: CHAT,
    text: `🤖 *Barbara* — ${tema.titulo}\n` +
          `Serie: \`${claveSerie}\` · ${imgs.length} slides · ID: \`${runId}\`\n` +
          `🎯 Ángulo: _${plan.angulo || "—"}_\n\n` +
          `📝 *Caption:*\n\n${plan.caption || ""}${avisoAngulo}\n\n${comoCorregir}`,
    parse_mode: "Markdown",
  });

  // 6b) APRENDER de la corrección, si la hubo.
  //
  // Va DESPUÉS de mandar la pieza a Telegram a propósito: destilar la regla es
  // valioso pero nunca puede demorar ni tumbar la entrega. `aprenderDeCorreccion`
  // no lanza — si falla, la pieza de hoy ya salió igual.
  if (CORRECCION) {
    const r = await aprenderDeCorreccion((_k, body) => claude(body), AK, CORRECCION);
    if (r.guardada) {
      console.log(`regla ${r.reforzada ? "reforzada" : "nueva"}: ${r.regla}`);
      await tg("sendMessage", {
        chat_id: CHAT,
        text: r.reforzada
          ? `🧠 Anotado (ya lo habían pedido antes): _${r.regla}_`
          : `🧠 Aprendido para las próximas: _${r.regla}_`,
        parse_mode: "Markdown",
      });
    } else {
      console.log("no se guardó regla:", r.motivo);
    }
  }

  // 7) Registrar en memoria (anti-repetición + artefacto aprobable)
  guardarEnLog({
    fecha: new Date().toISOString().slice(0, 10), tipo: dia, serie: claveSerie,
    angulo: plan.angulo || slides[0]?.titulo || "", titulo: tema.titulo, runId,
    // El plan completo, para que la proxima correccion tenga QUE corregir.
    // Solo sobrevive en las ultimas entradas (ver CON_CONTENIDO).
    contenido: { slides, caption: plan.caption || "" },
  });
  console.log("OK", dia, "|", claveSerie, "| ángulo:", plan.angulo);
}

main().catch(async (e) => {
  console.error(e);
  // Un fallo de auth de Higgsfield no se arregla reintentando ni mirando el
  // código: hay que volver a loguearse a mano. Ya pasó el 22-ago-2026 (y
  // antes), y las dos veces el mensaje decía sólo "Not authenticated", que
  // obliga a que alguien vaya a buscar el procedimiento. Va con el remedio
  // adentro.
  const esAuth = /Not authenticated|auth login|session expired|unauthor|forbidden|\b(401|403)\b/i.test(String(e));
  const remedio = esAuth
    ? "\n\n🔑 *Es el token de Higgsfield, no el código.* Hay que re-loguearse a mano:\n" +
      "1. `higgsfield auth login` (abre el navegador)\n" +
      "2. `bash services/barbara/reauth.sh` — re-cifra, rota el secret y pushea\n" +
      "Ojo: el CLI local tiene que ser 0.2.x, que es el que usa CI."
    : "";
  try {
    await tg("sendMessage", {
      chat_id: CHAT,
      text: "⚠️ Barbara falló (" + dia + "): " + String(e).slice(0, 300) + remedio,
      parse_mode: "Markdown",
    });
  } catch {}
  process.exit(1);
});
