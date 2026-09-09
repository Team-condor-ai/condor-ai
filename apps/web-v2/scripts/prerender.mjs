/**
 * Public home, SPA fallback and redirects for retired campaigns.
 * The Colombia campaign was retired at the owner's request.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(raiz, "dist");

// Keep old advertising links useful without serving the retired offer,
// form, tracking pixels or campaign code.
mkdirSync(join(dist, "colombia"), { recursive: true });
writeFileSync(join(dist, "colombia", "index.html"), `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cóndor AI</title><meta name="robots" content="noindex,follow">
<link rel="canonical" href="https://condorai.cl/">
<meta http-equiv="refresh" content="0;url=/">
<script>window.location.replace("/" + window.location.search);</script>
</head><body><p>Esta campaña ha finalizado. <a href="/">Ir a Cóndor AI</a>.</p></body></html>`, "utf8");
console.log("prerender: /colombia/index.html → inicio (campaña retirada)");

/* ═══════════════════════════════════════════════════════════════════════
   La home pasa a ser el sitio corporativo estático (11-ago-2026)

   `dist/index.html` que produce Vite es la cáscara del SPA. Acá se
   reemplaza por la página generada en `scripts/gen-sitio.mjs`.

   EL ORDEN IMPORTA, y es la parte fácil de romper: `404.html` tiene que
   quedar con la cáscara del SPA, NO con la home estática. GitHub Pages
   sirve 404.html a toda ruta que no exista como archivo, y el router de
   React depende de eso para poder montar en cualquier ruta futura. Si
   404.html fuera la página estática, el router nunca montaría.
   Por eso se escribe 404.html ANTES de pisar index.html, y el workflow ya
   no lo copia después (ver deploy-web.yml). */
const cascaraSPA = readFileSync(join(dist, "index.html"), "utf8");
writeFileSync(join(dist, "404.html"), cascaraSPA, "utf8");
console.log("prerender: /404.html  ← cáscara del SPA (fallback de rutas del router)");

const homeEstatica = readFileSync(join(dist, "rediseno", "inicio.html"), "utf8");
writeFileSync(join(dist, "index.html"), homeEstatica, "utf8");
console.log(`prerender: /index.html ← sitio corporativo (${homeEstatica.length} bytes)`);
