// Prueba la interacción real del guion por CDP (clics y hover de verdad).
// node herramientas/probar-interaccion.mjs URL
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
const url = process.argv[2];
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cn-int-"));
const puerto = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--headless=new", "--disable-gpu", "about:blank"], { stdio: "ignore" });
let ws, fallas = 0;
try {
  let obj;
  for (let i = 0; i < 120 && !obj; i++) { try { obj = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { await esperar(250); } }
  ws = new WebSocket(obj.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (e) => (await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url });
  await esperar(2000);
  await ev(`document.documentElement.style.scrollBehavior = "auto"`);   // el scroll suave movería los blancos del clic
  const centro = async (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  const clic = async (sel) => { const [x, y] = await centro(sel); await esperar(400); for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); await esperar(500); };
  const ok = (cond, txt) => { console.log((cond ? "OK   " : "FALLA") + " " + txt); if (!cond) fallas++; };

  await clic("#btn-calco");
  ok(await ev(`document.getElementById('calco').classList.contains('con-original') && getComputedStyle(document.querySelector('.calco-original')).opacity > 0.3`), "Calco: muestra el original debajo");
  await clic(".segmento button:nth-child(2)");
  ok(await ev(`document.querySelector('.segmento button:nth-child(2)').getAttribute('aria-selected')==='true'`), "Segmento: cambia la opción activa");
  await clic(".interruptor i");
  ok(await ev(`!document.querySelector('.interruptor input').checked`), "Interruptor: se apaga al tocarlo");
  // hover real sobre una tarjeta de producto
  const [hx, hy] = await centro(".prod:nth-child(2)"); await esperar(300);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: hx, y: hy }); await esperar(900);
  ok(await ev(`getComputedStyle(document.querySelector('.prod:nth-child(2)')).transform !== 'none'`), "Hover: la tarjeta de producto se levanta");
  // firma: "Otra vez" reinicia la animación
  await clic("#f-aleteo .otra");
  ok(await ev(`document.getElementById('f-aleteo').classList.contains('corre') && getComputedStyle(document.querySelector('#f-aleteo .ala')).animationName === 'aletea'`), "Firmas: «Otra vez» relanza el aleteo");
  await clic("#lento");
  ok(await ev(`document.body.classList.contains('lento') && getComputedStyle(document.body).getPropertyValue('--vel').trim()==='4'`), "Cámara lenta: multiplica las duraciones ×4");
  // luz del acrílico sigue al cursor
  const [mx, my] = await centro(".mesa"); await esperar(300);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: mx - 100, y: my - 60 }); await esperar(300);
  ok(await ev(`document.querySelector('.tarjeta').style.getPropertyValue('--lx') !== ''`), "Acrílico: la luz sigue al cursor");
  // navegación: enlace activo al bajar
  await ev(`document.querySelector('#productos').scrollIntoView()`); await esperar(500);
  ok(await ev(`document.querySelector('.barra-nav a.activo')?.getAttribute('href')`) === "#productos", "Barra: marca la sección activa");
  // descargas: los SVG existen
  const malos = await ev(`Promise.all([...document.querySelectorAll('a[download]')].map(a=>fetch(a.href).then(r=>r.ok?null:a.getAttribute('href')))).then(x=>x.filter(Boolean))`);
  ok(malos.length === 0, `Descargas: ${await ev(`document.querySelectorAll('a[download]').length`)} enlaces, ${malos.length} rotos ${malos.join(", ")}`);
} finally {
  try { ws && ws.close(); } catch {}
  cerrarChrome(perfil, proc); // en Windows hay que cerrar el árbol entero await esperar(600);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
process.exitCode = fallas ? 1 : 0;
