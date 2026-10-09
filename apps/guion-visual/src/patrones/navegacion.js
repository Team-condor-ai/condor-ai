/* Navegación del guion (y demostración de los patrones):
   - Barra: el logo se pliega a isotipo al bajar; migas "Capítulo › Sección" donde el
     capítulo abre un menú con sus secciones hermanas; botón ⌘K; progreso de lectura.
   - Dock de acrílico: capítulos con una gota que se desliza (resorte) al activo.
     En celular: una píldora con la sección actual que abre el índice como hoja.
   - ⌘K: paleta de comandos (buscar secciones, copiar colores, acciones).
   - Pestañas: indicador que viaja con resorte. */
import { CAPITULOS, SECCIONES, capituloDe, seccionesDe } from "../plan.js";
import { hacerAcrilico } from "../kit/acrilico.js";
import { Resorte } from "../kit/resorte.js";
import { hoja, montarPopups } from "../kit/popups.js";
import { toast } from "../kit/avisos.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lleva a una sección y deja el foco ahí (sin anillo ni salto), para seguir con Tab desde ella. */
export function irA(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  el.scrollIntoView({ behavior: reducido() ? "auto" : "smooth" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

export function montarNavegacion() {
  const barra = $(".barra");
  const migaCap = $("#miga-cap"), migaSec = $("#miga-sec"), menuCap = $("#menu-hermanas");
  const dock = $(".dock"), gota = $(".dock-gota");
  const progreso = $(".barra-progreso i");
  const pildora = $(".pildora-indice"), indice = $("#hoja-indice");
  // el menú vive fuera de la barra: su backdrop-filter la vuelve raíz de fondo y bloque
  // contenedor de lo fijo, así el acrílico del menú no esmerilaba la página de abajo
  document.body.appendChild(menuCap);

  // ── dock: un botón por capítulo ──
  const lista = $(".dock-capitulos");
  lista.innerHTML = CAPITULOS.map((c) => `<a href="#${seccionesDe(c.id)[0].id}" data-cap="${c.id}" data-tip="${c.nombre}"><b aria-hidden="true">${c.n}</b><span>${c.nombre}</span></a>`).join("");
  montarPopups(lista);   // los tooltips del dock (se montaron antes de que existieran los botones)
  hacerAcrilico(dock);
  hacerAcrilico(gota);
  const gx = new Resorte(0, { rigidez: 260, amortiguacion: 25 }), gw = new Resorte(44, { rigidez: 260, amortiguacion: 27 });
  const pintarGota = () => { gota.style.transform = `translateX(${gx.x}px)`; gota.style.width = `${gw.x}px`; };
  const moverGota = (cap, instante) => {
    const a = $(`.dock-capitulos a[data-cap="${cap}"]`);
    if (!a) return;
    $$(".dock-capitulos a").forEach((x) => { x.classList.toggle("activo", x === a); x === a ? x.setAttribute("aria-current", "location") : x.removeAttribute("aria-current"); });
    const r = a.getBoundingClientRect(), d = lista.getBoundingClientRect();
    if (!r.width) return;   // dock oculto (celular)
    if (instante) { gx.fijar(r.left - d.left); gw.fijar(r.width); pintarGota(); return; }
    gx.a(r.left - d.left, pintarGota); gw.a(r.width, pintarGota);
  };

  // ── sección visible → migas, dock, píldora, índice ──
  let actual = null, capActual = null;
  const poner = (id, instante) => {
    if (id === actual) return;
    const s = SECCIONES.find((x) => x.id === id), c = capituloDe(id);
    if (!s || !c) return;
    actual = id;
    migaCap.querySelector("span").textContent = `${c.n} · ${c.nombre}`;
    migaSec.textContent = s.nombre;
    pildora.querySelector(".tx").textContent = s.nombre;
    pildora.setAttribute("aria-label", `Índice del guion, estás en ${s.nombre}`);
    if (c.id !== capActual) {
      // el menú solo se rehace al cambiar de capítulo (si está abierto no pierde el foco)
      // solo se cambian los ítems: un innerHTML borraría la capa de acrílico y el menú quedaba transparente
      capActual = c.id;
      $$("[role=menuitem]", menuCap).forEach((a) => a.remove());
      menuCap.insertAdjacentHTML("beforeend", seccionesDe(c.id).map((x) => `<a role="menuitem" href="#${x.id}">${x.nombre}</a>`).join(""));
    }
    $$("[role=menuitem]", menuCap).forEach((a) => (a.getAttribute("href") === `#${id}` ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    $$("a", indice).forEach((a) => (a.getAttribute("href") === `#${id}` ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
    if (!destino || destino === c.id) moverGota(c.id, instante);
  };
  // al tocar un capítulo la gota viaja altiro (sin esperar al scroll) y no se distrae con los
  // capítulos que la página cruza en el camino; se suelta cuando el scroll termina
  let destino = null, soltar = 0;
  const liberar = () => { destino = null; const c = capituloDe(actual); if (c) moverGota(c.id); };
  lista.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-cap]");
    if (!a) return;
    destino = a.dataset.cap; moverGota(destino);
    clearTimeout(soltar); soltar = setTimeout(liberar, 2500);   // por si el navegador no avisa scrollend
  });
  addEventListener("scrollend", () => { if (destino) { clearTimeout(soltar); liberar(); } });
  let primera = true;
  const obs = new IntersectionObserver((xs) => {
    const vis = xs.filter((x) => x.isIntersecting).pop();
    if (vis) { poner(vis.target.id, primera); primera = false; }
  }, { rootMargin: "-45% 0px -50% 0px" });
  SECCIONES.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
  setTimeout(() => { if (!actual) { poner("inicio", true); primera = false; } }, 400);
  const recolocar = () => { const c = capituloDe(actual); if (c) moverGota(c.id, true); };
  addEventListener("resize", recolocar);
  document.fonts?.ready.then(recolocar);   // el ancho de los botones cambia al cargar la letra

  // ── barra que se pliega + progreso de lectura ──
  let plegada = false, raf = 0;
  addEventListener("scroll", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
      if (progreso) progreso.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
      const p = y > 120;
      if (p !== plegada) { plegada = p; barra.classList.toggle("plegada", p); }
    });
  }, { passive: true });

  // ── menú de hermanas (las migas): popups.js lo abre y lo cierra con su animación;
  // aquí solo se enfoca la sección actual en vez de la primera ──
  const enfocarActual = () => requestAnimationFrame(() => { if (!menuCap.hidden && !menuCap.classList.contains("sale")) menuCap.querySelector("[aria-current]")?.focus(); });
  migaCap.addEventListener("click", enfocarActual);
  migaCap.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") enfocarActual(); });

  // ── píldora de índice (celular) ──
  const cuerpoIndice = indice.querySelector(".indice");
  cuerpoIndice.innerHTML = CAPITULOS.map((c) => `<div class="indice-cap" role="group" aria-labelledby="ind-${c.id}"><p class="rotulo" id="ind-${c.id}">${c.n} · ${c.nombre}</p>${seccionesDe(c.id).map((s) => `<a href="#${s.id}" data-cerrar>${s.nombre}</a>`).join("")}</div>`).join("");
  indice.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    // con la hoja abierta la raíz no se desplaza (overflow: hidden): se espera a que cierre
    e.preventDefault();
    const id = a.getAttribute("href").slice(1);
    let hecho = false;
    const ir = () => { if (hecho) return; hecho = true; mo.disconnect(); requestAnimationFrame(() => irA(id)); };
    const mo = new MutationObserver(() => indice.hidden && ir());
    mo.observe(indice, { attributes: true, attributeFilter: ["hidden"] });
    setTimeout(ir, 1500);
  });
  pildora.setAttribute("aria-haspopup", "dialog");
  pildora.addEventListener("click", (e) => {
    hoja(indice, e.currentTarget);
    // abre mostrando (y con el foco en) la sección actual
    const a = indice.querySelector("[aria-current]");
    if (a) {
      // el capítulo actual arriba, con su rótulo; si la sección quedara bajo el borde
      // de la media altura, se sube la sección misma
      const top = cuerpoIndice.getBoundingClientRect().top, grupo = a.closest(".indice-cap").getBoundingClientRect().top;
      const h = indice.offsetHeight, visible = Math.min(h, Math.max(320, h * 0.55)) - 64;   // ancla media de la hoja
      const dCap = grupo - top, dSec = a.getBoundingClientRect().bottom - top;
      cuerpoIndice.scrollTop += dSec - dCap < visible ? dCap - 4 : dSec - visible;
      a.focus({ preventScroll: true });
    }
  });

  montarComando();
  montarPestanas();
}

// ── ⌘K ──────────────────────────────────────────────────────────────────
function montarComando() {
  const dlg = $("#comando"), inp = $("#comando-buscar"), res = $("#comando-resultados");
  const M = window.CONDOR_MARCA;
  const acciones = [
    ...SECCIONES.map((s) => ({ t: s.nombre, d: capituloDe(s.id).nombre, ir: `#${s.id}`, k: "Ir a" })),
    { t: "Copiar Azul Cóndor", d: "#014CFD", copiar: "#014CFD", k: "Color" },
    { t: "Copiar Tinta", d: "#151517", copiar: "#151517", k: "Color" },
    ...Object.values(M.productos).map((p) => ({ t: `Copiar color de condor ${p.nombre}`, d: p.color, copiar: p.color, k: "Color" })),
    { t: "Descargar logo horizontal", d: "SVG en negro", bajar: "assets/marca/condor-logo-horizontal-negro.svg", k: "Archivo" },
    { t: "Descargar isotipo", d: "SVG en negro", bajar: "assets/marca/condor-isotipo-negro.svg", k: "Archivo" },
    { t: "Cámara lenta", d: "Las animaciones ×4", alternar: "lento", k: "Acción" },
  ];
  const MAX = 9;
  let filtradas = acciones, sel = 0, desde = null, abierto = false, reloj = 0;
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = (s) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  // atajo según el sistema: ⌘K en Apple, Ctrl K en el resto
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || "");
  $$(".buscar-cmd kbd").forEach((k) => (k.textContent = mac ? "⌘K" : "Ctrl K"));
  $$("[data-comando]").forEach((b) => b.setAttribute("aria-keyshortcuts", mac ? "Meta+K" : "Control+K"));
  $$('.buscar-cmd[aria-label]').forEach((b) => b.setAttribute("aria-label", `Buscar (${mac ? "⌘K" : "Ctrl K"})`));
  // en celular el texto de ayuda largo se corta: uno corto que se lee entero
  const ayuda = inp.placeholder, angosto = matchMedia("(max-width: 520px)");
  const ajustarAyuda = () => (inp.placeholder = angosto.matches ? "Buscar en el guion…" : ayuda);
  ajustarAyuda(); angosto.addEventListener("change", ajustarAyuda);

  const marcar = (i) => {
    // solo cambia la marca (sin rehacer la lista: el puntero no parpadea)
    sel = i;
    $$("[role=option]", res).forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    const li = $(`#cmd-${i}`, res);
    if (li) { inp.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
    else inp.removeAttribute("aria-activedescendant");
  };
  const pintar = () => {
    res.innerHTML = filtradas.slice(0, MAX).map((a, i) => `<li role="option" id="cmd-${i}" aria-selected="false" data-i="${i}"><span class="cmd-k">${a.k}</span><b>${a.t}</b><small>${a.d}</small></li>`).join("")
      || `<li class="cmd-vacio" role="option" aria-disabled="true" aria-selected="false">Nada con «${esc(inp.value.trim())}». Prueba con «logo» o «azul».</li>`;
    marcar(filtradas.length ? sel : -1);
  };
  const filtrar = () => {
    const q = norm(inp.value.trim());
    filtradas = !q ? acciones : acciones.filter((a) => norm(`${a.t} ${a.d} ${a.k}`).includes(q));
    sel = 0; pintar();
  };
  const ejecutar = (a) => {
    if (!a) return;
    if (a.ir) desde = null;   // el foco va a la sección, no de vuelta al botón
    cerrar();
    if (a.ir) setTimeout(() => irA(a.ir.slice(1)), 60);
    if (a.copiar) navigator.clipboard?.writeText(a.copiar).then(() => toast(`${a.copiar} copiado`, { tono: "ok", duracion: 2200 }), () => toast("No se pudo copiar", { tono: "error" }));
    if (a.bajar) { const l = document.createElement("a"); l.href = a.bajar; l.download = ""; l.click(); toast("Descargando el SVG", { duracion: 1800 }); }
    if (a.alternar) {
      const on = document.body.classList.toggle(a.alternar);
      const casilla = document.getElementById(a.alternar);   // la casilla de las firmas queda al día
      if (casilla) casilla.checked = on;
      toast(on ? "Cámara lenta activada" : "Cámara lenta desactivada", { tono: "info", duracion: 2000 });
    }
  };
  const caja = dlg.querySelector(".comando-caja");
  const abrir = (b) => {
    if (abierto) return;
    abierto = true;
    clearTimeout(reloj);
    desde = b || document.activeElement;
    dlg.classList.remove("sale");   // si venía cerrándose, se recupera sin trabarse
    dlg.hidden = false;
    document.documentElement.classList.add("con-modal");
    if (!caja._acrilico) hacerAcrilico(caja);
    inp.value = ""; filtrar(); inp.focus();
  };
  const cerrar = () => {
    if (!abierto) return;
    abierto = false;
    dlg.classList.add("sale");
    document.documentElement.classList.remove("con-modal");
    const fin = () => { if (abierto) return; clearTimeout(reloj); dlg.hidden = true; dlg.classList.remove("sale"); };
    dlg.addEventListener("animationend", (e) => e.target === dlg && fin(), { once: true });
    // por si la animación no corre (sin animación o pestaña en segundo plano)
    const dur = parseFloat(getComputedStyle(dlg).animationDuration) * 1000 || 0;
    if (!dur) fin(); else reloj = setTimeout(fin, dur + 400);
    desde?.focus?.({ preventScroll: true });
  };
  inp.addEventListener("input", filtrar);
  inp.addEventListener("keydown", (e) => {
    const n = Math.min(MAX, filtradas.length);
    if (e.key === "ArrowDown" && n) { e.preventDefault(); marcar((sel + 1) % n); }
    else if (e.key === "ArrowUp" && n) { e.preventDefault(); marcar((sel - 1 + n) % n); }
    else if (e.key === "Home" && n && !inp.value) { e.preventDefault(); marcar(0); }
    else if (e.key === "End" && n && !inp.value) { e.preventDefault(); marcar(n - 1); }
    else if (e.key === "Enter") { e.preventDefault(); ejecutar(filtradas[sel]); }
  });
  // Escape y Tab, vengan de donde vengan mientras está abierto (el foco no se escapa)
  document.addEventListener("keydown", (e) => {
    if (!abierto) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
    else if (e.key === "Tab") { e.preventDefault(); inp.focus(); }
  }, true);
  res.addEventListener("pointermove", (e) => { const li = e.target.closest("[data-i]"); if (li && Number(li.dataset.i) !== sel) marcar(Number(li.dataset.i)); });
  res.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) ejecutar(filtradas[Number(li.dataset.i)]); });
  dlg.addEventListener("pointerdown", (e) => { if (e.target === dlg) cerrar(); });
  document.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "k") return;
    e.preventDefault();
    if (abierto) cerrar();
    else if (!document.querySelector(".velo")) abrir();   // no se abre bajo un modal u hoja abiertos
  });
  $$("[data-comando]").forEach((b) => b.addEventListener("click", () => abrir(b)));
}

// ── Pestañas con indicador que viaja ────────────────────────────────────
function montarPestanas() {
  $$(".pestanas").forEach((p) => {
    const tabs = $$('[role="tab"]', p), ind = document.createElement("i");
    ind.className = "pestanas-ind";
    p.querySelector('[role="tablist"]').appendChild(ind);
    const x = new Resorte(0), w = new Resorte(0);
    const pintar = () => { ind.style.transform = `translateX(${x.x}px)`; ind.style.width = `${w.x}px`; };
    const ir = (t, instante) => {
      tabs.forEach((b) => { const on = b === t; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; const panel = document.getElementById(b.getAttribute("aria-controls")); if (panel) { panel.hidden = !on; if (on && !instante) { panel.classList.remove("aparecer"); void panel.offsetWidth; panel.classList.add("aparecer"); } } });
      const r = t.getBoundingClientRect(), l = t.parentElement.getBoundingClientRect();
      if (instante) { x.fijar(r.left - l.left); w.fijar(r.width); pintar(); } else { x.a(r.left - l.left, pintar); w.a(r.width, pintar); }
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => ir(t));
      t.addEventListener("keydown", (e) => { const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null; if (j === null) return; e.preventDefault(); const n = tabs[(j + tabs.length) % tabs.length]; n.focus(); ir(n); });
    });
    requestAnimationFrame(() => ir(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0], true));
    new ResizeObserver(() => ir(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0], true)).observe(p);
  });
}
