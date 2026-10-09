/* Controles del kit.
   - Segmentado: <div class="segmentado" role="radiogroup"> con <button role="radio">; una lente de
     acrílico viaja con resorte y se estira hacia donde va mientras se mueve.
   - Deslizador: <label class="deslizador"><input type="range" data-formato="clp|%|n"><output>
   - Contador:   <div class="contador" data-min data-max> con − valor +
   - Botón con estados en capas: <button class="btn" data-estados> quieto → cargando → listo. */
import { hacerAcrilico } from "./acrilico.js";
import { Resorte } from "./resorte.js";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const formatos = { clp: (v) => clp.format(v), "%": (v) => `${v} %`, n: (v) => String(v), h: (v) => `${v} h`, px: (v) => `${v} px` };
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function montarControles(raiz = document) {
  // ── segmentado con lente que viaja ──
  raiz.querySelectorAll(".segmentado").forEach((seg) => {
    const lente = document.createElement("span");
    lente.className = "seg-lente";
    lente.setAttribute("aria-hidden", "true");
    lente.dataset.acrilico = ""; lente.dataset.radio = "pildora"; seg.prepend(lente);
    hacerAcrilico(lente);
    const tabs = [...seg.querySelectorAll('[role="radio"]')];
    // el ancho de cada opción se reserva en negrita (CSS ::after con data-texto)
    tabs.forEach((t) => (t.dataset.texto = t.textContent.trim()));
    const x = new Resorte(0, { rigidez: 340, amortiguacion: 26 }), w = new Resorte(0, { rigidez: 340, amortiguacion: 28 });
    const pintar = () => {
      // se estira hacia donde viaja según la velocidad, y se afina un poco al estirarse
      const estira = Math.min(22, Math.abs(x.v) * 0.014);
      const izq = x.v < 0 ? estira : 0;
      lente.style.transform = `translateX(${(x.x - izq).toFixed(2)}px) scaleY(${(1 - estira / 160).toFixed(4)})`;
      lente.style.width = `${(w.x + estira).toFixed(2)}px`;
    };
    const ir = (b, instante) => {
      const antes = tabs.find((t) => t.getAttribute("aria-checked") === "true");
      tabs.forEach((t) => { t.setAttribute("aria-checked", String(t === b)); t.tabIndex = t === b ? 0 : -1; });
      // medidas de diseño (offset*): no las altera la escala del botón apretado
      const nx = b.offsetLeft, nw = b.offsetWidth;
      const r = b.getBoundingClientRect(), s = seg.getBoundingClientRect();
      if (instante) { x.fijar(nx); w.fijar(nw); pintar(); return; }
      x.a(nx, pintar); w.a(nw, pintar);
      // si la opción quedó fuera (segmentado con scroll en el celular), se trae a la vista
      if (r.left < s.left || r.right > s.right) b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducido() ? "auto" : "smooth" });
      if (antes !== b) seg.dispatchEvent(new CustomEvent("cambio", { detail: b.dataset.valor ?? b.dataset.texto }));
    };
    tabs.forEach((b, i) => {
      b.addEventListener("click", () => ir(b));
      b.addEventListener("keydown", (e) => {
        const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (j === null) return;
        e.preventDefault();
        const t = tabs[(j + tabs.length) % tabs.length];
        t.focus(); ir(t);
      });
    });
    const activo = () => tabs.find((t) => t.getAttribute("aria-checked") === "true") || tabs[0];
    requestAnimationFrame(() => ir(activo(), true));
    // al cambiar de tamaño (fuentes que cargan, rotar) la lente se reubica sin viajar
    new ResizeObserver(() => ir(activo(), true)).observe(seg);
    document.fonts?.ready.then(() => ir(activo(), true));
  });

  // ── deslizador ──
  raiz.querySelectorAll(".deslizador").forEach((d) => {
    const inp = d.querySelector('input[type="range"]'), out = d.querySelector("output");
    const f = formatos[inp.dataset.formato] || formatos.n;
    const pintar = () => {
      const p = ((inp.value - inp.min) / (inp.max - inp.min)) * 100;
      inp.style.setProperty("--p", `${p}%`);
      if (out) out.textContent = f(Number(inp.value));
      inp.setAttribute("aria-valuetext", f(Number(inp.value)));
    };
    if (out) { out.setAttribute("aria-hidden", "true"); }   // el valor ya lo lee aria-valuetext
    inp.addEventListener("input", pintar);
    pintar();
  });

  // ── contador ──
  raiz.querySelectorAll(".contador").forEach((c) => {
    const min = Number(c.dataset.min ?? 0), max = Number(c.dataset.max ?? 99);
    const val = c.querySelector(".contador-valor"), menos = c.querySelector('[data-paso="-1"]'), mas = c.querySelector('[data-paso="1"]');
    let v = Number(val.textContent);
    // el valor se anuncia al cambiar; los topes no sacan el foco del botón (aria-disabled, no disabled)
    val.setAttribute("aria-live", "polite");
    val.setAttribute("aria-atomic", "true");
    c.removeAttribute("aria-valuenow");
    const pintar = (dir) => {
      val.textContent = v;
      menos.setAttribute("aria-disabled", String(v <= min));
      mas.setAttribute("aria-disabled", String(v >= max));
      // la cifra rueda en la dirección del cambio
      if (dir) { val.classList.remove("rueda-arriba", "rueda-abajo"); void val.offsetWidth; val.classList.add(dir > 0 ? "rueda-arriba" : "rueda-abajo"); }
    };
    const paso = (p) => {
      const nuevo = Math.min(max, Math.max(min, v + p));
      if (nuevo === v) {
        // en el tope: un pequeño rebote dice "hasta aquí"
        c.style.setProperty("--tope", `${p > 0 ? 4 : -4}px`);
        c.classList.remove("tope"); void c.offsetWidth; c.classList.add("tope");
        return false;
      }
      v = nuevo; pintar(p);
      return true;
    };
    c.addEventListener("animationend", (e) => { if (e.target === c) c.classList.remove("tope"); });
    [menos, mas].forEach((b) => {
      const p = Number(b.dataset.paso);
      b.addEventListener("click", (e) => { if (e.detail === 0 || !b._repetido) paso(p); b._repetido = false; });
      // mantener apretado repite, cada vez más rápido
      let t;
      const parar = () => clearTimeout(t);
      b.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        b._repetido = false;
        let espera = 420;
        const otra = () => { t = setTimeout(() => { if (paso(p)) { b._repetido = true; espera = Math.max(70, espera * 0.75); otra(); } }, espera); };
        otra();
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, parar));
    });
    // flechas también sobre el grupo
    c.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); paso(1); }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); paso(-1); }
    });
    pintar();
  });

  // ── botón con estados en capas ──
  raiz.querySelectorAll("[data-estados]").forEach((b) => {
    if (!b.querySelector(".capa")) {
      const txt = b.innerHTML;
      b.innerHTML = `<span class="capa capa-quieto">${txt}</span><span class="capa capa-cargando" aria-hidden="true"><span class="anillo"></span>${b.dataset.cargando || "Enviando"}</span><span class="capa capa-listo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>${b.dataset.listo || "Listo"}</span>`;
    }
    const quieto = b.querySelector(".capa-quieto");
    b.addEventListener("click", () => {
      if (b.dataset.estado) return;
      b.dataset.estado = "cargando";
      b.setAttribute("aria-busy", "true");
      b.setAttribute("aria-label", b.dataset.cargando || "Enviando");
      quieto.setAttribute("aria-hidden", "true");
      setTimeout(() => { b.dataset.estado = "listo"; b.removeAttribute("aria-busy"); b.setAttribute("aria-label", b.dataset.listo || "Listo"); }, 1600);
      setTimeout(() => { delete b.dataset.estado; b.removeAttribute("aria-label"); quieto.removeAttribute("aria-hidden"); }, 3400);
    });
  });
}
