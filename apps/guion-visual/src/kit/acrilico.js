/* Acrílico: el material de condor.ai.
   Una lámina lechosa y esmerilada con cuerpo: desenfoca lo que hay detrás (no lo
   dobla: no es vidrio), lo tiñe de blanco, tiene una superficie con textura (grano,
   acanalado o escarcha) y un canto pulido que atrapa la luz. Un brillo suave sigue
   al puntero sobre la superficie.

   Uso:  <div data-acrilico>…</div>             lámina normal
         <div data-acrilico data-denso>…</div>  más opaca: menús, toasts, hojas (texto encima)
         <div data-acrilico data-radio="pildora">…</div>
         montarAcrilicos(raiz)  ·  hacerAcrilico(el)
   La textura es una sola para todo el sitio: <html data-textura="grano|acanalado|escarcha|lisa">
   (ponerTextura() la cambia y la recuerda en este navegador). */

export function hacerAcrilico(el) {
  if (el._acrilico) return el._acrilico;
  const capa = document.createElement("span");
  capa.className = "acrilico__capa";
  capa.setAttribute("aria-hidden", "true");
  el.prepend(capa);
  el.classList.add("acrilico");
  if (el.dataset.denso !== undefined) el.classList.add("acrilico--denso");
  if (el.dataset.radio === "pildora") el.style.borderRadius = "999px";
  else if (el.dataset.radio) el.style.borderRadius = `${el.dataset.radio}px`;
  return (el._acrilico = { capa });
}

export function montarAcrilicos(raiz = document) {
  raiz.querySelectorAll("[data-acrilico]").forEach(hacerAcrilico);
}

// ── textura de la superficie (una para todo el sitio) ──
export const TEXTURAS = ["grano", "acanalado", "escarcha", "lisa"];
export function ponerTextura(t) {
  if (!TEXTURAS.includes(t)) return;
  document.documentElement.dataset.textura = t;
  try { localStorage.setItem("cn-textura", t); } catch { /* sin almacenamiento */ }
  document.dispatchEvent(new CustomEvent("textura", { detail: t }));
}
try { const t = localStorage.getItem("cn-textura"); if (TEXTURAS.includes(t)) document.documentElement.dataset.textura = t; } catch { /* sin almacenamiento */ }
document.documentElement.dataset.textura ||= "grano";

// ── brillo: sigue al puntero sobre la superficie, una vez por cuadro ──
let pendiente = null, raf = 0;
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest?.(".acrilico");
  if (!el) return;
  pendiente = { x: e.clientX, y: e.clientY, el };
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const p = pendiente;
    const capa = p?.el._acrilico?.capa;
    if (!capa) return;
    const r = p.el.getBoundingClientRect();
    capa.style.setProperty("--bx", `${(((p.x - r.left) / r.width) * 100).toFixed(1)}%`);
    capa.style.setProperty("--by", `${(((p.y - r.top) / r.height) * 100).toFixed(1)}%`);
  });
}, { passive: true });
