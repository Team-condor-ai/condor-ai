// Arnés CDP compartido: abre UN Chrome headless con perfil temporal y lo cierra solo a él.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function cerrarChrome(perfil, proc) {
  try { proc.kill(); } catch {}
  const marca = path.basename(perfil).replace(/'/g, "");
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
}
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function conChrome(fn) {
  const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-nav-"));
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
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
      if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errores.push(d.params.entry.text + " " + (d.params.entry.url || ""));
    };
    const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (e) => { const r = await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
    await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Log.enable");
    const abrir = async (url, ancho = 1440, alto = 900, movil = false, extra) => {
      await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
      if (movil) await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      if (extra) await extra();
      await cdp("Page.navigate", { url });
      await esperar(2500);
      await ev(`document.documentElement.style.scrollBehavior = "auto"`);
    };
    const tecla = async (key, mods = 0, code, keyCode) => {
      const t = { key, code: code || key, windowsVirtualKeyCode: keyCode, modifiers: mods };
      const texto = key.length === 1 && !(mods & 2) ? { text: key } : {};
      await cdp("Input.dispatchKeyEvent", { type: texto.text ? "keyDown" : "rawKeyDown", ...t, ...texto });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", ...t });
    };
    const escribir = async (s) => { for (const ch of s) await cdp("Input.insertText", { text: ch }); };
    const clicXY = async (x, y) => { await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); };
    const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,l:r.left,t:r.top}})()`);
    const clic = async (sel) => { const r = await rect(sel); if (!r) throw new Error("no existe " + sel); await clicXY(r.x, r.y); };
    let fallas = 0;
    const ok = (cond, txt) => { console.log((cond ? "OK   " : "FALLA") + " " + txt); if (!cond) fallas++; };
    await fn({ cdp, ev, abrir, tecla, escribir, clic, clicXY, rect, ok, errores, esperar });
    console.log(`\n${fallas} fallas · errores de consola: ${JSON.stringify(errores)}`);
  } finally {
    try { ws && ws.close(); } catch {}
    cerrarChrome(perfil, proc);
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
}
