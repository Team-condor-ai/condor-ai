// Arnés CDP mínimo para probar el kit (Chrome headless con perfil temporal propio).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Cierra SOLO los Chrome de este perfil temporal (nunca el Chrome del usuario). */
function cerrarChrome(perfil, proc) {
  try { proc.kill(); } catch {}
  const marca = path.basename(perfil).replace(/'/g, "");
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
}

export async function lanzar() {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-kit-"));
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(CHROME, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let obj;
  for (let i = 0; i < 120 && !obj; i++) { try { obj = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
  const ws = new WebSocket(obj.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map(); const errores = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errores.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errores.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (e) => { const r = await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(e + "\n" + JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await cdp("Page.enable"); await cdp("Runtime.enable");

  const api = {
    cdp, ev, errores,
    async abrir(url, { ancho = 1440, alto = 900, movil = false, reducido = false } = {}) {
      await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: movil, maxTouchPoints: movil ? 5 : 0 });
      await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reducido ? "reduce" : "no-preference" }] });
      await cdp("Page.navigate", { url });
      await esperar(2200);
      await ev(`document.documentElement.style.scrollBehavior='auto'`);
    },
    async centro(sel) {
      return ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('no hay ${sel.replace(/'/g, "")}');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    },
    async mover(x, y) { await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); },
    async clicXY(x, y) { for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); },
    async clic(sel, pausa = 450) { const [x, y] = await api.centro(sel); await esperar(150); await api.mover(x, y); await api.clicXY(x, y); await esperar(pausa); return [x, y]; },
    async toque(sel, pausa = 450) { const [x, y] = await api.centro(sel); await esperar(150); await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await esperar(pausa); return [x, y]; },
    async arrastreTactil(x, y0, y1, pasos = 10, ms = 16) {
      await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
      for (let i = 1; i <= pasos; i++) { await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / pasos }] }); await esperar(ms); }
      await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },
    async tecla(key, { shift = false } = {}) {
      const codes = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, Backspace: 8, " ": 32 };
      const vk = codes[key] ?? key.toUpperCase().charCodeAt(0);
      const base = { key, code: key.length === 1 ? (/\d/.test(key) ? "Digit" + key : "Key" + key.toUpperCase()) : key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: shift ? 8 : 0 };
      const texto = key.length === 1 ? { text: key, unmodifiedText: key } : key === "Enter" ? { text: "\r" } : {};
      await cdp("Input.dispatchKeyEvent", { type: texto.text ? "keyDown" : "rawKeyDown", ...base, ...texto });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await esperar(60);
    },
    async escribir(txt) { for (const ch of txt) { if (/[a-z0-9]/i.test(ch)) await api.tecla(ch); else { await cdp("Input.insertText", { text: ch }); await esperar(40); } } },
    async foco() { return ev(`(()=>{const a=document.activeElement;return a?(a.id||a.getAttribute('aria-label')||a.textContent.trim().slice(0,30)||a.tagName):null})()`); },
    async captura(archivo, clip) {
      const p = { format: "png" };
      if (clip) { const [sx, sy] = await ev(`[scrollX, scrollY]`); p.clip = { ...clip, x: clip.x + sx, y: clip.y + sy, scale: 1 }; }
      const r = await cdp("Page.captureScreenshot", p);
      fs.writeFileSync(archivo, Buffer.from(r.result.data, "base64"));
    },
    async capturaEl(sel, archivo, margen = 16) {
      const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()`);
      await esperar(500);
      await api.captura(archivo, { x: Math.max(0, r.x - margen), y: Math.max(0, r.y - margen), width: r.w + margen * 2, height: r.h + margen * 2 });
    },
    cerrar() { try { ws.close(); } catch {} cerrarChrome(perfil, proc); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} },
  };
  return api;
}
