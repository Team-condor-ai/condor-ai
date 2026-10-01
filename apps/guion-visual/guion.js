/* =========================================================================
   Guion visual condor.ai · visión Claro · motor
   - Marca: sprite (isotipo y sus propuestas, wordmark, logos, productos)
   - Letras vivas: el wordmark se escribe trazo a trazo
   - Propuestas del isotipo, plano de construcción de las letras
   - Productos, kit de interfaz, copiar SVG, tema
   Todo plano: sin 3D ni texturas. El acrílico vive solo en la interfaz.
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
  for (const [k, v] of Object.entries(M.isos)) simbolos += `<symbol id="iso-${k}" viewBox="0 0 ${v.w} ${v.h}"><path fill-rule="evenodd" d="${v.d}"/></symbol>`;
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

  /* ── 3. Letras vivas ───────────────────────────────────────────────── */
  // Cada <svg class="letras-vivas"> recibe: los trazos centrales (que se dibujan),
  // los nodos (que aparecen con un pequeño rebote) y la forma final (que entra
  // al terminar y deja el wordmark exacto).
  const W = M.word;
  function prepararLetras(el) {
    el.setAttribute("viewBox", `-12 -12 ${W.w + 24} ${W.h + 24}`);
    const trazos = W.trazos.map((t) => `<path pathLength="1" style="--l:${t.letra}" d="${t.d}"/>`).join("");
    const nodos = W.nodos.map((n) => `<circle style="--l:${n.letra}" cx="${n.x}" cy="${n.y}" r="13"/>`).join("");
    el.innerHTML = `<g class="lv-trazos" stroke-width="${W.grosor}" fill="none" stroke-linecap="butt">${trazos}</g><g class="lv-nodos">${nodos}</g><path class="lv-final" d="${W.d}"/>`;
    el.style.setProperty("--retraso", `${el.dataset.escribir || 0}s`);
  }
  function escribir(el) {
    el.classList.remove("escribe");
    void el.getBoundingClientRect();
    el.classList.add("escribe");
  }
  $$(".letras-vivas").forEach((el) => {
    prepararLetras(el);
    if (reduce) { el.classList.add("quieta"); return; }
    let hecho = false;
    new IntersectionObserver((e) => { if (!hecho && e[0].isIntersecting) { hecho = true; escribir(el); } }, { threshold: 0.4 }).observe(el);
  });

  /* ── 4. Plano de construcción de las letras ────────────────────────── */
  const guia = $("#letras-guia");
  if (guia) {
    const w = W.w, h = W.h;
    const g = (y, cls, txt) => `<line x1="-30" x2="${w + 30}" y1="${y}" y2="${y}" class="${cls}"/><text x="${w + 36}" y="${y + 4}" class="lg-t">${txt}</text>`;
    // centros de los círculos (o, d, o, a) y de la c, a partir de los trazos
    const circulos = W.trazos.filter((t) => /A39 39 0 1 1/.test(t.d) && /Z$/.test(t.d)).map((t) => {
      const n = t.d.match(/-?\d+(\.\d+)?/g).map(Number);
      return [n[0] + 39, n[1]];
    });
    const ang = (cx, cy) => {
      const a = (30.7 * Math.PI) / 180;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + 70 * Math.cos(a)}" y2="${cy + 70 * Math.sin(a)}" class="lg-ala"/>`;
    };
    guia.setAttribute("viewBox", `-40 -36 ${w + 150} ${h + 72}`);
    guia.innerHTML =
      g(0, "lg-l", "ascendente") + g(46, "lg-l", "alto de x") + g(146, "lg-l fuerte", "línea base") +
      circulos.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="50" class="lg-c"/>`).join("") +
      `<circle cx="50" cy="96" r="50" class="lg-c"/>` + ang(50, 96) + `<text x="104" y="140" class="lg-t lg-rosa">30,7°</text>` +
      `<line x1="395" y1="-8.3" x2="445" y2="21.4" class="lg-ala"/>` +
      `<g class="letras-vivas-g"></g>`;
    // las letras vivas dentro del plano
    const vivas = document.createElementNS(NS, "svg");
    vivas.setAttribute("class", "letras-vivas");
    vivas.setAttribute("x", "0"); vivas.setAttribute("y", "0");
    vivas.setAttribute("width", W.w); vivas.setAttribute("height", W.h);
    vivas.dataset.escribir = "0.2";
    guia.appendChild(vivas);
    prepararLetras(vivas);
    vivas.setAttribute("viewBox", `0 0 ${W.w} ${W.h}`);
    if (reduce) vivas.classList.add("quieta");
    else new IntersectionObserver((e) => { if (e[0].isIntersecting) escribir(vivas); }, { threshold: 0.5 }).observe(guia);
    $("#btn-escribir").addEventListener("click", () => escribir(vivas));
  }

  /* ── 5. Propuestas del isotipo ─────────────────────────────────────── */
  const prop = $("#propuesta");
  if (prop) {
    const textos = $$(".propuesta-textos p");
    const ver = (v) => {
      prop.dataset.variante = v;
      textos.forEach((p) => (p.hidden = p.dataset.texto !== v));
      $$("#propuestas button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.variante === v)));
    };
    $$("#propuestas button").forEach((b) => b.addEventListener("click", () => ver(b.dataset.variante)));
    ver("corte");
  }

  /* ── 6. Cargas ─────────────────────────────────────────────────────── */
  function correr(el) {
    el.classList.remove("corre"); void el.offsetWidth; el.classList.add("corre");
    $$(".letras-vivas", el).forEach(escribir);
  }
  $$("[data-repetir]").forEach((b) => b.addEventListener("click", () => correr(document.getElementById(b.dataset.repetir))));
  const ct = $("#carga-trazo");
  if (ct && !reduce) {
    let hecho = false;
    new IntersectionObserver((e) => { if (!hecho && e[0].isIntersecting) { hecho = true; correr(ct); } }, { threshold: 0.5 }).observe(ct);
  }

  /* ── 7. Copiar ─────────────────────────────────────────────────────── */
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

  /* ── 8. Tema ───────────────────────────────────────────────────────── */
  const raiz = document.documentElement, btnTema = $("#btn-tema");
  const temas = ["sistema", "claro", "oscuro"];
  function tema(t) {
    if (t === "claro") raiz.dataset.theme = "light";
    else if (t === "oscuro") raiz.dataset.theme = "dark";
    else delete raiz.dataset.theme;
    btnTema.dataset.tema = t;
    btnTema.querySelector("span").textContent = t === "sistema" ? "Auto" : t === "claro" ? "Claro" : "Oscuro";
    guardar("cn-tema", t);
  }
  tema(leer("cn-tema") || "sistema");
  btnTema.addEventListener("click", () => tema(temas[(temas.indexOf(btnTema.dataset.tema) + 1) % 3]));

  /* ── 9. Navegación activa ──────────────────────────────────────────── */
  const enlaces = $$(".barra-nav a");
  const secs = enlaces.map((a) => document.querySelector(a.getAttribute("href")));
  addEventListener("scroll", () => {
    const y = innerHeight * 0.3;
    let act = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= y) act = i; });
    enlaces.forEach((a, i) => a.classList.toggle("activo", i === act));
  }, { passive: true });

  /* ── 10. Láminas de acrílico: la luz sigue al cursor ───────────────── */
  $$("[data-inclinar]").forEach((el) => {
    const zona = el.closest(".mesa") || el;
    zona.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--lx", `${Math.max(0, Math.min(100, x * 100))}%`);
      el.style.setProperty("--ly", `${Math.max(0, Math.min(100, y * 100))}%`);
    });
  });

  /* ── 11. Kit ───────────────────────────────────────────────────────── */
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
})();
