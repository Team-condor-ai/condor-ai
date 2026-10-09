// Mide el guion por CDP: errores de consola, desborde horizontal y capturas.
// node herramientas/medir.mjs URL carpeta  →  escritorio (1440) y celular (390)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Cierra SOLO los Chrome de este perfil temporal (nunca el Chrome del usuario). */
function cerrarChrome(perfil, proc) {
  try { proc.kill(); } catch {}
  const marca = path.basename(perfil).replace(/'/g, "");
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
}
const [url, carpeta] = process.argv.slice(2);
fs.mkdirSync(carpeta, { recursive: true });
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [nombre, ancho, alto, movil] of [["escritorio", 1440, 900, false], ["celular", 390, 844, true]]) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-med-"));
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let ws;
  try {
    let obj;
    for (let i = 0; i < 120 && !obj; i++) { try { obj = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
    ws = new WebSocket(obj.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let n = 0; const pend = new Map(), errores = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
      if (d.method === "Runtime.exceptionThrown") errores.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errores.push(d.params.args.map((a) => a.value).join(" "));
      if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errores.push(d.params.entry.text + " " + (d.params.entry.url || ""));
    };
    const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Log.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
    await cdp("Page.navigate", { url });
    await esperar(2500);
    // recorrer la página para disparar las animaciones al entrar a la vista
    const H = (await cdp("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true })).result.result.value;
    for (let y = 0; y < H; y += alto * 0.8) { await cdp("Runtime.evaluate", { expression: `document.documentElement.style.scrollBehavior='auto';scrollTo(0,${y})` }); await esperar(180); }
    await esperar(2500);
    const med = (await cdp("Runtime.evaluate", { returnByValue: true, expression: `(()=>{const W=innerWidth;const anchos=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>W+1)&&getComputedStyle(e).position!=='fixed'&&!e.closest('.liquido,.mesa,.sitio')}).slice(0,8).map(e=>e.tagName.toLowerCase()+'.'+[...e.classList].join('.')+' '+Math.round(e.getBoundingClientRect().right));return {scrollW:document.documentElement.scrollWidth,W,alto:document.documentElement.scrollHeight,desbordes:anchos,imgsRotas:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))}})()` })).result.result.value;
    console.log(nombre, JSON.stringify(med), "errores:", JSON.stringify(errores));
    // capturas por tramos
    const tramos = Math.min(14, Math.ceil(med.alto / alto));
    for (let i = 0; i < tramos; i++) {
      await cdp("Runtime.evaluate", { expression: `scrollTo(0,${i * alto})` });
      await esperar(500);
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(carpeta, `${nombre}-${String(i).padStart(2, "0")}.png`), Buffer.from(shot.result.data, "base64"));
    }
  } finally {
    try { ws && ws.close(); } catch {}
    cerrarChrome(perfil, proc); // en Windows hay que cerrar el árbol entero await esperar(600);
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
}
