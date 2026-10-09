/* Avisos: toast (cola), alerta (crece desde su botón) y banner (se pliega).
   Reglas (cerebro · Patrones): el toast confirma lo que TÚ hiciste; máximo 3, en
   abanico al pasar el puntero, no se van con el puntero encima; lo destructivo
   trae Deshacer. La alerta es una decisión sin vuelta: foco en Cancelar, Escape,
   Tab atrapado y el foco vuelve a su botón. */

import { rectReal } from "./popups.js";

// ── Toast ───────────────────────────────────────────────────────────────
const MAX = 3, HUECO = 10;
let pila, encima = false;
const relojes = new Map();
function contenedor() {
  if (!pila) {
    pila = document.createElement("div");
    pila.className = "toasts";
    pila.setAttribute("role", "region");
    pila.setAttribute("aria-label", "Avisos");
    pila.setAttribute("aria-live", "polite");
    // con el puntero encima se abren en abanico y sus relojes se pausan
    pila.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") return; encima = true; orden(); pila.classList.add("abierta"); relojes.forEach((r) => r.pausar()); });
    pila.addEventListener("pointerleave", (e) => { if (e.pointerType === "touch") return; encima = false; pila.classList.remove("abierta"); relojes.forEach((r) => r.seguir()); });
    // con el teclado dentro (Tab a «Deshacer») también se pausan
    pila.addEventListener("focusin", () => relojes.forEach((r) => r.pausar()));
    pila.addEventListener("focusout", (e) => { if (!pila.contains(e.relatedTarget) && !encima) relojes.forEach((r) => r.seguir()); });
    document.body.appendChild(pila);
  }
  return pila;
}
const iconos = {
  ok: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.6v.2"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.2"/>',
};
/** Multiplicador de cámara lenta vigente (--vel). */
export const vel = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1;
const vivos = () => (pila ? [...pila.children].filter((t) => !t.classList.contains("sale")) : []);

/** toast("Guardado", { tono: "ok", deshacer: () => …, duracion: 4200 }) */
export function toast(texto, { tono = "ok", deshacer, duracion = 4200 } = {}) {
  const c = contenedor();
  const t = document.createElement("div");
  t.className = `toast acrilico toast--${tono}`;
  t.dataset.acrilico = ""; t.dataset.denso = "";
  t.setAttribute("role", tono === "error" ? "alert" : "status");
  t.innerHTML = `<svg class="toast-ico" viewBox="0 0 24 24" aria-hidden="true">${iconos[tono] || iconos.info}</svg><span></span>` +
    (deshacer ? `<button type="button" class="toast-accion">Deshacer</button>` : "") +
    `<button type="button" class="toast-cerrar" aria-label="Cerrar aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button>`;
  t.querySelector("span").textContent = texto;
  c.prepend(t);
  import("./acrilico.js").then((v) => v.hacerAcrilico(t));
  // máximo 3 a la vista: el más viejo se va
  vivos().slice(MAX).forEach(salir);
  orden();
  let restante = duracion, inicio = performance.now(), reloj = 0, quieto = false;
  const reloj_ = {
    pausar() { if (quieto) return; quieto = true; clearTimeout(reloj); restante -= performance.now() - inicio; },
    seguir() { if (!quieto) return; quieto = false; inicio = performance.now(); clearTimeout(reloj); restante = Math.max(1200, restante); reloj = setTimeout(() => salir(t), restante); },
  };
  relojes.set(t, reloj_);
  quieto = true; reloj_.seguir();
  if (encima || c.contains(document.activeElement)) reloj_.pausar();   // nace bajo el puntero: espera
  t.querySelector(".toast-cerrar").addEventListener("click", () => salir(t, true));
  t.querySelector(".toast-accion")?.addEventListener("click", () => { deshacer(); salir(t, true); toast("Listo, se deshizo", { tono: "info", duracion: 2200 }); });
  return t;
}
/** Posición de cada uno: --i (profundidad en la pila) y --y (altura real en el abanico). */
function orden() {
  if (!pila) return;
  let y = 0;
  vivos().forEach((t, i) => {
    t.style.setProperty("--i", Math.min(i, MAX));
    t.style.setProperty("--y", `${y}px`);
    t.classList.toggle("atras", i > 0);
    y += t.offsetHeight + HUECO;
  });
  // la pila abierta crece hacia arriba lo que mide el abanico: el puntero no cae entre dos
  const primero = vivos()[0];
  pila.style.setProperty("--abanico", `${Math.max(0, y - HUECO - (primero?.offsetHeight || 0))}px`);
}
function salir(t, porMano = false) {
  if (t.classList.contains("sale")) return;
  relojes.get(t)?.pausar();
  relojes.delete(t);
  // si el foco estaba dentro, pasa al siguiente aviso (o se suelta sin perderse)
  const teniaFoco = t.contains(document.activeElement);
  t.classList.add("sale");
  t.classList.remove("atras");
  orden();
  if (teniaFoco && porMano) (vivos()[0]?.querySelector(".toast-cerrar") || document.body).focus?.();
  const fuera = () => { t.remove(); orden(); if (pila && !pila.children.length) { pila.classList.remove("abierta"); encima = false; } };
  t.addEventListener("animationend", (e) => { if (e.target === t) fuera(); });
  // respaldo: si la animación no corre (pestaña oculta), igual se va
  setTimeout(() => t.isConnected && fuera(), 400 + 300 * vel());
}

// ── Alerta ──────────────────────────────────────────────────────────────
let alertaN = 0;
/** alerta(boton, { titulo, texto, confirmar: "Eliminar", peligro: true }) → Promise<boolean> */
export function alerta(desde, { titulo, texto, confirmar = "Aceptar", cancelar = "Cancelar", peligro = false } = {}) {
  return new Promise((resolver) => {
    const r = rectReal(desde);
    const id = `alerta-${++alertaN}`;
    const velo = document.createElement("div");
    velo.className = "velo";
    velo.innerHTML = `<div class="alerta-caja acrilico" role="alertdialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-d" data-acrilico data-denso data-radio="22">
        <h3 id="${id}-t"></h3><p id="${id}-d"></p>
        <div class="alerta-botones"><button type="button" class="btn suave" data-r="0"></button><button type="button" class="btn ${peligro ? "peligro" : "primario"}" data-r="1"></button></div>
      </div>`;
    const caja = velo.querySelector(".alerta-caja");
    caja.querySelector("h3").textContent = titulo;
    caja.querySelector("p").textContent = texto;
    const botones = [...caja.querySelectorAll("button")];
    botones[0].textContent = cancelar; botones[1].textContent = confirmar;
    document.body.appendChild(velo);
    import("./acrilico.js").then((v) => v.hacerAcrilico(caja));
    // nace del botón: el origen de la escala es el centro del botón (medido sin la escala de entrada)
    caja.style.transformOrigin = `${r.left + r.width / 2 - caja.offsetLeft}px ${r.top + r.height / 2 - caja.offsetTop}px`;
    document.documentElement.classList.add("con-modal");
    botones[0].focus({ preventScroll: true });
    let cerrada = false;
    const cerrar = (v) => {
      if (cerrada) return;
      cerrada = true;
      document.removeEventListener("keydown", teclas, true);
      // vuelve hacia el botón (que pudo moverse si cambió el tamaño)
      const r2 = rectReal(desde);
      caja.style.transformOrigin = `${r2.left + r2.width / 2 - caja.offsetLeft}px ${r2.top + r2.height / 2 - caja.offsetTop}px`;
      velo.classList.add("sale");
      const fin = () => { if (!velo.isConnected) return; velo.remove(); document.documentElement.classList.remove("con-modal"); desde.focus({ preventScroll: true }); };
      velo.addEventListener("animationend", (e) => { if (e.target === velo) fin(); });
      setTimeout(fin, 400 + 240 * vel());
      resolver(v);
    };
    const teclas = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(false); }
      if (e.key === "Tab") {
        // Tab atrapado entre los dos botones
        const i = botones.indexOf(document.activeElement);
        e.preventDefault();
        botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus();
      }
    };
    document.addEventListener("keydown", teclas, true);
    botones.forEach((b) => b.addEventListener("click", () => cerrar(b.dataset.r === "1")));
    velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(false); });
  });
}

// ── Banner ──────────────────────────────────────────────────────────────
export function montarBanners(raiz = document) {
  raiz.querySelectorAll(".banner").forEach((b) => {
    // el detalle se pliega con grid 1fr → 0fr: necesita un hijo que pueda medir 0
    const det = b.querySelector(".banner-detalle");
    if (det && !det.querySelector(".banner-detalle-in")) {
      const dentro = document.createElement("span");
      dentro.className = "banner-detalle-in";
      dentro.append(...det.childNodes);
      det.append(dentro);
      det.id ||= `banner-d-${Math.random().toString(36).slice(2, 7)}`;
    }
    const boton = b.querySelector(".banner-plegar");
    if (det) boton?.setAttribute("aria-controls", det.id);
    boton?.addEventListener("click", () => {
      const plegado = b.classList.toggle("plegado");
      boton.setAttribute("aria-expanded", String(!plegado));
      boton.setAttribute("aria-label", plegado ? "Desplegar aviso" : "Plegar aviso");
    });
  });
}
