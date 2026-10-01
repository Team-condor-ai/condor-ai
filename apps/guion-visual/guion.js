/* =========================================================================
   Guion visual condor.ai · visión Claro · motor
   - Marca: sprite (isotipo, wordmark, logos, productos) desde marca-datos.js
   - Construcción del cóndor (esqueleto → fusión → marca) y carga "Forja"
   - Cóndor de acrílico en 3D (three.js r128, MeshPhysicalMaterial)
   - Productos, kit de interfaz, copiar SVG, tema
   ========================================================================= */
(() => {
  "use strict";
  const M = window.CONDOR_MARCA;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ── 1. Sprite de marca ────────────────────────────────────────────── */
  const sprite = document.createElementNS(NS, "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  let simbolos =
    `<symbol id="iso" viewBox="0 0 ${M.iso.w} ${M.iso.h}"><path fill-rule="evenodd" d="${M.iso.d}"/></symbol>` +
    `<symbol id="word" viewBox="0 0 ${M.word.w} ${M.word.h}"><path d="${M.word.d}"/></symbol>` +
    `<symbol id="lockup-h" viewBox="${M.lockupH.vb}">${M.lockupH.cuerpo}</symbol>` +
    `<symbol id="lockup-v" viewBox="${M.lockupV.vb}">${M.lockupV.cuerpo}</symbol>`;
  for (const [id, p] of Object.entries(M.productos)) simbolos += `<symbol id="p-${id}" viewBox="0 0 240 240"><path fill-rule="evenodd" d="${p.d}"/></symbol>`;
  sprite.innerHTML = simbolos;
  document.body.prepend(sprite);

  /* ── 2. Productos (antes de heredar viewBox, porque crean <use>) ───── */
  const PRODS = Object.entries(M.productos);
  const grid = $("#productos-grid");
  if (grid) {
    grid.innerHTML =
      PRODS.map(([id, p]) => `
      <article class="prod" style="--p:${p.color}">
        <div class="prod-iconos">
          <span class="icono-p claro"><svg><use href="#p-${id}"/></svg></span>
          <span class="icono-p lleno"><svg><use href="#p-${id}"/></svg></span>
        </div>
        <p class="prod-nombre"><svg class="pn-iso"><use href="#iso"/></svg><span>condor</span> ${p.nombre.toLowerCase()}</p>
        <p class="prod-que">${p.que}</p>
        <button type="button" class="btn-mini" data-copiar="svg:producto-${id}:color"><svg><use href="#i-copiar"/></svg>SVG</button>
      </article>`).join("") +
      `<article class="prod prod-medula" style="--p:#0853E0">
        <div class="prod-iconos">
          <span class="icono-p claro"><img src="assets/medula/medula-marca.svg" alt=""></span>
          <span class="icono-p lleno"><img src="assets/medula/medula-marca.svg" alt=""></span>
        </div>
        <p class="prod-nombre">Medula <em>de <svg class="pn-iso"><use href="#iso"/></svg> condor.ai</em></p>
        <p class="prod-que">La memoria de tu empresa. Marca propia, respaldada.</p>
      </article>
      <article class="prod prod-proximo">
        <div class="prod-iconos"><span class="icono-p vacio"></span></div>
        <p class="prod-nombre"><svg class="pn-iso"><use href="#iso"/></svg><span>condor</span> ___</p>
        <p class="prod-que">El próximo. Mismo lienzo, mismo trazo, un nodo libre.</p>
      </article>`;
  }
  $$("[data-producto]").forEach((el) => {
    const id = el.dataset.producto;
    el.style.setProperty("--p", M.productos[id].color);
    el.innerHTML = `<svg><use href="#p-${id}"/></svg>`;
  });
  $$("[data-producto-icono]").forEach((el) => {
    const id = el.dataset.productoIcono;
    el.style.setProperty("--p", M.productos[id].color);
    el.innerHTML = `<svg><use href="#p-${id}"/></svg>`;
  });
  const fila = $("#sitio-iconos");
  if (fila) fila.innerHTML = PRODS.map(([id, p]) => `<span class="icono-p lleno chico" style="--p:${p.color}" title="condor ${p.nombre.toLowerCase()}"><svg><use href="#p-${id}"/></svg></span>`).join("") +
    `<span class="icono-p lleno chico" style="--p:#0853E0" title="Medula"><img src="assets/medula/medula-marca.svg" alt=""></span>`;

  // Cada <svg><use href="#x"/></svg> hereda el viewBox de su símbolo: basta un ancho en CSS.
  $$("svg > use").forEach((u) => {
    const s = u.parentNode;
    if (s.hasAttribute("viewBox") || s.closest("symbol")) return;
    const sim = document.querySelector(u.getAttribute("href"));
    if (sim && sim.getAttribute("viewBox")) s.setAttribute("viewBox", sim.getAttribute("viewBox"));
  });

  /* ── 3. Construcción y Forja ───────────────────────────────────────── */
  // El esqueleto trae el collar (círculo blanco) y la cabeza: los sacamos y
  // los resolvemos con una máscara, que funciona sobre cualquier fondo.
  const esq = M.esqueleto.replace(/<circle[^>]*\/>/g, "");
  const cab = { x: 500, y: 204, r: 37, collar: 53 };
  const defs = document.createElementNS(NS, "svg");
  defs.setAttribute("aria-hidden", "true");
  defs.style.cssText = "position:absolute;width:0;height:0";
  defs.innerHTML = `<defs><mask id="m-collar" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="440"><rect width="1000" height="440" fill="#fff"/><circle cx="${cab.x}" cy="${cab.y}" r="${cab.collar}" fill="#000"/></mask></defs>`;
  document.body.prepend(defs);
  const trazos = `<g mask="url(#m-collar)" stroke-linecap="round" stroke-linejoin="round">${esq}</g><circle cx="${cab.x}" cy="${cab.y}" r="${cab.r}" stroke="none"/>`;
  const marcaFinal = `<path fill-rule="evenodd" transform="translate(${-M.iso.dx} ${-M.iso.dy})" d="${M.iso.d}"/>`;
  const ce = $("#cons-esqueleto"), cf = $("#cons-fusion"), cm = $("#cons-marca");
  if (ce) {
    ce.innerHTML = `<g stroke-linecap="round" stroke-linejoin="round">${esq}</g><circle cx="${cab.x}" cy="${cab.y}" r="${cab.r}" stroke="none"/><circle cx="${cab.x}" cy="${cab.y}" r="${cab.collar}" class="cons-anillo"/>`;
    cf.innerHTML = trazos;
    cm.innerHTML = marcaFinal;
    $$(".paso-botones button").forEach((b) =>
      b.addEventListener("click", () => {
        $$(".paso-botones button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
        $("#construccion").dataset.paso = b.dataset.paso;
      }),
    );
  }
  const ft = $("#forja-trazos"), ff = $("#forja-final");
  if (ft) {
    ft.innerHTML = trazos;
    ff.innerHTML = marcaFinal;
    // dedos: se dibujan con pathLength normalizado
    $$("path[fill='none']", ft).forEach((p, i) => { p.setAttribute("pathLength", "1"); p.style.setProperty("--i", i % 3); });
    $$("path:not([fill='none'])", ft).forEach((p) => p.classList.add("forja-ala"));
    $("circle", ft).classList.add("forja-cabeza");
  }
  function correr(el) { el.classList.remove("corre"); void el.offsetWidth; el.classList.add("corre"); }
  $$("[data-repetir]").forEach((b) => b.addEventListener("click", () => correr(document.getElementById(b.dataset.repetir))));
  const forja = $("#carga-forja");
  if (forja) {
    let hecho = false;
    new IntersectionObserver((e) => { if (!hecho && e[0].isIntersecting) { hecho = true; correr(forja); } }, { threshold: 0.5 }).observe(forja);
  }

  /* ── 4. Copiar ─────────────────────────────────────────────────────── */
  const aviso = $("#aviso");
  let avisoT;
  function avisar(t) { aviso.textContent = t; aviso.classList.add("visible"); clearTimeout(avisoT); avisoT = setTimeout(() => aviso.classList.remove("visible"), 1700); }
  function copiar(texto, etq) {
    const ok = () => avisar(`${etq} copiado`);
    const respaldo = () => {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { avisar("No se pudo copiar"); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, respaldo);
    else respaldo();
  }
  const SOLIDOS = { azul: "#3A5CFF", grafito: "#0B0C12", blanco: "#FFFFFF" };
  const GRADS = { ionosfera: ["#9DB4FF", "#3A5CFF", "#13225F"], aurora: ["#FFB3D1", "#C69BFF", "#6F8BFF"], hielo: ["#FFFFFF", "#DCE4FF", "#9DB4FF"] };
  function svgPieza(pieza, color) {
    let vb, cuerpo, fill = SOLIDOS[color] || "#3A5CFF", defs = "";
    if (pieza === "lockup") { vb = M.lockupH.vb; cuerpo = M.lockupH.cuerpo; }
    else if (pieza.startsWith("producto-")) { const p = M.productos[pieza.slice(9)]; vb = "0 0 240 240"; cuerpo = `<path fill-rule="evenodd" d="${p.d}"/>`; fill = p.color; }
    else { vb = `0 0 ${M.iso.w} ${M.iso.h}`; cuerpo = `<path fill-rule="evenodd" d="${M.iso.d}"/>`; }
    if (GRADS[color]) {
      const n = vb.split(" ").map(Number), st = GRADS[color];
      defs = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${n[0]}" y1="${n[1]}" x2="${n[0] + n[2]}" y2="${n[1] + n[3]}">${st.map((c, i) => `<stop offset="${i / (st.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient></defs>`;
      fill = "url(#g)";
    }
    return `<svg xmlns="${NS}" viewBox="${vb}" fill="${fill}">${defs}${cuerpo}</svg>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const v = b.dataset.copiar;
    if (v.startsWith("svg:")) { const [, pieza, color] = v.split(":"); copiar(svgPieza(pieza, color), "SVG"); }
    else if (v === "tokens") copiar($("#codigo-tokens").textContent, "Tokens");
    else copiar(v, v);
  });

  /* ── 5. Tema ───────────────────────────────────────────────────────── */
  const raiz = document.documentElement, btnTema = $("#btn-tema");
  const temas = ["sistema", "claro", "oscuro"];
  function tema(t) {
    if (t === "claro") raiz.dataset.theme = "light";
    else if (t === "oscuro") raiz.dataset.theme = "dark";
    else delete raiz.dataset.theme;
    btnTema.dataset.tema = t;
    btnTema.querySelector("span").textContent = t === "sistema" ? "Auto" : t === "claro" ? "Claro" : "Oscuro";
    guardar("cn-tema", t);
    if (window.__cnEscena) window.__cnEscena.tema();
  }
  tema(leer("cn-tema") || "sistema");
  btnTema.addEventListener("click", () => tema(temas[(temas.indexOf(btnTema.dataset.tema) + 1) % 3]));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => window.__cnEscena && window.__cnEscena.tema());

  /* ── 6. Navegación activa ──────────────────────────────────────────── */
  const enlaces = $$(".barra-nav a");
  const secs = enlaces.map((a) => document.querySelector(a.getAttribute("href")));
  addEventListener("scroll", () => {
    const y = innerHeight * 0.3;
    let act = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= y) act = i; });
    enlaces.forEach((a, i) => a.classList.toggle("activo", i === act));
  }, { passive: true });

  /* ── 7. Láminas que se inclinan con la luz ─────────────────────────── */
  $$("[data-inclinar]").forEach((el) => {
    const zona = el.closest(".mesa") || el;
    zona.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
      el.style.setProperty("--lx", `${Math.max(0, Math.min(100, x * 100))}%`);
      el.style.setProperty("--ly", `${Math.max(0, Math.min(100, y * 100))}%`);
    });
    zona.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });

  /* ── 8. Kit ────────────────────────────────────────────────────────── */
  $$("[data-modo-bloque]").forEach((g) => {
    const destino = document.getElementById(g.dataset.modoBloque);
    $$("button", g).forEach((b) => b.addEventListener("click", () => {
      $$("button", g).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      destino.classList.toggle("cn-oscuro", b.dataset.modo === "oscuro");
      destino.classList.toggle("cn-claro", b.dataset.modo === "claro");
    }));
  });
  $$(".ui-pestanas").forEach((g) => $$("button", g).forEach((b) => b.addEventListener("click", () => {
    $$("button", g).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  })));
  $$("[data-cargando]").forEach((b) => b.addEventListener("click", () => {
    if (b.classList.contains("cargando")) return;
    b.classList.add("cargando");
    setTimeout(() => b.classList.remove("cargando"), 2200);
  }));

  /* ── 9. Cóndor de acrílico (3D) ────────────────────────────────────── */
  const caja3d = $("#escena3d"), lienzo = $("#lienzo3d");
  function sin3d() { caja3d.classList.add("sin-3d"); }
  if (!window.THREE || !lienzo) { sin3d(); return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { sin3d(); return; }
  const T = THREE;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.NoToneMapping;
  renderer.toneMappingExposure = 0.95;
  const escena = new T.Scene();
  const camara = new T.PerspectiveCamera(28, 1, 1, 5000);
  camara.position.set(0, 0, 1650);

  // Entorno: una "sala" de paneles de luz para que el acrílico tenga reflejos.
  const pmrem = new T.PMREMGenerator(renderer);
  const sala = new T.Scene();
  sala.background = new T.Color(0x3a4256);
  const luzPanel = (w, h, x, y, z, ry, c = 0xffffff) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; sala.add(m);
  };
  luzPanel(6, 2, 0, 4, -4, 0); luzPanel(2, 6, -5, 0, 0, Math.PI / 2); luzPanel(2, 6, 5, 1, 0, -Math.PI / 2, 0xdfe6ff);
  luzPanel(8, 1.2, 0, -3, 4, Math.PI, 0xffe9f3); luzPanel(3, 3, 0, 6, 2, 0);
  escena.environment = pmrem.fromScene(sala, 0.03).texture;

  // Luces de color detrás: el acrílico las refracta.
  function mancha(color, tam, x, y, z, op) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const s = new T.Mesh(new T.PlaneGeometry(tam, tam), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, opacity: op, depthWrite: false }));
    s.position.set(x, y, z); escena.add(s); return s;
  }
  // detrás del cóndor, dentro del encuadre: lo que el acrílico refracta
  // (las luces de color viven en CSS detrás del lienzo: más limpias que en 3D)
  const manchas = [];

  // Geometría: el path del isotipo → formas → extrusión con bisel redondo.
  const tok = M.iso.d.match(/[MLCZ]|-?(?:\d+\.?\d*|\.\d+)/g);
  const formas = [];
  let f = null, i = 0, cmd = "";
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) { cmd = tok[i++]; if (cmd === "Z" && f) { formas.push(f); f = null; } continue; }
    // potrace no cierra con Z: cada M nuevo cierra la forma anterior
    if (cmd === "M") { if (f) formas.push(f); f = new T.Shape(); f.moveTo(num(), -num()); cmd = "L"; }
    else if (cmd === "L") f.lineTo(num(), -num());
    else if (cmd === "C") { const a = num(), b = -num(), c = num(), d = -num(), e = num(), g = -num(); f.bezierCurveTo(a, b, c, d, e, g); }
    else i++;
  }
  if (f) formas.push(f);
  const geo = new T.ExtrudeGeometry(formas, { depth: 46, bevelEnabled: true, bevelThickness: 16, bevelSize: 9, bevelSegments: 10, curveSegments: 28 });
  geo.center();
  const material = new T.MeshPhysicalMaterial({
    color: 0x3a5cff, metalness: 0, roughness: 0.12, reflectivity: 0.7,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9,
    transparent: true, opacity: 0.9,
  });
  const condor = new T.Mesh(geo, material);
  escena.add(condor);
  const luz = new T.DirectionalLight(0xffffff, 0.9); luz.position.set(-300, 600, 900); escena.add(luz);

  function medir() {
    const r = caja3d.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camara.aspect = r.width / r.height;
    // que el cóndor ocupe ~72 % del ancho (o del alto si la escena es angosta)
    const ancho = M.iso.w * 1.05;
    const dist = (ancho / 0.6) / (2 * Math.tan((camara.fov * Math.PI) / 360) * camara.aspect);
    camara.position.z = Math.max(dist, 900);
    camara.updateProjectionMatrix();
  }
  window.__cnEscena = {
    tema() {
      const oscuro = getComputedStyle(raiz).colorScheme.includes("dark");
      material.color.set(oscuro ? 0x4a6bff : 0x3a5cff).convertSRGBToLinear();
      material.envMapIntensity = oscuro ? 1.5 : 1.3;
    },
  };
  window.__cnEscena.tema();
  medir();
  addEventListener("resize", medir);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  caja3d.addEventListener("pointermove", (e) => {
    const r = caja3d.getBoundingClientRect();
    ptr.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ptr.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  caja3d.addEventListener("pointerleave", () => { ptr.tx = 0; ptr.ty = 0; });
  let visible = true;
  new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(caja3d);
  const t0 = performance.now();
  function cuadro(ahora) {
    if (visible) {
      const t = (ahora - t0) / 1000;
      ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
      const entrada = reduce ? 1 : Math.min(1, t / 1.6);
      const e = 1 - Math.pow(1 - entrada, 4);
      condor.rotation.y = (reduce ? 0 : Math.sin(t * 0.45) * 0.32) + ptr.x * 0.35 + (1 - e) * -0.7;
      condor.rotation.x = 0.1 + ptr.y * 0.18 + (reduce ? 0 : Math.sin(t * 0.3) * 0.04);
      condor.position.y = (reduce ? 0 : Math.sin(t * 0.8) * 8) + (1 - e) * -60;
      renderer.render(escena, camara);
    }
    if (!reduce) requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  if (reduce) setTimeout(() => renderer.render(escena, camara), 50);
  caja3d.classList.add("con-3d");
})();
