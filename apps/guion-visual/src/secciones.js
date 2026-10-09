/* Lo que en el guion sale de los datos (assets/marca-datos.js) y las demos de las
   secciones. Las secciones solo MUESTRAN: las piezas vienen del kit. */
import { DATOS as M, logoH, logoPlano } from "./kit/marca.js";
import { cargaCondor } from "./kit/marca.js";
import { hacerAcrilico, ponerTextura } from "./kit/acrilico.js";
import { toast, alerta } from "./kit/avisos.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const a = (f) => `assets/marca/${f}`;
const T = M.tintas;
const PRODUCTOS = Object.entries(M.productos);

export function montarSecciones() {
  inicioPlaca();
  logos();
  productos();
  paleta();
  firmas();
  bancoAcrilico();
  carga();
  momentos();
  archivos();
  demosKit();
}

// ── Inicio: la placa de acrílico se inclina hacia el puntero ────────────
// La luz (brillo y canto) sigue al puntero por toda la sección. Con puntero
// grueso o movimiento reducido la placa queda quieta.
function inicioPlaca() {
  const sec = $("#inicio"), placa = $("#inicio-placa");
  if (!sec || !placa) return;
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  import("./kit/resorte.js").then(({ Resorte }) => {
    const rx = new Resorte(0, { rigidez: 90, amortiguacion: 16 }), ry = new Resorte(0, { rigidez: 90, amortiguacion: 16 });
    // derecha (0°) se quita la transformación: el logo se pinta nítido (ver .icono-vivo en CSS)
    const pintar = () => {
      placa.style.setProperty("--rx", `${rx.x.toFixed(2)}deg`); placa.style.setProperty("--ry", `${ry.x.toFixed(2)}deg`);
      placa.classList.toggle("inclinada", Math.abs(rx.x) + Math.abs(ry.x) > 0.02 || rx.destino !== 0 || ry.destino !== 0);
    };
    sec.addEventListener("pointermove", (e) => {
      const r = placa.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
      const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
      rx.a(-y * 9, pintar); ry.a(x * 12, pintar);
      const capa = placa._acrilico?.capa;
      capa?.style.setProperty("--bx", `${(50 + x * 50).toFixed(1)}%`);
      capa?.style.setProperty("--by", `${(50 + y * 50).toFixed(1)}%`);
    });
    sec.addEventListener("pointerleave", () => { rx.a(0, pintar); ry.a(0, pintar); });
  });
}

// ── Logo ────────────────────────────────────────────────────────────────
function logos() {
  const fondos = [
    ["#FFFFFF", "negro", "Negro sobre blanco", "La principal"],
    ["#FFFFFF", "azul", "Azul sobre blanco", "Momentos de marca"],
    [T.negro, "blanco", "Blanco sobre tinta", "Fondos oscuros, video"],
    [T.azul, "blanco", "Blanco sobre azul", "Botón de marca, sellos"],
  ];
  const ficha = (pieza, [fondo, tinta, t, s]) => `<figure class="f"><div class="lienzo ${pieza}" style="background:${fondo}"><img src="${a(`condor-logo-${pieza}-${tinta}.svg`)}" alt="Logo ${pieza}, ${t.toLowerCase()}" loading="lazy"></div><figcaption><b>${t}</b><span>${s}</span><a class="btn mini" href="${a(`condor-logo-${pieza}-${tinta}.svg`)}" download data-tip="Descargar SVG"><svg aria-hidden="true"><use href="#i-bajar"/></svg>SVG</a></figcaption></figure>`;
  $("#logos-h").innerHTML = fondos.map((f) => ficha("horizontal", f)).join("");
  $("#logos-v").innerHTML = fondos.map((f) => ficha("vertical", f)).join("");
  const [vx, vy, vw, vh] = M.lockupH.vb, X = M.medidas.altoX, r = [vx - X, vy - X, vw + 2 * X, vh + 2 * X];
  $("#respeto").innerHTML = `<svg viewBox="${r.join(" ")}" role="img" aria-label="Área de respeto del logo"><rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#F2F2F4"/><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/><rect x="${r[0] + 1}" y="${r[1] + 1}" width="${r[2] - 2}" height="${r[3] - 2}" fill="none" stroke="${T.azul}" stroke-width="2" stroke-dasharray="8 6"/><g fill="${T.negro}">${logoPlano()}</g><g fill="${T.azul}" font-family="Inter Display, sans-serif" font-size="34" font-weight="600" text-anchor="middle"><text x="${vx - X / 2}" y="${vy + vh / 2 + 12}">x</text><text x="${vx + vw + X / 2}" y="${vy + vh / 2 + 12}">x</text><text x="${vx + vw / 2}" y="${vy - X / 2 + 12}">x</text><text x="${vx + vw / 2}" y="${vy + vh + X / 2 + 12}">x</text></g></svg>`;
  $("#noes").innerHTML = [["transform:scaleX(1.35)", "No deformar"], ["transform:rotate(-12deg)", "No rotar"], ["filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))", "No agregar sombras"], ["opacity:.22", "No usar sin contraste"]]
    .map(([css, t]) => `<figure class="f"><div class="lienzo"><img src="${a("condor-logo-horizontal-negro.svg")}" style="${css}" alt="" loading="lazy"></div><figcaption><b class="no">${t}</b></figcaption></figure>`).join("");
}

// ── Productos: íconos vivos (se inclinan hacia el puntero, con brillo) ──
function productos() {
  const nombre = (n) => `<span class="nom"><span>condor</span> ${n}</span>`;
  $("#familia").innerHTML = PRODUCTOS.map(([id, p]) => `<article class="prod">
      <div class="icono-vivo" data-tilt><img src="${a(`producto-${id}.svg`)}" alt="Ícono de condor ${p.nombre}"><i class="brillo"></i></div>
      ${nombre(p.nombre)}<small>${p.que}</small>
      <a class="btn mini" href="${a(`producto-${id}.svg`)}" download><svg aria-hidden="true"><use href="#i-bajar"/></svg>SVG</a></article>`).join("");
  const fichas = PRODUCTOS.map(([id, p]) => `<span class="ficha-prod" data-acrilico data-denso data-radio="pildora"><img src="${a(`producto-${id}-chico.svg`)}" alt="">${p.nombre}</span>`).join("");
  $$("[data-fichas-producto]").forEach((el) => (el.innerHTML = fichas));
  $$("[data-iconos-producto]").forEach((el) => (el.innerHTML = PRODUCTOS.map(([id]) => `<img src="${a(`producto-${id}.svg`)}" alt="">`).join("")));
  // inclinación 3D hacia el puntero (solo con puntero fino)
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  $$("[data-tilt]").forEach((el) => {
    // al volver a 0° se quita la transformación: quieto se pinta nítido (ver .icono-vivo en CSS)
    let t;
    el.addEventListener("pointermove", (e) => {
      clearTimeout(t);
      el.classList.add("inclinado");
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 16).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 18).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
      el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      t = setTimeout(() => el.classList.remove("inclinado"), 700 * (parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1));
    });
  });
}

// ── Color ───────────────────────────────────────────────────────────────
function paleta() {
  const colores = [
    ["Tinta", T.negro, "#fff", "El negro de condor.ai"], ["Blanco", "#FFFFFF", T.negro, "La base de todo", 1], ["Azul Cóndor", T.azul, "#fff", "Solo para destacar"],
    ["Texto 2", "#636368", "#fff", "5,97 : 1"], ["Texto 3", "#6B6B70", "#fff", "5,3 : 1"], ["Íconos", "#8E8E93", "#151517", "Solo íconos y texto grande"],
    ["Líneas", "#DDDDDF", T.negro, "Bordes y divisiones"], ["Hundida", "#F2F2F4", T.negro, "Campos, pistas"], ["Azul suave", "#EEF3FF", T.negro, "Fondo del acento"],
  ];
  $("#paleta").innerHTML = colores.map(([n, c, t, u, borde]) => `<button type="button" class="tinta${borde ? " borde" : ""}" style="--t:${c};--x:${t}" data-copiar="${c}" data-tip="Copiar ${c}"><b>${n}</b><span>${c}</span><small>${u}</small></button>`).join("");
  $("#paleta-productos").innerHTML = PRODUCTOS.map(([id, p]) => `<button type="button" class="tinta-prod" data-copiar="${p.color}" data-tip="Copiar ${p.color}"><img src="${a(`producto-${id}.svg`)}" alt=""><b>condor ${p.nombre}</b><span>${p.color}</span></button>`).join("");
}

// ── Firmas ──────────────────────────────────────────────────────────────
function firmas() {
  const lista = [
    ["aleteo", "Aleteo", "El ala da un aletazo y se asienta; el nombre aparece a su lado.", "Carga del sitio"],
    ["enfoque", "Enfoque", "Llega desenfocado y apenas más grande; se enfoca y las letras se juntan.", "Video y portadas"],
    ["destello", "Destello", "Una luz cruza el logo como un reflejo sobre acrílico.", "Esperas y hover"],
    ["despegue", "Despegue", "El cóndor sube planeando y el nombre se descubre letra a letra.", "Reserva"],
  ];
  $("#firmas-grilla").innerHTML = lista.map(([id, t, d, uso]) => `<div class="escena m-${id}" id="f-${id}"><div class="escena-cab"><h3>${t}</h3><span class="uso">${uso}</span></div><div class="escena-logo">${logoH({ destello: id === "destello" })}</div><p>${d}</p><button class="btn mini otra" type="button" data-otra="f-${id}"><svg aria-hidden="true"><use href="#i-repetir"/></svg>Otra vez</button></div>`).join("");
}

// ── Banco de acrílico: lámina arrastrable + textura y parámetros en vivo ─
function bancoAcrilico() {
  const banco = $("#banco"), lente = $("#banco-lamina"), mesa = $("#banco-mesa");
  if (!banco) return;
  // la textura es global: el segmentado parte en la que está puesta
  const actual = document.documentElement.dataset.textura;
  $$("#banco-textura [role=radio]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.valor === actual)));
  $("#banco-textura").addEventListener("cambio", (e) => ponerTextura(e.detail));
  // arrastrar la lámina
  let dx = 0, dy = 0, arrastrando = false;
  const poner = (x, y) => {
    const m = mesa.getBoundingClientRect(), l = lente.getBoundingClientRect();
    const nx = Math.min(m.width - l.width / 2, Math.max(-l.width / 2, x)), ny = Math.min(m.height - l.height / 2, Math.max(-l.height / 2, y));
    lente.style.left = `${nx}px`; lente.style.top = `${ny}px`;
  };
  lente.addEventListener("pointerdown", (e) => {
    arrastrando = true; lente.setPointerCapture(e.pointerId); lente.classList.add("tomada");
    const l = lente.getBoundingClientRect(); dx = e.clientX - l.left; dy = e.clientY - l.top;
  });
  lente.addEventListener("pointermove", (e) => {
    if (!arrastrando) return;
    const m = mesa.getBoundingClientRect();
    poner(e.clientX - m.left - dx, e.clientY - m.top - dy);
  });
  const soltar = () => { arrastrando = false; lente.classList.remove("tomada"); };
  lente.addEventListener("pointerup", soltar); lente.addEventListener("pointercancel", soltar);
  lente.addEventListener("keydown", (e) => {
    const p = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
    if (!p) return;
    e.preventDefault();
    poner(lente.offsetLeft + p[0], lente.offsetTop + p[1]);
  });
  // parámetros
  const param = {
    esmerilado: (v) => ["--esmerilado", `${v}px`],
    tinte: (v) => ["--tinte", `rgba(255, 255, 255, ${v / 100})`],
    textura: (v) => ["--tx-k", String(v / 100)],
  };
  $$("#banco [data-param]").forEach((inp) => inp.addEventListener("input", () => lente.style.setProperty(...param[inp.dataset.param](inp.value))));
  // forma y escena
  const radios = { lamina: "26px", pildora: "999px", placa: "40px" };
  $("#banco-forma").addEventListener("cambio", (e) => {
    lente.dataset.forma = e.detail;
    lente.style.borderRadius = radios[e.detail];
    lente.setAttribute("aria-valuetext", { lamina: "Lámina", pildora: "Píldora", placa: "Placa" }[e.detail]);
  });
  $("#banco-escena").addEventListener("cambio", (e) => { mesa.dataset.escena = e.detail; });
}

// ── La carga ────────────────────────────────────────────────────────────
function carga() {
  const el = $("#carga-demo");
  if (!el) return;
  const c = cargaCondor(el, { texto: "Preparando tu sitio" });
  let t = 0;
  const reloj = (fn) => { clearInterval(t); t = setInterval(fn, 60); };
  const acciones = {
    armar: () => { clearInterval(t); c.estado("x"); requestAnimationFrame(() => c.estado("armar").texto("Preparando tu sitio")); },
    espera: () => { clearInterval(t); c.estado("espera").texto("La IA está pensando…"); },
    progreso: () => { let p = 0; c.texto("Subiendo productos · 0 %"); reloj(() => { p = Math.min(1, p + 0.02); c.progreso(p).texto(`Subiendo productos · ${Math.round(p * 100)} %`); if (p >= 1) clearInterval(t); }); },
    listo: () => { clearInterval(t); c.listo("Todo listo"); },
  };
  $$("[data-carga]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-carga]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    acciones[b.dataset.carga]();
  }));
  // recorrido automático la primera vez que se ve
  new IntersectionObserver((xs, o) => {
    if (!xs[0].isIntersecting) return;
    o.disconnect();
    const pasos = ["armar", "espera", "progreso", "listo"], esperas = [0, 1600, 3600, 7600];
    pasos.forEach((p, i) => setTimeout(() => $(`[data-carga="${p}"]`).click(), esperas[i]));
  }, { threshold: 0.6 }).observe(el);
}

// ── Momentos de marca ───────────────────────────────────────────────────
function momentos() {
  // el ícono que se abre en una ventana de acrílico
  const app = $("#app-abre");
  if (app) {
    const ventana = app.querySelector(".app-ventana");
    hacerAcrilico(ventana);
    app.querySelector(".app-icono-boton").addEventListener("click", () => app.classList.toggle("abierta"));
    app.querySelector(".app-cerrar").addEventListener("click", () => app.classList.remove("abierta"));
  }
  // sello: el texto gira alrededor del cóndor
  const sello = $("#sello");
  if (sello) {
    const txt = "CONDOR.AI · TECNOLOGÍA DEL FUTURO · DESDE LOS ANDES · ";
    sello.querySelector("textPath").textContent = txt;
  }
  // ola: las letras se levantan cerca del puntero
  const ola = $("#ola");
  if (ola && matchMedia("(hover: hover)").matches) {
    const letras = $$(".le", ola);
    ola.addEventListener("pointermove", (e) => {
      letras.forEach((l) => {
        const r = l.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
        const k = Math.max(0, 1 - d / 160);
        l.style.transform = `translateY(${(-k * 14).toFixed(1)}px)`;
      });
    });
    ola.addEventListener("pointerleave", () => letras.forEach((l) => (l.style.transform = "")));
  }
}

// ── Archivos ────────────────────────────────────────────────────────────
function archivos() {
  const lista = [
    ["condor-logo-horizontal-negro.svg", "Logo horizontal · negro, azul, blanco y currentColor"],
    ["condor-logo-vertical-negro.svg", "Logo vertical"],
    ["condor-isotipo-negro.svg", "Isotipo: el cóndor solo"],
    ["condor-wordmark-negro.svg", "Nombre: condor.ai en vector propio"],
    ["icono-azul.svg", "Ícono de app · azul, blanco y tinta"],
    ...PRODUCTOS.map(([id]) => [`producto-${id}.svg`, `Ícono de condor ${id}`]),
  ];
  $("#lista-archivos").innerHTML = lista.map(([f, t]) => `<li><a href="${a(f)}" download><svg aria-hidden="true"><use href="#i-bajar"/></svg><code>${f}</code></a><span>${t}</span></li>`).join("") +
    `<li><span class="li-cod"><code>npm run marca</code></span><span>Regenera todo desde <code>condor.mjs</code> (cóndor), <code>tipo.mjs</code> (letras) e <code>iconos.mjs</code> (productos).</span></li>`;
}

// ── Demos del kit (avisos, alertas) ─────────────────────────────────────
function demosKit() {
  $("#demo-toast")?.addEventListener("click", () => toast("Cambios guardados"));
  $("#demo-toast-deshacer")?.addEventListener("click", () => toast("Se archivó «Ferretería Los Andes»", { deshacer: () => {} }));
  $("#demo-toast-error")?.addEventListener("click", () => toast("No pudimos conectar. Reintentamos en 5 s.", { tono: "error" }));
  $("#demo-alerta")?.addEventListener("click", async (e) => {
    const ok = await alerta(e.currentTarget, { titulo: "¿Eliminar la tienda de prueba?", texto: "Se borran sus productos y pedidos de ejemplo. No se puede deshacer.", confirmar: "Eliminar", peligro: true });
    toast(ok ? "Tienda de prueba eliminada" : "No se eliminó nada", { tono: ok ? "ok" : "info" });
  });
  // menú de ejemplo: lo elegido se confirma
  $("#menu-acciones")?.addEventListener("elegir", (e) => toast(`Elegiste «${e.detail.textContent.trim()}»`, { tono: "info", duracion: 2200 }));
}
