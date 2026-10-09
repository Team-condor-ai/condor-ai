/* Menús y popups. Todo lo que se abre NACE del botón que lo abre (crece desde
   su origen) y, al cerrarse, devuelve el foco ahí.
   - Menú:     <button data-menu="id">  +  <div class="menu" id="id" role="menu">…<button role="menuitem">
   - Popover:  <button data-popover="id">  +  <div class="popover" id="id">
   - Tooltip:  [data-tip="texto"]
   - Modal:    <button data-modal="id">  +  <div class="modal" id="id" role="dialog">
   - Hoja:     <button data-hoja="id">   +  <div class="hoja" id="id">  (arrastrable, con anclas) */
import { hacerAcrilico } from "./acrilico.js";
import { Resorte, goma } from "./resorte.js";

let abierto = null;   // { panel, boton }
const FOCOS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const enfocables = (raiz) => [...raiz.querySelectorAll(FOCOS)].filter((x) => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length);

/** Rect del elemento sin su escala momentánea (un botón apretado mide 96 %). */
export function rectReal(el) {
  const r = el.getBoundingClientRect();
  const m = getComputedStyle(el).transform;
  if (!m || m === "none") return r;
  const { a, d, e, f } = new DOMMatrixReadOnly(m);
  const w = r.width / (a || 1), h = r.height / (d || 1), cx = r.left + r.width / 2 - e, cy = r.top + r.height / 2 - f;
  return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, width: w, height: h };
}

function ubicar(panel, boton) {
  const r = rectReal(boton);
  panel.style.position = "fixed";
  panel.hidden = false;
  // medidas de diseño (offset*): la escala de la animación de entrada no las altera
  const pw = panel.offsetWidth, ph = panel.offsetHeight;
  let x = r.left, y = r.bottom + 8;
  if (x + pw > innerWidth - 12) x = Math.max(12, Math.min(r.right, innerWidth - 12) - pw);
  let arriba = false;
  if (y + ph > innerHeight - 12 && r.top - ph - 8 >= 12) { y = r.top - ph - 8; arriba = true; }
  panel.style.left = `${Math.round(x)}px`;
  panel.style.top = `${Math.round(y)}px`;
  // el origen de la animación es el botón: el panel brota de su borde
  const ox = Math.min(pw, Math.max(0, r.left + r.width / 2 - x));
  panel.style.transformOrigin = `${ox}px ${arriba ? ph + 8 : -8}px`;
}
function cerrarAbierto(devolverFoco = true) {
  if (!abierto) return;
  const { panel, boton } = abierto;
  abierto = null;
  boton.setAttribute("aria-expanded", "false");
  panel.classList.add("sale");
  const fin = () => { if (panel.classList.contains("sale")) { panel.hidden = true; panel.classList.remove("sale"); } };
  panel.addEventListener("animationend", function f(e) { if (e.target !== panel) return; panel.removeEventListener("animationend", f); fin(); });
  setTimeout(fin, 700);
  if (devolverFoco) boton.focus({ preventScroll: true });
}
function abrir(panel, boton, enfocarPrimero) {
  if (abierto?.panel === panel) return cerrarAbierto();
  cerrarAbierto(false);
  panel.classList.remove("sale");
  if (!panel._acrilico && panel.dataset.acrilico !== undefined) hacerAcrilico(panel);
  // reinicia la animación de entrada aunque se reabra a mitad de la salida
  panel.style.animation = "none"; panel.hidden = false; void panel.offsetWidth; panel.style.animation = "";
  ubicar(panel, boton);
  boton.setAttribute("aria-expanded", "true");
  abierto = { panel, boton };
  if (enfocarPrimero === "suave") {
    // abierto con el mouse: el foco entra al menú sin resaltar nada; las flechas siguen sirviendo
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  } else if (enfocarPrimero) {
    const items = [...panel.querySelectorAll('[role="menuitem"]:not([disabled])')];
    (enfocarPrimero === "ultimo" ? items.at(-1) : items[0])?.focus({ preventScroll: true });
  }
}
document.addEventListener("pointerdown", (e) => {
  if (abierto && !abierto.panel.contains(e.target) && !abierto.boton.contains(e.target)) cerrarAbierto(false);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && abierto) { e.preventDefault(); cerrarAbierto(); } });
// también si el foco se va a otra parte (Tab fuera de un popover)
document.addEventListener("focusin", (e) => { if (abierto && !abierto.panel.contains(e.target) && !abierto.boton.contains(e.target)) cerrarAbierto(false); });
addEventListener("resize", () => cerrarAbierto(false));
addEventListener("scroll", () => abierto && ubicar(abierto.panel, abierto.boton), { passive: true });

export function montarPopups(raiz = document) {
  // ── menús ──
  raiz.querySelectorAll("[data-menu]").forEach((b) => {
    const menu = document.getElementById(b.dataset.menu);
    if (!menu) return;
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", menu.id);
    const items = () => [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
    // foco móvil: los ítems no están en el orden de Tab; se recorren con flechas
    items().forEach((x) => (x.tabIndex = -1));
    b.addEventListener("click", (e) => abrir(menu, b, e.detail === 0 ? true : "suave"));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (abierto?.panel !== menu) abrir(menu, b, e.key === "ArrowUp" ? "ultimo" : true); }
    });
    menu.addEventListener("keydown", (e) => {
      const l = items(), i = l.indexOf(document.activeElement);
      const ir = (j) => { e.preventDefault(); l[(j + l.length) % l.length]?.focus(); };
      if (e.key === "ArrowDown") ir(i + 1);
      else if (e.key === "ArrowUp") ir(i < 0 ? l.length - 1 : i - 1);
      else if (e.key === "Home" || e.key === "PageUp") ir(0);
      else if (e.key === "End" || e.key === "PageDown") ir(l.length - 1);
      // Tab cierra y sigue desde el botón (sin quedar atrapado en un menú que se va)
      else if (e.key === "Tab") cerrarAbierto(true);
      else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // escribir la inicial salta a esa opción (y repetirla, a la siguiente)
        const k0 = e.key.toLowerCase(), nombre = (x) => (x.firstChild ? [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("") : x.textContent).trim().toLowerCase();
        const j = l.findIndex((x, k) => k > i && nombre(x).startsWith(k0));
        const k = j >= 0 ? j : l.findIndex((x) => nombre(x).startsWith(k0));
        if (k >= 0) ir(k);
      }
    });
    // al pasar el puntero, el foco sigue al puntero (como en macOS): un solo resaltado
    menu.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const it = e.target.closest('[role="menuitem"]');
      if (it && document.activeElement !== it && !it.disabled) it.focus({ preventScroll: true });
    });
    menu.addEventListener("click", (e) => {
      const it = e.target.closest('[role="menuitem"]');
      if (!it || it.disabled) return;
      if (it.dataset.marcar !== undefined) {
        menu.querySelectorAll("[data-marcar]").forEach((x) => x.setAttribute("aria-checked", String(x === it)));
      }
      menu.dispatchEvent(new CustomEvent("elegir", { detail: it, bubbles: true }));
      cerrarAbierto();
    });
  });
  // ── popovers ──
  raiz.querySelectorAll("[data-popover]").forEach((b) => {
    const p = document.getElementById(b.dataset.popover);
    if (!p) return;
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", p.id);
    b.setAttribute("aria-haspopup", "dialog");
    b.addEventListener("click", () => abrir(p, b, false));
    // un enlace del popover lo cierra al seguirlo
    p.addEventListener("click", (e) => { if (e.target.closest("a[href]")) cerrarAbierto(false); });
  });
  // ── tooltips ──
  raiz.querySelectorAll("[data-tip]").forEach(tooltip);
  // ── modales ──
  raiz.querySelectorAll("[data-modal]").forEach((b) => { b.setAttribute("aria-haspopup", "dialog"); b.addEventListener("click", () => modal(document.getElementById(b.dataset.modal), b)); });
  // ── hojas ──
  raiz.querySelectorAll("[data-hoja]").forEach((b) => { b.setAttribute("aria-haspopup", "dialog"); b.addEventListener("click", () => hoja(document.getElementById(b.dataset.hoja), b)); });
}

// ── Tooltip ─────────────────────────────────────────────────────────────
// Aparece tras una pausa corta; si ya hay uno a la vista, el siguiente sale al tiro.
let tip, tipReloj, tipDueño = null, tipUltimo = 0;
function tooltip(el) {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tip";   // el rol se pone solo mientras se muestra
    tip.id = "tip";
    document.body.appendChild(tip);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && tipDueño) ocultarTip(); }, true);
    addEventListener("scroll", () => tipDueño && ocultarTip(), { passive: true });
  }
  const mostrar = (inmediato) => {
    clearTimeout(tipReloj);
    const ver = () => {
      tipDueño = el;
      tip.textContent = el.dataset.tip;
      const r = rectReal(el), w = tip.offsetWidth, h = tip.offsetHeight;
      const abajo = r.top - h - 10 < 8;
      tip.style.left = `${Math.round(Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)))}px`;
      tip.style.top = `${Math.round(abajo ? r.bottom + 10 : r.top - h - 10)}px`;
      tip.style.setProperty("--tip-dy", abajo ? "-4px" : "4px");
      tip.setAttribute("role", "tooltip");
      tip.classList.add("ver");
      el.setAttribute("aria-describedby", "tip");
    };
    if (inmediato || performance.now() - tipUltimo < 400) ver(); else tipReloj = setTimeout(ver, 380);
  };
  const ocultar = () => { if (tipDueño === el || !tipDueño) ocultarTip(); clearTimeout(tipReloj); };
  el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") mostrar(false); });
  el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && document.activeElement !== el) ocultar(); });
  // con foco de teclado (no al hacer clic con el mouse)
  el.addEventListener("focus", () => { if (el.matches(":focus-visible")) mostrar(true); });
  el.addEventListener("blur", ocultar);
  // en el celular: mantener apretado lo muestra; soltar lo esconde un rato después
  let largo;
  el.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { ocultar(); return; } largo = setTimeout(() => mostrar(true), 450); });
  el.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") { clearTimeout(largo); if (tipDueño === el) setTimeout(ocultar, 1200); } });
  el.addEventListener("pointercancel", () => clearTimeout(largo));
}
function ocultarTip() {
  clearTimeout(tipReloj);
  if (tipDueño) { tipDueño.removeAttribute("aria-describedby"); tipUltimo = performance.now(); }
  tipDueño = null;
  tip?.classList.remove("ver");
  tip?.removeAttribute("role");
}

// ── Modal ───────────────────────────────────────────────────────────────
export function modal(caja, desde) {
  if (!caja || caja.closest(".velo")) return;
  ocultarTip();
  const velo = document.createElement("div");
  velo.className = "velo";
  caja.hidden = false;
  velo.appendChild(caja);
  document.body.appendChild(velo);
  if (!caja._acrilico && caja.dataset.acrilico !== undefined) hacerAcrilico(caja);
  const origen = () => { const r = rectReal(desde); caja.style.transformOrigin = `${r.left + r.width / 2 - caja.offsetLeft}px ${r.top + r.height / 2 - caja.offsetTop}px`; };
  origen();
  document.documentElement.classList.add("con-modal");
  enfocables(caja)[0]?.focus({ preventScroll: true });
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener("keydown", teclas, true);
    origen();
    velo.classList.add("sale");
    const fin = () => { if (!velo.isConnected) return; caja.hidden = true; document.body.appendChild(caja); velo.remove(); document.documentElement.classList.remove("con-modal"); desde.focus({ preventScroll: true }); };
    velo.addEventListener("animationend", (e) => { if (e.target === velo) fin(); });
    setTimeout(fin, 400 + 240 * vel());
  };
  const teclas = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
    if (e.key === "Tab") {
      const l = enfocables(caja), i = l.indexOf(document.activeElement);
      if (!l.length) { e.preventDefault(); return; }
      if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && (i === l.length - 1 || i < 0)) { e.preventDefault(); l[0].focus(); }
    }
  };
  document.addEventListener("keydown", teclas, true);
  caja.querySelectorAll("[data-cerrar]").forEach((b) => (b.onclick = cerrar));
  velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(); });
}
const vel = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1;

// ── Hoja arrastrable (celular) ──────────────────────────────────────────
// Anclas: completa (0), media (muestra ~la mitad de la pantalla) y cerrada (su alto).
// Se arrastra desde cualquier parte que no sea un control; al soltar se proyecta
// con la velocidad y elige el ancla más cercana; más allá de los topes, goma.
export function hoja(el, desde) {
  if (!el || el.closest(".velo")) return;
  ocultarTip();
  const velo = document.createElement("div");
  velo.className = "velo velo--hoja";
  el.hidden = false;
  velo.appendChild(el);
  document.body.appendChild(velo);
  if (!el._acrilico && el.dataset.acrilico !== undefined) hacerAcrilico(el);
  const ac = new AbortController(), on = { signal: ac.signal };
  const alto = () => el.offsetHeight;
  const anclas = () => { const h = alto(), media = Math.min(h, Math.max(320, h * 0.55)); return [0, Math.round(h - media), h]; };
  const res = new Resorte(alto(), { rigidez: 320, amortiguacion: 30 });
  const pintar = (y) => { el.style.transform = `translateY(${y}px)`; velo.style.setProperty("--velo", String(Math.max(0, Math.min(1, 1 - y / alto())))); };
  res.fijar(alto()); pintar(alto());
  res.a(anclas()[1], pintar);
  document.documentElement.classList.add("con-modal");
  enfocables(el)[0]?.focus({ preventScroll: true });
  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    ac.abort();
    res.a(alto(), (y) => {
      pintar(y);
      if (y >= alto() - 1 && velo.isConnected) { el.hidden = true; el.style.transform = ""; el.classList.remove("arrastrando"); document.body.appendChild(el); velo.remove(); document.documentElement.classList.remove("con-modal"); desde?.focus({ preventScroll: true }); }
    });
  };
  let y0 = 0, base = 0, t0 = 0, ult = 0, v = 0, id = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.target.closest("button, a, input, select, textarea, label")) return;
    // dentro de una zona con scroll propio (el índice), manda el scroll; el agarre siempre arrastra
    if (!e.target.closest(".hoja-agarre")) {
      for (let n = e.target; n && n !== el; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return;
      }
    }
    id = e.pointerId;
    el.setPointerCapture(id);
    el.classList.add("arrastrando");
    y0 = e.clientY; base = res.x; t0 = performance.now(); ult = e.clientY; v = 0;
    cancelAnimationFrame(res.raf); res.raf = 0;
  }, on);
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const ahora = performance.now(), dt = Math.max(1, ahora - t0);
    // velocidad suavizada (px/s): la última muestra pesa más
    v = v * 0.3 + ((e.clientY - ult) / dt) * 1000 * 0.7; t0 = ahora; ult = e.clientY;
    res.x = goma(base + e.clientY - y0, 0, alto());
    pintar(res.x);
  }, on);
  const soltar = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    el.classList.remove("arrastrando");
    if (performance.now() - t0 > 90) v = 0;   // se detuvo antes de soltar: sin impulso
    const destino = res.x + v * 0.2;
    const a = anclas();
    const ancla = a.reduce((m, x) => (Math.abs(x - destino) < Math.abs(m - destino) ? x : m), a[0]);
    if (ancla === a[2]) cerrar(); else res.a(ancla, pintar, v);
  };
  el.addEventListener("pointerup", soltar, on);
  el.addEventListener("pointercancel", soltar, on);
  el.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", cerrar, on));
  velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(); }, on);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
    if (e.key === "Tab") {
      const l = enfocables(el), i = l.indexOf(document.activeElement);
      if (!l.length) { e.preventDefault(); return; }
      if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && (i === l.length - 1 || i < 0)) { e.preventDefault(); l[0].focus(); }
    }
  }, { capture: true, signal: ac.signal });
  // si cambia el tamaño (rotar el celular), se queda en su ancla
  addEventListener("resize", () => { const a = anclas(); res.fijar(a[1]); pintar(a[1]); }, on);
}
