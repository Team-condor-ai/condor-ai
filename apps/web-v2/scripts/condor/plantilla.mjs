/* Plantilla compartida: cabecera, barra, pie, cierre y piezas repetidas. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SITIO, CORREO, WSP, WSP_VISIBLE, NAV, PAISES, MARCAS, FAQ, REDES, wsp } from "./datos.mjs";

const publico = (f) => new URL("../../public/" + f, import.meta.url);
const ver = (f) => createHash("sha1").update(readFileSync(publico(f))).digest("hex").slice(0, 8);
export const VER = { tokens: ver("condor/tokens.css"), estilo: ver("condor/estilo.css"), app: ver("condor/app.js") };

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const flecha = '<span aria-hidden="true">→</span>';

const barra = (ruta) => {
  const activo = (h) => (h === ruta || (h.length > 1 && !h.includes("#") && ruta.startsWith(h))) ? ' aria-current="page"' : "";
  return `<header class="nav-fijo">
  <div class="nav acrilico denso">
    <a class="marca" href="/" aria-label="Cóndor AI, inicio"><img src="/condor/marca/condor-logo-horizontal.svg" alt="condor.ai" width="112" height="24"></a>
    <nav class="nav-links" aria-label="Principal">${NAV.map((n) => `<a href="${n.href}"${activo(n.href)}>${n.texto}</a>`).join("")}</nav>
    <div class="nav-der">
      <a class="acceso" href="/acceso">Clientes</a>
      <a class="btn chico" href="/agendar/">Agendar reunión</a>
      <button class="burger" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="cajon"><span></span></button>
    </div>
  </div>
</header>
<nav class="cajon" id="cajon" aria-label="Menú">
  ${NAV.map((n) => `<a href="${n.href}">${n.texto}</a>`).join("")}
  <a href="/acceso">Acceso clientes</a>
  <a class="btn" href="/agendar/">Agendar una reunión</a>
</nav>`;
};

export const pie = () => `<footer class="pie">
  <div class="wrap">
    <div class="pie-grid">
      <div class="pie-marca">
        <img src="/condor/marca/condor-logo-horizontal.svg" alt="condor.ai" width="124" height="26">
        <p>Web, tienda online y el sistema que da seguimiento a cada cliente. Desde Santiago, para Latinoamérica.</p>
      </div>
      <div><h4>Servicios</h4><ul>
        <li><a href="/productos/crm/">Cóndor CRM</a></li>
        <li><a href="/productos/ecommerce/">Cóndor Ecommerce</a></li>
        <li><a href="/productos/sites/">Cóndor Sites</a></li></ul></div>
      <div><h4>Empresa</h4><ul>
        <li><a href="/equipo/">Equipo</a></li>
        <li><a href="/#trabajos">Trabajos</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/contacto/">Contacto</a></li>
        <li><a href="/acceso">Acceso clientes</a></li></ul></div>
      <div><h4>Escríbenos</h4><ul>
        <li><a href="mailto:${CORREO}">${CORREO}</a></li>
        <li><a href="https://wa.me/${WSP}" target="_blank" rel="noopener">${WSP_VISIBLE}</a></li>
        <li><a href="/agendar/">Agendar una reunión</a></li></ul></div>
    </div>
    <div class="pie-base">
      <span>© 2026 Cóndor AI · Santiago, Chile</span>
      <span style="display:flex;flex-wrap:wrap;gap:6px 22px"><a href="/legal/privacidad/" style="color:inherit">Privacidad</a><a href="/legal/terminos/" style="color:inherit">Términos y condiciones</a><a href="/legal/cancelacion/" style="color:inherit">Política de cancelación</a></span>
      <span class="redes">${REDES.map(([n, u, p]) => `<a href="${u}" aria-label="${n}" title="${n}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">${p}</svg></a>`).join("")}</span>
    </div>
  </div>
</footer>
<a class="wsp" href="${wsp("Hola, quiero conversar sobre mi negocio con Cóndor.")}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12.04 2A9.9 9.9 0 0 0 3.6 17l-1.5 5 5.1-1.4A9.9 9.9 0 1 0 12.04 2Zm5.8 14c-.25.7-1.45 1.35-2 1.4-.5.05-1.15.2-3.7-.8-3.1-1.2-5.1-4.4-5.25-4.6-.15-.2-1.25-1.65-1.25-3.15s.8-2.25 1.1-2.55c.25-.3.6-.35.8-.35h.55c.2 0 .4 0 .6.45.25.55.8 1.95.85 2.1.1.15.1.3 0 .5l-.3.45c-.15.15-.3.35-.15.65.15.25.65 1.1 1.4 1.75 1 .85 1.8 1.15 2.1 1.3.25.15.45.1.6-.1.2-.25.7-.8.9-1.1.2-.3.4-.25.65-.15l2 .95c.25.15.45.2.5.3.1.15.1.7-.15 1.4Z"/></svg></a>`;

/** Documento completo. `cuerpo` va entre la barra y el pie. */
export function pagina({ titulo, desc, ruta, cuerpo, og = "/condor/og.jpg", noindex = false, jsonld = "", scripts = "" }) {
  const url = SITIO + ruta;
  return `<!DOCTYPE html>
<html lang="es" class="sin-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ""}<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CL">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITIO}${og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/condor/marca/condor-isotipo.svg">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/condor/fuentes/InterDisplay-SemiBold.ttf" as="font" type="font/ttf" crossorigin>
<link rel="preload" href="/condor/fuentes/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/condor/tokens.css?v=${VER.tokens}">
<link rel="stylesheet" href="/condor/estilo.css?v=${VER.estilo}">
<script>document.documentElement.classList.remove("sin-js")</script>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>\n` : ""}</head>
<body>
<a class="salto" href="#contenido">Saltar al contenido</a>
${barra(ruta)}
<main id="contenido">
${cuerpo}
</main>
${pie()}
<script src="/condor/app.js?v=${VER.app}" defer></script>
${scripts}
</body>
</html>
`;
}

/* ── Piezas repetidas ───────────────────────────────────────────────── */
export const selectorPais = (etiqueta = "Precios para") => `<div class="selector-fila"><span class="rotulo">${etiqueta}</span><div class="paises" role="radiogroup" aria-label="País de los precios">${PAISES.map((p, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-pais="${p.id}" data-nombre="${p.nombre}">${p.nombre}<small>${p.moneda}</small></button>`).join("")}</div></div>`;

const chipMarca = (m) => {
  if (!m.logo) return `<span class="marca-chip texto"><b>${esc(m.n)}</b></span>`;
  return `<span class="marca-chip${m.cuadrado ? " cuadrado" : ""}" title="${esc(m.n)}"><img src="${m.logo}" alt="${m.texto ? "" : esc(m.n)}" loading="lazy">${m.texto ? `<b>${esc(m.n)}</b>` : ""}</span>`;
};
export const franjaMarcas = () => `<section class="marcas" aria-label="Marcas que trabajan con nosotros">
  <p class="rotulo">Marcas que ya trabajan con nosotros</p>
  <div class="pista-mask"><div class="pista">
    <div class="pista-grupo">${MARCAS.map(chipMarca).join("")}</div>
    <div class="pista-grupo" aria-hidden="true">${MARCAS.map(chipMarca).join("")}</div>
  </div></div>
</section>`;

export const faqHtml = (ids) => {
  const lista = ids ? ids.map((i) => FAQ.find((f) => f.id === i)).filter(Boolean) : FAQ;
  return `<div class="faq-lista">${lista.map((f) => `<details><summary>${f.q}</summary>${f.a.map((p) => `<p>${p}</p>`).join("")}</details>`).join("")}</div>`;
};
export const faqJsonLd = (ids) => JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: (ids ? ids.map((i) => FAQ.find((f) => f.id === i)) : FAQ).filter(Boolean).map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a.join(" ").replace(/<[^>]+>/g, "") },
  })),
});

export const cierre = ({ titulo = "Hablemos de tu negocio.", texto = "Treinta minutos para entender qué te está costando clientes. Sin compromiso.", mensaje = "Hola, quiero conversar sobre mi negocio con Cóndor." } = {}) => `<section class="seccion" style="padding-top:0"><div class="wrap"><div class="cierre revelar">
  <h2>${titulo}</h2>
  <p>${texto}</p>
  <div class="cierre-acc"><a class="btn blanco" href="/agendar/">Agendar una reunión</a><a class="enlace" href="${wsp(mensaje)}" target="_blank" rel="noopener">Prefiero WhatsApp <span aria-hidden="true">→</span></a></div>
</div></div></section>`;

export const cabSeccion = ({ rotulo, titulo, bajada = "", centro = false }) => `<div class="cab-seccion revelar${centro ? " centro" : ""}">${rotulo ? `<p class="rotulo">${rotulo}</p>` : ""}<h2 class="titulo">${titulo}</h2>${bajada ? `<p class="bajada">${bajada}</p>` : ""}</div>`;

export const personaHtml = (p) => `<article class="persona revelar"><div class="foto">${p.foto ? `<img src="${p.foto}" alt="${esc(p.nombre)}" loading="lazy">` : esc(p.iniciales)}</div><div><h3>${p.nombre}</h3><span class="rol">${p.rol}</span><p>${p.texto}</p></div></article>`;

/** Página de redirección para URLs retiradas (se conserva el enlace, no la oferta). */
export const redireccion = (destino) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cóndor AI</title><meta name="robots" content="noindex,follow">
<link rel="canonical" href="${SITIO}${destino}"><meta http-equiv="refresh" content="0;url=${destino}">
<script>location.replace(${JSON.stringify(destino)} + location.search + location.hash)</script>
</head><body><p>Esta página se movió. <a href="${destino}">Ir a la nueva</a>.</p></body></html>
`;
