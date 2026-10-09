// Arnés CDP mínimo (copiado del patrón de herramientas/probar-interaccion.mjs).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function cerrarChrome(perfil, proc) {
  try { proc.kill(); } catch {}
  const marca = path.basename(perfil).replace(/'/g, "");
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
}

export async function abrir({ url = "http://127.0.0.1:5320/", width = 1440, height = 900, mobile = false, reducido = false } = {}) {
  const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-pat-"));
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let obj;
  for (let i = 0; i < 120 && !obj; i++) { try { obj = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
  const ws = new WebSocket(obj.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map(); const errores = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errores.push(d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errores.push(d.params.args.map((a) => a.value || a.description).join(" "));
  };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (e) => { const r = await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  if (reducido) await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp("Page.navigate", { url });
  await esperar(2200);
  await ev(`document.documentElement.style.scrollBehavior = "auto"`);
  const centro = async (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  const raton = async (type, x, y, extra = {}) => cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
  const clic = async (sel, pausa = 450) => { const [x, y] = await centro(sel); await esperar(250); await raton("mousePressed", x, y, { buttons: 1 }); await raton("mouseReleased", x, y); await esperar(pausa); };
  const escribir = async (sel, txt) => { await ev(`document.querySelector(${JSON.stringify(sel)}).focus()`); await cdp("Input.insertText", { text: txt }); await esperar(80); };
  const tecla = async (key, code = key, vk = 0) => { await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk }); await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk }); await esperar(80); };
  const captura = async (archivo, clip) => { const r = await cdp("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); fs.writeFileSync(archivo, Buffer.from(r.result.data, "base64")); };
  let fallas = 0;
  const ok = (cond, txt) => { console.log((cond ? "OK   " : "FALLA") + " " + txt); if (!cond) fallas++; };
  const cerrar = () => { try { ws.close(); } catch {} cerrarChrome(perfil, proc); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} };
  return { cdp, ev, centro, raton, clic, escribir, tecla, captura, ok, cerrar, errores, fallas: () => fallas };
}
