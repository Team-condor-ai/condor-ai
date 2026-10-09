// Hoja P2c · letras tipo Apple (Inter Display), con animaciones.
// node herramientas/hoja-tipo.mjs  →  hojas/p2c-letras.html
import fs from "node:fs";
import { componer, BL, XH } from "./tipo.mjs";
import { path, VARIANTES, ANCHO, ALTO } from "./condor.mjs";

const AZUL = "#014CFD", TINTA = "#151517";
const condorD = path(VARIANTES.oficial);
let uid = 0;

/** Logo horizontal como SVG. modo: "quieto" | "escritura" | "subida" | "vuelo" */
function logo(peso, { modo = "quieto", color = TINTA, alto = 120, soloLetras = false } = {}) {
  const W = componer(peso);
  const hC = 1.5 * XH, wC = (hC * ANCHO) / ALTO, gap = soloLetras ? 0 : 0.36 * XH;
  const x0 = soloLetras ? 0 : wC + gap, top = W.top - 4, base = BL + 6;
  const vbW = x0 + W.w, vbH = base - top;
  const id = `l${++uid}`;
  let defs = "", cuerpo = "";
  if (!soloLetras) cuerpo += `<g class="cn"><svg x="0" y="${BL - hC + 2}" width="${wC}" height="${hC}" viewBox="0 0 ${ANCHO} ${ALTO}"><path fill-rule="evenodd" d="${condorD}"/></svg></g>`;
  let paso = 0;
  const letras = W.letras.map((l, k) => {
    // el grupo de afuera posiciona; el de adentro es el que se anima (si no, la animación pisa la posición)
    const g0 = `<g transform="translate(${x0} 0)"><g class="le" style="--k:${k}">`;
    if (modo !== "escritura") return `${g0}<path d="${l.d}"/></g></g>`;
    // máscara: los trazos del esqueleto se dibujan uno tras otro; los puntos aparecen al final
    const m = `${id}m${k}`;
    const trazos = l.e.map((e) => `<path class="t" pathLength="1" style="--d:${(0.55 + 0.11 * paso++).toFixed(2)}s" d="${e}"/>`).join("");
    const puntos = l.p.map(([cx, cy, r]) => `<circle class="p" style="--d:${(0.55 + 0.11 * paso++).toFixed(2)}s" cx="${cx}" cy="${cy}" r="${r * 1.3}"/>`).join("");
    defs += `<mask id="${m}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="${W.w + 100}" height="300"><g fill="none" stroke="#fff" stroke-width="${W.V * 2.5}" stroke-linecap="round" stroke-linejoin="round">${trazos}</g><g fill="#fff">${puntos}</g></mask>`;
    return `${g0}<path d="${l.d}" mask="url(#${m})"/></g></g>`;
  }).join("");
  cuerpo += `<g class="letras" style="--w:${W.w}">${letras}</g>`;
  return `<svg class="logo m-${modo}" viewBox="0 ${top} ${vbW} ${vbH}" style="height:${alto}px;color:${color};--avance:${(vbW / vbH) * alto}px" fill="currentColor" role="img" aria-label="condor.ai"><defs>${defs}</defs>${cuerpo}</svg>`;
}

const pesos = [["medium", "Medium", "Más liviana"], ["semibold", "Semibold", "La que recomiendo"], ["bold", "Bold", "Más pesada"]];
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P2c · Letras condor.ai</title>
<style>
:root{--tinta:${TINTA};--azul:${AZUL};--gris:#636368;--linea:#DDDDDF;--llegada:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--tinta);font:16px/1.5 -apple-system,"SF Pro Text",Inter,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:48px 24px 96px}
h1{font:600 30px/1.1 -apple-system,"SF Pro Display",Inter,sans-serif;letter-spacing:-.02em;margin:0}
h2{font:600 20px/1.2 -apple-system,Inter,sans-serif;margin:56px 0 6px;letter-spacing:-.01em}
.sub{color:var(--gris);margin:6px 0 0}
.escena{position:relative;border:1px solid var(--linea);border-radius:20px;display:grid;place-items:center;padding:56px 24px;margin-top:20px;overflow:hidden}
.escena.oscura{background:var(--tinta);border-color:var(--tinta)}
.otra{position:absolute;right:14px;bottom:14px;height:32px;padding:0 12px;border-radius:10px;border:0;background:#F2F2F4;color:var(--gris);font:500 13px -apple-system,Inter,sans-serif;cursor:pointer}
.otra:hover{background:#E8EEFF;color:var(--azul)}
.fila{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.ficha{border:1px solid var(--linea);border-radius:20px;padding:24px;display:grid;gap:18px}
.ficha b{font-weight:600}.ficha span{color:var(--gris);font-size:14px}
.ficha .neg{background:var(--tinta);border-radius:12px;padding:18px;display:grid;place-items:center}
.anims{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.anims .escena{padding:44px 16px 64px}
.anims p{margin:10px 0 0;color:var(--gris);font-size:14px}
@media (max-width:900px){.fila,.anims{grid-template-columns:1fr}}
svg.logo{display:block;max-width:100%;height:auto;overflow:visible}

/* Escritura: los trazos del esqueleto se dibujan y los puntos aparecen */
.m-escritura .t{stroke-dasharray:1;stroke-dashoffset:1}
.m-escritura .p{transform-box:fill-box;transform-origin:center;transform:scale(0)}
.m-escritura .cn{opacity:0}
.corre .m-escritura .t{animation:trazo .62s cubic-bezier(.65,0,.35,1) var(--d) forwards}
.corre .m-escritura .p{animation:punto .5s cubic-bezier(.34,1.6,.64,1) var(--d) forwards}
.corre .m-escritura .cn{animation:planeo 1.1s var(--llegada) forwards}
@keyframes trazo{to{stroke-dashoffset:0}}
@keyframes punto{to{transform:scale(1)}}
@keyframes planeo{from{opacity:0;transform:translate(-28px,18px) rotate(-4deg)}to{opacity:1;transform:none}}

/* Subida: cada letra sube y se enfoca (estilo keynote) */
.m-subida .le,.m-subida .cn{transform-box:fill-box;opacity:0}
.corre .m-subida .cn{animation:planeo 1s var(--llegada) forwards}
.corre .m-subida .le{animation:sube .9s var(--llegada) calc(.25s + var(--k) * .045s) forwards}
@keyframes sube{from{opacity:0;transform:translateY(45%);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}

/* Vuelo: el cóndor cruza de derecha a izquierda y destapa el nombre */
.m-vuelo .cn{transform:translateX(100%)}
.m-vuelo .letras{clip-path:inset(0 0 0 100%)}
.corre .m-vuelo .cn{animation:cruza 1.5s cubic-bezier(.45,0,.2,1) forwards}
.corre .m-vuelo .letras{animation:destapa 1.5s cubic-bezier(.45,0,.2,1) forwards}
@keyframes cruza{from{transform:translateX(100%)}to{transform:none}}
@keyframes destapa{to{clip-path:inset(0 0 0 0)}}

@media (prefers-reduced-motion:reduce){.logo *{animation:none!important;opacity:1!important;transform:none!important;clip-path:none!important;stroke-dashoffset:0!important;filter:none!important}}
</style></head><body><main>
<h1>P2c · Letras tipo Apple</h1>
<p class="sub">Contornos de Inter Display (la alternativa abierta más cercana a SF Pro Display), pasados a vector propio y con esqueleto por letra para animarse.</p>

<div class="escena corre" id="e0">${logo("semibold", { modo: "escritura", alto: 150 })}<button class="otra" data-otra="e0">Otra vez</button></div>

<h2>Pesos</h2>
<p class="sub">Mismas formas en tres grosores.</p>
<div class="fila">${pesos.map(([p, n, d]) => `<div class="ficha"><div><b>${n}</b> · <span>${d}</span></div>${logo(p, { alto: 64 })}${logo(p, { alto: 34, color: AZUL })}<div class="neg">${logo(p, { alto: 38, color: "#fff" })}</div></div>`).join("")}</div>

<h2>Animaciones de firma</h2>
<p class="sub">Lo que permite tener las letras en vector propio, con esqueleto.</p>
<div class="anims">
  <div><div class="escena corre" id="e1">${logo("semibold", { modo: "escritura", alto: 64 })}<button class="otra" data-otra="e1">Otra vez</button></div><p><b>Escritura</b> · el cóndor planea y el nombre se escribe trazo a trazo. Carga del sitio, cierres de video.</p></div>
  <div><div class="escena corre" id="e2">${logo("semibold", { modo: "subida", alto: 64 })}<button class="otra" data-otra="e2">Otra vez</button></div><p><b>Subida</b> · cada letra sube y se enfoca, una tras otra. Portadas y entradas de sección.</p></div>
  <div><div class="escena corre" id="e3">${logo("semibold", { modo: "vuelo", alto: 64 })}<button class="otra" data-otra="e3">Otra vez</button></div><p><b>Vuelo</b> · el cóndor cruza y va destapando el nombre. Intro de video y presentaciones.</p></div>
</div>
</main>
<script>
document.querySelectorAll("[data-otra]").forEach((b) => b.addEventListener("click", () => {
  const e = document.getElementById(b.dataset.otra);
  e.classList.remove("corre"); void e.offsetWidth; e.classList.add("corre");
}));
</script>
</body></html>`;
fs.writeFileSync("hojas/p2c-letras.html", html);
console.log("hojas/p2c-letras.html");
