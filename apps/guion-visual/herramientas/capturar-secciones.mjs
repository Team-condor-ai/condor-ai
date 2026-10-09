// Captura cada <section id> del guion (ya animada) y arma hojas de contacto.
// node herramientas/capturar-secciones.mjs URL carpeta [ancho=1440] [alto=900]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
const [url, carpeta, ancho = "1440", alto = "900"] = process.argv.slice(2);
const W = +ancho, H = +alto, movil = W < 700;
fs.mkdirSync(carpeta, { recursive: true });
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-cap-"));
const puerto = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
function cerrar() {
  try { proc.kill(); } catch {}
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(perfil)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
}
let ws;
try {
  let obj;
  for (let i = 0; i < 120 && !obj; i++) { try { obj = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
  ws = new WebSocket(obj.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (e) => (await cdp("Runtime.evaluate", { expression: e, returnByValue: true })).result.result.value;
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: movil });
  await cdp("Page.navigate", { url });
  await esperar(2200);
  await ev(`document.documentElement.style.scrollBehavior='auto'`);
  const ids = await ev(`[...document.querySelectorAll('main > section[id]')].map(s=>s.id)`);
  const archivos = [];
  for (const id of ids) {
    // la sección del vuelo se captura a mitad de su recorrido
    if (id === "vuelo") await ev(`(()=>{const v=document.getElementById('vuelo');scrollTo(0, v.offsetTop + (v.offsetHeight-innerHeight)*0.62)})()`);
    else await ev(`(()=>{const s=document.getElementById(${JSON.stringify(id)});scrollTo(0, s.offsetTop - 40)})()`);
    await esperar(1300);
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    const f = path.join(carpeta, `${String(archivos.length).padStart(2, "0")}-${id}.png`);
    fs.writeFileSync(f, Buffer.from(shot.result.data, "base64"));
    archivos.push(f);
  }
  // hojas de contacto de 6
  const tw = movil ? 260 : 700, th = Math.round((tw * H) / W), cols = movil ? 6 : 2;
  for (let h = 0; h * 6 < archivos.length; h++) {
    const grupo = archivos.slice(h * 6, h * 6 + 6), comp = [];
    for (const [i, f] of grupo.entries()) comp.push({ input: await sharp(f).resize(tw, th).png().toBuffer(), left: (i % cols) * (tw + 8), top: Math.floor(i / cols) * (th + 8) });
    const filas = Math.ceil(grupo.length / cols);
    await sharp({ create: { width: cols * (tw + 8), height: filas * (th + 8), channels: 3, background: "#777" } }).composite(comp).png().toFile(path.join(carpeta, `_hoja-${h}.png`));
  }
  console.log(ids.length, "secciones");
} finally {
  try { ws && ws.close(); } catch {}
  cerrar(); await esperar(500);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
