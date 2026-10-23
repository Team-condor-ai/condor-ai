/* condorai.cl 2.0 · menú, aparición al scroll, brillo del acrílico y precios por país */
(() => {
  const d = document;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (_e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (_e) { return null; } };

  // ── menú del celular ──
  const burger = d.querySelector(".burger");
  const cajon = d.getElementById("cajon");
  if (burger && cajon) {
    const poner = (abierto) => {
      cajon.classList.toggle("abierto", abierto);
      burger.setAttribute("aria-expanded", String(abierto));
      d.body.style.overflow = abierto ? "hidden" : "";
    };
    burger.addEventListener("click", () => poner(!cajon.classList.contains("abierto")));
    cajon.addEventListener("click", (e) => { if (e.target.closest("a")) poner(false); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") poner(false); });
  }

  // ── aparecer al entrar ──
  const reveladas = [...d.querySelectorAll(".revelar")];
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveladas.forEach((el) => io.observe(el));
  } else reveladas.forEach((el) => el.classList.add("visto"));

  // ── brillo del acrílico: sigue al puntero ──
  let raf = 0, ult = null;
  d.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".acrilico");
    if (!el) return;
    ult = { x: e.clientX, y: e.clientY, el };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = ult.el.getBoundingClientRect();
      ult.el.style.setProperty("--bx", (((ult.x - r.left) / r.width) * 100).toFixed(1) + "%");
      ult.el.style.setProperty("--by", (((ult.y - r.top) / r.height) * 100).toFixed(1) + "%");
    });
  }, { passive: true });

  // ── precios por país ──
  const PAISES = ["cl", "pe", "co", "mx", "ar"];
  const ZONA_PAIS = {
    "America/Santiago": "cl", "America/Punta_Arenas": "cl", "Pacific/Easter": "cl",
    "America/Lima": "pe", "America/Bogota": "co",
    "America/Mexico_City": "mx", "America/Cancun": "mx", "America/Merida": "mx", "America/Monterrey": "mx",
    "America/Chihuahua": "mx", "America/Hermosillo": "mx", "America/Mazatlan": "mx", "America/Tijuana": "mx",
    "America/Buenos_Aires": "ar",
  };
  function detectar() {
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (ZONA_PAIS[z]) return ZONA_PAIS[z];
      if (z.indexOf("America/Argentina/") === 0) return "ar";
    } catch (_e) { /* sigue */ }
    const m = String(navigator.language || "").toLowerCase().match(/-(cl|pe|co|mx|ar)$/);
    return m ? m[1] : "cl";
  }
  function aplicar(pais) {
    d.querySelectorAll("[data-p]").forEach((el) => { el.hidden = el.getAttribute("data-p") !== pais; });
    d.querySelectorAll(".paises button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.pais === pais)));
    d.querySelectorAll("[data-pais-nombre]").forEach((el) => {
      const b = d.querySelector('.paises button[data-pais="' + pais + '"]');
      if (b) el.textContent = b.dataset.nombre;
    });
  }
  const guardado = leer("cn-pais");
  const inicial = PAISES.includes(guardado) ? guardado : detectar();
  aplicar(inicial);
  d.querySelectorAll(".paises").forEach((grupo) => {
    grupo.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-pais]");
      if (!b) return;
      guardar("cn-pais", b.dataset.pais);
      aplicar(b.dataset.pais);
    });
    grupo.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
      const bs = [...grupo.querySelectorAll("button")];
      const i = bs.findIndex((x) => x.getAttribute("aria-checked") === "true");
      const sig = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
      e.preventDefault(); sig.focus(); sig.click();
    });
  });
})();
