/* Guion visual condor.ai · arranque.
   Orden: marca → secciones (arman su DOM) → acrílico → kit → patrones → navegación. */
import { montarLogos } from "./kit/marca.js";
import { montarAcrilicos } from "./kit/acrilico.js";
import { montarControles } from "./kit/controles.js";
import { montarCampos } from "./kit/campos.js";
import { montarPopups } from "./kit/popups.js";
import { montarBanners, toast } from "./kit/avisos.js";
import { montarSteppers } from "./patrones/stepper.js";
import { montarScrollers } from "./patrones/scrollers.js";
import { montarDatos } from "./patrones/datos.js";
import { montarNavegacion } from "./patrones/navegacion.js";
import { montarSecciones } from "./secciones.js";

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

montarLogos();
montarSecciones();
montarAcrilicos();
montarControles();
montarCampos();
montarPopups();
montarBanners();
montarSteppers();
montarScrollers();
montarDatos();
montarNavegacion();

// ── firmas: corren al entrar a la vista; "Otra vez" las relanza ──
const otra = (e) => { e.classList.remove("corre"); void e.getBoundingClientRect(); e.classList.add("corre"); };
document.addEventListener("click", (e) => { const b = e.target.closest("[data-otra]"); if (b) otra(document.getElementById(b.dataset.otra)); });
const alVer = (el, fn, umbral = 0.5) => {
  if (reducido) { el.classList.add("corre"); return; }
  const o = new IntersectionObserver((xs) => xs.forEach((x) => { if (x.isIntersecting) { fn(x.target); o.unobserve(x.target); } }), { threshold: umbral });
  o.observe(el);
};
$$(".escena, .curvas").forEach((e) => alVer(e, otra));
document.getElementById("todas")?.addEventListener("click", () => $$("#firmas-grilla .escena").forEach(otra));
document.getElementById("lento")?.addEventListener("change", (e) => document.body.classList.toggle("lento", e.target.checked));
document.querySelector(".inicio-logo")?.addEventListener("click", (e) => otra(e.currentTarget));

// ── aparecer al entrar (sutil, una vez) ──
if (!reducido) {
  const o = new IntersectionObserver((xs) => xs.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("visto"); o.unobserve(x.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".revelar").forEach((el) => o.observe(el));
} else $$(".revelar").forEach((el) => el.classList.add("visto"));

// ── copiar ──
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copiar]");
  if (!b) return;
  const v = b.dataset.copiar === "tokens" ? document.getElementById("codigo-tokens").textContent : b.dataset.copiar;
  navigator.clipboard?.writeText(v).then(() => toast(`${b.dataset.copiar === "tokens" ? "Tokens" : v} copiado`, { duracion: 2000 }), () => toast("No se pudo copiar", { tono: "error" }));
});

// ── calco del original ──
document.getElementById("btn-calco")?.addEventListener("click", (e) => {
  const on = document.getElementById("calco").classList.toggle("con-original");
  e.currentTarget.setAttribute("aria-pressed", String(on));
  e.currentTarget.querySelector(".tx").textContent = on ? "Ocultar el original" : "Ver el original debajo";
});
