/**
 * Genera el sitio público de condorai.cl 2.0 (23-oct-2026).
 *
 * Reemplaza a scripts/gen-sitio.mjs (el sitio de Joaquín: 4 líneas, Bárbara, Track, Media).
 * Los servicios ahora son tres: Cóndor CRM, Cóndor Ecommerce y Cóndor Sites.
 *
 *   node scripts/gen-condor.mjs      (lo corre `npm run build` antes de vite)
 *
 * Contenido y datos: scripts/condor/*.mjs · estilo y scripts del navegador: public/condor/
 * La portada se escribe en public/rediseno/inicio.html porque `prerender.mjs` y `src/main.tsx`
 * ya apuntan a esa ruta.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITIO } from "./condor/datos.mjs";
import { redireccion } from "./condor/plantilla.mjs";
import { inicio, producto, equipo, contacto, agendar } from "./condor/paginas.mjs";
import { ARTICULOS, blogIndice, blogArticulo } from "./condor/blog.mjs";
import { cancelacion, privacidad, terminos } from "./condor/legal.mjs";

const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const escribir = (ruta, contenido) => {
  const destino = join(PUB, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido, "utf8");
};

/* ── Páginas vigentes ── */
const paginas = [
  ["rediseno/inicio.html", inicio()],
  ["productos/sites/index.html", producto("sites")],
  ["productos/ecommerce/index.html", producto("ecommerce")],
  ["productos/crm/index.html", producto("crm")],
  ["equipo/index.html", equipo()],
  ["contacto/index.html", contacto()],
  ["agendar/index.html", agendar()],
  ["legal/privacidad/index.html", privacidad()],
  ["legal/terminos/index.html", terminos()],
  ["legal/cancelacion/index.html", cancelacion()],
  ["blog/index.html", blogIndice()],
  ...ARTICULOS.map((a) => [`blog/${a.slug}/index.html`, blogArticulo(a)]),
];
paginas.forEach(([ruta, html]) => escribir(ruta, html));

/* ── Páginas retiradas: se conserva el enlace, no la oferta ── */
const retiradas = {
  "productos/index.html": "/#soluciones",
  "productos/media/index.html": "/",
  "productos/track/index.html": "/productos/crm/",
  "productos/agentes/index.html": "/",
  "productos/barbara/index.html": "/",
  "productos/barbara/plantillas-gratis/index.html": "/",
  "blog/videos-ia/index.html": "/blog/",
  "equipo/joaquin.html": "/equipo/",
  "equipo/alejandro.html": "/equipo/",
  "equipo/maximiliano.html": "/equipo/",
};
Object.entries(retiradas).forEach(([ruta, destino]) => escribir(ruta, redireccion(destino)));

/* ── SEO ── */
const urls = ["/", "/productos/crm/", "/productos/ecommerce/", "/productos/sites/", "/equipo/", "/blog/", "/contacto/", "/agendar/",
  ...ARTICULOS.map((a) => `/blog/${a.slug}/`), "/legal/privacidad/", "/legal/terminos/", "/legal/cancelacion/"];
escribir("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITIO}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
escribir("robots.txt", `User-agent: *\nAllow: /\nDisallow: /acceso\n\nSitemap: ${SITIO}/sitemap.xml\n`);

console.log(`gen-condor: ${paginas.length} páginas, ${Object.keys(retiradas).length} redirecciones, sitemap y robots.`);
