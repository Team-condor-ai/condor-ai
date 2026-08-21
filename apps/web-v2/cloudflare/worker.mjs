/**
 * Cóndor mezcla un sitio público estático con el portal React en /acceso/*.
 *
 * `dist/index.html` es la portada estática y `dist/404.html` es la cáscara de
 * React. Por eso el modo SPA global de Cloudflare no sirve: enviaría la portada
 * a las rutas internas del portal. Este Worker interviene únicamente en
 * /acceso y devuelve la cáscara correcta con estado 200.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/acceso" || url.pathname.startsWith("/acceso/")) {
      // `html_handling: auto-trailing-slash` expone 404.html como /404. Pedir
      // el nombre físico provocaría un 307 y perderíamos el cuerpo al envolverlo.
      url.pathname = "/404";
      const shell = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(shell.headers);
      headers.set("Cache-Control", "no-cache");
      return new Response(shell.body, {
        status: 200,
        statusText: "OK",
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
