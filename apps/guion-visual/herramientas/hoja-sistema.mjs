// Hoja P5 · el sistema: color, tipografía, forma, material y movimiento.
// node herramientas/hoja-sistema.mjs  →  hojas/p5-sistema.html  (correr antes `npm run marca`)
import fs from "node:fs";

const M = (() => { const s = fs.readFileSync("assets/marca-datos.js", "utf8"); return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); })();
const H = M.lockupH, [vx, vy, vw, vh] = H.vb;
const [ala, cuerpo] = M.iso.piezas;

/** Logo horizontal con piezas animables: ala, cuerpo y cada letra por separado. */
function logo(id, { color = "var(--cn-tinta)", destello = false } = {}) {
  const condor = `<g transform="${H.anim.condor}"><path class="ala" d="${ala}"/><path class="cuerpo" d="${cuerpo}"/></g>`;
  const letras = `<g transform="translate(${H.anim.palabraX} 0)">${M.word.letras.map((l, k) => `<g class="le" style="--k:${k}"><path d="${l.d}"/></g>`).join("")}</g>`;
  let luz = "";
  if (destello) {
    const estatico = `<g transform="${H.anim.condor}"><path d="${ala}"/><path d="${cuerpo}"/></g><g transform="translate(${H.anim.palabraX} 0)">${M.word.letras.map((l) => `<path d="${l.d}"/>`).join("")}</g>`;
    luz = `<defs><mask id="m-${id}" maskUnits="userSpaceOnUse" x="${vx}" y="${vy}" width="${vw}" height="${vh}"><g fill="#fff">${estatico}</g></mask>` +
      `<linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(18 .5 .5)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
      `<g mask="url(#m-${id})"><rect class="luz" style="--viaje:${Math.round(vw * 1.6)}px" x="${vx - vw * 0.4}" y="${vy - 20}" width="${vw * 0.28}" height="${vh + 40}" fill="url(#g-${id})"/></g>`;
  }
  return `<svg class="logo" viewBox="${vx} ${vy} ${vw} ${vh}" style="color:${color}" fill="currentColor" role="img" aria-label="condor.ai"><g class="todo">${condor}${letras}</g>${luz}</svg>`;
}

const firmas = [
  ["aleteo", "Aleteo", "El ala da un aletazo y se asienta con resorte; el nombre aparece a su lado. Carga del sitio, cierres de video."],
  ["enfoque", "Enfoque", "Llega desenfocado y apenas más grande; se enfoca y las letras se juntan. Portadas, keynotes, entradas de sección."],
  ["destello", "Destello", "Una luz cruza el logo como un reflejo sobre acrílico. Estados de espera, hover del logo, sellos."],
  ["despegue", "Despegue", "El cóndor sube planeando y el nombre se descubre letra a letra. Intro de video y presentaciones."],
];
const colores = [
  ["Tinta", "#151517", "#fff"], ["Blanco", "#FFFFFF", "#151517", true], ["Azul Cóndor", "#014CFD", "#fff"],
  ["Gris 1 · texto 2", "#636368", "#fff"], ["Gris 2 · texto 3", "#8E8E93", "#fff"], ["Gris 3", "#C7C7CC", "#151517"],
  ["Gris 4 · líneas", "#DDDDDF", "#151517"], ["Gris 5 · hundida", "#F2F2F4", "#151517"], ["Azul suave", "#EEF3FF", "#151517"],
];
const productos = Object.entries(M.productos);

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P5 · Sistema condor.ai</title>
<link rel="stylesheet" href="../tokens/condor.css">
<style>
*{box-sizing:border-box}
body{margin:0;background:var(--cn-fondo);color:var(--cn-texto);font:400 var(--cn-t-17)/1.55 var(--cn-texto-f);-webkit-font-smoothing:antialiased;--vel:1}
body.lento{--vel:4}
main{max-width:1180px;margin:0 auto;padding:56px 24px 120px}
h1,h2,h3{font-family:var(--cn-display);font-weight:600;letter-spacing:-.02em;margin:0}
h1{font-size:var(--cn-t-40)} h2{font-size:var(--cn-t-28);margin:88px 0 8px} h3{font-size:var(--cn-t-21)}
.sub{color:var(--cn-texto-2);max-width:68ch;margin:8px 0 0}
.rot{font:500 var(--cn-t-12)/1.3 var(--cn-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cn-acento)}
.grid{display:grid;gap:14px;margin-top:24px}
.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g2{grid-template-columns:repeat(2,1fr)}
@media (max-width:860px){.g3,.g4,.g2{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.g3,.g4,.g2{grid-template-columns:1fr}}
/* color */
.tinta{height:120px;border-radius:var(--cn-r-4);padding:16px;display:flex;flex-direction:column;justify-content:flex-end;font-size:var(--cn-t-13)}
.tinta b{font:600 var(--cn-t-15) var(--cn-display)}.tinta span{opacity:.75;font-family:var(--cn-mono);font-size:var(--cn-t-12)}
.prod{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--cn-linea);border-radius:var(--cn-r-4)}
.prod img{width:44px;height:44px}.prod b{font:600 var(--cn-t-15) var(--cn-display)}.prod span{display:block;font:var(--cn-t-12) var(--cn-mono);color:var(--cn-texto-2)}
/* tipografía */
.escala p{margin:0 0 14px}
/* forma */
.radio{height:110px;background:var(--cn-gris-5);display:grid;place-items:end start;padding:14px;font:500 var(--cn-t-13) var(--cn-mono);color:var(--cn-texto-2)}
.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.btn{height:44px;padding:0 20px;border:0;border-radius:var(--cn-r-2);font:500 var(--cn-t-15) var(--cn-texto-f);cursor:pointer;transition:transform var(--cn-d-3) var(--cn-resorte),background var(--cn-d-2) var(--cn-suave)}
.btn:active{transform:scale(.96)}
.primario{background:var(--cn-azul);color:#fff}.primario:hover{background:var(--cn-azul-hondo)}
.secundario{background:var(--cn-gris-5);color:var(--cn-tinta)}.secundario:hover{background:#E8E8EC}
.oscuro{background:var(--cn-tinta);color:#fff}
/* material */
.mesa{position:relative;overflow:hidden;isolation:isolate;height:440px;border-radius:var(--cn-r-5);background:#fff;border:1px solid var(--cn-linea);margin-top:24px;display:grid;place-items:center}
.mancha{position:absolute;border-radius:50%;filter:blur(50px);opacity:.75;z-index:-1;animation:deriva calc(18s * var(--vel)) var(--cn-suave) infinite alternate}
.m1{width:340px;height:340px;background:#7A3CFF;left:8%;top:6%}
.m2{width:300px;height:300px;background:#0A8FE0;right:10%;top:18%;animation-delay:-6s}
.m3{width:280px;height:280px;background:#FF5A1F;left:38%;bottom:-8%;animation-delay:-12s}
@keyframes deriva{to{transform:translate(60px,-40px) scale(1.15)}}
.vidrio{--lx:50%;--ly:0%;background:radial-gradient(320px circle at var(--lx) var(--ly),rgba(255,255,255,.6),transparent 60%),var(--cn-vidrio);backdrop-filter:var(--cn-vidrio-blur);-webkit-backdrop-filter:var(--cn-vidrio-blur);border:1px solid var(--cn-vidrio-borde);box-shadow:var(--cn-vidrio-canto),var(--cn-sombra-3);border-radius:var(--cn-r-5)}
.tarjeta{width:min(88%,420px);padding:28px;display:grid;gap:10px}
.tarjeta .cifra{font:600 var(--cn-t-56)/1 var(--cn-display);letter-spacing:-.03em}
.fichas{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.ficha{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:var(--cn-r-pildora);font:500 var(--cn-t-13) var(--cn-texto-f)}
.ficha img{width:26px;height:26px}
/* movimiento: curvas */
.curva{border:1px solid var(--cn-linea);border-radius:var(--cn-r-4);padding:18px;display:grid;gap:8px}
.pista{position:relative;height:44px;border-radius:var(--cn-r-2);background:var(--cn-gris-5);overflow:hidden;container-type:inline-size}
.bola{position:absolute;left:6px;top:6px;width:32px;height:32px;border-radius:10px;background:var(--cn-azul)}
.corre .bola{animation:ida var(--d) var(--e) forwards}
@keyframes ida{to{transform:translateX(calc(100cqw - 44px))}}
.curva code{font:var(--cn-t-12) var(--cn-mono);color:var(--cn-texto-2)}
/* movimiento: firmas */
.barra{display:flex;align-items:center;gap:16px;margin-top:20px}
.barra label{display:flex;align-items:center;gap:8px;color:var(--cn-texto-2);font-size:var(--cn-t-15);cursor:pointer}
.escena{position:relative;border:1px solid var(--cn-linea);border-radius:var(--cn-r-5);padding:60px 40px 76px;display:grid;place-items:center;overflow:hidden}
.escena .logo{width:min(100%,520px);height:auto;display:block;overflow:visible}
.escena .otra{position:absolute;right:14px;bottom:14px}
.escena p{position:absolute;left:24px;bottom:16px;right:150px;margin:0;color:var(--cn-texto-2);font-size:var(--cn-t-13)}
.escena h3{position:absolute;left:24px;top:18px}
.logo .ala,.logo .cuerpo,.logo .le,.logo .todo{transform-box:fill-box}

/* 1 · Aleteo */
.m-aleteo .ala{transform-origin:88% 78%;opacity:0}
.m-aleteo .cuerpo{opacity:0}
.m-aleteo .le{opacity:0}
.corre.m-aleteo .ala{animation:aletea calc(1.25s * var(--vel)) cubic-bezier(.3,0,.2,1) forwards}
.corre.m-aleteo .cuerpo{animation:asoma calc(.6s * var(--vel)) var(--cn-llegada) forwards}
.corre.m-aleteo .le{animation:aparece calc(.7s * var(--vel)) var(--cn-llegada) calc((.55s + var(--k) * .035s) * var(--vel)) forwards}
@keyframes aletea{0%{opacity:0;transform:rotate(26deg)}18%{opacity:1}42%{transform:rotate(-9deg)}66%{transform:rotate(3.5deg)}84%{transform:rotate(-1deg)}100%{opacity:1;transform:none}}
@keyframes asoma{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes aparece{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}

/* 2 · Enfoque */
.m-enfoque .todo{opacity:0;transform-origin:50% 50%}
.m-enfoque .le{transform:translateX(calc((var(--k) - 4) * 9px))}
.corre.m-enfoque .todo{animation:enfoca calc(1.1s * var(--vel)) var(--cn-llegada) forwards}
.corre.m-enfoque .le{animation:junta calc(1.3s * var(--vel)) var(--cn-llegada) forwards}
@keyframes enfoca{from{opacity:0;filter:blur(14px);transform:scale(1.07)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes junta{to{transform:none}}

/* 3 · Destello */
.m-destello .luz{transform:none;opacity:0}
.corre.m-destello .luz{animation:barre calc(1.4s * var(--vel)) cubic-bezier(.45,0,.25,1) calc(.2s * var(--vel)) 2 forwards}
@keyframes barre{0%{opacity:0;transform:none}10%{opacity:1}90%{opacity:1}100%{opacity:0;transform:translateX(var(--viaje))}}

/* 4 · Despegue */
.m-despegue .ala,.m-despegue .cuerpo{opacity:0}
.m-despegue .le{opacity:0}
.corre.m-despegue .ala,.corre.m-despegue .cuerpo{animation:despega calc(1.2s * var(--vel)) var(--cn-llegada) forwards}
.corre.m-despegue .le{animation:descubre calc(.8s * var(--vel)) var(--cn-llegada) calc((.4s + var(--k) * .05s) * var(--vel)) forwards}
@keyframes despega{from{opacity:0;transform:translate(-36px,42px) rotate(-9deg)}to{opacity:1;transform:none}}
@keyframes descubre{from{opacity:0;transform:translateY(40%);filter:blur(5px)}to{opacity:1;transform:none;filter:blur(0)}}

@media (prefers-reduced-motion:reduce){.logo *{animation:none!important;opacity:1!important;transform:none!important;filter:none!important}.mancha{animation:none}}
</style></head><body><main>
<p class="rot">Guion visual · P5</p>
<h1>El sistema</h1>
<p class="sub">Todo sale de <code>tokens/condor.css</code>: color, tipografía, forma, material y movimiento. Blanco de base, negro y blanco corporativo, y el azul solo para destacar.</p>

<h2>Color</h2>
<p class="sub">La marca es tinta sobre blanco. El Azul Cóndor aparece poco y por eso se nota: el logo en momentos de marca, la acción principal y lo que está activo.</p>
<div class="grid g3">${colores.map(([n, c, t, borde]) => `<div class="tinta" style="background:${c};color:${t}${borde ? ";box-shadow:inset 0 0 0 1px #DDDDDF" : ""}"><b>${n}</b><span>${c}</span></div>`).join("")}</div>
<h3 style="margin-top:32px">Productos</h3>
<div class="grid g3">${productos.map(([id, p]) => `<div class="prod"><img src="../assets/marca/producto-${id}.svg" alt=""><div><b>condor ${p.nombre}</b><span>${p.color}</span></div></div>`).join("")}</div>

<h2>Tipografía</h2>
<p class="sub">Inter Display para titulares (la misma del nombre) e Inter para texto e interfaz. Titulares en 600 con espaciado negativo; texto en 400 a 17 px.</p>
<div class="escala" style="margin-top:24px">
  <p style="font:600 var(--cn-t-80)/1 var(--cn-display);letter-spacing:-.035em">Tecnología del futuro.</p>
  <p style="font:600 var(--cn-t-56)/1.05 var(--cn-display);letter-spacing:-.03em">Desde los Andes.</p>
  <p style="font:600 var(--cn-t-28)/1.15 var(--cn-display);letter-spacing:-.02em">Título de tarjeta · Inter Display 28</p>
  <p style="font:400 var(--cn-t-21)/1.45 var(--cn-texto-f);color:var(--cn-texto-2)">Bajada en Inter 21. Una o dos líneas, nunca un párrafo.</p>
  <p style="font:400 var(--cn-t-17)/1.55 var(--cn-texto-f)">Texto corrido en Inter 17: el tamaño base del sitio.</p>
  <p class="rot">Rótulo · Geist Mono 12</p>
</div>

<h2>Forma</h2>
<p class="sub">Radios generosos, como Apple. Los íconos usan el squircle continuo.</p>
<div class="grid g4">${[["8", "--cn-r-1", "chips"], ["12", "--cn-r-2", "botones, campos"], ["22", "--cn-r-4", "tarjetas"], ["28", "--cn-r-5", "paneles"]].map(([n, v, u]) => `<div class="radio" style="border-radius:var(${v})">${n} px · ${u}</div>`).join("")}</div>
<div class="btns"><button class="btn primario">Agenda una reunión</button><button class="btn secundario">Ver productos</button><button class="btn oscuro">Hablemos</button></div>

<h2>Material · acrílico claro</h2>
<p class="sub">Láminas translúcidas sobre blanco: dejan pasar el color de abajo, lo desenfocan y tienen un canto de luz. Mueve el cursor sobre la tarjeta.</p>
<div class="mesa" id="mesa">
  <i class="mancha m1"></i><i class="mancha m2"></i><i class="mancha m3"></i>
  <div class="vidrio tarjeta" id="tarjeta">
    <span class="rot">Ventas del mes · datos de ejemplo</span>
    <span class="cifra">$4.820.000</span>
    <span style="color:var(--cn-texto-2)">+18 % respecto a septiembre</span>
    <div class="fichas">${productos.map(([id, p]) => `<span class="vidrio ficha"><img src="../assets/marca/producto-${id}.svg" alt="">${p.nombre}</span>`).join("")}</div>
  </div>
</div>

<h2>Movimiento</h2>
<p class="sub">Suave, con inercia y un final que se siente. Tres curvas para todo; el resorte es un muelle real (no una curva que lo imita).</p>
<div class="grid g3" id="curvas">
  ${[["Llegada", "var(--cn-llegada)", "cubic-bezier(.16, 1, .3, 1)", "900ms", "Lo que entra en pantalla."], ["Suave", "var(--cn-suave)", "cubic-bezier(.25, .1, .25, 1)", "500ms", "Cambios de estado."], ["Resorte", "var(--cn-resorte)", "muelle amortiguado, ζ = 0,62", "700ms", "Toques, interruptores, insignias."]].map(([n, e, c, d, u]) => `<div class="curva"><div class="pista"><span class="bola" style="--e:${e};--d:${d}"></span></div><h3>${n}</h3><code>${c}</code><span style="color:var(--cn-texto-2);font-size:var(--cn-t-15)">${u}</span></div>`).join("")}
</div>
<div class="btns"><button class="btn secundario" id="curvas-otra">Otra vez</button></div>

<h3 style="margin-top:48px">Firmas del logo</h3>
<p class="sub">Cuatro formas de que aparezca el logo. Elige una (o dos: una para la carga y otra para video).</p>
<div class="barra"><label><input type="checkbox" id="lento"> Cámara lenta (×4)</label><button class="btn secundario" id="todas">Repetir todas</button></div>
<div class="grid g2">
${firmas.map(([id, t, d]) => `<div class="escena corre m-${id}" id="f-${id}"><h3>${t}</h3>${logo(id, { destello: id === "destello" })}<p>${d}</p><button class="btn secundario otra" data-otra="f-${id}">Otra vez</button></div>`).join("")}
</div>
</main>
<script>
const otra = (e) => { e.classList.remove("corre"); void e.offsetWidth; e.classList.add("corre"); };
document.querySelectorAll("[data-otra]").forEach((b) => b.addEventListener("click", () => otra(document.getElementById(b.dataset.otra))));
document.getElementById("todas").addEventListener("click", () => document.querySelectorAll(".escena").forEach(otra));
document.getElementById("lento").addEventListener("change", (e) => document.body.classList.toggle("lento", e.target.checked));
const curvas = document.getElementById("curvas");
const correCurvas = () => otra(curvas);
document.getElementById("curvas-otra").addEventListener("click", correCurvas);
new IntersectionObserver((x) => { if (x[0].isIntersecting) correCurvas(); }, { threshold: .6 }).observe(curvas);
// las firmas parten cuando entran a la vista
const vistas = new IntersectionObserver((xs) => xs.forEach((x) => { if (x.isIntersecting) { otra(x.target); vistas.unobserve(x.target); } }), { threshold: .5 });
document.querySelectorAll(".escena").forEach((e) => vistas.observe(e));
// la luz del acrílico sigue al cursor
const t = document.getElementById("tarjeta");
document.getElementById("mesa").addEventListener("pointermove", (e) => {
  const r = t.getBoundingClientRect();
  t.style.setProperty("--lx", ((e.clientX - r.left) / r.width) * 100 + "%");
  t.style.setProperty("--ly", ((e.clientY - r.top) / r.height) * 100 + "%");
});
</script>
</body></html>`;
fs.writeFileSync("hojas/p5-sistema.html", html);
console.log("hojas/p5-sistema.html");
