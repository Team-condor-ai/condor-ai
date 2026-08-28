// condor.ai — JS compartido (nav, menú móvil, animaciones, form)
document.addEventListener("DOMContentLoaded", () => {
  const y = document.getElementById("anio"); if (y) y.textContent = new Date().getFullYear();

  const nav = document.getElementById("nav");
  if (nav) { const f = () => nav.classList.toggle("solid", scrollY > 20); f(); addEventListener("scroll", f, { passive: true }); }

  const hamb = document.getElementById("hamb"), drawer = document.getElementById("drawer"), ov = document.getElementById("ov");
  if (hamb && drawer && ov) {
    const tg = v => { drawer.classList.toggle("open", v); ov.classList.toggle("on", v); hamb.classList.toggle("x", v); document.body.style.overflow = v ? "hidden" : ""; };
    hamb.onclick = () => tg(!drawer.classList.contains("open"));
    ov.onclick = () => tg(false);
    drawer.querySelectorAll("a").forEach(a => a.onclick = () => tg(false));
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = document.querySelectorAll(".rev");
  if (reduce || !("IntersectionObserver" in window)) { els.forEach(x => x.classList.add("vis")); }
  else {
    const o = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add("vis"); o.unobserve(x.target); } }), { threshold: .14, rootMargin: "0px 0px -50px 0px" });
    els.forEach(x => o.observe(x));
  }

  if (!matchMedia("(hover: none)").matches && !reduce) {
    const orbs = document.querySelectorAll(".orb[data-par]");
    addEventListener("mousemove", ev => {
      const x = ev.clientX / innerWidth - .5, yy = ev.clientY / innerHeight - .5;
      orbs.forEach(o => { const f = parseFloat(o.dataset.par) * 100; o.style.transform = (o.classList.contains("orb-1") ? "translateX(-50%) " : "") + `translate(${x * f}px,${yy * f}px)`; });
    }, { passive: true });
  }

  // Tarjetas de equipo: en pantallas táctiles se despliegan al tocar
  if (matchMedia("(hover: none)").matches) {
    document.querySelectorAll("[data-member]").forEach(card => {
      card.addEventListener("click", ev => {
        if (ev.target.closest("a")) return; // no bloquear el botón "Ver perfil"
        card.classList.toggle("open");
      });
    });
  }

  // Forzar autoplay de todos los videos (íconos, fondos) — móvil a veces no lo dispara solo
  document.querySelectorAll("video[autoplay]").forEach(v => {
    v.muted = true; v.setAttribute("muted", ""); v.playsInline = true; v.setAttribute("playsinline", "");
    const go = () => v.play().catch(() => {});
    go();
    v.addEventListener("loadeddata", go);
    v.addEventListener("canplay", go);
  });
  // Reintenta al primer toque/scroll (por si el navegador bloqueó el autoplay inicial)
  const kick = () => { document.querySelectorAll("video[autoplay]").forEach(v => v.play().catch(() => {})); };
  document.addEventListener("touchstart", kick, { once: true, passive: true });
  document.addEventListener("scroll", kick, { once: true, passive: true });


  // Formulario de contacto -> abre WhatsApp con los datos
  const cf = document.getElementById("cform");
  if (cf) cf.addEventListener("submit", ev => {
    ev.preventDefault();
    const d = new FormData(cf);
    const msg = `Hola condor.ai 👋%0A%0ANombre: ${d.get("nombre") || ""}%0ANegocio: ${d.get("negocio") || ""}%0AServicio de interés: ${d.get("servicio") || ""}%0AMensaje: ${d.get("mensaje") || ""}`;
    window.open(`https://wa.me/56988989824?text=${msg}`, "_blank");
  });
});
