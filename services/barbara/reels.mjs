// condor.ai · "Barbara Reels" — videos verticales 9:16 para redes (GitHub Actions)
// MARTES (TIPO=ugc):     UGC ~30s. La vocera fija (avatar.png) HABLA en español neutro sobre
//                        lo importante de implementar IA + CTA "Contáctanos". Motor: Veo 3.1 (voz nativa).
// JUEVES (TIPO=trailer): Trailer cinematográfico ~30s de una INDUSTRIA distinta cada semana
//                        (rota rubros desde la memoria), potenciada por IA. Motor: Seedance 2.0.
// Memoria anti-repetición compartida con los carruseles (services/barbara/content-log.json).
// Une clips con ffmpeg y manda a Telegram para revisar antes de subir.
//
// Secrets: ANTHROPIC_API_KEY, HIGGSFIELD_ACCESS_TOKEN/REFRESH_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Variables: TIPO (ugc|trailer|test) · RETRY=1 (rehacer cuando el equipo rechaza) · INDUSTRIA (forzar rubro)

import { execSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { elegirAngulo } from "./angulos.mjs";
import { leerReglas, bloquePrompt as bloqueReglas, aprenderDeCorreccion } from "./reglas.mjs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const isRetry = process.env.RETRY === "1";
// Lo que el equipo escribio despues de "Denuevo barbara" en Telegram.
const CORRECCION = (process.env.CORRECCION || "").trim();
const LOG = "services/barbara/content-log.json";
const AVATAR = "services/barbara/avatar.png";

let TIPO = (process.env.TIPO || "").trim().toLowerCase();
const isTest = TIPO === "test" || process.env.TEST === "1";
if (!["ugc", "trailer"].includes(TIPO)) {
  // por día: martes(2)=ugc, jueves(4)=trailer
  TIPO = new Date().getUTCDay() === 4 ? "trailer" : "ugc";
}

// Pool de industrias para el trailer del jueves (rota para cubrir todos los rubros)
const INDUSTRIAS = [
  "restaurante", "retail / tienda", "clínica dental", "inmobiliaria", "taller mecánico",
  "logística y transporte", "gimnasio", "estudio jurídico", "hotel", "e-commerce",
  "constructora", "agro", "peluquería / barbería", "óptica", "veterinaria", "farmacia",
];

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
const leerLog = () => { try { return JSON.parse(readFileSync(LOG, "utf8")); } catch { return []; } };
function guardarEnLog(entry) { const log = leerLog(); log.push(entry); writeFileSync(LOG, JSON.stringify(log.slice(-100), null, 2) + "\n"); }

// ── Lo que los carruseles ya tenían y los reels no ─────────────────────────
//
// Las mejoras del 22 y 23-ago (juez de ángulos, reglas del equipo, corrección
// dirigida) se habían hecho sólo en barbara.mjs. Los reels son 2 de las 5
// piezas semanales y seguían con "no repitas, acá van las últimas 15" y con el
// reintento a ciegas. Esto los pone al día.
//
// Va acá como funciones compartidas y no copiado en cada generador: son dos
// (UGC del martes y trailer del jueves) y duplicar era garantizar que se
// desincronizaran.

/** Elige el ángulo con el juez semántico. Devuelve el bloque para el prompt. */
async function elegirAnguloReel(instruccion) {
  // En una corrección dirigida NO se elige ángulo nuevo: el equipo pidió
  // arreglar algo de ESA pieza. Se mantiene el de la anterior del mismo tipo.
  if (isRetry && CORRECCION) {
    const previo = [...leerLog()].reverse().find((e) => e.angulo)?.angulo || "";
    if (previo) {
      console.log("corrección dirigida: se mantiene el ángulo anterior");
      return `\n\nÁNGULO A MANTENER (es una corrección, NO cambies de tema):\n"${previo}"\nEn el campo "angulo" del JSON devuelve exactamente este ángulo.`;
    }
    return "";
  }

  // El historial mezcla carruseles y reels a propósito: para quien sigue la
  // cuenta, repetir la idea del carrusel del lunes en el reel del martes es
  // repetir igual, aunque cambie el formato.
  const historial = leerLog().map((e) => e.angulo).filter(Boolean).slice(-80);
  try {
    const eleccion = await elegirAngulo((_k, body) => claude(body), AK, { instruccion, historial });
    for (const d of eleccion.descartes) {
      console.log(`ángulo descartado: se parecía a "${d.se_parece_a}" (${d.razon})`);
    }
    if (eleccion.agotado) console.log("⚠️ ángulos agotados — se sigue con el mejor disponible");
    if (!eleccion.angulo) return "";
    console.log("ángulo elegido:", eleccion.angulo.angulo);
    return `\n\nÁNGULO YA ELEGIDO (no lo cambies, desarróllalo):\n"${eleccion.angulo.angulo}"\nQué lo hace distinto: ${eleccion.angulo.por_que_es_distinto}\nEn el campo "angulo" del JSON devuelve exactamente este ángulo.`;
  } catch (e) {
    // Si el juez falla se sigue sin él: peor, pero publicable.
    console.log("elección de ángulo falló, sigo sin ella:", String(e).slice(0, 140));
    return "";
  }
}

/** El bloque de reintento: corrección dirigida si la hay, rehacer si no. */
function bloqueReintento() {
  if (!isRetry) return "";
  if (CORRECCION) {
    return `\n\n⚠️ ESTO ES UNA CORRECCIÓN, NO UNA PIEZA NUEVA.\nEl equipo pidió exactamente esto:\n  · ${CORRECCION}\n\nHaz ese cambio y NADA MÁS: todo lo que no está en el pedido se queda igual (mismo ángulo, mismo tono, misma estructura). No "aproveches" para mejorar otra cosa.`;
  }
  return "\n\n⚠️ REINTENTO: la pieza anterior fue rechazada. Haz una claramente mejor y distinta.";
}

// ---- Higgsfield: generar un clip y devolver su URL ----
// extraArgs = array de args extra, ej. ["--start-image", AVATAR] o ["--resolution", "720p"].
// Usamos execFileSync (sin shell) para que los saltos de línea, comillas o $ del prompt
// NUNCA rompan el comando (el bug que hacía fallar a Barbara con "Command failed").
function genVideo(model, prompt, dur, idx, extraArgs = []) {
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);
  const args = [
    "generate", "create", model, "--prompt", safe,
    "--aspect_ratio", "9:16", "--duration", String(dur),
    ...extraArgs, "--wait", "--wait-timeout", "14m",
  ];
  // Higgsfield falla transitoriamente a veces (devuelve vacío). Reintentamos hasta 3 veces.
  let ultimo = "";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const out = execFileSync("higgsfield", args, { encoding: "utf8", timeout: 15 * 60 * 1000, stdio: ["ignore", "pipe", "pipe"] });
      const url = (out.trim().split("\n").pop() || "").trim();
      if (/^https?:\/\//.test(url)) return url;
      ultimo = out.slice(-160);
    } catch (e) {
      ultimo = String(e.stderr || e.message || e).slice(-300);
    }
    // Errores de config/auth (workspace, sesión, token) NO son transitorios: reintentar
    // sólo quema tiempo y cuota. Aborta el run entero de inmediato.
    if (/no workspace|session expired|unauthor|forbidden|invalid.*(token|credential)|\b(401|403)\b|auth login/i.test(ultimo)) {
      const err = new Error("Higgsfield config/auth (no reintentable): " + ultimo.slice(-160));
      err.permanent = true;
      throw err;
    }
    if (intento < 3) {
      console.log(`clip ${idx + 1}: intento ${intento}/3 falló (${ultimo.slice(-60)}), esperando 45s…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 45000); // backoff sync
    }
  }
  throw new Error("Higgsfield sin URL (clip " + (idx + 1) + ") tras 3 intentos: " + ultimo);
}

// ---- Unir N clips en un solo vertical 9:16 (re-encode para que el concat sea robusto) ----
async function unirClips(urls) {
  if (urls.length === 1) return Buffer.from(await (await fetch(urls[0])).arrayBuffer());
  for (let i = 0; i < urls.length; i++) {
    writeFileSync(`/tmp/c${i}.mp4`, Buffer.from(await (await fetch(urls[i])).arrayBuffer()));
  }
  const inputs = urls.map((_, i) => `-i /tmp/c${i}.mp4`).join(" ");
  const parts = urls.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[v${i}];`).join("");
  const concat = urls.map((_, i) => `[v${i}][${i}:a]`).join("") + `concat=n=${urls.length}:v=1:a=1[v][a]`;
  execSync(
    `ffmpeg -y ${inputs} -filter_complex "${parts}${concat}" -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac /tmp/final.mp4`,
    { stdio: "ignore" }
  );
  return readFileSync("/tmp/final.mp4");
}

// ================= MARTES: UGC que habla (Veo 3.1) =================
const schemaUGC = {
  type: "object", additionalProperties: false,
  properties: {
    angulo: { type: "string", description: "Ángulo/idea ÚNICO de hoy en una frase (para no repetir)." },
    clips: {
      type: "array", description: "Exactamente 4 tomas de 8s, en orden. Las 4 forman UN SOLO discurso continuo que avanza sin repetir NUNCA una idea o frase ya dicha. Toma 1 = HOOK (engancha en los primeros 3s). Toma 4 = CIERRE con CTA.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          escena: { type: "string", description: "Descripción EN INGLÉS de la toma (encuadre, gesto, acción de la mujer). Varía encuadres entre tomas (close-up, plano medio) para que los cortes se sientan naturales." },
          dialogo: { type: "string", description: "Lo que dice en esta toma, en español neutro latinoamericano. OBLIGATORIO entre 22 y 26 palabras: debe cubrir los 8 segundos completos de habla continua, sin silencios y SIN repetir nada de las tomas anteriores (cada toma continúa la idea, no la repite). Habla fluida y natural, no apurada. La toma 4 cierra invitando a contactar a condor.ai para implementar IA en su negocio." },
        },
        required: ["escena", "dialogo"],
      },
    },
    texto_en_pantalla: { type: "string", description: "Hook corto en español para sobreimprimir en el reel." },
    caption: { type: "string", description: "Caption para Instagram/TikTok con hook + valor + invita a escribir + 5-8 hashtags (IA/negocios/Perú/Chile)." },
  },
  required: ["angulo", "clips", "texto_en_pantalla", "caption"],
};

async function hacerUGC() {
  const recientes = leerLog().slice(-15).map(e => `- [${e.fecha} ${e.tipo}] ${e.angulo}`).join("\n") || "(sin historial)";
  const anguloFijado = await elegirAnguloReel("reel UGC de una vocera hablando a cámara sobre implementar IA en un negocio");
  const reglasEquipo = bloqueReglas(leerReglas());
  const extra = bloqueReintento();
  const dir = await claude({
    model: "claude-sonnet-5", max_tokens: 2500,
    system: `Eres Barbara, directora creativa de condor.ai (agencia que implementa IA en negocios de Perú y Chile). Diriges un reel UGC vertical 9:16 de una vocera que habla a cámara en ESPAÑOL NEUTRO sobre lo importante que es implementar IA en tu negocio HOY. Tono cercano, real, energía de creadora auténtica, hook potente en los primeros 3 segundos y mucha retención. NUNCA repites ángulos ni frases de las piezas recientes (te las paso). Responde SOLO con el JSON.\n\nREGLAS DEL GUION (críticas): son exactamente 4 tomas de 8 segundos que forman UN SOLO monólogo continuo (~95 palabras en total). Cada toma DEBE tener entre 22 y 26 palabras de diálogo para cubrir sus 8 segundos completos de habla fluida y natural (ni apurada ni con silencios). El discurso AVANZA en cada toma: jamás repitas una idea, frase o palabra clave ya usada en una toma anterior. Piensa el guion completo primero y luego pártelo en 4.`,
    output_config: { format: { type: "json_schema", schema: schemaUGC } },
    messages: [{ role: "user", content: `Crea el guion del reel UGC de hoy.\n\nPIEZAS RECIENTES (no repitas estos ángulos):\n${recientes}${reglasEquipo}${anguloFijado}${extra}\n\nDevuelve 4 tomas (escena + diálogo en español neutro). Toma 1 hook, toma 4 cierre con CTA "contáctanos y vemos cómo implementarla en tu negocio".` }],
  });
  const plan = JSON.parse(textOf(dir));
  const clips = (plan.clips || []).slice(0, 4);

  const look = "Authentic UGC selfie-style vertical video, the SAME woman from the reference image (keep her identity, face and outfit consistent), modern bright home office, warm natural lighting, phone-recorded handheld feel, subtle natural motion. This is RAW camera footage only: absolutely NO Instagram interface, NO social media UI, NO story or post frame, NO profile header, NO username, NO like/comment buttons, NO icons, NO on-screen text, NO captions, NO subtitles, NO watermark, NO logos. Just the clean full-frame camera footage of the woman talking.";
  const urls = [];
  for (let i = 0; i < clips.length; i++) {
    // Formato de diálogo recomendado para Veo 3: "she says:" con dos puntos, SIN comillas anidadas,
    // y etiqueta Audio. ~22-26 palabras llenan los 8s sin silencios ni repetición.
    const prompt = `${clips[i].escena}\n\nShe looks straight into the camera with authentic energy and speaks continuously for the full 8 seconds in clear neutral Latin American Spanish, natural lip-sync, fluid pacing with no pauses and no dead air. She says: ${clips[i].dialogo}\n\nAudio: only her voice in neutral Latin American Spanish plus subtle room tone, no music. No subtitles. No captions.\n\n${look}`;
    urls.push(genVideo("veo3_1", prompt, 8, i, ["--image", AVATAR]));
  }
  if (!urls.length) throw new Error("No se generó ningún clip UGC");
  const videoBuf = await unirClips(urls);
  return { plan, videoBuf, titulo: "🎤 Reel UGC — implementa IA en tu negocio", tipoLog: "reel-ugc", extraLog: {} };
}

// ================= JUEVES: trailer cinematográfico por industria (Seedance 2.0) =================
const schemaTrailer = {
  type: "object", additionalProperties: false,
  properties: {
    angulo: { type: "string", description: "Ángulo/idea ÚNICO de este trailer en una frase (para no repetir)." },
    clips: {
      type: "array", description: "Exactamente 2 clips de 15s, en orden. Juntos cuentan un mini-trailer que EXPLICA cómo la IA transforma la industria, con voz en off.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          escena: { type: "string", description: "Prompt EN INGLÉS de la escena cinematográfica de 15s (la industria potenciada por IA). Hook visual fuerte en el primer segundo." },
          locucion: { type: "string", description: "Voz en off EN ESPAÑOL neutro para ESTE clip (25-35 palabras = ~15s hablando). Explica de forma concreta y con gancho cómo la IA transforma la industria. El clip 1 engancha; el clip 2 cierra invitando a condor.ai. Las dos locuciones forman un solo discurso continuo, sin repetir." },
        },
        required: ["escena", "locucion"],
      },
    },
    texto_en_pantalla: { type: "string", description: "Frase aspiracional corta en español para sobreimprimir." },
    caption: { type: "string", description: "Caption para Instagram/TikTok con hook + valor para esa industria + invita a escribir + 5-8 hashtags." },
  },
  required: ["angulo", "clips", "texto_en_pantalla", "caption"],
};

async function hacerTrailer() {
  const log = leerLog();
  const recientes = log.slice(-15).map(e => `- [${e.fecha} ${e.tipo}] ${e.angulo}${e.industria ? " · industria: " + e.industria : ""}`).join("\n") || "(sin historial)";
  // elegir industria menos usada recientemente (o forzada por env)
  const usadas = log.slice(-10).map(e => e.industria).filter(Boolean);
  const disponibles = INDUSTRIAS.filter(x => !usadas.includes(x));
  const pool = disponibles.length ? disponibles : INDUSTRIAS;
  const industria = (process.env.INDUSTRIA || "").trim() || pool[Math.floor(Math.random() * pool.length)];

  const anguloFijado = await elegirAnguloReel(`reel trailer cinematográfico sobre cómo la IA transforma un ${industria}`);
  const reglasEquipo = bloqueReglas(leerReglas());
  const extra = bloqueReintento();
  const look = "Cinematic premium trailer, vertical 9:16, dramatic camera movement, glossy modern color grade, epic uplifting score energy, futuristic but grounded, real-looking people and spaces of the industry transformed by AI, holographic data and subtle AI interface accents. NO logos, NO watermark, NO real brand names, NO on-screen text.";
  const dir = await claude({
    model: "claude-sonnet-5", max_tokens: 2000,
    system: `Eres Barbara, directora creativa de condor.ai. Diriges un REEL TRAILER cinematográfico vertical 9:16 (~30s, 2 clips de 15s) que muestra una industria concreta transformada por la IA, con máxima técnica de hook y retención. CLAVE: NO es solo cine con música — lleva una VOZ EN OFF en español neutro que EXPLICA, con datos y gancho, cómo la IA transforma esa industria (educativo y persuasivo, no aburrido). Es distinto y NO copia el carrusel del miércoles. NUNCA repites ángulos de las piezas recientes. Responde SOLO con el JSON.`,
    output_config: { format: { type: "json_schema", schema: schemaTrailer } },
    messages: [{ role: "user", content: `Industria de hoy: ${industria}.\n\nLOOK VISUAL OBLIGATORIO:\n${look}\n\nPIEZAS RECIENTES (no repitas):\n${recientes}${reglasEquipo}${anguloFijado}${extra}\n\nDevuelve 2 clips (escena en inglés + locución en español de 25-35 palabras c/u) que cuenten, con voz en off explicativa, cómo la IA transforma un ${industria}. La locución debe sonar a trailer: potente, clara y que enseñe algo concreto.` }],
  });
  const plan = JSON.parse(textOf(dir));
  const clips = (plan.clips || []).slice(0, 2);

  const urls = [];
  for (let i = 0; i < clips.length; i++) {
    const escena = typeof clips[i] === "string" ? clips[i] : (clips[i].escena || "");
    const locucion = typeof clips[i] === "string" ? "" : (clips[i].locucion || "");
    const audio = locucion
      ? `\n\nAudio: a confident cinematic narrator voiceover in clear neutral Latin American Spanish says: ${locucion} — over subtle epic background music, low in the mix. The narrator voice must be clear and front. No other speech.`
      : "";
    urls.push(genVideo("seedance_2_0", escena + audio + "\n\n" + look, 15, i, ["--resolution", "720p"]));
  }
  if (!urls.length) throw new Error("No se generó ningún clip de trailer");
  const videoBuf = await unirClips(urls);
  return { plan, videoBuf, titulo: `🎬 Reel Trailer — IA en ${industria}`, tipoLog: "reel-trailer", extraLog: { industria } };
}

async function main() {
  console.log("Reels |", TIPO, "| retry:", isRetry, "| TG:", !!TG, "| ANTHROPIC:", !!AK);
  if (isTest) {
    const j = await (await tg("sendMessage", { chat_id: CHAT, text: "✅ Barbara Reels: conexión OK" })).json();
    if (!j.ok) throw new Error("TG: " + j.description); return;
  }

  // Candado anti-doble-publicación (salvo RETRY): si ya se publicó este tipo hoy, no regenerar
  if (!isRetry) {
    const hoyISO = new Date().toISOString().slice(0, 10);
    const yaHoy = leerLog().some(e => e.fecha === hoyISO && e.tipo === "reel-" + TIPO);
    if (yaHoy) { console.log("Reel", TIPO, "ya publicado hoy (" + hoyISO + "). Usa RETRY=1 para rehacer."); return; }
  }

  const { plan, videoBuf, titulo, tipoLog, extraLog } = TIPO === "trailer" ? await hacerTrailer() : await hacerUGC();

  // Enviar a Telegram
  const fd = new FormData();
  fd.append("chat_id", CHAT);
  fd.append("caption", `${titulo}\n\n💬 Texto en pantalla: ${plan.texto_en_pantalla || ""}`);
  fd.append("video", new Blob([videoBuf], { type: "video/mp4" }), "reel.mp4");
  const j = await (await tg("sendVideo", fd, true)).json();
  if (!j.ok) throw new Error("Telegram sendVideo: " + (j.description || ""));
  await tg("sendMessage", { chat_id: CHAT, text: `🎬 *${titulo}* — listo para revisar.\n\n📝 *Caption:*\n${plan.caption || ""}\n\n_Si quedó mal, responde "Denuevo barbara" en el grupo._`, parse_mode: "Markdown" });

  // Aprender de la corrección, si la hubo. Va DESPUÉS de entregar la pieza y
  // nunca lanza: si falla, el reel de hoy ya salió igual. Las reglas son las
  // MISMAS que las de los carruseles a propósito — son preferencias de la
  // marca, no del formato.
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

  guardarEnLog({ fecha: new Date().toISOString().slice(0, 10), tipo: tipoLog, angulo: plan.angulo || "", ...extraLog });
  console.log("OK reel", TIPO, "| ángulo:", plan.angulo, extraLog.industria ? "| industria: " + extraLog.industria : "");
}

main().catch(async (e) => {
  console.error(e);
  try { await tg("sendMessage", { chat_id: CHAT, text: "⚠️ Barbara Reels falló (" + TIPO + "): " + String(e).slice(0, 300) }); } catch {}
  process.exit(1);
});
