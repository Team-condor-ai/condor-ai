// condor.ai · Motor compartido del generador multi-cliente de Bárbara.
//
// A PROPÓSITO no lo importan barbara.mjs ni reels.mjs (el bot semanal de
// Cóndor, que ya corre en vivo cada Lun/Mié/Vie y Mar/Jue). Son funciones
// calcadas de esos dos archivos, duplicadas aquí a propósito: extraerlas de
// los scripts que ya funcionan en producción para que las importaran habría
// significado tocar código que se dispara solo, bajo presión de fecha, sin
// beneficio nuevo — puro riesgo. Unificar esto es una mejora segura para
// después, cuando clientes.mjs ya esté probado.

import { execFileSync, execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { apiDisponible, generarImagen as apiImagen, generarVideo as apiVideo } from "./higgsfield-api.mjs";

const ASSETS = fileURLToPath(new URL("./assets/", import.meta.url));

export async function tg(token, method, payload, isForm = false) {
  const opt = { method: "POST" };
  if (isForm) opt.body = payload;
  else { opt.headers = { "Content-Type": "application/json" }; opt.body = JSON.stringify(payload); }
  return fetch(`https://api.telegram.org/bot${token}/${method}`, opt);
}

export async function claude(apiKey, body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Claude " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.json();
}

export const textOf = (d) => (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");

// Misma regla dura que barbara.mjs: el modelo tiende a renderizar literalmente
// cualquier palabra estructural del prompt si no se lo prohibimos.
export const REGLA_TEXTO = `TEXT RULE (critical): the only text rendered in the image must be the final Spanish copy the reader is meant to see, as polished editorial typography. Do NOT render meta words or field labels such as "titular", "título", "subtítulo", "subtitulo", "dato", "texto", "slide", "CTA", "headline", "subtitle" or "caption", and NEVER render a word followed by a colon used as a label. No placeholder labels, no field names on the image.`;

// Regla de veracidad. Va en el system de TODO director que escriba copy —
// Cóndor y cada cliente — porque el modelo, cuando no tiene el dato, no deja
// el hueco: lo rellena con una cifra verosímil y le pone al lado el nombre de
// un medio real.
//
// Pasó en vivo el 22-ago-2026 con el noticiero de Cóndor: tituló "4 noticias
// de esta semana" con fechas de julio inexistentes, y le atribuyó cifras a
// Bloomberg y a un "reporte trimestral de Microsoft" que nunca estuvieron en
// la investigación. Se pilló mirando los PNG antes de publicar.
//
// Con un cliente el riesgo es peor: nadie de Cóndor revisa sus piezas antes de
// que salgan, y el dato inventado va con SU logo y SU marca encima.
export const REGLA_VERACIDAD = `REGLA DE VERACIDAD (no negociable): toda cifra, porcentaje, fecha, estudio o nombre de empresa que escribas tiene que venir del material que te paso. Está PROHIBIDO:
- inventar o estimar una estadística, aunque suene razonable;
- atribuirle un dato a una fuente real (Bloomberg, Microsoft, Meta, Google, McKinsey, Gartner, un diario…) si no viene en el material;
- ponerle a un hecho una fecha que no sea la real;
- describir como "de esta semana" o "reciente" algo cuya fecha no tienes.
Si no tienes el dato, escribe la pieza SIN cifras: un buen texto sin números es publicable, uno con un número inventado no. Esto se publica en la cuenta real de una marca y con su logo encima.`;

// ── El logo REAL, compuesto encima — nunca dibujado por el modelo ──────────
//
// Corregido 22-ago-2026: el primer carrusel publicado le pedía a nano_banana_2
// que DIBUJARA "a small geometric hummingbird mark in gradient" en cada slide.
// Un modelo de imagen no reproduce el mismo logo dos veces — lo redibuja de
// memoria, y esa vez salió con proporciones y trazo distintos al real. Para
// una marca, el logo tiene que ser SIEMPRE el mismo archivo, pixel a pixel.
//
// La solución no es "describir mejor" el logo: es no pedirle al modelo que lo
// dibuje. El template dice "deja limpio este espacio" y acá se pega encima el
// PNG real, recortado del logo oficial (`apps/web-v2/public/assets/logo.png`).
//
// El wordmark cambia de color (negro/blanco) según el fondo real de CADA
// slide, no según qué template es: T_BARBARA_DATOS alterna fondo negro y
// crema a criterio del modelo, así que no hay forma de saberlo de antemano.
// Se mide el brillo real de la zona donde va a ir el logo y se elige la
// versión que se lea — el mismo criterio (luminancia percibida) que ya usa
// `plantillas.mjs` para decidir texto claro/oscuro.
const ICONO = ASSETS + "condor-icon.png";
const WORDMARK_NEGRO = ASSETS + "condor-wordmark-black.png";
const WORDMARK_BLANCO = ASSETS + "condor-wordmark-white.png";

async function fondoEsOscuro(sharpImg, region) {
  const { data } = await sharpImg.clone().extract(region).raw().toBuffer({ resolveWithObject: true });
  let suma = 0, n = 0;
  const canales = data.length / (region.width * region.height);
  for (let i = 0; i < data.length; i += canales) {
    // Luminancia percibida (Rec. 601): el ojo ve el verde mucho más claro que
    // el azul, promediar los tres canales a secas da el resultado equivocado.
    suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return suma / n < 140;
}

/**
 * Compone el logo real de condor.ai sobre el buffer que devolvió Higgsfield.
 * `posicion`: "izquierda" (ícono + wordmark pegados al borde izquierdo) o
 * "centro" (el bloque completo centrado horizontalmente).
 */
export async function pegarLogoCondor(buf, posicion = "izquierda") {
  const base = sharp(buf);
  const meta = await base.metadata();
  const W = meta.width, H = meta.height;

  // Proporciones tomadas de las piezas ya aprobadas: el ícono ocupa ~6.5% del
  // alto, con un margen de ~6.5% del ancho respecto al borde.
  const altoIcono = Math.round(H * 0.065);
  const margenX = Math.round(W * 0.065);
  const margenY = Math.round(H * 0.05);
  const gap = Math.round(altoIcono * 0.28);

  const iconoMeta = await sharp(ICONO).metadata();
  const escala = altoIcono / iconoMeta.height;
  const anchoIcono = Math.round(iconoMeta.width * escala);

  const iconoBuf = await sharp(ICONO).resize({ height: altoIcono }).toBuffer();
  const wordmarkMeta = await sharp(WORDMARK_NEGRO).metadata();
  const anchoWordmark = Math.round(wordmarkMeta.width * escala);
  const altoWordmark = Math.round(wordmarkMeta.height * escala);

  const anchoTotal = anchoIcono + gap + anchoWordmark;
  const left0 = posicion === "centro" ? Math.round((W - anchoTotal) / 2) : margenX;

  // Se mide el brillo de la franja donde va a ir el wordmark (no el ícono: el
  // ícono lleva su propio contraste interno y se lee sobre cualquier fondo).
  const oscuro = await fondoEsOscuro(base, {
    left: Math.max(0, Math.min(left0 + anchoIcono + gap, W - 1)),
    top: Math.max(0, margenY),
    width: Math.max(1, Math.min(anchoWordmark, W - (left0 + anchoIcono + gap))),
    height: Math.max(1, Math.min(altoWordmark, H - margenY)),
  });
  const wordmarkBuf = await sharp(oscuro ? WORDMARK_BLANCO : WORDMARK_NEGRO)
    .resize({ height: altoIcono }).toBuffer();

  return base.composite([
    { input: iconoBuf, left: left0, top: margenY },
    { input: wordmarkBuf, left: left0 + anchoIcono + gap, top: margenY },
  ]).png().toBuffer();
}

// ---- Higgsfield: generar imagen y devolver URL (mismo patrón de reintentos
// que barbara.mjs — 3 intentos, aborta de inmediato si el error es de
// auth/config en vez de transitorio) ----
export async function genImagen(prompt, idx) {
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);

  // Si hay credenciales de la API oficial, se usa ésa: son estáticas y no
  // caducan, a diferencia del OAuth del CLI que obliga a re-loguearse a mano
  // cada tanto (ver el encabezado de higgsfield-api.mjs). Sin credenciales,
  // sigue el CLI exactamente como siempre.
  if (apiDisponible()) return apiImagen(safe, { aspectRatio: "4:5", formato: "png" });

  const args = ["generate", "create", "nano_banana_2", "--prompt", safe, "--aspect_ratio", "4:5", "--resolution", "1k", "--wait", "--wait-timeout", "8m"];
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
    if (/no workspace|session expired|unauthor|forbidden|invalid.*(token|credential)|\b(401|403)\b|auth login/i.test(ultimo)) {
      const err = new Error("Higgsfield config/auth (no reintentable): " + ultimo.slice(-160));
      err.permanent = true;
      throw err;
    }
    if (intento < 3) {
      console.log(`slide ${idx + 1}: intento ${intento}/3 falló (${ultimo.slice(-60)}), esperando 45s…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 45000);
    }
  }
  throw new Error("Higgsfield no devolvió URL (slide " + (idx + 1) + ") tras 3 intentos: " + ultimo);
}

// ---- Higgsfield: video sin vocera fija (UGC de cliente, seedance1_5 en
// 720p — motor recomendado en docs/motores-higgsfield.md del repo `barbara`:
// ~4x más barato que seedance_2_0, calidad "amateur" suficiente para UGC).
// Mismo patrón de reintentos que genImagen. `extraArgs` permite pasar
// `--image <ref>` si algún día el cliente sube una foto de referencia.
export async function genVideo(prompt, dur, idx, extraArgs = []) {
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);

  // Igual que genImagen: la API oficial primero si está configurada.
  // `extraArgs` (hoy sólo `--image` para una foto de referencia, que todavía
  // no se usa) es del CLI; si algún día se usa, hay que mapearlo a
  // `image-to-video` en vez de `text-to-video`, así que se cae al CLI.
  if (apiDisponible() && !extraArgs.length) {
    return apiVideo(safe, { duracion: dur, aspectRatio: "9:16", resolucion: "720" });
  }

  const args = [
    "generate", "create", "seedance1_5", "--prompt", safe,
    "--aspect_ratio", "9:16", "--duration", String(dur), "--resolution", "720p",
    ...extraArgs, "--wait", "--wait-timeout", "14m",
  ];
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
    if (/no workspace|session expired|unauthor|forbidden|invalid.*(token|credential)|\b(401|403)\b|auth login/i.test(ultimo)) {
      const err = new Error("Higgsfield config/auth (no reintentable): " + ultimo.slice(-160));
      err.permanent = true;
      throw err;
    }
    if (intento < 3) {
      console.log(`clip ${idx + 1}: intento ${intento}/3 falló (${ultimo.slice(-60)}), esperando 45s…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 45000);
    }
  }
  throw new Error("Higgsfield sin URL (clip " + (idx + 1) + ") tras 3 intentos: " + ultimo);
}

// ---- Unir N clips en un solo vertical 9:16 (mismo enfoque que reels.mjs) ----
export async function unirClips(urls) {
  if (urls.length === 1) return Buffer.from(await (await fetch(urls[0])).arrayBuffer());
  for (let i = 0; i < urls.length; i++) {
    writeFileSync(`/tmp/bc${i}.mp4`, Buffer.from(await (await fetch(urls[i])).arrayBuffer()));
  }
  const inputs = urls.map((_, i) => `-i /tmp/bc${i}.mp4`).join(" ");
  const parts = urls.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[v${i}];`).join("");
  const concat = urls.map((_, i) => `[v${i}][${i}:a]`).join("") + `concat=n=${urls.length}:v=1:a=1[v][a]`;
  execSync(
    `ffmpeg -y ${inputs} -filter_complex "${parts}${concat}" -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac /tmp/bfinal.mp4`,
    { stdio: "ignore" }
  );
  return readFileSync("/tmp/bfinal.mp4");
}

// ---- Supabase: REST plano (mismo estilo que services/seguimiento/seguimiento.mjs,
// sin SDK — Bárbara nunca ha tenido dependencias pesadas) ----
export function supabase(url, serviceKey) {
  const H = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  return {
    async get(path) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers: H });
      if (!r.ok) throw new Error("Supabase GET " + path + ": " + r.status + " " + (await r.text()).slice(0, 200));
      return r.json();
    },
    async post(path, body, { returnMinimal = true } = {}) {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "POST",
        headers: { ...H, Prefer: returnMinimal ? "return=minimal" : "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Supabase POST " + path + ": " + r.status + " " + (await r.text()).slice(0, 200));
      return returnMinimal ? null : r.json();
    },
    async patch(path, body) {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Supabase PATCH " + path + ": " + r.status + " " + (await r.text()).slice(0, 200));
    },
  };
}
