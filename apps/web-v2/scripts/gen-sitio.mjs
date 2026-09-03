/**
 * Genera el sitio corporativo de condor.ai: inicio, hub de productos, las 4
 * líneas reales (Sites/Ecommerce/Media/Track), contacto y agendar.
 *
 * Reorganizado el 3-sept-2026 (pedido de Joaquín): las secciones Compañía,
 * Equipo, Proceso y Clientes se retiraron del sitio por completo — no solo
 * del menú — junto con las páginas por persona y los "casos de uso" con
 * fotos de banco de imágenes que tenían las categorías genéricas viejas.
 *
 * POR QUÉ UN GENERADOR Y NO UN ARCHIVO POR PÁGINA
 * ---------------------------------------------------------------------------
 * Todas las páginas comparten barra, pie, cierre y estilos. Con una copia por
 * archivo, a la tercera edición dejan de ser el mismo sitio: alguien cambia el
 * teléfono en el pie de una y no en las otras. Acá el contenido son
 * datos y la estructura es una sola plantilla.
 *
 *   node scripts/gen-sitio.mjs        (lo corre `npm run build` antes de vite)
 *
 * El CSS NO se duplica: vive en /rediseno/estilo.css y todas lo enlazan.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(raiz, "public");

/* Versión del CSS, calculada de su contenido.
   Sin esto, /rediseno/estilo.css es una URL fija que GitHub Pages sirve con
   Cache-Control: max-age=600. Resultado: se publica un cambio de estilo y
   durante diez minutos el navegador sigue mostrando el anterior — y si ya
   tenía la página abierta, más todavía. Con el hash en la consulta, cada
   cambio del archivo cambia la URL y el navegador lo pide de nuevo al
   instante. */
const VER = createHash("sha1")
  .update(readFileSync(join(PUB, "rediseno", "estilo.css")))
  .digest("hex")
  .slice(0, 8);

const WSP = "56988989824";                     // WhatsApp Business de las campañas
const WSP_VISIBLE = "+56 9 8898 9824";
const CORREO = "contacto@teamcondorcl.com";


/* Iconos de línea, en el propio archivo. Trazo de 1.5 y esquinas redondas:
   a este tamaño, un icono relleno se convierte en una mancha y compite con
   el titular en vez de acompañarlo. `currentColor` para que hereden el
   color del bloque y funcionen igual sobre claro y sobre navy. */
const ICO = {
  codigo: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  agente: '<path d="M12 3a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-4 4 4 4 0 0 1-4-4v-1H7a3 3 0 0 1 0-6h1V7a4 4 0 0 1 4-4Z"/><path d="M9.5 10.5h.01M14.5 10.5h.01"/>',
  brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  martillo: '<path d="M14 4 20 10 17 13 11 7 14 4Z"/><path d="m11 7-8 8v4h4l8-8"/>',
  entrega: '<path d="M20 7 9 18l-5-5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  correo: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  whatsapp: '<path d="M3.5 20.5 5 16a8 8 0 1 1 3 3l-4.5 1.5Z"/>',
  carrito: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"/>',
  panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  megafono: '<path d="M3 10v4a1 1 0 0 0 1 1h2l2 6h2l-1.5-6H11l7 4V5l-7 4H8a2 2 0 0 0-2 2Z"/><path d="M18 9a3 3 0 0 1 0 6"/>',
};
const icono = (n, clase = "ico") =>
  `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;

/* Banderas dibujadas a mano, no emoji: Windows no trae las glifas de
   bandera regional y el tab de país terminaba mostrando "CL"/"PE"/"CO"
   en vez de la bandera (hallazgo real, 3-sept-2026). Un SVG de 3 franjas
   se ve igual en cualquier sistema operativo. */
const BANDERA = {
  cl: '<svg viewBox="0 0 3 2" width="20" height="14" aria-hidden="true"><rect width="3" height="2" fill="#fff"/><rect y="1" width="3" height="1" fill="#D52B1E"/><rect width="1" height="1" fill="#0039A6"/><polygon points="0.5,0.16 0.583,0.382 0.82,0.382 0.628,0.518 0.702,0.74 0.5,0.604 0.298,0.74 0.372,0.518 0.18,0.382 0.417,0.382" fill="#fff"/></svg>',
  pe: '<svg viewBox="0 0 3 2" width="20" height="14" aria-hidden="true"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#D91023"/><rect x="2" width="1" height="2" fill="#D91023"/></svg>',
  co: '<svg viewBox="0 0 3 2" width="20" height="14" aria-hidden="true"><rect width="3" height="2" fill="#FCD116"/><rect y="1" width="3" height="0.5" fill="#003893"/><rect y="1.5" width="3" height="0.5" fill="#CE1126"/></svg>',
};

/* Hero personalizada por línea de producto: mismo patrón para Sites,
   Ecommerce, Media y Track, cada una con el degradado de su isotipo real
   y el logo grande — para que cada línea se sienta con identidad propia
   sin salir de la plantilla compartida (`cab()`/`pie` siguen iguales). */
const heroLinea = ({ logo, nombre, gradiente, bajada }) => `
<section class="hero-linea" style="background:${gradiente}"><div class="wrap">
  <a class="volver" href="/productos/">Volver a productos</a>
  <img src="${logo}" alt="" class="hero-linea-logo" />
  <h1>${nombre}</h1>
  <p class="bajada">${bajada}</p>
</div></section>`;

/* Hero del HOME: mensaje e imagen rotan juntos, uno por línea (mismo
   índice en los dos arreglos que arma cada `mostrar(i)` de JS_COMUN).
   Antes solo rotaba el texto — la imagen quedaba fija siempre en la foto
   de oficina, sin relación con lo que decía el titular en ese momento.
   (La tarjeta de 3 cifras bajo la imagen que hubo brevemente se retiró
   a pedido de Joaquín — recuadro de más.)

   `imagen` apunta a `/assets/hero/hero-<linea>.webp`, encargadas a Codex
   el 3-sept-2026 (brief en `Descargas/Cóndor - Imágenes Hero (para
   Codex)/INSTRUCCIONES.md`) y entregadas el mismo día. La de Sites es un
   mockup regenerado por Codex (marca ficticia "HABITAT"), no la captura
   real incrustada como pedía el brief — por eso su `alt` dice
   "construido con", no "real entregado". Las otras 3 (Ecommerce, Media,
   Track) sí son genéricas/ficticias a propósito, como se pidió.

   Cóndor Media NO incluye carruseles (eso es específico de Bárbara, un
   producto aparte dentro de Cóndor Agents) — corregido el 3-sept tras
   aviso explícito de Joaquín. */
const HERO_SLIDES = [
  {
    titulo: "Un sitio web propio, siempre actualizado",
    bajada: "Cóndor Sites: creación sin costo inicial, soporte 24/7 y mejoras continuas cada mes.",
    imagen: "/assets/hero/hero-sites.webp",
    alt: "Sitio web construido con Cóndor Sites",
  },
  {
    titulo: "Tiendas en línea que venden de verdad",
    bajada: "Cóndor Ecommerce: construcción, pasarela de pago y gestión de campañas, administradas por nosotros.",
    imagen: "/assets/hero/hero-ecommerce.webp",
    alt: "Tienda en línea de Cóndor Ecommerce",
  },
  {
    titulo: "Contenido para redes, cada semana",
    bajada: "Cóndor Media: fotos, historias y video con la identidad de su marca, producidos con apoyo de inteligencia artificial.",
    imagen: "/assets/hero/hero-media.webp",
    alt: "Contenido de redes producido por Cóndor Media",
  },
  {
    titulo: "Software a medida para su operación",
    bajada: "Cóndor Track: ERPs, paneles e integraciones para procesos que ya existen en su empresa.",
    imagen: "/assets/hero/hero-track.webp",
    alt: "Panel de operación de Cóndor Track",
  },
];

/* Las 4 líneas reales de producto (reorganización 3-sept-2026, pedido de
   Joaquín). Mismos logos y mismo orden que usa el desplegable de React en
   `src/components/Nav.tsx` — son dos sistemas de render distintos (este
   archivo genera HTML plano, React genera el home), pero el contenido de
   marca tiene que verse idéntico en los dos. */
const LINEAS = [
  { clave: "sites", href: "/productos/sites/", nombre: "Cóndor Sites", logo: "/assets/productos/condor-sites.png", ico: "codigo",
    resumen: "Sitio web propio, con soporte y actualizaciones incluidas cada mes y sin costo de creación inicial.",
    desde: "Desde $20.990/mes" },
  { clave: "ecommerce", href: "/productos/ecommerce/", nombre: "Cóndor Ecommerce", logo: "/assets/productos/condor-ecommerce.png", ico: "carrito",
    resumen: "Tienda en línea administrada de punta a punta: construcción, pasarela de pago, stock y, si corresponde, gestión de campañas.",
    desde: "Desde $69.990/mes + comisión por venta" },
  { clave: "media", href: "/productos/media/", nombre: "Cóndor Media", logo: "/assets/productos/condor-media.png", ico: "megafono",
    // Sin modelo comercial público todavía (línea nueva, 2-sept-2026) —
    // a diferencia de Sites/Ecommerce, "desde" acá es intencionalmente
    // genérico. Ver aviso a Joaquín al cerrar esta tarea.
    resumen: "Contenido para redes sociales de su marca, producido cada semana con apoyo de inteligencia artificial.",
    desde: "Cotización según objetivos" },
  { clave: "track", href: "/productos/track/", nombre: "Cóndor Track", logo: "/assets/productos/condor-track.png", ico: "panel",
    resumen: "Software y paneles de operación a medida: ERPs, integraciones y automatizaciones para procesos que ya existen.",
    desde: "Cotización a medida" },
];

/* NAV ya no es una lista plana: "Productos" es un desplegable con las 4
   líneas de arriba. `drop` marca esa entrada; el resto son enlaces
   normales. "Agentes IA" apunta al hub de Cóndor Agents
   (`/productos/agentes/`), NO directo a Bárbara — esa landing pasa a ser
   una subpágina del hub, porque a futuro habrá más agentes además de
   ella (hoy mostrados como "próximamente"). Equipo vuelve a la barra,
   junto a Productos (pedido explícito de Joaquín el 3-sept). */
const NAV = [
  { url: "/", nombre: "Inicio" },
  { drop: "Productos", hijos: LINEAS },
  { url: "/equipo/", nombre: "Equipo" },
  { url: "/productos/agentes/", nombre: "Agentes IA" },
  { url: "/contacto/", nombre: "Contacto" },
];

const navDesktop = (rutaActual) => NAV.map((e) => {
  if (e.drop) {
    const activo = LINEAS.some((h) => h.href === rutaActual);
    return `    <div class="nav-drop">
      <button class="nav-drop-boton" type="button" aria-haspopup="true" aria-expanded="false"${activo ? ' aria-current="page"' : ""}>
        ${e.drop}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="nav-drop-panel" role="menu">
${e.hijos.map((h) => `        <a href="${h.href}" class="nav-drop-item" role="menuitem"${rutaActual === h.href ? ' aria-current="page"' : ""}><img src="${h.logo}" alt="" width="22" height="22" />${h.nombre}</a>`).join("\n")}
      </div>
    </div>`;
  }
  return `    <a href="${e.url}"${rutaActual === e.url ? ' aria-current="page"' : ""}>${e.nombre}</a>`;
}).join("\n");

const navCajon = (rutaActual) => NAV.map((e) => {
  if (e.drop) {
    return `  <span class="cajon-grupo">${e.drop}</span>\n` +
      e.hijos.map((h) => `  <a href="${h.href}" class="cajon-sub"${rutaActual === h.href ? ' aria-current="page"' : ""}><img src="${h.logo}" alt="" width="18" height="18" />${h.nombre}</a>`).join("\n");
  }
  return `  <a href="${e.url}"${rutaActual === e.url ? ' aria-current="page"' : ""}>${e.nombre}</a>`;
}).join("\n");

const cab = (t) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t.titulo}</title>
<meta name="description" content="${t.desc}" />
<meta name="theme-color" content="#ffffff" />
<meta property="og:title" content="${t.titulo}" />
<meta property="og:description" content="${t.desc}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="es_CL" />
<link rel="canonical" href="https://condorai.cl${t.ruta}" />
<link rel="icon" type="image/png" href="/assets/favicon.png" />
<link rel="preconnect" href="https://api.fontshare.com" />
<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin />
<link href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&f[]=satoshi@400,500,700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/rediseno/estilo.css?v=${VER}" />
</head>
<body>
<header class="topbar"><div class="wrap">
  <button class="burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="cajon">
    <span></span><span></span><span></span>
  </button>
  <a class="marca-link" href="/"><img class="logo" src="/assets/logo.png" alt="condor.ai" /></a>
  <nav class="menu">
${navDesktop(t.ruta)}
  </nav>
  <a class="portal-acceso" href="/acceso">Portal clientes</a>
  <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
</div></header>

<div class="cortina" hidden></div>
<nav class="cajon" id="cajon" aria-label="Menú" hidden>
  <div class="cajon-cab">
    <img class="logo" src="/assets/logo.png" alt="condor.ai" />
    <button class="cerrar" aria-label="Cerrar menú">&times;</button>
  </div>
${navCajon(t.ruta)}
  <a href="/acceso">Portal de clientes</a>
  <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
</nav>
`;

const cierre = (titulo = "Conversemos sobre su proyecto") => `
<section class="seccion"><div class="wrap cierre">
  <h2 style="margin-top:20px">${titulo}</h2>
  <p>Agende una reunión de treinta minutos. Al terminar tendrá un diagnóstico del problema y una propuesta de alcance, sin compromiso.</p>
  <div class="btns">
    <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
    <a class="btn btn-linea" href="/contacto/">Otras vías de contacto</a>
  </div>
</div></section>
`;

const pie = `
<footer class="pie"><div class="wrap">
  <div class="pie-cols">
    <div>
      <img class="logo" src="/assets/logo.png" alt="condor.ai" />
      <p style="color:var(--on-navy-2);font-size:14.5px;margin-top:16px;max-width:34ch">
        Sitios web, tiendas en línea, contenido para redes y software a medida para empresas.</p>
    </div>
    <div><h4>Productos</h4>
      ${LINEAS.map((l) => `<a href="${l.href}">${l.nombre}</a>`).join("")}<a href="/productos/barbara/">Agentes IA</a></div>
    <div><h4>Contacto</h4>
      <a href="/agendar">Agendar una reunión</a>
      <a href="mailto:${CORREO}">${CORREO}</a>
      <a href="https://wa.me/${WSP}" target="_blank" rel="noopener">WhatsApp ${WSP_VISIBLE}</a>
      <a href="/acceso">Portal de clientes</a></div>
  </div>
  <div class="legal"><span>© 2026 condor.ai · Santiago, Chile</span><span>Todos los derechos reservados</span></div>
</div></footer>
</body>
</html>
`;

const JS_COMUN = `
<script>
(() => {
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Acordeón de productos: muelle críticamente amortiguado, e interrumpible.
  // Arranca siempre desde la altura que hay EN PANTALLA, así se puede hacer
  // clic a mitad de la apertura y sigue desde ahí sin saltar.
  const RESPUESTA = 0.32;
  document.querySelectorAll(".prod").forEach((det) => {
    const cuerpo = det.querySelector(".cuerpo"), resumen = det.querySelector("summary");
    let raf = 0, alto = 0, vel = 0, meta = det.open ? -1 : 0;
    if (!det.open) cuerpo.style.height = "0px";
    function correr() {
      if (quieto) { cuerpo.style.height = meta < 0 ? "auto" : "0px"; if (meta >= 0) det.open = false; return; }
      cancelAnimationFrame(raf);
      let previo = performance.now();
      const paso = (ahora) => {
        const dt = Math.min((ahora - previo) / 1000, 0.05); previo = ahora;
        const destino = meta < 0 ? cuerpo.scrollHeight : 0;
        const w = 2 * Math.PI / RESPUESTA, k = w * w, c = 2 * w;
        vel += (-k * (alto - destino) - c * vel) * dt;
        alto += vel * dt;
        if (Math.abs(alto - destino) < 0.5 && Math.abs(vel) < 2) {
          cuerpo.style.height = meta < 0 ? "auto" : "0px";
          if (meta >= 0) det.open = false;
          return;
        }
        cuerpo.style.height = Math.max(0, alto) + "px";
        raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    }
    resumen.addEventListener("click", (ev) => {
      ev.preventDefault();
      alto = cuerpo.getBoundingClientRect().height;
      cuerpo.style.height = alto + "px";
      if (det.open) meta = 0; else { det.open = true; meta = -1; }
      correr();
    });
  });

  // Entrada al entrar en pantalla, ESCALONADA dentro de cada bloque.
  // El retardo se calcula por posición dentro del grupo, no por posición en
  // la página: si fuera global, el último bloque esperaría varios segundos.
  // Tope de 3 pasos — más allá se percibe como lentitud, no como ritmo.
  const grupos = document.querySelectorAll(".lista, .oficina-dos, .pasos, .testis, .citas, .vias, .equipo-grid, .cifras, .pie-cols");
  const sueltos = document.querySelectorAll(".dos-col > *, .cierre");
  const marcar = (el, i) => {
    el.classList.add("rv");
    el.style.transitionDelay = Math.min(i, 3) * 80 + "ms";
  };
  if (quieto) {
    document.querySelectorAll(".rv").forEach(p => p.classList.add("vis"));
  } else {
    grupos.forEach(g => [...g.children].forEach(marcar));
    sueltos.forEach(el => marcar(el, 0));
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("vis"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px", threshold: .08 });
    document.querySelectorAll(".rv").forEach(p => io.observe(p));
  }

  // Las cifras cuentan hacia arriba al aparecer. Con movimiento reducido se
  // muestran ya en su valor final: el número es el dato, la animación no.
  const cifras = document.querySelectorAll("[data-contar]");
  if (cifras.length && !quieto) {
    const ioc = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const el = e.target, fin = +el.dataset.contar;
        const pre = el.dataset.pre || "", post = el.dataset.post || "";
        const t0 = performance.now(), dur = 900;
        const paso = (ahora) => {
          const t = Math.min((ahora - t0) / dur, 1);
          const suave = 1 - Math.pow(1 - t, 3);          // desacelera al final
          el.textContent = pre + Math.round(fin * suave) + post;
          if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
        ioc.unobserve(el);
      }
    }, { threshold: .6 });
    cifras.forEach(c => ioc.observe(c));
  }

  // Cajón lateral (solo teléfono).
  // El atributo hidden se quita al abrir y se vuelve a poner al terminar de cerrar: si
  // quedara siempre en el DOM visible, sus enlaces seguirían siendo
  // enfocables con el tabulador por detrás de la página.
  const burger = document.querySelector(".burger");
  const cajon = document.getElementById("cajon");
  const cortina = document.querySelector(".cortina");
  if (burger && cajon && cortina) {
    let abierto = false;
    const abrir = () => {
      abierto = true;
      cajon.hidden = false; cortina.hidden = false;
      requestAnimationFrame(() => document.body.classList.add("cajon-abierto"));
      burger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";   // que no scrollee lo de atrás
      cajon.querySelector("a").focus();
    };
    const cerrar = () => {
      if (!abierto) return;
      abierto = false;
      document.body.classList.remove("cajon-abierto");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      const fin = () => { if (!abierto) { cajon.hidden = true; cortina.hidden = true; } };
      quieto ? fin() : setTimeout(fin, 280);
      burger.focus();
    };
    burger.addEventListener("click", () => (abierto ? cerrar() : abrir()));
    cortina.addEventListener("click", cerrar);
    cajon.querySelector(".cerrar").addEventListener("click", cerrar);
    cajon.querySelectorAll("a").forEach((a) => a.addEventListener("click", cerrar));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
  }

  // ── Carrusel ────────────────────────────────────────────────────────
  // Dos comportamientos según el ancho:
  //
  // ESCRITORIO — coverflow: cada tarjeta se coloca por su distancia a la
  //   activa (data-pos) y el CSS la aleja en Z, la inclina y la atenúa.
  //
  // TELÉFONO — pista deslizante: TODAS las tarjetas viven en una fila y lo
  //   que se mueve es la fila entera. Esto es lo que arregla el salto: antes
  //   la activa era position:relative y las demás absolute, y "position" no
  //   se puede animar — el navegador cambiaba de golpe. Moviendo la pista,
  //   la transición es una sola propiedad y sí se anima.
  //   Además permite arrastrar con el dedo, como una historia de Instagram:
  //   la tarjeta sigue al dedo y al soltar decide por distancia Y velocidad.
  const MOVIL = () => matchMedia("(max-width: 700px)").matches;

  document.querySelectorAll(".sitios").forEach((car) => {
    const pista = car.querySelector(".sitios-pista");
    const tarjetas = [...car.querySelectorAll(".sitio")];
    const puntos = [...car.querySelectorAll(".s-punto")];
    if (!tarjetas.length) return;
    const total = tarjetas.length;
    let act = 0, reloj = 0;

    const pintar = (sinAnimar) => {
      if (MOVIL()) {
        pista.style.transition = sinAnimar ? "none" : "";
        pista.style.transform = "translate3d(" + (-act * 100) + "%,0,0)";
        tarjetas.forEach((t, i) => {
          t.dataset.pos = i === act ? "0" : "fuera";
          t.setAttribute("aria-hidden", String(i !== act));
        });
      } else {
        pista.style.transform = "";
        pista.style.transition = "";
        tarjetas.forEach((t, i) => {
          let d = i - act;
          if (d > total / 2) d -= total;
          if (d < -total / 2) d += total;
          t.dataset.pos = Math.abs(d) > 2 ? "lejos" : String(d);
          t.setAttribute("aria-hidden", String(d !== 0));
        });
      }
      puntos.forEach((p, i) => p.setAttribute("aria-selected", String(i === act)));
    };
    const ir = (n) => { act = (n + total) % total; pintar(); };
    const andar = () => { if (!quieto) { clearInterval(reloj); reloj = setInterval(() => ir(act + 1), 3800); } };
    const frenar = () => clearInterval(reloj);

    puntos.forEach((p, i) => p.addEventListener("click", () => { frenar(); ir(i); andar(); }));
    tarjetas.forEach((t, i) => t.addEventListener("click", () => {
      if (!MOVIL()) { frenar(); ir(i); andar(); }
    }));
    car.addEventListener("pointerenter", frenar);
    car.addEventListener("pointerleave", andar);
    car.addEventListener("focusin", frenar);

    // ── Arrastre con el dedo (solo en la pista deslizante) ──────────────
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, arrastrando = false, decidido = false;
    const ancho = () => car.getBoundingClientRect().width || 1;

    pista.addEventListener("pointerdown", (e) => {
      if (!MOVIL() || e.pointerType === "mouse") return;
      frenar();
      x0 = e.clientX; y0 = e.clientY; t0 = performance.now();
      dx = 0; arrastrando = true; decidido = false;
      pista.style.transition = "none";
    });

    pista.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      const ex = e.clientX - x0, ey = e.clientY - y0;
      // Hasta saber si el gesto es horizontal o vertical NO se toma ninguno:
      // robarle el gesto al scroll vertical es la forma más rápida de que la
      // página se sienta trabada.
      if (!decidido) {
        if (Math.abs(ex) < 8 && Math.abs(ey) < 8) return;
        decidido = true;
        if (Math.abs(ey) > Math.abs(ex)) { arrastrando = false; pista.style.transition = ""; return; }
        pista.setPointerCapture(e.pointerId);
      }
      dx = ex;
      // Resistencia en los extremos: en la primera y la última, el dedo
      // avanza menos que el dedo. Un tope seco se siente como un error.
      if ((act === 0 && dx > 0) || (act === total - 1 && dx < 0)) dx *= 0.35;
      pista.style.transform = "translate3d(calc(" + (-act * 100) + "% + " + dx + "px),0,0)";
    });

    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false;
      pista.style.transition = "";
      const v = dx / Math.max(performance.now() - t0, 1);   // px por ms
      // Cambia de tarjeta si se arrastró más de un tercio del ancho O si el
      // gesto fue rápido. Lo segundo es lo que permite pasar de un flick
      // corto, sin tener que recorrer media pantalla.
      const salta = Math.abs(dx) > ancho() / 3 || Math.abs(v) > 0.45;
      if (salta && dx < 0) ir(Math.min(act + 1, total - 1));
      else if (salta && dx > 0) ir(Math.max(act - 1, 0));
      else pintar();
      dx = 0;
      andar();
    };
    pista.addEventListener("pointerup", soltar);
    pista.addEventListener("pointercancel", soltar);

    // Al girar el teléfono o cambiar de ancho, se recoloca sin animación:
    // animar un cambio de modo se ve como un salto, no como una transición.
    let modo = MOVIL();
    addEventListener("resize", () => {
      const ahora = MOVIL();
      if (ahora !== modo) { modo = ahora; pintar(true); }
      else if (ahora) pintar(true);
    });

    pintar(true);
    andar();
  });

  // Hero rotativo (solo en el inicio). Se detiene al pasar el ratón y al
  // enfocar con teclado: un titular que cambia mientras alguien lo lee es una
  // molestia, no una gracia. La imagen rota con el mismo índice que el
  // texto — mismo orden en el HTML, así que basta con togglear el "on"
  // del k-ésimo elemento de cada lista a la vez.
  const slides = [...document.querySelectorAll("#slides .slide")];
  if (slides.length) {
    const puntos = [...document.querySelectorAll(".punto")];
    const heroImgs = [...document.querySelectorAll(".hero-img")];
    let i = 0, timer = 0;
    const mostrar = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("on", k === i));
      puntos.forEach((p, k) => p.setAttribute("aria-selected", String(k === i)));
      heroImgs.forEach((im, k) => im.classList.toggle("on", k === i));
    };
    const arrancar = () => { if (!quieto) { clearInterval(timer); timer = setInterval(() => mostrar(i + 1), 6500); } };
    const parar = () => clearInterval(timer);
    puntos.forEach((p, k) => p.addEventListener("click", () => { parar(); mostrar(k); arrancar(); }));
    const zona = document.querySelector(".hero");
    zona.addEventListener("pointerenter", parar);
    zona.addEventListener("pointerleave", arrancar);
    zona.addEventListener("focusin", parar);
    arrancar();
  }
})();
</script>
`;


/* Lógica del formulario de agenda. Se conserva tal cual estaba: la única
   diferencia son los colores del mensaje de error, que ahora usan los tokens
   de esta hoja en vez de los de la plantilla anterior. */
const JS_AGENDA = `
<script>
(() => {
  const FN = "https://ogmvdthxwcmvqjlxhpsr.supabase.co/functions/v1/agendar-publico";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbXZkdGh4d2NtdnFqbHhocHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDEwMTksImV4cCI6MjA5NzIxNzAxOX0.wo6zSUlMejjYu1hSweZcWEBBdCvBgVNWg3xtLzFTIrI";
  const sel = document.getElementById("ag_hora");
  if (!sel) return;
  // Tramos de 30 min, de 09:00 a 20:30.
  for (let h = 9; h <= 20; h++) for (const m of [0, 30]) {
    const v = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
  }
  const fIn = document.getElementById("ag_fecha");
  fIn.min = new Date().toISOString().slice(0, 10);
  fIn.max = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const $ = (id) => document.getElementById(id);
  const msg = $("agMsg");
  document.getElementById("agForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "ag-msg"; msg.textContent = "";
    const fecha = fIn.value;
    if (new Date(fecha + "T12:00:00").getDay() === 0) {
      msg.className = "ag-msg mal"; msg.textContent = "Atendemos de lunes a sábado. Elija otro día."; return;
    }
    const body = {
      nombre: $("ag_nombre").value, whatsapp: $("ag_wsp").value, email: $("ag_email").value,
      mensaje: $("ag_msg").value, fecha, hora: $("ag_hora").value, website: $("ag_web").value,
    };
    $("agBtn").disabled = true; msg.textContent = "Agendando…";
    try {
      const r = await fetch(FN, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
        body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) {
        document.getElementById("agForm").outerHTML =
          '<div class="ag-ok"><h3>Reunión agendada</h3>' +
          '<p>Le confirmamos por WhatsApp en breve.</p>' +
          '<a class="btn btn-linea" href="/">Volver al inicio</a></div>';
      } else {
        msg.className = "ag-msg mal"; msg.textContent = j.error || "No se pudo agendar. Intente de nuevo.";
        $("agBtn").disabled = false;
      }
    } catch (_e) {
      msg.className = "ag-msg mal"; msg.textContent = "Error de conexión. Intente de nuevo.";
      $("agBtn").disabled = false;
    }
  });
})();
</script>
`;


/* Logos reales (3-sept-2026) + los clientes que todavía no tienen uno
   cargado en el repo, que se muestran como texto con el mismo trato
   visual — la tira no distingue entre los dos tipos de tarjeta. */
const CLIENTES = [
  { nombre: "Tecnobox", logo: "/assets/clientes/tecnobox.png" },
  { nombre: "Neisstech", logo: "/assets/clientes/neisstech.png" },
  { nombre: "Delta Force", logo: "/assets/clientes/delta-force.png" },
  { nombre: "Bafles Viva", logo: "/assets/clientes/bafles-viva.png" },
  { nombre: "Ebi Foods", logo: "/assets/clientes/ebi-foods.png" },
];
const chipCliente = (c) => c.logo
  ? `<span class="cliente-chip"><img src="${c.logo}" alt="${c.nombre}" loading="lazy" /></span>`
  : `<span class="cliente-chip cliente-chip-texto">${c.nombre}</span>`;
const carrusel = `
<section class="clientes">
  <div class="titulo">Empresas que han confiado en nosotros</div>
  <div class="pista">
    ${CLIENTES.map(chipCliente).join("")}
    ${CLIENTES.map(chipCliente).join("")}
  </div>
</section>
`;


/* Carrusel de sitios entregados, en coverflow.
   La tarjeta del centro manda y las laterales se alejan en Z, se inclinan y
   se atenúan: la profundidad ordena la lectura sin necesidad de un marco que
   grite cuál es la activa.

   Son capturas de sitios REALES que entregamos y siguen en línea — se
   presentan como trabajo propio porque lo son. (Hasta el 2-sept-2026 este
   generador también mostraba "casos de uso" con fotos de banco de imágenes
   para las líneas de agentes/consultoría; se retiraron junto con esas
   categorías genéricas al reorganizar el menú en Sites/Ecommerce/Media/
   Track — no correspondía inventar un carrusel equivalente para Media o
   Track sin capturas reales que mostrar.) */
/* `url` = el sitio EN VIVO. Cuando está, la tarjeta se vuelve un enlace que
   abre en pestaña nueva; cuando no, queda como tarjeta muerta igual que antes.
   Cada URL de acá se verificó respondiendo 200 el 17-ago-2026 — una tarjeta
   que promete "ver en vivo" y cae en un 404 es peor que no ser clicable. */
const SITIOS = [
  { img: "/assets/sitios/ecommerce.webp",    nombre: "Tienda en línea",      tipo: "Comercio",
    url: "/demos/ecommerce/",
    desc: "Catálogo, carro y pago en línea. Pensada para vender desde el teléfono." },
  { img: "/assets/sitios/inmobiliario.webp", nombre: "Portal inmobiliario",  tipo: "Propiedades",
    url: "/demos/inmobiliario/",
    desc: "Buscador con filtros, fichas de propiedad y contacto directo con el corredor." },
  { img: "/assets/sitios/restaurante.webp",  nombre: "Sitio de restaurante", tipo: "Gastronomía",
    url: "https://joaquinmunozs.github.io/condorweb-demo-restaurante/",
    desc: "Carta, reservas y ubicación. Carga rápido incluso con fotos grandes." },
  { img: "/assets/sitios/servicios.webp",    nombre: "Sitio de servicios",   tipo: "Salud",
    url: "/demos/servicios/",
    desc: "Servicios, equipo y agenda de horas. Diseñado para generar confianza." },
  { img: "/assets/sitios/esencial.webp",     nombre: "Sitio esencial",       tipo: "Empresa",
    desc: "La versión directa: quiénes son, qué hacen y cómo contactarlos." },
];

const carruselSitios = () => {
  const datos = SITIOS;
  return '<div class="sitios" aria-label="Sitios que hemos entregado"><div class="sitios-pista">' +
    datos.map((x, i) => {
      // Con `url` la tarjeta entera es el enlace (no solo el título): en el
      // teléfono, que es donde más se mira esto, apuntarle a un texto chico es
      // justamente lo que hace que nadie lo pinche.
      const abre = x.url
        ? '<a class="sitio sitio-link" data-i="' + i + '" href="' + x.url +
          '" target="_blank" rel="noopener">'
        : '<article class="sitio" data-i="' + i + '">';
      const cierra = x.url ? '</a>' : '</article>';
      const pista = x.url ? '<span class="sitio-ver">Ver en vivo →</span>' : '';
      return abre +
        '<div class="captura"><img src="' + x.img + '" alt="' + x.nombre + '" loading="lazy" />' + pista + '</div>' +
        '<div class="sitio-txt"><span class="sitio-tipo">' + x.tipo + '</span>' +
        '<h4>' + x.nombre + '</h4><p>' + x.desc + '</p></div>' +
      cierra;
    }).join("") +
    '</div><div class="sitios-puntos" role="tablist" aria-label="Elegir">' +
    datos.map((x, i) =>
      '<button class="s-punto" role="tab" aria-selected="' + (i === 0) + '" aria-label="' + x.nombre + '"></button>'
    ).join("") +
    '</div></div>';
};

/* Tarjeta de línea para el home y para el hub /productos/ — misma tarjeta en
   los dos lugares, ABIERTA (sin acordeón): cuatro líneas caben sin esconder
   nada detrás de un clic. El logo real de la marca (no un ícono genérico)
   identifica cada línea — pedido explícito de Joaquín. */
const tarjetaLinea = (l) => `
  <article class="fila">
    <div class="marca-fila"><img class="marca-logo" src="${l.logo}" alt="" loading="lazy" /></div>
    <div>
      <h3>${l.nombre}</h3>
      <p class="desc">${l.resumen}</p>
      <p class="aplica"><b>${l.desde}</b></p>
      <a class="btn btn-linea" href="${l.href}" style="margin-top:12px">Ver ${l.nombre} →</a>
    </div>
  </article>`;
const tarjetasLineas = () => LINEAS.map(tarjetaLinea).join("");

/* Equipo — vuelve a la barra y al home (3-sept-2026, corrección el mismo
   día en que se había retirado). Mismo contenido de fondo que la versión
   anterior; se reescriben solo los pies de las fotos de oficina, que
   tenían un tono demasiado informal ("un martes cualquiera") para el
   resto del sitio. */
const PERSONAS = [
  { slug: "joaquin", nombre: "Joaquín Muñoz", rol: "Fundador", foto: "joaquin.jpg",
    resumen: "Dirige la relación con cada cliente y participa en la definición de todos los proyectos. Responsable de la estrategia técnica y comercial de la compañía.",
    frase: "Si un proceso todavía no conviene automatizar, prefiero decirlo antes de que el cliente invierta.",
    bloques: [
      ["lupa",     "Responsabilidad", "Conduce el levantamiento inicial de cada proyecto y define el alcance junto al cliente. Es la contraparte permanente durante toda la ejecución, no solo en la venta."],
      ["brujula",  "Enfoque",         "Traducir un problema de operación a una solución acotada y medible. Antes de proponer un desarrollo, estima cuánto tiempo o costo libera."],
      ["martillo", "En qué participa","Está en la primera reunión de todos los proyectos y en las revisiones de avance. Toma las decisiones de arquitectura de producto junto al equipo técnico."],
      ["entrega",  "Alcance",         "Estrategia técnica, relación comercial y definición de producto."],
    ],
    contacto: [["calendario", "Agendar con Joaquín", "/agendar"], ["correo", CORREO, "mailto:" + CORREO]] },

  { slug: "alejandro", nombre: "Alejandro Tobar", rol: "Backend e infraestructura", foto: "alejandro.jpg",
    resumen: "A cargo de bases de datos, integraciones y despliegue. Responsable de que los sistemas se mantengan estables a medida que crece el volumen.",
    frase: "Las decisiones de base de datos se toman pensando en el volumen del año siguiente, no en el de la demostración.",
    bloques: [
      ["codigo",   "Responsabilidad", "Diseño del modelo de datos, integraciones con sistemas externos y puesta en producción. Define cómo se migra un esquema sin detener la operación."],
      ["brujula",  "Enfoque",         "Sistemas que aguantan crecimiento sin reescribirse. Prefiere una solución aburrida que lleva años funcionando antes que una novedad sin rodaje."],
      ["martillo", "En qué participa","Toda integración con CRM, ERP o pasarelas de pago, y cada despliegue a producción. Es quien responde cuando algo falla fuera de horario."],
      ["entrega",  "Alcance",         "Backend, bases de datos, integraciones, despliegue e infraestructura."],
    ],
    contacto: [["calendario", "Agendar una reunión", "/agendar"], ["correo", CORREO, "mailto:" + CORREO]] },

  { slug: "maximiliano", nombre: "Maximiliano Pino", rol: "Frontend y producto", foto: "maximiliano.jpg",
    resumen: "Responsable de las interfaces y de la experiencia de uso: que el sistema se entienda sin manual y funcione en cualquier dispositivo.",
    frase: "Una interfaz que necesita capacitación para usarse está mal diseñada.",
    bloques: [
      ["codigo",   "Responsabilidad", "Construcción de las interfaces con las que trabaja el usuario final, y de que el sistema se comporte igual en escritorio y en teléfono."],
      ["brujula",  "Enfoque",         "Que el equipo del cliente entienda el sistema el primer día. La capacitación debería confirmar lo que ya se intuye, no enseñarlo desde cero."],
      ["martillo", "En qué participa","Diseño de interacción, desarrollo de la interfaz y las revisiones de avance donde el cliente ve el sistema real por primera vez."],
      ["entrega",  "Alcance",         "Frontend, diseño de interacción y calidad de la experiencia de uso."],
    ],
    contacto: [["calendario", "Agendar una reunión", "/agendar"], ["correo", CORREO, "mailto:" + CORREO]] },
];

const OFICINA = `
  <div class="oficina-dos">
    <figure>
      <div class="marco"><img src="/assets/oficina/equipo.webp" alt="El equipo de condor.ai" loading="lazy" /></div>
      <figcaption><b>Un solo equipo, una sola mesa</b>Las decisiones de cada proyecto se toman entre quienes lo construyen, sin capas intermedias entre el cliente y el equipo técnico.</figcaption>
    </figure>
    <figure>
      <div class="marco"><img src="/assets/oficina/oficina.webp" alt="Oficina de condor.ai en Santiago" loading="lazy" /></div>
      <figcaption><b>Oficina en Santiago</b>Ahí se realizan las reuniones de levantamiento y las revisiones de avance con cada cliente que prefiere una instancia presencial.</figcaption>
    </figure>
  </div>`;

const tarjetasEquipo = PERSONAS.map((p) => `
    <article class="persona">
      <div class="retrato"><img src="/assets/${p.foto}" alt="${p.nombre}" loading="lazy" /></div>
      <div class="txt"><h3>${p.nombre}</h3><div class="rol">${p.rol}</div>
        <div class="mas"><div>
          <p>${p.resumen}</p>
          <a class="ver" href="/equipo/${p.slug}.html">Ver más</a>
        </div></div></div>
    </article>`).join("");

const escribir = (ruta, html) => {
  const destino = join(PUB, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html, "utf8");
  console.log("  " + ruta);
};

console.log("Generando el sitio:");

/* ── INICIO ─────────────────────────────────────────────────────────── */
/* El inicio muestra cada sección DE VERDAD —las fotos, los productos, las
   personas— pero en versión corta, y cada una con su "Ver más". La idea es
   que alguien que solo mira el inicio ya entienda qué hacemos y con quién
   va a trabajar; la subpágina es para quien quiere el detalle. */
const verMas = (url, texto) =>
  `<a class="btn btn-linea" href="${url}">${texto}</a>`;

escribir("rediseno/inicio.html", cab({
  titulo: "condor.ai — Sitios, tiendas en línea, contenido y software a medida",
  desc: "Cóndor Sites, Cóndor Ecommerce, Cóndor Media y Cóndor Track: cuatro líneas de producto para la presencia digital y la operación de su empresa en Chile y la región.",
  ruta: "/",
}) + `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <div class="slides" id="slides">
${HERO_SLIDES.map((s, i) => `      <article class="slide${i === 0 ? " on" : ""}">
        <h1>${s.titulo}</h1>
        <p class="bajada">${s.bajada}</p>
      </article>`).join("\n")}
    </div>
    <div class="hero-cta">
      <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
      <a class="btn btn-linea" href="/productos/">Ver productos</a>
    </div>
    <div class="puntos" role="tablist" aria-label="Cambiar mensaje">
${HERO_SLIDES.map((s, i) => `      <button class="punto" role="tab" aria-selected="${i === 0}" aria-label="Mensaje ${i + 1} de ${HERO_SLIDES.length}"></button>`).join("\n")}
    </div>
  </div>
  <div>
    <div class="hero-marco">
${HERO_SLIDES.map((s, i) => `      <img class="hero-img${i === 0 ? " on" : ""}" src="${s.imagen}" alt="${s.alt}" />`).join("\n")}
    </div>
  </div>
</div></section>

${carrusel}

<!-- EQUIPO (resumen) -->
<section class="seccion oscura"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Las personas responsables de su proyecto</h2></div>
    ${verMas("/equipo/", "Ver el equipo completo")}
  </div>
${OFICINA}
  <div class="lista">
${PERSONAS.map((p) => `    <article class="fila-persona">
      <div class="retrato-s"><img src="/assets/${p.foto}" alt="${p.nombre}" loading="lazy" /></div>
      <div><h3>${p.nombre}</h3><div class="rol">${p.rol}</div>
        <p>${p.resumen}</p>
        <a class="ver" href="/equipo/${p.slug}.html">Ver más</a></div>
    </article>`).join("\n")}
  </div>
</div></section>

<!-- PRODUCTOS (resumen) -->
<section class="seccion"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Cuatro líneas de producto, cada una con equipo dedicado</h2></div>
    ${verMas("/productos/", "Ver todos los productos")}
  </div>
  <div class="lista">
${tarjetasLineas()}
  </div>
</div></section>

<!-- CONTACTO (resumen) -->
<section class="seccion"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Tres formas de llegar a nosotros</h2></div>
    ${verMas("/contacto/", "Ver todas las vías")}
  </div>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("calendario")}<span class="n">01</span></div>
      <div><h3>Reunión</h3><p class="desc">Treinta minutos, por videollamada o presencial en nuestra oficina en Santiago. Es la forma más rápida de saber si podemos ayudar.</p>
      <a class="btn btn-primario" href="/agendar" style="margin-top:16px">Agendar una reunión</a></div></article>
    <article class="fila"><div class="marca-fila">${icono("correo")}<span class="n">02</span></div>
      <div><h3>Correo</h3><p class="desc">Para propuestas formales, bases de licitación o consultas que requieran adjuntos. Respondemos el mismo día hábil.</p>
      <a class="valor" href="mailto:${CORREO}">${CORREO}</a></div></article>
    <article class="fila"><div class="marca-fila">${icono("whatsapp")}<span class="n">03</span></div>
      <div><h3>WhatsApp</h3><p class="desc">Para consultas breves. Es el mismo número de atención comercial que usamos en nuestras campañas.</p>
      <a class="valor" href="https://wa.me/${WSP}" target="_blank" rel="noopener">${WSP_VISIBLE}</a></div></article>
  </div>
</div></section>
` + cierre() + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── PRODUCTOS (hub) ────────────────────────────────────────────────── */
escribir("productos/index.html", cab({
  titulo: "Productos — condor.ai",
  desc: "Cóndor Sites, Cóndor Ecommerce, Cóndor Media y Cóndor Track: cuatro líneas de producto, cada una con equipo y proceso propio.",
  ruta: "/productos/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Cuatro líneas de producto, cada una con equipo dedicado</h1>
  <p class="bajada">No trabajamos por horas ni revendemos licencias. Cada línea tiene un responsable técnico y un alcance escrito antes de comenzar.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
<div class="lista">${tarjetasLineas()}</div>
${carruselSitios()}
</div></section>

<!-- Bárbara (Agentes IA) va aparte de las 4 líneas: es un producto
     empaquetado —precio de lista, se instala igual para todos—, con
     identidad propia (negro y lima) porque es una marca aparte, no una
     quinta línea de servicio a medida. -->
<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <a href="/productos/barbara/" class="barbara-tira">
    <div class="barbara-tira-txt">
      <span class="mono-label">Agentes IA · suscripción mensual</span>
      <h2>Bárbara</h2>
      <p>Tu agente de IA que crea el contenido de Instagram de tu marca cada semana:
         carruseles, historias y video, con tu paleta y tu logo.
         Desde <s>$36.990</s> $18.495/mes — 50% de descuento hasta el 20 de octubre.</p>
      <span class="barbara-tira-cta">Conocer Bárbara →</span>
    </div>
    <img src="/assets/barbara/lockup.jpg" alt="Bárbara, agente de IA de contenido" loading="lazy" />
  </a>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="margin-top:20px;max-width:20ch">La entrega incluye más que el sistema funcionando</h2>
  <div class="pasos" style="margin-top:34px;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.1)">
    <div class="paso" style="background:var(--navy-3)"><div class="n">ENTREGA 01</div><h3>Propiedad completa</h3>
      <p>Dominio, código fuente y accesos quedan a nombre de su empresa. Sin dependencia de nosotros para seguir operando.</p></div>
    <div class="paso" style="background:var(--navy-3)"><div class="n">ENTREGA 02</div><h3>Documentación</h3>
      <p>Cómo está construido, cómo se despliega y qué hacer cuando algo falla. Escrito para alguien que no participó del proyecto.</p></div>
    <div class="paso" style="background:var(--navy-3)"><div class="n">ENTREGA 03</div><h3>Capacitación y soporte</h3>
      <p>Sesiones con su equipo y un período de soporte acordado por contrato, con tiempos de respuesta definidos.</p></div>
  </div>
</div></section>
` + cierre("¿Cuál de las cuatro necesita?") + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── CÓNDOR SITES ───────────────────────────────────────────────────────
   Pricing y proceso reales, sacados de las infografías oficiales del
   2-sept-2026 (ver nota condor_sites_proceso_y_pricing_2026_09_02 en
   memoria) — no son cifras de ejemplo. La tarjeta de planes reproduce, en
   el lenguaje visual serio del sitio, la pantalla real de la app Cóndor
   Sites (capturas recibidas el 3-sept-2026): mismo ícono, mismo precio
   tachado y el mismo checklist. Corrección del 3-sept (segunda ronda):
   el país ya NO viene preseleccionado — hasta que el visitante elige uno
   no se muestra ningún precio, para que no lo confunda con el de otro
   país; antes de la tarjeta va una sección de "qué es" con las mismas
   tres ventajas explicadas en prosa. */
const JS_PLANES_SITES = `
<script>
(() => {
  const tabs = document.querySelectorAll(".pais-tab");
  const cta = document.getElementById("planSitesCta");
  const marcador = document.getElementById("planSitesPlaceholder");
  if (!tabs.length || !cta) return;
  const NOMBRE = { cl: "Chile", pe: "Perú", co: "Colombia" };
  tabs.forEach((t) => t.addEventListener("click", () => {
    const pais = t.dataset.pais;
    tabs.forEach((o) => { o.classList.toggle("activo", o === t); o.setAttribute("aria-selected", String(o === t)); });
    document.querySelectorAll(".plan-pais").forEach((p) => p.classList.toggle("activo", p.dataset.pais === pais));
    if (marcador) marcador.classList.add("oculto");
    cta.hidden = false;
    cta.textContent = "Empezar en " + NOMBRE[pais] + " →";
  }));
})();
</script>
`;
escribir("productos/sites/index.html", cab({
  titulo: "Cóndor Sites — condor.ai",
  desc: "Sitio web propio con soporte 24/7 y mejoras continuas, sin costo de creación inicial. Desde $20.990/mes en Chile.",
  ruta: "/productos/sites/",
}) + heroLinea({
  logo: "/assets/productos/condor-sites.png",
  nombre: "Cóndor Sites",
  gradiente: "linear-gradient(135deg,#2747ff 0%,#7a5bff 55%,#ff3b4e 100%)",
  bajada: "Un sitio web propio, sin costo de creación inicial. Un solo plan mensual incluye soporte 24/7, administración y mejoras continuas.",
}) + `
<section style="padding-bottom:clamp(40px,5vw,56px)"><div class="wrap dos-col">
  <div><h2>Qué es Cóndor Sites</h2></div>
  <div>
    <p>Un sitio web propio para su empresa —no una plantilla compartida ni un constructor que usted mismo tiene que aprender a operar. Nuestro equipo lo diseña, lo publica y lo mantiene actualizado todos los meses.</p>
    <div class="hechos" style="margin-top:24px">
      <div class="hecho"><b>Sin costo inicial</b><span>Se paga solo la mensualidad, desde el primer mes</span></div>
      <div class="hecho"><b>Soporte 24/7</b><span>Atención continua, no solo horario de oficina</span></div>
      <div class="hecho"><b>Mejoras incluidas</b><span>Cambios visuales y de contenido, sin cobro extra</span></div>
      <div class="hecho"><b>Dominio propio</b><span>Publicado bajo la marca de su empresa</span></div>
    </div>
  </div>
</div></section>

<section style="padding-bottom:clamp(40px,5vw,56px)"><div class="wrap planes-centro">
  <h2>Elija su país para ver el plan</h2>
  <p style="color:var(--ink-2);margin-top:10px;max-width:50ch">El precio cambia según el país — selecciónelo antes de ver la tarifa, así no hay confusión entre monedas.</p>
  <div class="paises-tabs" role="tablist" aria-label="Elegir país" style="margin-top:22px">
    <button class="pais-tab" data-pais="cl" role="tab" aria-selected="false">${BANDERA.cl} Chile</button>
    <button class="pais-tab" data-pais="pe" role="tab" aria-selected="false">${BANDERA.pe} Perú</button>
    <button class="pais-tab" data-pais="co" role="tab" aria-selected="false">${BANDERA.co} Colombia</button>
  </div>

  <div class="plan-card">
    <img class="plan-icono" src="/assets/productos/condor-sites.png" alt="" />
    <h3>Página web + soporte 24/7 mensual</h3>
    <ul class="plan-checklist">
      <li>Creamos su página web sin costo inicial</li>
      <li>Soporte 24/7 y administración mensual</li>
      <li>Innovación continua: cambios visuales, nuevos productos y mejoras a pedido</li>
    </ul>
    <div class="plan-precios">
      <p class="plan-placeholder" id="planSitesPlaceholder">Elija un país arriba para ver el precio y la moneda.</p>
      <div class="plan-pais" data-pais="cl">
        <div class="plan-precio"><span class="antes">$28.990</span><strong>$20.990</strong><span class="cada">/mes</span></div>
        <p class="plan-moneda">Incluye IVA</p>
      </div>
      <div class="plan-pais" data-pais="pe">
        <div class="plan-precio"><span class="antes">S/109</span><strong>S/79</strong><span class="cada">/mes</span></div>
        <p class="plan-moneda">Incluye IGV</p>
      </div>
      <div class="plan-pais" data-pais="co">
        <div class="plan-precio"><span class="antes">$89.900 COP</span><strong>$69.900 COP</strong><span class="cada">/mes</span></div>
        <p class="plan-moneda">Incluye IVA</p>
      </div>
    </div>
    <a class="btn btn-primario" href="/agendar" id="planSitesCta" hidden>Empezar →</a>
  </div>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <h2 style="margin-bottom:8px">Sitios que hemos entregado</h2>
  <p style="color:var(--ink-2);max-width:60ch">Capturas de sitios reales, en línea hoy — no maquetas.</p>
  <div style="margin-top:28px">${carruselSitios()}</div>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="margin-top:20px">Cómo se construye</h2>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("lupa")}<span class="n">01</span></div>
      <div><h3>Levantamiento</h3><p class="desc">Reunión inicial y luego recopilación de logo, textos, fotos y datos de su empresa.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("martillo")}<span class="n">02</span></div>
      <div><h3>Construcción y ajustes</h3><p class="desc">Diseño y desarrollo del sitio, con un enlace de borrador para revisar y pedir cambios antes de publicar.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("entrega")}<span class="n">03</span></div>
      <div><h3>Publicación y mantención</h3><p class="desc">Conexión del dominio, salida en vivo y actualizaciones mes a mes mientras dure la suscripción.</p></div></article>
  </div>
</div></section>
` + cierre("¿Le construimos su sitio?") + pie.replace("</body>", JS_COMUN + JS_PLANES_SITES + "</body>"));

/* ── CÓNDOR ECOMMERCE ───────────────────────────────────────────────────
   Pricing, comisiones y proceso reales del modelo comercial cerrado el
   2-sept-2026 (ver condor_ecommerce_modelo_comercial_2026_09_02 en
   memoria). Perú/Colombia/Paraguay se cotizan aparte, ajustados por costo
   de vida — no se listan cifras acá para no publicar un tipo de cambio
   que puede quedar desactualizado. Ampliada el 3-sept (segunda ronda):
   hero con la identidad de marca, sección de "qué incluye" y un botón de
   cotizar por cada nivel — antes solo mostraba números sueltos. */
escribir("productos/ecommerce/index.html", cab({
  titulo: "Cóndor Ecommerce — condor.ai",
  desc: "Tienda en línea administrada de punta a punta: construcción, pasarela de pago, stock y campañas. Desde $69.990/mes + comisión por venta.",
  ruta: "/productos/ecommerce/",
}) + heroLinea({
  logo: "/assets/productos/condor-ecommerce.png",
  nombre: "Cóndor Ecommerce",
  gradiente: "linear-gradient(135deg,#122fc9 0%,#6f2fd6 55%,#e0266b 100%)",
  bajada: "Construimos y administramos su tienda en línea: pasarela de pago, boleta, sincronización de stock y, si lo necesita, gestión de campañas.",
}) + `
<section style="padding-bottom:clamp(40px,5vw,56px)"><div class="wrap dos-col">
  <div><h2>Qué incluye</h2></div>
  <div>
    <p>Una tienda propia, no un plan genérico de Shopify configurado a medias: nuestro equipo la construye, la conecta a su stock real y la mantiene funcionando mes a mes.</p>
    <div class="hechos" style="margin-top:24px">
      <div class="hecho"><b>Pasarela de pago</b><span>Mercado Pago, configurada y probada</span></div>
      <div class="hecho"><b>Boleta electrónica</b><span>Emisión automática, cumple SII</span></div>
      <div class="hecho"><b>Stock sincronizado</b><span>Con su bodega o ERP, sin planillas paralelas</span></div>
      <div class="hecho"><b>Reporte mensual</b><span>Venta real y comisión, sin sorpresas</span></div>
    </div>
  </div>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <h2>Base mensual, según tamaño de tienda</h2>
  <div class="pasos" style="margin-top:24px">
    <div class="paso"><div class="n">SIMPLE</div><h3>$69.990/mes</h3>
      <p>Menos de 100 SKU, sin integraciones ni gestión de Ads.</p>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px">Cotizar plan Simple →</a></div>
    <div class="paso"><div class="n">MEDIA</div><h3>$129.990/mes</h3>
      <p>100 a 500 SKU, o una integración con bodega o ERP externo.</p>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px">Cotizar plan Media →</a></div>
    <div class="paso"><div class="n">COMPLEJA</div><h3>$189.990/mes</h3>
      <p>Más de 500 SKU, varias integraciones, o incluye gestión de Meta Ads.</p>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px">Cotizar plan Compleja →</a></div>
  </div>
  <h2 style="margin-top:48px">Más una comisión por venta neta mensual</h2>
  <div class="lista" style="margin-top:12px">
    <div class="hecho"><b>Hasta $5.000.000/mes</b><span>5% de comisión</span></div>
    <div class="hecho"><b>$5.000.001 – $15.000.000/mes</b><span>7% de comisión</span></div>
    <div class="hecho"><b>Sobre $15.000.000/mes</b><span>9% de comisión</span></div>
  </div>
  <p style="margin-top:20px;color:var(--ink-2)">Precios de Chile, con IVA. Perú, Colombia y Paraguay se cotizan según el mercado local — consúltenos en la reunión inicial.</p>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="margin-top:20px">Cómo se construye</h2>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("lupa")}<span class="n">01</span></div>
      <div><h3>Cotización</h3><p class="desc">Reunión de 30-45 minutos sobre su catálogo e integraciones. Propuesta escrita dentro de 24 horas.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("martillo")}<span class="n">02</span></div>
      <div><h3>Onboarding</h3><p class="desc">Legales, pasarela de pago, construcción de la tienda y sincronización de stock. Objetivo: 7 a 10 días hábiles hasta publicar.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("entrega")}<span class="n">03</span></div>
      <div><h3>Mantención</h3><p class="desc">Reporte mensual con el corte del mes anterior, reunión trimestral y canal directo por WhatsApp Business.</p></div></article>
  </div>
</div></section>
` + cierre("¿Conversamos sobre su tienda?") + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── CÓNDOR MEDIA ───────────────────────────────────────────────────────
   Línea nueva (agregada 2-sept-2026), todavía SIN una tabla de precios
   cerrada como la de Sites/Ecommerce — pero el estimador de video SÍ está
   calibrado con un dato real de Joaquín (3-sept): 30s, nivel Profesional,
   entrega Estándar = $68.000 + IVA (ver `BASE` en JS_CALC_MEDIA). El resto
   de los multiplicadores (Básico/Premium, Urgente) son una extrapolación
   razonable sobre ese único punto real, no tarifas confirmadas una por
   una — avisar a Joaquín si alguna no calza con lo que de verdad cobra.
   Los packs mensuales siguen sin precio en pesos, solo cantidad. */
const JS_CALC_MEDIA = `
<script>
(() => {
  const seg = document.getElementById("calcSegundos");
  const nivel = document.getElementById("calcNivel");
  const plazo = document.getElementById("calcPlazo");
  const salida = document.getElementById("calcResultado");
  const segValor = document.getElementById("calcSegundosValor");
  if (!seg || !nivel || !plazo || !salida) return;
  // Calibrado con el dato real de Joaquín (3-sept-2026): un video de 30s
  // nivel Profesional con entrega Estándar se cobra $68.000 + IVA.
  const BASE = 68000 / (30 * 1.6); // CLP por segundo, nivel Básico, plazo estándar
  const NIVEL = { basico: 1, profesional: 1.6, premium: 2.4 };
  const PLAZO = { estandar: 1, urgente: 1.35 };
  const calcular = () => {
    const s = Number(seg.value);
    segValor.textContent = s + " s";
    const precio = Math.round((s * BASE * NIVEL[nivel.value] * PLAZO[plazo.value]) / 100) * 100;
    salida.textContent = "$" + precio.toLocaleString("es-CL");
  };
  [seg, nivel, plazo].forEach((el) => el.addEventListener("input", calcular));
  calcular();
})();
</script>
`;
escribir("productos/media/index.html", cab({
  titulo: "Cóndor Media — condor.ai",
  desc: "Contenido para redes sociales de su marca, producido cada semana con apoyo de inteligencia artificial. Estimador de video y packs mensuales.",
  ruta: "/productos/media/",
}) + heroLinea({
  logo: "/assets/productos/condor-media.png",
  nombre: "Cóndor Media",
  gradiente: "linear-gradient(135deg,#0b1437 0%,#16224d 100%)",
  bajada: "Contenido para las redes sociales de su marca, producido con la identidad visual de su empresa y apoyo de inteligencia artificial.",
}) + `
<section style="padding-bottom:clamp(40px,5vw,56px)"><div class="wrap dos-col">
  <div><h2>Qué incluye</h2></div>
  <div>
    <p>Un calendario de contenido definido, publicación en sus redes y revisión de que cada pieza respete la paleta, el logo y el tono de su marca.</p>
    <p>El alcance —cantidad de piezas, redes y frecuencia— se define según sus objetivos en la primera reunión, así que la propuesta final se cotiza a medida.</p>
  </div>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <h2>Estime el valor de un video</h2>
  <p style="color:var(--ink-2);margin-top:10px;max-width:56ch">Cálculo referencial según duración, nivel de producción y plazo de entrega. La cotización final se confirma en la reunión, según el brief real.</p>
  <div class="calculadora" style="margin-top:26px">
    <div class="calc-campo">
      <label>Duración <span class="calc-valor" id="calcSegundosValor">20 s</span></label>
      <input type="range" id="calcSegundos" min="5" max="120" step="5" value="20" />
    </div>
    <div class="calc-campo">
      <label>Nivel de producción</label>
      <select id="calcNivel">
        <option value="basico">Básico — edición simple, sin efectos</option>
        <option value="profesional" selected>Profesional — motion graphics y color</option>
        <option value="premium">Premium — guion, actuación y efectos avanzados</option>
      </select>
    </div>
    <div class="calc-campo">
      <label>Plazo de entrega</label>
      <select id="calcPlazo">
        <option value="estandar" selected>Estándar — 5 días hábiles</option>
        <option value="urgente">Urgente — 48 horas</option>
      </select>
    </div>
    <div class="calc-resultado">
      <span>Valor estimado</span>
      <span><strong id="calcResultado">$0</strong> <small style="font-size:13px;font-weight:500;color:var(--ink-3)">+ IVA</small></span>
    </div>
    <p class="calc-nota">Estimador en pesos chilenos, calculado sobre nuestras tarifas reales — la cotización final se confirma en la reunión, según el brief. No incluye pauta publicitaria ni licencias de música con derechos especiales.</p>
  </div>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <h2>Packs de videos</h2>
  <p style="color:var(--ink-2);margin-top:10px;max-width:56ch">Para marcas que necesitan contenido de forma regular, con un solo acuerdo mensual en vez de cotizar cada video por separado.</p>
  <div class="packs-media">
    <div class="pack-media">
      <h4>Pack Semanal</h4>
      <div class="precio-pack">4 videos <small>al mes</small></div>
      <ul>
        <li>1 video corto por semana</li>
        <li>Nivel profesional</li>
        <li>Un ajuste incluido por video</li>
      </ul>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px;width:100%;justify-content:center">Cotizar este pack →</a>
    </div>
    <div class="pack-media">
      <h4>Pack Quincenal</h4>
      <div class="precio-pack">8 videos <small>al mes</small></div>
      <ul>
        <li>2 videos por semana</li>
        <li>Nivel profesional</li>
        <li>Dos ajustes incluidos por video</li>
      </ul>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px;width:100%;justify-content:center">Cotizar este pack →</a>
    </div>
    <div class="pack-media">
      <h4>Pack Mensual Plus</h4>
      <div class="precio-pack">12 videos <small>al mes</small></div>
      <ul>
        <li>3 videos por semana</li>
        <li>Nivel premium disponible</li>
        <li>Ajustes ilimitados dentro del mes</li>
      </ul>
      <a class="btn btn-linea" href="/agendar" style="margin-top:18px;width:100%;justify-content:center">Cotizar este pack →</a>
    </div>
  </div>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="margin-top:20px">Cómo funciona</h2>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("lupa")}<span class="n">01</span></div>
      <div><h3>Brief</h3><p class="desc">Una reunión breve para entender su marca, objetivos y referencias. De ahí sale el calendario o el video puntual a producir.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("martillo")}<span class="n">02</span></div>
      <div><h3>Producción</h3><p class="desc">Guion, grabación o generación asistida por IA, edición y ajustes según el nivel contratado.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("entrega")}<span class="n">03</span></div>
      <div><h3>Entrega</h3><p class="desc">Listo para publicar, en el formato de cada red. Con pack mensual, el ciclo se repite automáticamente.</p></div></article>
  </div>
</div></section>
` + cierre("¿Conversamos sobre su contenido?") + pie.replace("</body>", JS_COMUN + JS_CALC_MEDIA + "</body>"));

/* ── CÓNDOR TRACK ───────────────────────────────────────────────────────
   Software a medida (ERPs, paneles, integraciones). Sin nombrar clientes
   ni proyectos internos concretos: son desarrollos confidenciales, y esta
   página describe la línea de servicio, no casos puntuales. Ampliada el
   3-sept (segunda ronda) con hero de marca, ejemplos concretos de uso y
   dos vías de contacto en vez de una sola. */
escribir("productos/track/index.html", cab({
  titulo: "Cóndor Track — condor.ai",
  desc: "Software y paneles de operación a medida: ERPs, integraciones y automatizaciones para procesos que ya existen en su empresa.",
  ruta: "/productos/track/",
}) + heroLinea({
  logo: "/assets/productos/condor-track.png",
  nombre: "Cóndor Track",
  gradiente: "linear-gradient(135deg,#0f1f6b 0%,#2747ff 100%)",
  bajada: "Sistemas propios para operar mejor: paneles de control, ERPs livianos e integraciones entre las herramientas que su empresa ya usa.",
}) + `
<section style="padding-bottom:clamp(40px,5vw,56px)"><div class="wrap dos-col">
  <div><h2>Para qué sirve</h2></div>
  <div>
    <p>Cuando una planilla o un proceso manual ya no aguanta el volumen del negocio, construimos el sistema que lo reemplaza. No es una plantilla configurada: cada Cóndor Track se diseña sobre el proceso real de la empresa, con acceso y datos que quedan a nombre del cliente.</p>
    <div class="hechos" style="margin-top:24px">
      <div class="hecho"><b>Control de stock</b><span>Entradas, salidas y alertas en un solo panel</span></div>
      <div class="hecho"><b>Seguimiento de pedidos</b><span>Desde que se venden hasta que se entregan</span></div>
      <div class="hecho"><b>Panel de ventas</b><span>Cifras reales, sin planillas paralelas</span></div>
      <div class="hecho"><b>Integraciones</b><span>Conecta los sistemas que su empresa ya usa</span></div>
    </div>
  </div>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <h2>Qué queda al terminar</h2>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("panel")}<span class="n">01</span></div>
      <div><h3>Un panel propio</h3><p class="desc">Diseñado sobre su proceso real, no una plantilla genérica adaptada a la fuerza.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("entrega")}<span class="n">02</span></div>
      <div><h3>Propiedad completa</h3><p class="desc">Código, datos y accesos a nombre de su empresa, sin dependencia de nosotros para seguir operando.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("martillo")}<span class="n">03</span></div>
      <div><h3>Soporte posterior</h3><p class="desc">Acordado por contrato, con tiempos de respuesta definidos para cuando algo falla.</p></div></article>
  </div>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="margin-top:20px">Cómo se construye</h2>
  <div class="pasos" style="margin-top:24px;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.1)">
    <div class="paso" style="background:var(--navy-3)"><div class="n">ETAPA 01</div><h3>Levantamiento</h3>
      <p>Una reunión inicial para entender el proceso y su contexto. Se entrega un alcance escrito con supuestos, plazos y costo antes de comenzar.</p></div>
    <div class="paso" style="background:var(--navy-3)"><div class="n">ETAPA 02</div><h3>Desarrollo</h3>
      <p>Avances revisables de forma periódica sobre el sistema real, no sobre maquetas. Las correcciones se incorporan antes de que sean costosas.</p></div>
    <div class="paso" style="background:var(--navy-3)"><div class="n">ETAPA 03</div><h3>Entrega y soporte</h3>
      <p>Puesta en producción, documentación y capacitación. La propiedad y los accesos quedan a nombre del cliente, con soporte posterior acordado.</p></div>
  </div>
  <div class="hero-cta" style="margin-top:36px">
    <a class="btn btn-primario" href="/agendar">Agendar diagnóstico →</a>
    <a class="btn btn-linea" href="/contacto/">Otras vías de contacto</a>
  </div>
</div></section>
` + cierre("¿Cotizamos su sistema?") + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── CÓNDOR AGENTS (hub) ──────────────────────────────────────────────
   "Agentes IA" en el menú apunta acá, no directo a Bárbara: a futuro esta
   familia sumará más agentes. Bárbara es hoy el único que existe, así que
   es la única tarjeta activa; el resto se muestra desenfocado y marcado
   "Próximamente" — pedido explícito de Joaquín (3-sept-2026), para no
   prometer nombres ni fechas de agentes que todavía no se construyeron. */
escribir("productos/agentes/index.html", cab({
  titulo: "Cóndor Agents — condor.ai",
  desc: "La familia de agentes de inteligencia artificial de Cóndor.ai. Hoy: Bárbara. Próximamente, más agentes especializados.",
  ruta: "/productos/agentes/",
}) + `
<section class="cabecera"><div class="wrap">
  <a class="volver" href="/productos/">Volver a productos</a>
  <img src="/assets/productos/condor-agents.png" alt="" width="56" height="56" style="border-radius:14px;margin-bottom:22px" />
  <h1>Cóndor Agents</h1>
  <p class="bajada">La familia de agentes de inteligencia artificial de Cóndor.ai. Cada uno resuelve una tarea puntual dentro de su empresa, con su propia identidad y su propio modo de trabajar.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <div class="agentes-grid">
    <a class="agente-card" href="/productos/barbara/">
      <img src="/assets/barbara/lockup.jpg" alt="Bárbara" loading="lazy" />
      <h3>Bárbara</h3>
      <p>Crea el contenido de Instagram de su marca cada semana: carruseles, historias y video, con su paleta y su logo.</p>
      <p class="aplica" style="margin-top:8px"><b>Desde <s>$36.990</s> $18.495/mes</b> — 50% hasta el 20 de octubre</p>
      <span class="agente-cta">Conocer a Bárbara →</span>
    </a>
    <div class="agente-card agente-proximo">
      <span class="agente-badge">Próximamente</span>
      <div class="agente-blur">
        ${icono("agente", "ico-agente-grande")}
        <h3>Próximo agente</h3>
        <p>Estamos construyendo el siguiente integrante de la familia Cóndor Agents.</p>
      </div>
    </div>
    <div class="agente-card agente-proximo">
      <span class="agente-badge">Próximamente</span>
      <div class="agente-blur">
        ${icono("agente", "ico-agente-grande")}
        <h3>Próximo agente</h3>
        <p>Estamos construyendo el siguiente integrante de la familia Cóndor Agents.</p>
      </div>
    </div>
  </div>
</div></section>
` + cierre("¿Conversamos sobre agentes para su empresa?") + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── EQUIPO ─────────────────────────────────────────────────────────── */
escribir("equipo/index.html", cab({
  titulo: "Equipo — condor.ai",
  desc: "Las personas responsables de su proyecto en condor.ai, con nombre, rol y responsabilidad.",
  ruta: "/equipo/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Las personas responsables de su proyecto</h1>
  <p class="bajada">Sabrá desde la primera reunión quién construye qué. No hay equipos rotativos ni recursos anónimos asignados por disponibilidad.</p>
</div></section>

<section class="seccion oscura" style="border-top:0"><div class="wrap">
${OFICINA}
  <div class="equipo-grid">
${tarjetasEquipo}
  </div>
</div></section>
` + cierre("¿Quiere conocerlos?") + pie.replace("</body>", JS_COMUN + "</body>"));

for (const p of PERSONAS) {
  escribir(`equipo/${p.slug}.html`, cab({
    titulo: `${p.nombre} — condor.ai`,
    desc: `${p.rol} en condor.ai. ${p.resumen}`,
    ruta: `/equipo/${p.slug}.html`,
  }) + `
<section class="cabecera"><div class="wrap">
  <a class="volver" href="/equipo/">Volver al equipo</a>
  <div class="ficha-cab">
    <div class="ficha-foto"><img src="/assets/${p.foto}" alt="${p.nombre}" /></div>
    <div>
      <div class="ficha-rol">${p.rol}</div>
      <h1>${p.nombre}</h1>
      <p class="bajada">${p.resumen}</p>
      <div class="hero-cta">
${p.contacto.map(([ic, txt, url]) => `        <a class="btn ${ic === "calendario" ? "btn-primario" : "btn-linea"}" href="${url}">${icono(ic, "ico-btn")}${txt}</a>`).join("\n")}
      </div>
    </div>
  </div>
</div></section>

<section class="seccion"><div class="wrap">
  <blockquote class="frase">${p.frase}</blockquote>
  <div class="lista">
${p.bloques.map(([ic, titulo, texto]) => `    <article class="fila">
      <div class="marca-fila">${icono(ic)}</div>
      <div><h3>${titulo}</h3><p class="desc">${texto}</p></div>
    </article>`).join("\n")}
  </div>
</div></section>

<section class="seccion oscura"><div class="wrap">
  <h2 style="max-width:20ch">El resto del equipo</h2>
  <div class="lista">
${PERSONAS.filter((o) => o.slug !== p.slug).map((o) => `    <article class="fila-persona">
      <div class="retrato-s"><img src="/assets/${o.foto}" alt="${o.nombre}" loading="lazy" /></div>
      <div><h3>${o.nombre}</h3><div class="rol">${o.rol}</div>
        <a class="ver" href="/equipo/${o.slug}.html">Ver ficha</a></div>
    </article>`).join("\n")}
  </div>
</div></section>
` + cierre(`¿Quiere conversar con ${p.nombre.split(" ")[0]}?`) + pie.replace("</body>", JS_COMUN + "</body>"));
}

/* ── CONTACTO ───────────────────────────────────────────────────────── */
escribir("contacto/index.html", cab({
  titulo: "Contacto — condor.ai",
  desc: `Agende una reunión, escríbanos a ${CORREO} o por WhatsApp al ${WSP_VISIBLE}.`,
  ruta: "/contacto/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Conversemos sobre su proyecto</h1>
  <p class="bajada">La vía más directa es agendar una reunión de treinta minutos. Al terminar tendrá un diagnóstico del problema y una propuesta de alcance, sin compromiso.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <div class="vias">
    <div class="via"><span class="n">VÍA 01</span><h3>Reunión</h3>
      <p>Treinta minutos, por videollamada o presencial en nuestra oficina en Santiago. Es la forma más rápida de saber si podemos ayudar.</p>
      <a class="btn btn-primario" href="/agendar" style="align-self:flex-start">Agendar una reunión</a></div>
    <div class="via"><span class="n">VÍA 02</span><h3>Correo</h3>
      <p>Para propuestas formales, bases de licitación o consultas que requieran adjuntos. Respondemos el mismo día hábil.</p>
      <a class="valor" href="mailto:${CORREO}">${CORREO}</a></div>
    <div class="via"><span class="n">VÍA 03</span><h3>WhatsApp</h3>
      <p>Para consultas breves. Es el mismo número de atención comercial que usamos en nuestras campañas.</p>
      <a class="valor" href="https://wa.me/${WSP}" target="_blank" rel="noopener">${WSP_VISIBLE}</a></div>
  </div>
</div></section>

<section class="seccion oscura"><div class="wrap dos-col">
  <div><h2>Antes de escribir</h2></div>
  <div>
    <p>No hace falta que traiga un requerimiento redactado ni un presupuesto definido. Con que pueda describir el proceso que le está costando tiempo o dinero, es suficiente para la primera conversación.</p>
    <p>Si después de esa reunión concluimos que no somos la empresa indicada para su problema, se lo diremos en esa misma reunión.</p>
  </div>
</div></section>
` + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── AGENDAR ────────────────────────────────────────────────────────────
   La página a la que apuntan TODOS los CTA del sitio. Se rehace con la
   misma barra, el mismo pie y la misma hoja de estilos que el resto: antes
   era la única con otra tipografía, otros colores y otro menú, y eso en la
   página donde se cierra la conversión se lee como si el enlace te hubiera
   sacado a otro sitio.

   LO QUE NO SE TOCA: la Edge Function, la anon key, los identificadores de
   cada campo, el honeypot, los tramos de 30 minutos, el bloqueo de domingos
   y el estado de éxito. Es un cambio de cáscara, no de comportamiento —
   este formulario es el que genera las reuniones. */
escribir("agendar/index.html", cab({
  titulo: "Agendar una reunión — condor.ai",
  desc: "Agende una reunión de treinta minutos con condor.ai. Al terminar tendrá un diagnóstico del problema y una propuesta de alcance, sin compromiso.",
  ruta: "/agendar",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Agende una reunión</h1>
  <p class="bajada">Treinta minutos, por videollamada o presencial en nuestra oficina en Santiago. Al terminar tendrá un diagnóstico del problema y una propuesta de alcance, sin compromiso.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap ag-grid">
  <form id="agForm" class="ag-form" autocomplete="on">
    <div class="ag-campo">
      <label for="ag_nombre">Nombre y apellido</label>
      <input id="ag_nombre" name="nombre" type="text" maxlength="80" required placeholder="Nombre y apellido" />
    </div>
    <div class="ag-campo">
      <label for="ag_wsp">WhatsApp</label>
      <input id="ag_wsp" name="whatsapp" type="tel" maxlength="20" required placeholder="+56 9 1234 5678" />
    </div>
    <div class="ag-campo">
      <label for="ag_email">Correo</label>
      <input id="ag_email" name="email" type="email" maxlength="120" required placeholder="tucorreo@empresa.cl" />
    </div>
    <div class="ag-dos">
      <div class="ag-campo">
        <label for="ag_fecha">Fecha</label>
        <input id="ag_fecha" name="fecha" type="date" required />
      </div>
      <div class="ag-campo">
        <label for="ag_hora">Hora</label>
        <select id="ag_hora" name="hora" required></select>
      </div>
    </div>
    <div class="ag-campo">
      <label for="ag_msg">Cuéntenos brevemente sobre su empresa <span>(opcional)</span></label>
      <textarea id="ag_msg" name="mensaje" maxlength="600" rows="4" placeholder="Qué proceso le está costando tiempo o dinero"></textarea>
    </div>
    <input id="ag_web" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <button class="btn btn-primario" type="submit" id="agBtn">Agendar la reunión</button>
    <p id="agMsg" class="ag-msg" role="status" aria-live="polite"></p>
  </form>

  <aside class="ag-lado">
    <h3>Qué pasa después</h3>
    <div class="ag-pasos">
      <div><b>01</b><span>Recibe la confirmación por WhatsApp, normalmente el mismo día.</span></div>
      <div><b>02</b><span>En la reunión revisamos el proceso que quiere resolver, sin presentación de ventas.</span></div>
      <div><b>03</b><span>Al terminar le enviamos un alcance escrito con plazos y costo.</span></div>
    </div>
    <h3 style="margin-top:26px">Otras vías</h3>
    <a class="ag-via" href="mailto:${CORREO}">${icono("correo")}${CORREO}</a>
    <a class="ag-via" href="https://wa.me/${WSP}" target="_blank" rel="noopener">${icono("whatsapp")}${WSP_VISIBLE}</a>
    <p class="ag-nota">Atendemos de lunes a sábado, entre 09:00 y 20:30.</p>
  </aside>
</div></section>
` + pie.replace("</body>", JS_COMUN + JS_AGENDA + "</body>"));


console.log("Listo.");
