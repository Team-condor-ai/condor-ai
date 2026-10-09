// Hoja P3 · el logo como sistema.
// node herramientas/hoja-logo.mjs  →  hojas/p3-logo.html  (usa assets/marca/, correr antes `npm run marca`)
import fs from "node:fs";

const M = (() => { const s = fs.readFileSync("assets/marca-datos.js", "utf8"); return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); })();
const { negro: TINTA, azul: AZUL } = M.tintas;
const a = (f) => `../assets/marca/${f}`;
const H = M.lockupH, X = M.medidas.altoX;
const vb = (v) => v.join(" ");

// área de respeto: alto de x por cada lado
const resp = [H.vb[0] - X, H.vb[1] - X, H.vb[2] + 2 * X, H.vb[3] + 2 * X];
const respeto = `<svg viewBox="${vb(resp)}" class="resp" aria-label="Área de respeto del logo">
  <rect x="${resp[0]}" y="${resp[1]}" width="${resp[2]}" height="${resp[3]}" fill="#EEF3FF"/>
  <rect x="${H.vb[0]}" y="${H.vb[1]}" width="${H.vb[2]}" height="${H.vb[3]}" fill="#fff"/>
  <rect x="${resp[0]}" y="${resp[1]}" width="${resp[2]}" height="${resp[3]}" fill="none" stroke="${AZUL}" stroke-width="2" stroke-dasharray="8 6"/>
  <g fill="${TINTA}">${H.cuerpo}</g>
  <g fill="${AZUL}" font-family="-apple-system,Inter,sans-serif" font-size="34" font-weight="600">
    <text x="${H.vb[0] - X / 2}" y="${H.vb[1] + H.vb[3] / 2 + 12}" text-anchor="middle">x</text>
    <text x="${H.vb[0] + H.vb[2] + X / 2}" y="${H.vb[1] + H.vb[3] / 2 + 12}" text-anchor="middle">x</text>
    <text x="${H.vb[0] + H.vb[2] / 2}" y="${H.vb[1] - X / 2 + 12}" text-anchor="middle">x</text>
    <text x="${H.vb[0] + H.vb[2] / 2}" y="${H.vb[1] + H.vb[3] + X / 2 + 12}" text-anchor="middle">x</text>
  </g></svg>`;

const fondos = [
  ["#FFFFFF", "negro", "Negro sobre blanco", "La principal"],
  ["#FFFFFF", "azul", "Azul sobre blanco", "Marca, momentos de color"],
  [TINTA, "blanco", "Blanco sobre tinta", "Fondos oscuros, video"],
  [AZUL, "blanco", "Blanco sobre azul", "Redes, piezas de marca"],
];
const ficha = (pieza, [fondo, tinta, t, s]) => `<figure class="f"><div class="lienzo ${pieza}" style="background:${fondo}${fondo === "#FFFFFF" ? ";box-shadow:inset 0 0 0 1px #DDDDDF" : ""}"><img src="${a(`condor-logo-${pieza}-${tinta}.svg`)}" alt="Logo ${pieza} ${t}"></div><figcaption><b>${t}</b><span>${s}</span><a href="${a(`condor-logo-${pieza}-${tinta}.svg`)}" download>SVG</a></figcaption></figure>`;
const noes = [
  ["transform:scaleX(1.35)", "No deformar"],
  ["transform:rotate(-12deg)", "No rotar"],
  ["filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))", "No agregar sombras ni efectos"],
  ["opacity:.25", "No usar sin contraste"],
];

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P3 · Logo condor.ai</title>
<style>
:root{--tinta:${TINTA};--azul:${AZUL};--gris:#636368;--linea:#DDDDDF}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--tinta);font:16px/1.5 -apple-system,"SF Pro Text",Inter,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:48px 24px 96px}
h1{font:600 30px/1.1 -apple-system,"SF Pro Display",Inter,sans-serif;letter-spacing:-.02em;margin:0}
h2{font:600 20px/1.2 -apple-system,Inter,sans-serif;margin:64px 0 6px;letter-spacing:-.01em}
.sub{color:var(--gris);margin:6px 0 0;max-width:70ch}
.rejilla{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:20px}
.rejilla.cuatro{grid-template-columns:repeat(4,1fr)}
.f{margin:0;display:grid;gap:10px}
.lienzo{border-radius:18px;display:grid;place-items:center;aspect-ratio:16/8;padding:10% 12%}
.lienzo.vertical{aspect-ratio:4/3;padding:12% 26%}
.lienzo img{width:100%;height:auto;display:block}
figcaption{display:grid;grid-template-columns:1fr auto;font-size:14px;color:var(--gris)}
figcaption b{color:var(--tinta);font-weight:600}
figcaption a{grid-row:1/3;grid-column:2;align-self:center;font:500 13px -apple-system,Inter,sans-serif;color:var(--azul);text-decoration:none;padding:6px 12px;border-radius:10px;background:#EEF3FF}
.solos{display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-top:20px}
.solos .lienzo{aspect-ratio:auto;height:220px;padding:28px}
.solos .lienzo img{width:auto;height:160px;max-width:100%}
.solos .lienzo.word img{height:auto;width:78%}
.iconos{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-end;margin-top:20px}
.iconos figure{margin:0;display:grid;justify-items:center;gap:8px;font-size:13px;color:var(--gris)}
.resp{width:100%;height:auto;display:block;margin-top:20px}
.minimos{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.minimos .lienzo{aspect-ratio:auto;height:120px;box-shadow:inset 0 0 0 1px var(--linea)}
.minimos p{margin:0;font-size:14px;color:var(--gris)}.minimos b{color:var(--tinta)}
.no .lienzo{box-shadow:inset 0 0 0 1px var(--linea);overflow:hidden}
.no figcaption{grid-template-columns:1fr}.no figcaption b::before{content:"✕  ";color:#D3222E}
@media (max-width:900px){.rejilla,.rejilla.cuatro,.solos,.minimos{grid-template-columns:1fr}}
</style></head><body><main>
<h1>P3 · El logo</h1>
<p class="sub">El cóndor elegido (B7, cuello lleno, plumas romas) con las letras Inter Display Semibold. El cóndor mide 1,8 veces el alto de x y se separa del nombre 0,34 alto de x. Siempre en una sola tinta.</p>

<h2>Horizontal</h2><p class="sub">La versión por defecto: barra del sitio, documentos, firmas, presentaciones.</p>
<div class="rejilla">${fondos.map((f) => ficha("horizontal", f)).join("")}</div>

<h2>Vertical</h2><p class="sub">Formatos cuadrados, portadas, merch.</p>
<div class="rejilla cuatro">${fondos.map((f) => ficha("vertical", f)).join("")}</div>

<h2>Isotipo y nombre</h2><p class="sub">El cóndor solo para avatares, sellos y cierres de video. El nombre solo cuando el cóndor ya está presente en la pieza.</p>
<div class="solos">
  <figure class="f"><div class="lienzo" style="box-shadow:inset 0 0 0 1px #DDDDDF"><img src="${a("condor-isotipo-negro.svg")}" alt="Isotipo"></div><figcaption><b>Isotipo</b><span>Avatares, sellos</span><a href="${a("condor-isotipo-negro.svg")}" download>SVG</a></figcaption></figure>
  <figure class="f"><div class="lienzo word" style="box-shadow:inset 0 0 0 1px #DDDDDF"><img src="${a("condor-wordmark-negro.svg")}" alt="Nombre"></div><figcaption><b>Nombre</b><span>Inter Display Semibold, en vector propio</span><a href="${a("condor-wordmark-negro.svg")}" download>SVG</a></figcaption></figure>
</div>

<h2>Ícono de app</h2><p class="sub">Squircle continuo, como los íconos de Apple. El cóndor ocupa el 66 % del ancho, apenas corrido a la izquierda para quedar centrado a la vista.</p>
<div class="iconos">
  ${["azul", "blanco", "tinta"].map((i) => `<figure><img src="${a(`icono-${i}.svg`)}" width="120" height="120" alt="Ícono ${i}"><span>${i}</span></figure>`).join("")}
  ${[64, 32, 16].map((t) => `<figure><img src="${a("icono-azul.svg")}" width="${t}" height="${t}" alt=""><span>${t} px</span></figure>`).join("")}
</div>

<h2>Área de respeto</h2><p class="sub">Alrededor del logo queda libre, como mínimo, el alto de x de las letras (la "x" de la figura) por cada lado.</p>
${respeto}

<h2>Tamaños mínimos</h2>
<div class="minimos">
  <div class="f"><div class="lienzo"><img src="${a("condor-logo-horizontal-negro.svg")}" style="width:110px" alt=""></div><p><b>Horizontal · 110 px</b> de ancho en pantalla, 28 mm impreso.</p></div>
  <div class="f"><div class="lienzo"><img src="${a("condor-logo-vertical-negro.svg")}" style="width:64px" alt=""></div><p><b>Vertical · 64 px</b> de ancho, 18 mm impreso.</p></div>
  <div class="f"><div class="lienzo"><img src="${a("condor-isotipo-negro.svg")}" style="width:20px" alt=""></div><p><b>Isotipo · 20 px</b>. Más chico, usar el ícono de app.</p></div>
</div>

<h2>Usos incorrectos</h2>
<div class="rejilla cuatro no">${noes.map(([css, t]) => `<figure class="f"><div class="lienzo"><img src="${a("condor-logo-horizontal-negro.svg")}" style="${css}" alt=""></div><figcaption><b>${t}</b></figcaption></figure>`).join("")}</div>
</main></body></html>`;
fs.writeFileSync("hojas/p3-logo.html", html);
console.log("hojas/p3-logo.html");
