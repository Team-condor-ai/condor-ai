/* condor.ai · Tracking de campaña (Meta Pixel + Conversions API con deduplicación)
 *
 * Uso en la landing (antes de </head>):
 *   <script>window.CONDOR_PIXEL_ID = "TU_PIXEL_ID";</script>
 *   <script src="/assets/js/condor-tracking.js" defer></script>
 *
 * Qué hace:
 *   - Carga el Pixel y dispara PageView.
 *   - condorTrack(evento, datos) manda el evento por el Pixel Y por el servidor (CAPI)
 *     con el MISMO event_id → Meta lo cuenta una sola vez, pero llega aunque el
 *     navegador bloquee el Pixel.
 *   - condorAtribucion() devuelve UTMs + cookies de Meta para adjuntarlas al POST /leads.
 *
 * Eventos de la campaña:
 *   ViewContent  → abrió un formulario
 *   Schedule     → agendó reunión
 *   Lead         → pidió que lo contacten
 */
(function () {
  "use strict";

  var CAPI = window.CONDOR_CAPI_URL || "https://ogmvdthxwcmvqjlxhpsr.supabase.co/functions/v1/capi";
  var PIXEL = window.CONDOR_PIXEL_ID || "";
  var UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var CLAVE = "condor_atribucion";

  function uuid() {
    try { return crypto.randomUUID(); } catch (e) {
      return "ev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }
  }
  function cookie(nombre) {
    var m = document.cookie.match("(^|;)\\s*" + nombre + "\\s*=\\s*([^;]+)");
    return m ? m.pop() : "";
  }

  /* Atribución: se captura en la PRIMERA visita y se conserva toda la sesión,
     porque el formulario suele enviarse desde otra vista del SPA (ya sin ?utm_ en la URL). */
  function capturarAtribucion() {
    var guardada = {};
    try { guardada = JSON.parse(sessionStorage.getItem(CLAVE) || "{}"); } catch (e) { /* sesión sin storage */ }

    var params = new URLSearchParams(location.search);
    var datos = Object.assign({}, guardada);
    UTMS.forEach(function (k) { if (params.get(k)) datos[k] = params.get(k).slice(0, 200); });
    if (params.get("fbclid")) datos.fbclid = params.get("fbclid").slice(0, 300);

    datos.fbp = cookie("_fbp") || datos.fbp || "";
    // Si el Pixel aún no escribió _fbc, se arma con el fbclid de la URL (formato de Meta).
    datos.fbc = cookie("_fbc") || datos.fbc || (datos.fbclid ? "fb.1." + Date.now() + "." + datos.fbclid : "");

    try { sessionStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* modo privado */ }
    return datos;
  }

  function cargarPixel() {
    if (!PIXEL || window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", PIXEL);
  }

  /* Dispara el mismo evento por los dos caminos. `datos` acepta:
     { email, telefono, nombre, valor, moneda, extra: {...} } */
  function condorTrack(evento, datos) {
    datos = datos || {};
    var eventId = uuid();
    var atrib = capturarAtribucion();

    // 1) Navegador
    try {
      if (window.fbq) {
        var custom = Object.assign({}, datos.extra || {});
        if (datos.valor != null) custom.value = datos.valor;
        if (datos.moneda) custom.currency = datos.moneda;
        window.fbq("track", evento, custom, { eventID: eventId });
      }
    } catch (e) { /* el pixel nunca debe romper la página */ }

    // 2) Servidor (mismo event_id → Meta deduplica)
    var cuerpo = {
      evento: evento, event_id: eventId, url: location.href,
      email: datos.email || "", telefono: datos.telefono || "", nombre: datos.nombre || "",
      pais: datos.pais || "", fbp: atrib.fbp || "", fbc: atrib.fbc || "",
      valor: datos.valor, moneda: datos.moneda, extra: datos.extra || {},
    };
    try {
      // keepalive: el evento sobrevive aunque el submit navegue a otra página
      fetch(CAPI, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo), keepalive: true, mode: "cors",
      }).catch(function () { /* si CAPI falla, el Pixel ya lo reportó */ });
    } catch (e) { /* nada */ }

    return eventId;
  }

  // API pública
  window.condorTrack = condorTrack;
  window.condorAtribucion = capturarAtribucion;

  capturarAtribucion();
  cargarPixel();
  condorTrack("PageView", {});
})();
