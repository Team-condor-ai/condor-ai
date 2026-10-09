/* =========================================================================
   Guion visual condor.ai · motor
   - Logos dibujados desde assets/marca-datos.js, con piezas animables
     (ala, cuerpo y cada letra) para las firmas de movimiento.
   - Grillas del logo, familia de productos, paleta y archivos.
   - Interacción: calco del original, firmas (con cámara lenta), curvas,
     luz del acrílico, segmentos, copiar y navegación activa.
   ========================================================================= */
(() => {
  "use strict";
  const M = window.CONDOR_MARCA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const H = M.lockupH, [vx, vy, vw, vh] = H.vb;
  const [ALA, CUERPO] = M.iso.piezas;
  const T = M.tintas;
  let uid = 0;

  /* ── 1. Logos ──────────────────────────────────────────────────────── */
  const condorG = (cls = true) => `<g transform="${H.anim.condor}"><path${cls ? ' class="ala"' : ""} d="${ALA}"/><path${cls ? ' class="cuerpo"' : ""} d="${CUERPO}"/></g>`;
  const letrasG = (cls = true) => `<g transform="translate(${H.anim.palabraX} 0)">${M.word.letras.map((l, k) => (cls ? `<g class="le" style="--k:${k}"><path d="${l.d}"/></g>` : `<path d="${l.d}"/>`)).join("")}</g>`;
  /** Logo horizontal; con destello agrega la luz enmascarada por el propio logo. */
  function logoH({ destello = false } = {}) {
    let luz = "";
    if (destello) {
      const id = `lz${++uid}`;
      luz = `<defs><mask id="m${id}" maskUnits="userSpaceOnUse" x="${vx}" y="${vy}" width="${vw}" height="${vh}"><g fill="#fff">${condorG(false)}${letrasG(false)}</g></mask>` +
        `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(18 .5 .5)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
        `<g mask="url(#m${id})"><rect class="luz" style="--viaje:${Math.round(vw * 1.6)}px" x="${vx - vw * 0.4}" y="${vy - 20}" width="${vw * 0.28}" height="${vh + 40}" fill="url(#g${id})"/></g>`;
    }
    return `<svg class="logo" viewBox="${vb(H.vb)}" fill="currentColor" role="img" aria-label="condor.ai"><g class="todo">${condorG()}${letrasG()}</g>${luz}</svg>`;
  }
  const vb = (v) => v.join(" ");
  const palabra = () => `<svg class="logo" viewBox="${vb(M.word.vb)}" fill="currentColor" role="img" aria-label="condor.ai">${M.word.letras.map((l, k) => `<g class="le" style="--k:${k}"><path d="${l.d}"/></g>`).join("")}</svg>`;
  const iso = () => `<svg class="logo" viewBox="${vb(M.iso.vb)}" fill="currentColor" role="img" aria-label="condor.ai"><path class="ala" d="${ALA}"/><path class="cuerpo" d="${CUERPO}"/></svg>`;

  $$("[data-logo]").forEach((el) => {
    const t = el.dataset.logo;
    el.innerHTML = t === "palabra" ? palabra() : logoH({ destello: el.dataset.firma === "destello" });
    if (el.dataset.alto) el.querySelector("svg").style.height = `${el.dataset.alto}px`;
  });
  $$("[data-iso]").forEach((el) => (el.innerHTML = iso()));

  /* ── 2. Grillas ────────────────────────────────────────────────────── */
  const a = (f) => `assets/marca/${f}`;
  const fondos = [
    ["#FFFFFF", "negro", "Negro sobre blanco", "La principal"],
    ["#FFFFFF", "azul", "Azul sobre blanco", "Momentos de marca"],
    [T.negro, "blanco", "Blanco sobre tinta", "Fondos oscuros, video"],
    [T.azul, "blanco", "Blanco sobre azul", "Redes, piezas de marca"],
  ];
  const ficha = (pieza, [fondo, tinta, t, s]) => `<figure class="f"><div class="lienzo ${pieza}" style="background:${fondo}"><img src="${a(`condor-logo-${pieza}-${tinta}.svg`)}" alt="Logo ${pieza}, ${t.toLowerCase()}"></div><figcaption><b>${t}</b><span>${s}</span><a class="btn mini-btn" href="${a(`condor-logo-${pieza}-${tinta}.svg`)}" download><svg aria-hidden="true"><use href="#i-bajar"/></svg>SVG</a></figcaption></figure>`;
  $("#logos-h").innerHTML = fondos.map((f) => ficha("horizontal", f)).join("");
  $("#logos-v").innerHTML = fondos.map((f) => ficha("vertical", f)).join("");
  // área de respeto: alto de x por lado
  const X = M.medidas.altoX, r = [vx - X, vy - X, vw + 2 * X, vh + 2 * X];
  $("#respeto").innerHTML = `<svg viewBox="${vb(r)}" role="img" aria-label="Área de respeto del logo"><rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${"#EEF3FF"}"/><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/><rect x="${r[0] + 1}" y="${r[1] + 1}" width="${r[2] - 2}" height="${r[3] - 2}" fill="none" stroke="${T.azul}" stroke-width="2" stroke-dasharray="8 6"/><g fill="${T.negro}">${condorG(false)}${letrasG(false)}</g><g fill="${T.azul}" font-family="Inter Display, sans-serif" font-size="34" font-weight="600" text-anchor="middle"><text x="${vx - X / 2}" y="${vy + vh / 2 + 12}">x</text><text x="${vx + vw + X / 2}" y="${vy + vh / 2 + 12}">x</text><text x="${vx + vw / 2}" y="${vy - X / 2 + 12}">x</text><text x="${vx + vw / 2}" y="${vy + vh + X / 2 + 12}">x</text></g></svg>`;
  $("#noes").innerHTML = [["transform:scaleX(1.35)", "No deformar"], ["transform:rotate(-12deg)", "No rotar"], ["filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))", "No agregar sombras"], ["opacity:.22", "No usar sin contraste"]]
    .map(([css, t]) => `<figure class="f"><div class="lienzo"><img src="${a("condor-logo-horizontal-negro.svg")}" style="${css}" alt=""></div><figcaption><b class="no">${t}</b></figcaption></figure>`).join("");

  // productos
  const P = Object.entries(M.productos);
  const nombre = (n) => `<span class="nom"><span>condor</span> ${n}</span>`;
  $("#familia").innerHTML =
    `<div class="prod ref"><img src="assets/referencias/condor-sites.png" alt="">${nombre("sites")}<small>Sitios y landings · el ícono de referencia</small></div>` +
    P.map(([id, p]) => `<div class="prod"><img src="${a(`producto-${id}.svg`)}" alt="">${nombre(p.nombre)}<small>${p.que}</small><a class="btn mini-btn" href="${a(`producto-${id}.svg`)}" download><svg aria-hidden="true"><use href="#i-bajar"/></svg>SVG</a></div>`).join("");
  $("#menu-demo").innerHTML = `<a role="menuitem" href="#productos"><img src="assets/referencias/condor-sites.png" alt="">Cóndor Sites</a>` +
    P.map(([id, p]) => `<a role="menuitem" href="#productos"><img src="${a(`producto-${id}.svg`)}" alt="">Cóndor ${p.nombre[0].toUpperCase() + p.nombre.slice(1)}</a>`).join("");
  $("#fichas").innerHTML = P.map(([id, p]) => `<span class="vidrio ficha"><img src="${a(`producto-${id}.svg`)}" alt="">${p.nombre}</span>`).join("");
  $("#sitio-iconos").innerHTML = P.map(([id]) => `<img src="${a(`producto-${id}.svg`)}" alt="">`).join("");

  // paleta
  const colores = [
    ["Tinta", T.negro, "#fff"], ["Blanco", "#FFFFFF", T.negro, 1], ["Azul Cóndor", T.azul, "#fff"],
    ["Gris 1 · texto 2", "#636368", "#fff"], ["Texto 3", "#737378", "#fff"], ["Gris 2 · íconos", "#8E8E93", "#fff"],
    ["Gris 4 · líneas", "#DDDDDF", T.negro], ["Gris 5 · hundida", "#F2F2F4", T.negro], ["Azul suave", "#EEF3FF", T.negro],
    ...P.map(([, p]) => [`condor ${p.nombre}`, p.color, "#fff"]),
  ];
  $("#paleta").innerHTML = colores.map(([n, c, t, borde]) => `<button type="button" class="tinta${borde ? " borde" : ""}" style="--t:${c};--x:${t}" data-copiar="${c}"><b>${n}</b><span>${c}</span></button>`).join("");

  // archivos
  const archivos = [
    ["condor-logo-horizontal-negro.svg", "Logo horizontal (negro, azul, blanco y currentColor)"],
    ["condor-logo-vertical-negro.svg", "Logo vertical"],
    ["condor-isotipo-negro.svg", "Isotipo: el cóndor solo"],
    ["condor-wordmark-negro.svg", "Nombre: condor.ai en vector propio"],
    ["icono-azul.svg", "Ícono de app (azul, blanco, tinta)"],
    ...P.map(([id]) => [`producto-${id}.svg`, `Ícono de condor ${id}`]),
  ];
  $("#lista-archivos").innerHTML = archivos.map(([f, t]) => `<li><a href="${a(f)}" download><code>${f}</code></a><span>${t}</span></li>`).join("") +
    `<li><code>herramientas/</code><span><code>npm run marca</code> regenera todo desde <code>condor.mjs</code> (cóndor), <code>tipo.mjs</code> (letras) e <code>iconos.mjs</code> (productos).</span></li>`;

  // firmas de movimiento
  const firmas = [
    ["aleteo", "Aleteo", "El ala da un aletazo y se asienta; el nombre aparece a su lado.", "Carga del sitio"],
    ["enfoque", "Enfoque", "Llega desenfocado y apenas más grande; se enfoca y las letras se juntan.", "Video y portadas"],
    ["destello", "Destello", "Una luz cruza el logo como un reflejo sobre acrílico.", "Esperas y hover"],
    ["despegue", "Despegue", "El cóndor sube planeando y el nombre se descubre letra a letra.", "Reserva"],
  ];
  $("#firmas").innerHTML = firmas.map(([id, t, d, uso]) => `<div class="escena m-${id}" id="f-${id}"><div class="escena-cab"><h3>${t}</h3><span class="uso">${uso}</span></div><div class="escena-logo">${logoH({ destello: id === "destello" })}</div><p>${d}</p><button class="btn secundario mini-btn otra" type="button" data-otra="f-${id}"><svg aria-hidden="true"><use href="#i-repetir"/></svg>Otra vez</button></div>`).join("");

  /* ── 3. Interacción ────────────────────────────────────────────────── */
  const otra = (e) => { e.classList.remove("corre"); void e.getBoundingClientRect(); e.classList.add("corre"); };
  $$("[data-otra]").forEach((b) => b.addEventListener("click", () => otra(document.getElementById(b.dataset.otra))));
  $("#todas").addEventListener("click", () => $$("#firmas .escena").forEach(otra));
  $("#lento").addEventListener("change", (e) => document.body.classList.toggle("lento", e.target.checked));
  const alVer = (el, fn, umbral = 0.5) => {
    if (reduce) { el.classList.add("corre"); return; }
    const o = new IntersectionObserver((xs) => xs.forEach((x) => { if (x.isIntersecting) { fn(x.target); o.unobserve(x.target); } }), { threshold: umbral });
    o.observe(el);
  };
  $$("#firmas .escena").forEach((e) => alVer(e, otra));
  alVer($("#curvas"), otra, 0.6);
  $("#inicio-logo").addEventListener("click", () => otra($("#inicio-logo")));




  // calco: ver el original debajo del cóndor nuevo
  const btnCalco = $("#btn-calco");
  btnCalco.addEventListener("click", () => {
    const on = $("#calco").classList.toggle("con-original");
    btnCalco.setAttribute("aria-pressed", String(on));
    btnCalco.textContent = on ? "Ocultar el original" : "Ver el original debajo";
  });

  // segmentos
  $$(".segmento").forEach((g) => $$("button", g).forEach((b) => b.addEventListener("click", () => $$("button", g).forEach((x) => x.setAttribute("aria-selected", String(x === b))))));

  // luz del acrílico
  $$("[data-luz]").forEach((el) => {
    const zona = el.closest(".mesa") || el;
    zona.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const q = el.getBoundingClientRect();
      el.style.setProperty("--lx", `${((e.clientX - q.left) / q.width) * 100}%`);
      el.style.setProperty("--ly", `${((e.clientY - q.top) / q.height) * 100}%`);
    });
  });

  // copiar
  const aviso = $("#aviso");
  let tAviso;
  const avisar = (t) => { aviso.textContent = t; aviso.classList.add("visible"); clearTimeout(tAviso); tAviso = setTimeout(() => aviso.classList.remove("visible"), 1600); };
  const copiar = (texto, etq) => {
    const ok = () => avisar(`${etq} copiado`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).then(ok, () => avisar("No se pudo copiar"));
    else avisar("No se pudo copiar");
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const v = b.dataset.copiar;
    if (v === "tokens") copiar($("#codigo-tokens").textContent, "Tokens");
    else copiar(v, v);
  });

  // navegación activa
  const enlaces = $$(".barra-nav a"), secs = enlaces.map((x) => document.querySelector(x.getAttribute("href")));
  const activa = () => {
    const y = innerHeight * 0.3;
    let act = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= y) act = i; });
    enlaces.forEach((x, i) => x.classList.toggle("activo", i === act));
  };
  addEventListener("scroll", activa, { passive: true });
  activa();
})();
