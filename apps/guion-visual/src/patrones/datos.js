/* Datos y lectura.
   - Tabla: ordenar por encabezado (aria-sort), búsqueda con cuenta (sin importar tildes),
     paginación; en celular las filas se vuelven tarjetas (CSS).
   - Acordeón: <details class="acordeon"> con alto animado e interrumpible.
   - Migas de demostración: tramos con menú de hermanas y "…" cuando no caben. */
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
// datos de EJEMPLO (se marcan como tal en la vista). El único precio real es el de
// ecommerce ($54.990, página pública); track y agents se cotizan a medida.
const FILAS = [
  ["Ferretería Los Andes", "ecommerce", "Activo", 54990, "2026-09-28"],
  ["Clínica Mirador", "agents", "Activo", null, "2026-09-30"],
  ["Transportes Sur", "track", "Prueba", null, "2026-10-02"],
  ["Café Altiplano", "ecommerce", "Activo", 54990, "2026-09-12"],
  ["Inmobiliaria Cumbre", "track", "Pausado", null, "2026-08-21"],
  ["Estudio Pacífico", "agents", "Activo", null, "2026-10-05"],
  ["Viña Quebrada", "ecommerce", "Prueba", 0, "2026-10-07"],
  ["Logística Austral", "track", "Activo", null, "2026-09-03"],
  ["Óptica Central", "agents", "Pausado", null, "2026-07-30"],
];
const tono = { Activo: "ok", Prueba: "info", Pausado: "alerta" };
const fecha = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
const mensual = (v) => (v === null ? "A medida" : v ? clp.format(v) : "—");
const plano = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpio = (s) => String(s).replace(/[<>&"]/g, "");
const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const vel = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1;

export function montarDatos(raiz = document) {
  raiz.querySelectorAll(".tabla-demo").forEach((caja) => {
    const tbody = caja.querySelector("tbody"), buscar = caja.querySelector("input[type=search]"), cuenta = caja.querySelector(".tabla-cuenta");
    const pag = caja.querySelector(".paginacion");
    cuenta.setAttribute("aria-live", "polite");
    let orden = { col: 4, dir: -1 }, pagina = 0;
    // en el celular los encabezados se esconden (filas = tarjetas): el orden pasa a un
    // selector nativo, que en iOS/Android abre la rueda del sistema
    const ths = [...caja.querySelectorAll("th[data-col]")];
    const sentido = (th) => (th.textContent.trim() === "Alta" ? ["más antiguas", "más recientes"] : th.classList.contains("num") ? ["menor a mayor", "mayor a menor"] : ["A–Z", "Z–A"]);
    const selector = document.createElement("label");
    selector.className = "tabla-orden";
    selector.innerHTML = `<span class="tabla-orden-tx">Ordenar</span><select aria-label="Ordenar la tabla">${ths.map((th) => {
      const [a, d] = sentido(th), n = th.textContent.trim(), c = th.dataset.col;
      return `<option value="${c}:1">${n} · ${a}</option><option value="${c}:-1">${n} · ${d}</option>`;
    }).join("")}</select><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>`;
    caja.querySelector(".tabla-cab .busqueda")?.after(selector);
    const sel = selector.querySelector("select");
    sel.addEventListener("change", () => { const [c, d] = sel.value.split(":").map(Number); orden = { col: c, dir: d }; pagina = 0; pintar(true); });
    const porPagina = 5;
    // lo que se busca es lo que se ve (fecha y monto formateados), sin tildes
    const texto = FILAS.map((f) => plano([f[0], f[1], `condor ${f[1]}`, f[2], mensual(f[3]), fecha(f[4])].join(" ")));

    const pintar = (animar = false) => {
      const q = plano(buscar.value.trim());
      let filas = FILAS.filter((_, k) => !q || texto[k].includes(q));
      const v = (f) => (f[orden.col] === null ? Infinity : f[orden.col]);
      filas.sort((a, b) => {
        const x = v(a), y = v(b);
        return (typeof x === "string" && typeof y === "string" ? comparar(x, y) : x > y ? 1 : x < y ? -1 : 0) * orden.dir;
      });
      const total = filas.length, paginas = Math.max(1, Math.ceil(total / porPagina));
      pagina = Math.min(pagina, paginas - 1);
      filas = filas.slice(pagina * porPagina, (pagina + 1) * porPagina);
      tbody.innerHTML = filas.map((f, k) => `<tr style="--i:${k}"><td data-c="Cliente"><b>${f[0]}</b></td><td data-c="Producto"><span class="prod-mini"><img src="assets/marca/producto-${f[1]}-chico.svg" alt="">${f[1]}</span></td><td data-c="Estado"><span class="insignia ${tono[f[2]]}">${f[2]}</span></td><td data-c="Mensual" class="num">${mensual(f[3])}</td><td data-c="Alta" class="num">${fecha(f[4])}</td></tr>`).join("") ||
        `<tr class="tabla-vacia"><td colspan="5"><b>Sin resultados</b><span>Ningún cliente coincide con «${limpio(buscar.value.trim())}». Prueba con un producto, como «track».</span><button type="button" class="btn mini" data-limpiar>Limpiar búsqueda</button></td></tr>`;
      tbody.classList.remove("anima");
      if (animar) { void tbody.offsetWidth; tbody.classList.add("anima"); }
      cuenta.textContent = `${total} de ${FILAS.length} clientes`;
      pag.innerHTML = `<button type="button" data-p="${pagina - 1}" ${pagina === 0 ? "disabled" : ""} aria-label="Página anterior"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>` +
        Array.from({ length: paginas }, (_, i) => `<button type="button" data-p="${i}" ${i === pagina ? 'aria-current="page"' : ""} aria-label="Página ${i + 1}">${i + 1}</button>`).join("") +
        `<button type="button" data-p="${pagina + 1}" ${pagina >= paginas - 1 ? "disabled" : ""} aria-label="Página siguiente"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`;
      ths.forEach((th) => th.setAttribute("aria-sort", Number(th.dataset.col) === orden.col ? (orden.dir > 0 ? "ascending" : "descending") : "none"));
      sel.value = `${orden.col}:${orden.dir}`;
    };
    caja.querySelectorAll("th[data-col] button").forEach((b) => b.addEventListener("click", () => {
      const col = Number(b.parentElement.dataset.col);
      orden = { col, dir: orden.col === col ? -orden.dir : 1 };
      pintar(true);
    }));
    buscar.addEventListener("input", () => { pagina = 0; pintar(); });
    pag.addEventListener("click", (e) => {
      const b = e.target.closest("[data-p]");
      if (!b || b.disabled || b.getAttribute("aria-current")) return;
      pagina = Number(b.dataset.p); pintar(true);
      // el foco sigue en la paginación aunque los botones se rehagan
      pag.querySelector(`[data-p="${pagina}"][aria-current]`)?.focus({ preventScroll: true });
    });
    tbody.addEventListener("click", (e) => { if (e.target.closest("[data-limpiar]")) { buscar.value = ""; pagina = 0; pintar(true); buscar.focus(); } });
    pintar();
  });

  // ── acordeón con alto animado: se puede interrumpir a mitad de camino ──
  raiz.querySelectorAll("details.acordeon").forEach((d) => {
    const s = d.querySelector("summary"), cuerpo = d.querySelector(".acordeon-cuerpo");
    let anim = null;
    s.addEventListener("click", (e) => {
      if (reducido()) return; // abre y cierra al instante (nativo)
      e.preventDefault();
      const cerrando = d.classList.contains("cerrando");
      const desde = d.open ? cuerpo.getBoundingClientRect().height : 0;
      const op = d.open ? Number(getComputedStyle(cuerpo).opacity) : 0;
      anim?.cancel(); anim = null;
      if (!d.open || cerrando) {
        d.classList.remove("cerrando");
        d.open = true;
        const h = cuerpo.scrollHeight;
        anim = cuerpo.animate([{ height: `${desde}px`, opacity: op }, { height: `${h}px`, opacity: 1 }], { duration: 460 * vel(), easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
        anim.onfinish = () => (anim = null);
      } else {
        d.classList.add("cerrando");
        anim = cuerpo.animate([{ height: `${desde}px`, opacity: op }, { height: "0px", opacity: 0 }], { duration: 320 * vel(), easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" });
        anim.onfinish = () => { anim = null; d.open = false; d.classList.remove("cerrando"); };
      }
    });
  });

  // ── migas de demostración que se recogen ──
  raiz.querySelectorAll(".migas-demo").forEach((m) => {
    // se mide SIEMPRE con la ruta completa y sin encoger (si no, al recogerse "cabe" y se
    // vuelve a abrir, o el tramo actual se corta con … en vez de recogerse)
    // dos niveles: primero se recogen los tramos del medio en "…"; si aún no cabe, también
    // el padre directo, para que el tramo actual (lo importante) se lea completo
    const noCabe = () => m.scrollWidth > m.clientWidth + 1;
    const ajustar = () => {
      m.classList.remove("recogidas", "recogidas-mas");
      m.classList.add("midiendo");
      if (noCabe()) { m.classList.add("recogidas"); if (noCabe()) m.classList.add("recogidas-mas"); }
      m.classList.remove("midiendo");
    };
    new ResizeObserver(ajustar).observe(m);
    document.fonts?.ready.then(ajustar);
  });
}
