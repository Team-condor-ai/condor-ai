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

  // BORRAR LA ZONA ANTES DE PEGAR.
  //
  // El template le pide al modelo que deje ese rincón continuo con el fondo, y
  // el modelo igual dibuja una caja ahí cada tanto: el 23-ago-2026 salió un
  // rectángulo BLANCO sobre fondo negro, ocupando el 43% de la esquina. Ya se
  // había reescrito la instrucción una vez por lo mismo (entonces era gris) y
  // volvió a pasar con otro color.
  //
  // Insistirle al modelo no es la solución — no obedecer es su modo de falla
  // normal. Se pinta la zona con el color real del fondo de alrededor y recién
  // ahí se pega el logo. Mismo principio que pegar el archivo en vez de
  // describirlo: no depender de la obediencia del modelo.
  // La zona se ANCLA A LOS BORDES, no al logo. La caja que dibujó el modelo el
  // 23-ago arrancaba en el pixel (0,0) y un parche centrado en el logo dejaba
  // el marco blanco asomando arriba y a la izquierda. El rincón reservado
  // llega al borde, así que limpiarlo tiene que llegar al borde también.
  const zona = {
    left: 0,
    top: 0,
    width: posicion === "centro" ? W : Math.min(W, left0 + anchoTotal + Math.round(W * 0.03)),
    height: Math.min(H, margenY + altoIcono + Math.round(H * 0.025)),
  };

  const fondo = await colorDeFondoAlrededor(base, zona, W, H);
  const parche = await sharp({
    create: { width: zona.width, height: zona.height, channels: 3, background: fondo },
  }).png().toBuffer();

  return base.composite([
    { input: parche, left: zona.left, top: zona.top },
    { input: iconoBuf, left: left0, top: margenY },
    { input: wordmarkBuf, left: left0 + anchoIcono + gap, top: margenY },
  ]).png().toBuffer();
}

/**
 * El color del fondo REAL alrededor de una zona, por mediana.
 *
 * Mediana y no promedio: si en la banda de muestreo cae una letra o el borde
 * de un ícono, el promedio se corre hacia ese color y el parche queda de un
 * tono que no es el del fondo. La mediana ignora esos pocos píxeles raros.
 *
 * Se muestrea una banda POR DEBAJO de la zona (no a los lados): en las cuatro
 * plantillas el fondo sigue limpio ahí, mientras que a la derecha suele
 * empezar el contador de slide.
 */
async function colorDeFondoAlrededor(sharpImg, zona, W, H) {
  const alto = Math.max(2, Math.round(H * 0.015));
  const top = Math.min(H - alto, zona.top + zona.height + Math.round(H * 0.005));
  const region = {
    left: zona.left,
    top: Math.max(0, top),
    width: Math.max(1, Math.min(zona.width, W - zona.left)),
    height: alto,
  };

  const { data, info } = await sharpImg.clone()
    .extract(region).raw().toBuffer({ resolveWithObject: true });

  const canales = info.channels;
  const r = [], g = [], b = [];
  for (let i = 0; i < data.length; i += canales) {
    r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
  }
  const mediana = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
  return { r: mediana(r), g: mediana(g), b: mediana(b) };
}

// ── El personaje Bárbara, pegado como archivo — nunca dibujado ─────────────
//
// Corregido 23-ago-2026, y es EXACTAMENTE el mismo aprendizaje que costó el
// logo un día antes: a un modelo de imagen no se le puede pedir que dibuje
// siempre el mismo personaje. Se le describía "a young Latin American woman…
// warm cream/ivory skin" y devolvía una Bárbara distinta cada vez, con la piel
// tostada — el descriptor regional pesa más que el adjetivo de color, y encima
// la cara, el trazo y las proporciones cambiaban entre slides.
//
// Joaquín mandó los 3 assets reales del personaje. Ahora se pegan tal cual,
// así que la Bárbara de un carrusel es pixel por pixel la misma que la del
// carrusel de la semana pasada.
//
// Las 3 poses cubren el pedido original de "jugar con la animación": varía la
// pose, no el personaje.
const POSES_BARBARA = [
  ASSETS + "barbara-retrato.png",   // sólo la cara
  ASSETS + "barbara-brazos.png",    // brazos cruzados
  ASSETS + "barbara-carpeta.png",   // con carpeta
];

/**
 * Compone a Bárbara sobre la imagen que devolvió Higgsfield.
 *
 * `indice` elige la pose de forma determinista (no al azar): dos slides
 * seguidos del mismo carrusel no deben repetir pose, y una corrida repetida
 * tiene que dar el mismo resultado para que sea reproducible.
 */
export async function pegarPersonajeBarbara(buf, indice = 0, posicion = "centro") {
  const base = sharp(buf);
  const meta = await base.metadata();
  const W = meta.width, H = meta.height;

  const lado = Math.round(W * 0.30);
  const left = Math.round((W - lado) / 2);
  // "centro" para carruseles (donde el template deja el hueco al medio) y
  // "bajo" para los anuncios: ahí el titular ocupa la mitad de arriba y el
  // subtítulo va justo debajo, así que un personaje centrado le cae encima.
  // Pasó en la primera prueba de ad_barbara (23-ago): tapó media línea del
  // subtítulo.
  const top = posicion === "bajo"
    ? Math.round(H * 0.55)
    : Math.round((H - lado) / 2);

  // BORRAR LA ZONA ANTES DE PEGAR, igual que con el logo. El template pide
  // dejar el círculo continuo con el fondo y el modelo igual dibuja uno —
  // en la prueba del 23-ago salió un círculo fantasma MÁS GRANDE que el
  // personaje, que asomaba alrededor. Se limpia un cuadrado con holgura.
  const margen = Math.round(lado * 0.22);
  const zona = {
    left: Math.max(0, left - margen),
    top: Math.max(0, top - margen),
    width: Math.min(W, lado + margen * 2),
    height: Math.min(H, lado + margen * 2),
  };
  zona.width = Math.min(zona.width, W - zona.left);
  zona.height = Math.min(zona.height, H - zona.top);

  // El color NO se muestrea justo alrededor del círculo: el fantasma que
  // dibuja el modelo es MÁS GRANDE que el personaje, así que una banda pegada
  // a la zona cae adentro del fantasma y el parche sale del color equivocado
  // — se ve como un rectángulo. Se muestrea el borde IZQUIERDO del cuadro, a
  // la misma altura, que en las cuatro plantillas es fondo limpio.
  const fondo = await colorDeBordeIzquierdo(base, zona, W);
  const parche = await sharp({
    create: { width: zona.width, height: zona.height, channels: 3, background: fondo },
  }).png().toBuffer();

  const pose = POSES_BARBARA[Math.abs(indice) % POSES_BARBARA.length];
  const personaje = await sharp(pose)
    .resize(lado, lado, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return base.composite([
    { input: parche, left: zona.left, top: zona.top },
    { input: personaje, left, top },
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

/**
 * El color del fondo tomado del BORDE IZQUIERDO del cuadro, a la altura de la
 * zona que se va a tapar.
 *
 * Existe aparte de `colorDeFondoAlrededor` por un caso concreto: el círculo
 * fantasma que el modelo dibuja detrás del personaje es más grande que el
 * personaje mismo, así que muestrear pegado a la zona cae DENTRO del fantasma
 * y el parche sale de otro color — se nota como un rectángulo.
 *
 * El borde izquierdo, a esa altura, es fondo limpio en las cuatro plantillas:
 * ninguna pone contenido pegado al margen.
 */
async function colorDeBordeIzquierdo(sharpImg, zona, W) {
  const region = {
    left: 0,
    top: zona.top,
    width: Math.max(2, Math.round(W * 0.03)),
    height: Math.max(2, zona.height),
  };

  const { data, info } = await sharpImg.clone()
    .extract(region).raw().toBuffer({ resolveWithObject: true });

  const canales = info.channels;
  const r = [], g = [], b = [];
  for (let i = 0; i < data.length; i += canales) {
    r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
  }
  const mediana = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
  return { r: mediana(r), g: mediana(g), b: mediana(b) };
}
