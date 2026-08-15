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

// ---- Higgsfield: generar imagen y devolver URL (mismo patrón de reintentos
// que barbara.mjs — 3 intentos, aborta de inmediato si el error es de
// auth/config en vez de transitorio) ----
export function genImagen(prompt, idx) {
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);
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
export function genVideo(prompt, dur, idx, extraArgs = []) {
  const safe = prompt.replace(/\s+/g, " ").trim().slice(0, 1500);
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
