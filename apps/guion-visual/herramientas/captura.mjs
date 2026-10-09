// Captura una página por CDP con espera real (sirve para animaciones CSS).
// node herramientas/captura.mjs URL salida.png [ancho] [alto] [espera_ms]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [url, salida, ancho = "1280", alto = "1500", espera = "4000"] = process.argv.slice(2);
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-cap-"));
const puerto = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${ancho},${alto}`, "about:blank"], { stdio: "ignore" });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let objetivos;
  for (let i = 0; i < 60 && !objetivos; i++) { try { objetivos = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
  ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: +ancho, height: +alto, deviceScaleFactor: 1, mobile: +ancho < 700 });
  await cdp("Page.navigate", { url });
  await esperar(+espera);
  const shot = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(salida, Buffer.from(shot.result.data, "base64"));
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill();
  await esperar(600);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
