/* Marca: el logo dibujado por piezas animables y el cóndor como carga.
   Los datos vienen de assets/marca-datos.js (npm run marca). */
const M = window.CONDOR_MARCA;
const H = M.lockupH;
const [ALA, CUERPO] = M.iso.piezas;
let uid = 0;

const condorG = (clases = true) => `<g transform="${H.anim.condor}"><path${clases ? ' class="ala"' : ""} d="${ALA}"/><path${clases ? ' class="cuerpo"' : ""} d="${CUERPO}"/></g>`;
const letrasG = (clases = true) => `<g transform="translate(${H.anim.palabraX} 0)">${M.word.letras.map((l, k) => (clases ? `<g class="le" style="--k:${k}"><path d="${l.d}"/></g>` : `<path d="${l.d}"/>`)).join("")}</g>`;
const vb = (v) => v.join(" ");

/** Logo horizontal con piezas (ala, cuerpo, letras). Con destello agrega una luz enmascarada. */
export function logoH({ destello = false } = {}) {
  const [vx, vy, vw, vh] = H.vb;
  let luz = "";
  if (destello) {
    const id = `lz${++uid}`;
    luz = `<defs><mask id="m${id}" maskUnits="userSpaceOnUse" x="${vx}" y="${vy}" width="${vw}" height="${vh}"><g fill="#fff">${condorG(false)}${letrasG(false)}</g></mask>` +
      `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(18 .5 .5)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
      `<g mask="url(#m${id})"><rect class="luz" style="--viaje:${Math.round(vw * 1.6)}px" x="${vx - vw * 0.4}" y="${vy - 20}" width="${vw * 0.28}" height="${vh + 40}" fill="url(#g${id})"/></g>`;
  }
  return `<svg class="logo" viewBox="${vb(H.vb)}" fill="currentColor" role="img" aria-label="condor.ai"><g class="todo">${condorG()}${letrasG()}</g>${luz}</svg>`;
}
export const isotipo = () => `<svg class="logo iso" viewBox="${vb(M.iso.vb)}" fill="currentColor" role="img" aria-label="condor.ai"><path class="ala" d="${ALA}"/><path class="cuerpo" d="${CUERPO}"/></svg>`;
export const palabra = () => `<svg class="logo" viewBox="${vb(M.word.vb)}" fill="currentColor" role="img" aria-label="condor.ai">${M.word.letras.map((l, k) => `<g class="le" style="--k:${k}"><path d="${l.d}"/></g>`).join("")}</svg>`;
/** Logo horizontal estático (para máscaras y piezas sin animación). */
export const logoPlano = () => `<g transform="${H.anim.condor}"><path d="${ALA}"/><path d="${CUERPO}"/></g>${letrasG(false)}`;
export const DATOS = M;

/** Rellena [data-logo="h|palabra|iso"] (con data-firma y data-alto opcionales). */
export function montarLogos(raiz = document) {
  raiz.querySelectorAll("[data-logo]").forEach((el) => {
    const t = el.dataset.logo;
    el.innerHTML = t === "palabra" ? palabra() : t === "iso" ? isotipo() : logoH({ destello: el.dataset.firma === "destello" });
    if (el.dataset.alto) el.querySelector("svg").style.height = `${el.dataset.alto}px`;
  });
}

/* ── El cóndor como carga ────────────────────────────────────────────────
   Estados: armar (entra) → espera (planea) → progreso (0–1: el ala se llena)
   → listo (check). Nunca un spinner genérico.
   const c = cargaCondor(el); c.estado("espera"); c.progreso(0.4); c.listo(); */
export function cargaCondor(el, { texto = "" } = {}) {
  const id = `cc${++uid}`;
  el.classList.add("carga-condor");
  el.innerHTML = `<svg viewBox="${vb(M.iso.vb)}" aria-hidden="true">
      <defs><clipPath id="${id}"><rect class="cc-nivel" x="${M.iso.vb[0]}" y="${M.iso.vb[1]}" width="${M.iso.vb[2]}" height="${M.iso.vb[3]}"/></clipPath></defs>
      <g class="cc-fantasma"><path d="${ALA}"/><path d="${CUERPO}"/></g>
      <g class="cc-tinta" clip-path="url(#${id})"><path class="ala" d="${ALA}"/><path class="cuerpo" d="${CUERPO}"/></g>
    </svg>
    <svg class="cc-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>
    <span class="cc-texto" role="status" aria-live="polite">${texto}</span>`;
  const nivel = el.querySelector(".cc-nivel");
  const [, y0, , h] = M.iso.vb;
  const api = {
    estado(e) { el.dataset.estado = e; return api; },
    progreso(p) {
      el.dataset.estado = "progreso";
      const q = Math.max(0, Math.min(1, p));
      nivel.setAttribute("y", y0 + h * (1 - q));
      nivel.setAttribute("height", h * q);
      return api;
    },
    listo(t) { nivel.setAttribute("y", y0); nivel.setAttribute("height", h); el.dataset.estado = "listo"; if (t) api.texto(t); return api; },
    texto(t) { el.querySelector(".cc-texto").textContent = t; return api; },
  };
  return api.estado("armar");
}
