/* Scrollers.
   - Carrusel: a sangre (las tarjetas se asoman por el margen, como en apple.com), scroll-snap
     nativo + flechas + puntos (uno por cada posición alcanzable) + teclado + arrastre con
     mouse con inercia que se asienta en una tarjeta + progreso pegado al dedo.
   - Marquee: cinta infinita; se pausa con el puntero encima; quieta con movimiento reducido.
   - Vuelo: escena fija (sticky) cuyo avance 0–1 sale del scroll; el cóndor sigue la curva,
     la estela se dibuja detrás y el nombre se escribe al ritmo del dedo. */
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const vel = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1;
const salida = (t) => 1 - Math.pow(1 - t, 4); // se posa (≈ --cn-llegada)

export function montarScrollers(raiz = document) {
  // ── carrusel ──
  raiz.querySelectorAll(".carrusel").forEach((c) => {
    const pista = c.querySelector(".carrusel-pista"), items = [...pista.children];
    const puntos = c.querySelector(".carrusel-puntos"), barra = c.querySelector(".carrusel-progreso i");
    const prev = c.querySelector("[data-dir='-1']"), next = c.querySelector("[data-dir='1']");
    let posiciones = [0], bs = [], anim = 0;

    // a sangre: la pista ocupa todo el ancho y su relleno coincide con la columna de texto
    const medir = () => {
      const r = c.getBoundingClientRect();
      const borde = Math.max(0, r.left);
      c.style.setProperty("--borde", `${borde}px`);
      // posiciones de snap reales (las últimas tarjetas no pueden alinearse al inicio)
      const max = pista.scrollWidth - pista.clientWidth;
      const pad = parseFloat(getComputedStyle(pista).scrollPaddingLeft) || 0;
      const base = pista.getBoundingClientRect().left - pista.scrollLeft;
      const ps = [];
      items.forEach((it) => {
        const x = Math.min(max, Math.max(0, Math.round(it.getBoundingClientRect().left - base - pad)));
        if (!ps.some((p) => Math.abs(p - x) < 3)) ps.push(x);
      });
      posiciones = ps.length ? ps : [0];
      if (bs.length !== posiciones.length) {
        puntos.innerHTML = posiciones.map((_, i) => `<button type="button" aria-label="Ir a la posición ${i + 1} de ${posiciones.length}"></button>`).join("");
        bs = [...puntos.children];
        bs.forEach((b, i) => b.addEventListener("click", () => irA(posiciones[i])));
      }
      pintar();
    };
    const cercana = (x) => posiciones.reduce((m, p, i) => (Math.abs(p - x) < Math.abs(posiciones[m] - x) ? i : m), 0);
    const pintar = () => {
      const max = pista.scrollWidth - pista.clientWidth;
      const p = max > 0 ? pista.scrollLeft / max : 0;
      if (barra) barra.style.transform = `scaleX(${(0.08 + 0.92 * p).toFixed(4)})`;
      const i = cercana(pista.scrollLeft);
      bs.forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
      prev.disabled = pista.scrollLeft < 4;
      next.disabled = pista.scrollLeft > max - 4;
    };

    // desplazamiento propio (cancelable): el snap se apaga mientras viaja y vuelve al llegar,
    // así nunca pelea con la animación ni da un tirón al final
    const parar = () => { if (anim) cancelAnimationFrame(anim); anim = 0; };
    const irA = (x, { v0 = 0 } = {}) => {
      parar();
      const desde = pista.scrollLeft, hasta = Math.max(0, Math.min(pista.scrollWidth - pista.clientWidth, x));
      if (reducido() || Math.abs(hasta - desde) < 1) { pista.scrollLeft = hasta; pista.classList.remove("arrastrando"); pintar(); return; }
      const dur = Math.min(900, 380 + Math.abs(hasta - desde) * 0.5 + Math.abs(v0) * 60) * vel();
      const t0 = performance.now();
      pista.classList.add("arrastrando");
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - t0) / dur);
        pista.scrollLeft = desde + (hasta - desde) * salida(t);
        if (t < 1) anim = requestAnimationFrame(paso);
        else { anim = 0; pista.classList.remove("arrastrando"); pintar(); }
      };
      anim = requestAnimationFrame(paso);
    };
    const vecina = (dir) => {
      const i = cercana(pista.scrollLeft);
      const x = pista.scrollLeft;
      // si está entre dos posiciones, la "siguiente" es la primera que queda en esa dirección
      const j = dir > 0 ? posiciones.findIndex((p) => p > x + 4) : posiciones.findLastIndex((p) => p < x - 4);
      return posiciones[j >= 0 ? j : i];
    };

    prev.addEventListener("click", () => irA(vecina(-1)));
    next.addEventListener("click", () => irA(vecina(1)));
    pista.addEventListener("scroll", () => requestAnimationFrame(pintar), { passive: true });
    pista.addEventListener("keydown", (e) => {
      const destino = { ArrowRight: () => vecina(1), ArrowLeft: () => vecina(-1), Home: () => posiciones[0], End: () => posiciones[posiciones.length - 1] }[e.key];
      if (destino) { e.preventDefault(); irA(destino()); }
    });
    // la rueda o el trackpad toman el control al instante
    pista.addEventListener("wheel", parar, { passive: true });
    pista.addEventListener("touchstart", parar, { passive: true });

    // arrastre con mouse (el táctil ya es nativo): sigue al puntero 1:1 y al soltar
    // proyecta la velocidad para elegir tarjeta, como un gesto de iOS
    let x0 = 0, s0 = 0, v = 0, ux = 0, ut = 0, arrastrando = false, movio = false;
    pista.addEventListener("dragstart", (e) => e.preventDefault());
    pista.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      parar();
      arrastrando = true; movio = false; x0 = ux = e.clientX; s0 = pista.scrollLeft; v = 0; ut = performance.now();
      pista.setPointerCapture(e.pointerId); pista.classList.add("arrastrando");
    });
    pista.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      const ahora = performance.now(), dt = Math.max(1, ahora - ut);
      // velocidad suavizada (px/ms, positiva = hacia la derecha del contenido)
      v = v * 0.6 + (-(e.clientX - ux) / dt) * 0.4;
      ux = e.clientX; ut = ahora;
      if (Math.abs(e.clientX - x0) > 3) movio = true;
      pista.scrollLeft = s0 - (e.clientX - x0);
    });
    const soltar = (e) => {
      if (!arrastrando) return;
      arrastrando = false;
      try { pista.releasePointerCapture(e.pointerId); } catch {}
      if (performance.now() - ut > 80) v = 0; // se quedó quieto antes de soltar: sin inercia
      const proyectado = pista.scrollLeft + v * 260;
      // nunca más de una "pantalla" por gesto, para que se sienta controlado
      const lim = pista.clientWidth * 0.9;
      const objetivo = Math.max(pista.scrollLeft - lim, Math.min(pista.scrollLeft + lim, proyectado));
      irA(posiciones[cercana(objetivo)], { v0: v });
    };
    pista.addEventListener("pointerup", soltar);
    pista.addEventListener("pointercancel", soltar);
    // un arrastre no debe contar como clic sobre la tarjeta
    pista.addEventListener("click", (e) => { if (movio) { e.preventDefault(); e.stopPropagation(); movio = false; } }, true);

    new ResizeObserver(medir).observe(c);
    addEventListener("resize", medir);   // el margen cambia aunque la caja no
    document.fonts?.ready.then(medir);
    medir();
  });

  // ── marquee ──
  raiz.querySelectorAll(".marquee").forEach((m) => {
    const cinta = m.querySelector(".marquee-cinta");
    // se duplica para el bucle sin costura (la copia no se lee). Las dos viajan dentro de UNA
    // pista con una sola animación (−50 %): si cada cinta tuviera la suya, la copia arranca
    // unos cuadros después y queda desfasada (se montaban los nombres)
    const copia = cinta.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    const pista = document.createElement("div");
    pista.className = "marquee-pista";
    cinta.before(pista);
    pista.append(cinta, copia);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const quieta = () => m.classList.toggle("quieta", mq.matches);
    mq.addEventListener?.("change", quieta);
    quieta();
  });

  // ── vuelo con scroll: el cóndor sigue la curva de la estela ──
  raiz.querySelectorAll(".vuelo").forEach((v) => {
    const escena = v.querySelector(".vuelo-escena"), cielo = v.querySelector(".vuelo-cielo");
    const condor = v.querySelector(".vuelo-condor"), curva = v.querySelector(".vuelo-estela path");
    const pasos = [...v.querySelectorAll(".vuelo-paso")];
    const largo = curva.getTotalLength();
    // la estela se dibuja con dasharray 1 / dashoffset (1 − p): necesita largo normalizado
    curva.setAttribute("pathLength", "1");
    let raf = 0, visible = true;
    const pintar = () => {
      raf = 0;
      const r = v.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      escena.style.setProperty("--p", p.toFixed(4));
      // la curva vive en un viewBox de 1000 × 300 estirado a la caja del cielo
      const w = cielo.clientWidth, h = cielo.clientHeight;
      const q = Math.min(0.999, p);
      const a = curva.getPointAtLength(q * largo), b = curva.getPointAtLength(Math.min(largo, q * largo + 6));
      const x = (a.x / 1000) * w, y = (a.y / 300) * h;
      const ang = Math.atan2(((b.y - a.y) / 300) * h, ((b.x - a.x) / 1000) * w) * (180 / Math.PI);
      const cw = condor.offsetWidth, ch = condor.offsetHeight;
      condor.style.transform = `translate(${(x - cw / 2).toFixed(1)}px, ${(y - ch / 2).toFixed(1)}px) rotate(${(ang * 0.5).toFixed(1)}deg) scale(${(0.8 + p * 0.3).toFixed(3)})`;
      pasos.forEach((x, i, l) => x.classList.toggle("visto", p >= i / l.length + 0.02));
    };
    // solo trabaja mientras la escena está cerca de la pantalla
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pintar(); }, { rootMargin: "200px 0px" }).observe(v);
    addEventListener("scroll", () => { if (visible && !raf) raf = requestAnimationFrame(pintar); }, { passive: true });
    new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(pintar); }).observe(cielo);
    pintar();
  });
}
