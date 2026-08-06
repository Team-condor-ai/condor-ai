/**
 * Prerender de rutas para GitHub Pages.  Se corre DESPUÉS de `vite build`.
 *
 * Resuelve dos problemas distintos que tenía /colombia:
 *
 * 1. HTTP 404.  GitHub Pages sólo sirve archivos que existen; una SPA vive en
 *    /index.html y el resto de las rutas caen al 404.html.  Funcionaba a la
 *    vista (el 404.html es una copia del index y React monta igual), pero el
 *    servidor respondía **404 Not Found** en el destino de una campaña pagada.
 *    Eso puede hacer que el revisor de Meta rechace el anuncio y garantiza que
 *    Google nunca indexe la página.  Escribir /colombia/index.html hace que la
 *    ruta exista de verdad y responda 200.
 *
 * 2. Meta tags invisibles.  Los scrapers de Meta y WhatsApp **no ejecutan
 *    JavaScript**: leen el HTML tal como llega.  Las etiquetas que la página
 *    pone desde React (useMeta) no las ven nunca, así que la tarjeta al
 *    compartir salía con el título genérico del sitio y sin imagen.  Acá se
 *    inyectan en el HTML servido.
 *
 * Mantener sincronizado con las constantes META_* de src/pages/Colombia.tsx.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(raiz, "dist");

const RUTAS = [
  {
    ruta: "colombia",
    url: "https://condorai.cl/colombia/",
    titulo: "Página web profesional desde $390.000 COP | Cóndor.ai Colombia",
    desc:
      "Diseño propio, no plantilla: se ve bien en el celular, aparece en Google y lleva el botón de WhatsApp. Desde $390.000 COP. Déjanos tu WhatsApp y te contactamos hoy, sin costo.",
    imagen: "https://condorai.cl/assets/og-colombia.jpg",
    locale: "es_CO",
  },
];

const escapar = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const base = readFileSync(join(dist, "index.html"), "utf8");

for (const r of RUTAS) {
  const metas = [
    `<title>${escapar(r.titulo)}</title>`,
    `<meta name="description" content="${escapar(r.desc)}" />`,
    `<link rel="canonical" href="${r.url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${r.url}" />`,
    `<meta property="og:title" content="${escapar(r.titulo)}" />`,
    `<meta property="og:description" content="${escapar(r.desc)}" />`,
    `<meta property="og:image" content="${r.imagen}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${r.locale}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapar(r.titulo)}" />`,
    `<meta name="twitter:description" content="${escapar(r.desc)}" />`,
    `<meta name="twitter:image" content="${r.imagen}" />`,
  ].join("\n    ");

  // Se quitan el <title> y la description del index global para no dejar dos.
  let html = base
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
    .replace("</head>", `  ${metas}\n  </head>`);

  /* Fuera las webfonts que esta ruta NO usa.
   *
   * El index.html es uno solo para todo el SPA y carga Clash Display y General
   * Sans, que usan la home y Planes. /colombia usa la tipografía del sistema
   * (San Francisco en Apple, Inter como puente en el resto) y solo necesita la
   * serif del titular, que se pide desde el componente.
   *
   * Son dos hojas de estilo a dominios externos que BLOQUEAN el render, más
   * sus archivos de fuente. En una página de campaña, donde cada décima de
   * segundo antes del primer pintado cuesta visitantes, no se pagan solas. */
  html = html.replace(
    /<link[^>]+api\.fontshare\.com[^>]*>\s*/gi,
    "",
  );

  const carpeta = join(dist, r.ruta);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, "index.html"), html, "utf8");
  console.log(`prerender: /${r.ruta}/index.html  (${html.length} bytes)`);
}
