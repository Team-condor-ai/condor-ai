/* Stepper: un formulario en pasos.
   <div class="stepper" data-stepper>
     <ol class="stepper-cabeza"><li>Empresa</li>…</ol>
     <div class="stepper-cuerpo"><section class="paso">…</section>…</div>
     <div class="stepper-pie"><button data-atras>…<button data-siguiente>…</div>
   Cada paso valida sus campos antes de avanzar; la transición respeta la dirección y el
   alto del cuerpo se anima (sin saltos); la línea va de círculo a círculo; los pasos hechos
   se pueden reabrir desde la cabeza; el último envía con el cóndor. */
import { validar } from "../kit/campos.js";
import { cargaCondor } from "../kit/marca.js";
import { toast } from "../kit/avisos.js";

const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const vel = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--vel")) || 1;
const limpio = (s) => String(s).replace(/[<>&"]/g, "");
// nombres legibles para el resumen (el name del campo es la clave)
const ETIQUETAS = { Horario: "Día y hora", RUT: "RUT" };

export function montarSteppers(raiz = document) {
  raiz.querySelectorAll("[data-stepper]").forEach((st) => {
    const form = st.querySelector("form");
    const pasos = [...st.querySelectorAll(".paso")];
    const marcas = [...st.querySelectorAll(".stepper-cabeza li")];
    const atras = st.querySelector("[data-atras]"), sig = st.querySelector("[data-siguiente]");
    const lineaCaja = st.querySelector(".stepper-linea"), linea = lineaCaja?.querySelector("i");
    const fin = st.querySelector(".stepper-fin"), reiniciar = st.querySelector("[data-reiniciar]");
    let i = 0, hecho = 0, envio = 0, altoAnim = null;

    // la línea nace en el centro del primer círculo y termina en el del último
    const centros = () => marcas.map((m) => { const r = m.querySelector(".num").getBoundingClientRect(); return r.left + r.width / 2; });
    const medirLinea = () => {
      if (!lineaCaja) return;
      const c = centros(), base = st.getBoundingClientRect().left + st.clientLeft;
      const num = marcas[0].querySelector(".num").getBoundingClientRect();
      lineaCaja.style.left = `${c[0] - base}px`;
      lineaCaja.style.right = "auto";
      lineaCaja.style.width = `${c[c.length - 1] - c[0]}px`;
      lineaCaja.style.top = `${num.top + num.height / 2 - st.getBoundingClientRect().top - st.clientTop - 1}px`;
      const total = c[c.length - 1] - c[0];
      linea.style.transform = `scaleX(${total > 0 ? (c[i] - c[0]) / total : 0})`;
    };

    // el cuerpo cambia de alto con suavidad en vez de saltar
    const conAlto = (cambio) => {
      const antes = form.getBoundingClientRect().height;
      cambio();
      if (reducido()) return;
      const despues = form.getBoundingClientRect().height;
      altoAnim?.cancel();
      if (Math.abs(antes - despues) < 2) return;
      form.classList.add("cambiando");
      altoAnim = form.animate([{ height: `${antes}px` }, { height: `${despues}px` }], { duration: 520 * vel(), easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      altoAnim.onfinish = altoAnim.oncancel = () => form.classList.remove("cambiando");
    };

    const pintar = (dir = 0) => {
      pasos.forEach((p, k) => {
        p.hidden = k !== i;
        p.inert = k !== i;
        p.classList.remove("entra-adelante", "entra-atras");
        if (k === i && dir) { void p.offsetWidth; p.classList.add(dir > 0 ? "entra-adelante" : "entra-atras"); }
      });
      marcas.forEach((m, k) => {
        m.classList.toggle("actual", k === i);
        m.classList.toggle("hecho", k !== i && k < Math.max(i, hecho));
        const b = m.querySelector("button");
        if (b) {
          b.disabled = k > hecho;
          if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        }
      });
      medirLinea();
      atras.disabled = i === 0;
      const ultimo = i === pasos.length - 1;
      sig.querySelector(".tx").textContent = ultimo ? "Agendar reunión" : "Continuar";
      sig.classList.toggle("final", ultimo);
      if (pasos[i].dataset.resumen !== undefined) resumir(pasos[i]);
      const nombre = marcas[i]?.querySelector(".nombre")?.textContent.trim() || "";
      st.querySelector(".stepper-estado").textContent = `Paso ${i + 1} de ${pasos.length}: ${nombre}`;
    };

    // el resumen lee el formulario y deja cambiar cada dato en su paso
    const resumir = (p) => {
      const filas = [];
      for (const [k, v] of new FormData(form)) {
        if (!v || typeof v !== "string") continue;
        const donde = pasos.findIndex((x) => x.querySelector(`[name="${CSS.escape(k)}"]`));
        filas.push(`<div><dt>${limpio(ETIQUETAS[k] || k)}</dt><dd>${limpio(v)}</dd>${donde >= 0 ? `<button type="button" class="resumen-cambiar" data-ir="${donde}" aria-label="Cambiar ${limpio(ETIQUETAS[k] || k).toLowerCase()}">Cambiar</button>` : ""}</div>`);
      }
      st.querySelectorAll(".fichas-opcion").forEach((g) => {
        const sel = [...g.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent.trim());
        if (sel.length) filas.push(`<div><dt>${limpio(g.dataset.nombre)}</dt><dd>${limpio(sel.join(", "))}</dd></div>`);
      });
      p.querySelector("dl").innerHTML = filas.join("") || "<div><dt>—</dt><dd>Sin datos todavía</dd></div>";
    };

    const pasoValido = () => {
      let ok = true;
      pasos[i].querySelectorAll(".campo").forEach((c) => { c.dataset.tocado = "1"; if (!validar(c)) ok = false; });
      // grupos de opción obligatorios
      pasos[i].querySelectorAll("[data-requerido-grupo]").forEach((g) => {
        const marcado = g.querySelector("input:checked, [aria-pressed='true']");
        g.classList.toggle("con-error", !marcado);
        g.setAttribute("aria-invalid", String(!marcado));
        if (!marcado) { ok = false; g.classList.remove("sacude"); void g.offsetWidth; g.classList.add("sacude"); }
      });
      if (!ok) {
        const malo = pasos[i].querySelector(".campo.con-error input, .campo.con-error textarea, .con-error input");
        malo?.focus({ preventScroll: true });
        st.querySelector(".stepper-estado").textContent = "Falta completar este paso.";
      }
      return ok;
    };

    const ir = (j) => {
      const dir = Math.sign(j - i);
      conAlto(() => { i = j; pintar(dir); });
      // con mouse el foco va al primer campo; en el celular no abrimos el teclado solo:
      // el foco va al título del paso (lo anuncia el lector de pantalla)
      const campo = matchMedia("(pointer: fine)").matches && pasos[i].querySelector("input:not([type=radio]), textarea");
      const h = pasos[i].querySelector("h3");
      if (campo) campo.focus({ preventScroll: true });
      else if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    };

    const avanzar = () => {
      if (st.classList.contains("enviando")) return;
      if (!pasoValido()) return;
      if (i < pasos.length - 1) { hecho = Math.max(hecho, i + 1); ir(i + 1); return; }
      // envío: demostración, no sale nada del navegador
      st.classList.add("enviando");
      fin.hidden = false;
      const c = cargaCondor(fin.querySelector(".fin-carga"), { texto: "Agendando…" }).estado("espera");
      let p = 0;
      const t0 = setTimeout(() => {
        envio = setInterval(() => {
          p += 0.08; c.progreso(p);
          if (p >= 1) {
            clearInterval(envio); envio = 0;
            c.listo("Reunión agendada");
            st.classList.add("enviado");
            reiniciar?.focus({ preventScroll: true });
            toast("Te enviamos la invitación al correo (demostración)", { tono: "ok" });
          }
        }, 90);
      }, 700);
      envio = t0;
    };

    sig.addEventListener("click", avanzar);
    atras.addEventListener("click", () => i > 0 && ir(i - 1));
    // Enter en un campo avanza, como en un formulario normal
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.target.matches("input:not([type=radio]):not([type=checkbox])")) { e.preventDefault(); avanzar(); }
    });
    // al elegir una opción, su error se va
    form.addEventListener("change", (e) => {
      const g = e.target.closest("[data-requerido-grupo]");
      if (g && g.querySelector("input:checked")) { g.classList.remove("con-error", "sacude"); g.setAttribute("aria-invalid", "false"); }
    });
    // saltar desde la cabeza: hacia atrás siempre; hacia adelante solo si este paso está bien
    marcas.forEach((m, k) => m.querySelector("button")?.addEventListener("click", () => {
      if (k === i || k > hecho) return;
      if (k > i && !pasoValido()) return;
      ir(k);
    }));
    st.addEventListener("click", (e) => { const b = e.target.closest("[data-ir]"); if (b) ir(Number(b.dataset.ir)); });

    reiniciar?.addEventListener("click", () => {
      clearTimeout(envio); clearInterval(envio); envio = 0;
      form.reset();
      st.querySelectorAll(".campo").forEach((c) => {
        c.classList.remove("con-error", "valido", "sacude"); delete c.dataset.tocado;
        const inp = c.querySelector("input, textarea"); inp?.removeAttribute("aria-invalid");
        const ay = c.querySelector(".campo-ayuda"); if (ay?.dataset.base) ay.textContent = ay.dataset.base;
      });
      st.querySelectorAll("[data-requerido-grupo]").forEach((g) => { g.classList.remove("con-error", "sacude"); g.removeAttribute("aria-invalid"); });
      st.querySelectorAll(".campo-sugerencia").forEach((s) => (s.hidden = true));
      st.querySelectorAll("[aria-pressed='true']").forEach((b) => b.setAttribute("aria-pressed", "false"));
      st.classList.remove("enviando", "enviado");
      fin.hidden = true;
      hecho = 0;
      conAlto(() => { i = 0; pintar(-1); });
      pasos[0].querySelector("input")?.focus({ preventScroll: true });
    });

    new ResizeObserver(medirLinea).observe(st);
    document.fonts?.ready.then(medirLinea);
    pintar();
  });
}
