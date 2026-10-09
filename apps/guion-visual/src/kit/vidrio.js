/* Vidrio líquido de verdad (portado del guion de Medula, sin React).
   Cada pieza genera su mapa de desplazamiento a partir de su forma (rectángulo
   redondeado): en el canto la luz se dobla hacia adentro como un lente convexo.
   Se aplica como backdrop-filter con un filtro SVG (solo Chromium lo pinta);
   Safari y Firefox reciben vidrio esmerilado.

   Uso:  <div class="vidrio" data-vidrio data-radio="28" data-refraccion="46">…</div>
         montarVidrios(raiz)  ·  vidrio.actualizar(el) si cambian sus parámetros
   Atributos: data-radio (px | "pildora"), data-bisel, data-refraccion, data-desenfoque,
              data-aberracion (≥ 0,14 = prisma de 3 pasadas), data-saturacion,
              data-liviano (sin filtro: láminas grandes), data-vivo (cambia de tamaño). */

export const REFRACCION_REAL = /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
const NS = "http://www.w3.org/2000/svg";
const cache = new Map();
let uid = 0;

/** Mapa de desplazamiento de un rectángulo redondeado (R = x, G = y, 0,5 = quieto). */
export function mapaDesplazamiento(w, h, radio, bisel) {
  const clave = `${w}x${h}r${radio}b${bisel}`;
  if (cache.has(clave)) return cache.get(clave);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const r = Math.min(radio, w / 2, h / 2), mx = w / 2 - r, my = h / 2 - r, b = Math.max(1, bisel);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - mx, qy = Math.abs(py) - my;
      let nx = 0, ny = 0, dist;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; dist = r - l; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
      else if (qx > qy) { dist = r - qx; nx = Math.sign(px); }
      else { dist = r - qy; ny = Math.sign(py); }
      // perfil convexo tipo squircle: casi nada al centro, fuerte en el canto
      const m = dist < b ? Math.pow(1 - Math.max(0, dist) / b, 2.2) : 0;
      const i = (y * w + x) * 4;
      img.data[i] = 128 - nx * m * 127;
      img.data[i + 1] = 128 - ny * m * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL("image/png");
  cache.set(clave, url);
  return url;
}

// los filtros viven en un portal fuera de las piezas (un <svg> dentro de un <button>
// no siempre se puede referenciar desde backdrop-filter)
let portal;
function defs() {
  if (!portal) {
    portal = document.createElementNS(NS, "svg");
    portal.setAttribute("class", "vidrio__defs");
    portal.setAttribute("aria-hidden", "true");
    portal.setAttribute("width", "0");
    portal.setAttribute("height", "0");
    document.body.appendChild(portal);
  }
  return portal;
}

const num = (el, k, d) => (el.dataset[k] !== undefined && el.dataset[k] !== "" ? Number(el.dataset[k]) : d);

function pintar(el, w, h) {
  const st = el._vidrio;
  const radio = el.dataset.radio === "pildora" ? h / 2 : num(el, "radio", 28);
  const bisel = num(el, "bisel", 24), refr = num(el, "refraccion", 46), blur = num(el, "desenfoque", 2);
  const aber = num(el, "aberracion", 0.1), sat = num(el, "saturacion", 1.5);
  el.style.borderRadius = el.dataset.radio === "pildora" ? "999px" : `${radio}px`;
  if (!REFRACCION_REAL || el.dataset.liviano !== undefined || w < 3 || h < 3) return;
  const mapa = mapaDesplazamiento(w, h, radio, bisel);
  const prisma = aber >= 0.14, base = blur > 0.5 ? "base" : "SourceGraphic";
  const f = st.filtro;
  f.setAttribute("width", w); f.setAttribute("height", h);
  f.innerHTML =
    `<feImage href="${mapa}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="mapa"/>` +
    (blur > 0.5 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="base"/>` : "") +
    (prisma
      ? `<feDisplacementMap in="${base}" in2="mapa" scale="${refr}" xChannelSelector="R" yChannelSelector="G" result="dR"/>` +
        `<feDisplacementMap in="${base}" in2="mapa" scale="${refr * (1 - aber)}" xChannelSelector="R" yChannelSelector="G" result="dG"/>` +
        `<feDisplacementMap in="${base}" in2="mapa" scale="${refr * (1 - aber * 2)}" xChannelSelector="R" yChannelSelector="G" result="dB"/>` +
        `<feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>` +
        `<feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>` +
        `<feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>` +
        `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen" result="rgb"/>` +
        `<feColorMatrix in="rgb" type="saturate" values="${sat}"/>`
      : `<feDisplacementMap in="${base}" in2="mapa" scale="${refr}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
        `<feColorMatrix in="d" type="saturate" values="${sat}"/>`);
  st.lente.style.backdropFilter = `url(#${st.id})`;
  st.lente.style.webkitBackdropFilter = `url(#${st.id})`;
  el.classList.add("vidrio--real");
  el.classList.remove("vidrio--esmerilado");
}

/** Convierte un elemento en vidrio. */
export function hacerVidrio(el) {
  if (el._vidrio) return el._vidrio;
  const id = `vid${++uid}`;
  const lente = document.createElement("span");
  lente.className = "vidrio__lente";
  lente.setAttribute("aria-hidden", "true");
  el.prepend(lente);
  el.classList.add("vidrio");
  const liviano = el.dataset.liviano !== undefined;
  el.classList.add(liviano ? "vidrio--liviano" : "vidrio--esmerilado");
  const filtro = document.createElementNS(NS, "filter");
  filtro.setAttribute("id", id);
  filtro.setAttribute("x", "0"); filtro.setAttribute("y", "0");
  filtro.setAttribute("filterUnits", "userSpaceOnUse");
  filtro.setAttribute("color-interpolation-filters", "sRGB");
  defs().appendChild(filtro);
  const st = (el._vidrio = { id, lente, filtro, w: 0, h: 0, t: 0, ultimo: 0, primera: true });
  const vivo = el.dataset.vivo !== undefined;
  const ro = new ResizeObserver(([e]) => {
    const red = (n) => (vivo ? Math.round(n / 2) * 2 : Math.round(n));
    const w = red(e.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth), h = red(e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
    if (w === st.w && h === st.h) return;
    clearTimeout(st.t);
    const poner = () => { st.w = w; st.h = h; st.ultimo = performance.now(); pintar(el, w, h); };
    if (st.primera) { st.primera = false; poner(); return; }
    // mientras cambia de tamaño, como mucho cada 100 ms (generar el mapa es lo caro)
    const espera = vivo ? Math.max(0, 100 - (performance.now() - st.ultimo)) : 120;
    st.t = setTimeout(poner, espera);
  });
  ro.observe(el);
  st.ro = ro;
  return st;
}

/** Vuelve a pintar con los atributos actuales (p. ej. desde un deslizador). */
export function actualizar(el) {
  const st = el._vidrio;
  if (st && st.w) pintar(el, st.w, st.h);
}

export function montarVidrios(raiz = document) {
  raiz.querySelectorAll("[data-vidrio]").forEach(hacerVidrio);
}

// brillo especular: sigue al puntero, una vez por cuadro, solo en vidrios con filtro
let pendiente = null, raf = 0;
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest?.(".vidrio:not(.vidrio--liviano)");
  if (!el) return;
  pendiente = { x: e.clientX, y: e.clientY, el };
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const p = pendiente;
    if (!p) return;
    const lente = p.el._vidrio?.lente;
    if (!lente) return;
    const r = p.el.getBoundingClientRect();
    lente.style.setProperty("--bx", `${(((p.x - r.left) / r.width) * 100).toFixed(1)}%`);
    lente.style.setProperty("--by", `${(((p.y - r.top) / r.height) * 100).toFixed(1)}%`);
  });
}, { passive: true });
