// Hoja P4 · íconos de producto.  node herramientas/hoja-productos.mjs  →  hojas/p4-productos.html
import fs from "node:fs";
import { PRODUCTOS, ESTILOS } from "./iconos.mjs";

const a = (f) => `../assets/marca/${f}`;
const ids = Object.keys(PRODUCTOS);
const nombre = (n) => `<span class="nom"><span class="c">condor</span> ${n}</span>`;
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P4 · Productos condor.ai</title>
<style>
@font-face{font-family:"Inter Display";src:url("../assets/fuentes/inter-display/InterDisplay-SemiBold.ttf") format("truetype");font-weight:600}
:root{--tinta:#151517;--azul:#014CFD;--gris:#636368;--linea:#DDDDDF}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--tinta);font:16px/1.5 -apple-system,"SF Pro Text",Inter,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:48px 24px 96px}
h1{font:600 30px/1.1 "Inter Display",-apple-system,sans-serif;letter-spacing:-.02em;margin:0}
h2{font:600 20px/1.2 "Inter Display",-apple-system,sans-serif;margin:64px 0 6px}
.sub{color:var(--gris);margin:6px 0 0;max-width:72ch}
.familia{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px}
.p{border:1px solid var(--linea);border-radius:22px;padding:28px 24px;display:grid;justify-items:center;gap:14px;text-align:center}
.p img{width:168px;height:168px;transition:transform .5s cubic-bezier(.16,1,.3,1)}
.p:hover img{transform:translateY(-4px) scale(1.03)}
.nom{font:600 22px/1.1 "Inter Display",-apple-system,sans-serif;letter-spacing:-.02em}.nom .c{color:#9A9AA2}
.p small{color:var(--gris);font-size:14px}
.ref{background:#F6F6F8}
.tam{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-end;margin-top:24px}
.tam div{display:flex;gap:14px;align-items:flex-end}
.tam span{display:block;font-size:12px;color:var(--gris);text-align:center;margin-top:6px}
.oscuro{background:var(--tinta);border-radius:22px;padding:32px;display:flex;gap:28px;flex-wrap:wrap;margin-top:24px}
.chip{display:flex;align-items:center;gap:12px;color:#fff}.chip img{width:44px;height:44px}.chip .nom{font-size:18px;color:#fff}.chip .nom .c{color:#8E8E96}
.menu{margin-top:24px;width:320px;border:1px solid var(--linea);border-radius:16px;padding:8px;box-shadow:0 18px 40px -20px rgba(0,0,0,.25)}
.menu a{display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;color:var(--tinta);text-decoration:none;font-weight:500}
.menu a:hover{background:#F2F2F4}.menu img{width:28px;height:28px}
.reglas{margin-top:24px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px 32px;color:var(--gris);font-size:15px;padding:0;list-style:none}
.reglas b{color:var(--tinta)}
@media (max-width:900px){.familia{grid-template-columns:1fr 1fr}.reglas{grid-template-columns:1fr}}
</style></head><body><main>
<h1>P4 · Íconos de producto</h1>
<p class="sub">Fondo aprobado (baldosa, láminas de acrílico y resplandor), colores nuevos. Glifos de Phosphor Icons (MIT): bolsa tipo Shopify con el cursor encima, la libreta de clientes del CRM y la burbuja con el destello de la IA. Tres estilos de glifo para elegir.</p>
${ESTILOS.map((e) => `<h2>${({blanco:"Blanco · sólido, como los íconos de Apple. El más legible.",vidrio:"Vidrio · acrílico: el fondo desenfocado a través del glifo, con canto de luz.",duotono:"Duotono · contorno blanco con relleno translúcido. El más liviano."})[e]}</h2>
<div class="familia">
  ${ids.map((id) => `<div class="p"><img src="${a(`producto-${id}-${e}.svg`)}" alt="condor ${id}">${nombre(PRODUCTOS[id].nombre)}<small>${PRODUCTOS[id].que}</small></div>`).join("")}
</div>`).join("")}

<h2>Tamaños reales</h2><p class="sub">Se leen hasta 20 px: a ese tamaño queda el color y la silueta del pictograma.</p>
<div class="tam">${ids.map((id) => `<div>${[96, 64, 40, 28, 20].map((t) => `<figure style="margin:0"><img src="${a(`producto-${id}-blanco.svg`)}" width="${t}" height="${t}" alt=""><span>${t}</span></figure>`).join("")}</div>`).join("")}</div>

<h2>En contexto</h2><p class="sub">Sobre tinta y en el menú de productos del sitio.</p>
<div class="oscuro">${ids.map((id) => `<div class="chip"><img src="${a(`producto-${id}-blanco.svg`)}" alt="">${nombre(PRODUCTOS[id].nombre)}</div>`).join("")}</div>
<div class="menu">${ids.map((id) => `<a href="#"><img src="${a(`producto-${id}-blanco.svg`)}" alt="">Cóndor ${PRODUCTOS[id].nombre[0].toUpperCase() + PRODUCTOS[id].nombre.slice(1)}</a>`).join("")}</div>

<h2>Reglas</h2>
<ul class="reglas">
  <li><b>Baldosa</b> squircle continuo, la misma del ícono de app de condor.ai.</li>
  <li><b>Un color por producto</b>: ecommerce violeta con rosa, track turquesa-océano con menta, agents naranja con magenta. Los fondos profundos son índigo, azul o carmesí: nunca café ni oliva.</li>
  <li><b>Dos láminas</b>: la de arriba en el tono profundo del producto; la de abajo en su acento, que se oscurece hacia la esquina inferior izquierda.</li>
  <li><b>Glifo</b> de Phosphor Icons, a ~48 % de la baldosa, sin contorno, con sombra en el tono profundo. Una insignia (cursor, destello) se recorta del glifo con un margen limpio.</li>
  <li><b>Resplandor</b> blanco detrás del pictograma: es la luz que atraviesa el acrílico.</li>
  <li><b>Nombre</b> en minúscula: "condor" en gris, el producto en tinta.</li>
</ul>
</main></body></html>`;
fs.writeFileSync("hojas/p4-productos.html", html);
console.log("hojas/p4-productos.html");
