/**
 * Genera el sitio corporativo de condor.ai: inicio + seis subpáginas + tres
 * fichas de equipo.
 *
 * POR QUÉ UN GENERADOR Y NO DIEZ ARCHIVOS A MANO
 * ---------------------------------------------------------------------------
 * Las diez páginas comparten barra, pie, cierre y estilos. Con una copia por
 * archivo, a la tercera edición dejan de ser el mismo sitio: alguien cambia el
 * teléfono en el pie de una y no en las otras nueve. Acá el contenido son
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
};
const icono = (n, clase = "ico") =>
  `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;

const NAV = [
  ["/inicio/", "Inicio"],
  ["/equipo/", "Equipo"],
  ["/clientes/", "Clientes"],
  ["/proceso/", "Proceso"],
  ["/productos/", "Productos"],
  ["/contacto/", "Contacto"],
];

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
  <a href="/"><img class="logo" src="/assets/logo.png" alt="condor.ai" /></a>
  <nav class="menu">
${NAV.map(([u, n]) => `    <a href="${u}"${t.ruta === u ? ' aria-current="page"' : ""}>${n}</a>`).join("\n")}
  </nav>
  <a class="portal-acceso" href="/portal.html">Portal clientes</a>
  <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
</div></header>

<div class="cortina" hidden></div>
<nav class="cajon" id="cajon" aria-label="Menú" hidden>
  <div class="cajon-cab">
    <img class="logo" src="/assets/logo.png" alt="condor.ai" />
    <button class="cerrar" aria-label="Cerrar menú">&times;</button>
  </div>
${NAV.map(([u, n]) => `  <a href="${u}"${t.ruta === u ? ' aria-current="page"' : ""}>${n}</a>`).join("\n")}
  <a href="/portal.html">Portal de clientes</a>
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
        Desarrollo de software, agentes de inteligencia artificial y consultoría de IA para empresas.</p>
    </div>
    <div><h4>Productos</h4>
      <a href="/productos/">Desarrollo de software</a><a href="/productos/">Asistentes y agentes de IA</a><a href="/productos/">Consultoría e implementación</a></div>
    <div><h4>La empresa</h4>
      <a href="/inicio/">Quiénes somos</a><a href="/equipo/">Equipo</a><a href="/proceso/">Proceso</a><a href="/clientes/">Clientes</a></div>
    <div><h4>Contacto</h4>
      <a href="/agendar">Agendar una reunión</a>
      <a href="mailto:${CORREO}">${CORREO}</a>
      <a href="https://wa.me/${WSP}" target="_blank" rel="noopener">WhatsApp ${WSP_VISIBLE}</a>
      <a href="/portal.html">Portal de clientes</a></div>
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

  // Carrusel de sitios: coverflow que avanza solo.
  // La posición de cada tarjeta se calcula respecto de la activa y se pone en
  // data-pos; el CSS hace el resto. Se guarda la distancia MÁS CORTA en el
  // anillo (por eso el ajuste con la mitad del total), o al pasar del último
  // al primero las tarjetas cruzarían toda la pantalla en vez de girar.
  document.querySelectorAll(".sitios").forEach((car) => {
    const tarjetas = [...car.querySelectorAll(".sitio")];
    const puntos = [...car.querySelectorAll(".s-punto")];
    if (!tarjetas.length) return;
    const total = tarjetas.length;
    let act = 0, reloj = 0;

    const pintar = () => {
      tarjetas.forEach((t, i) => {
        let d = i - act;
        if (d > total / 2) d -= total;
        if (d < -total / 2) d += total;
        t.dataset.pos = Math.abs(d) > 2 ? "lejos" : String(d);
        t.setAttribute("aria-hidden", String(d !== 0));
      });
      puntos.forEach((p, i) => p.setAttribute("aria-selected", String(i === act)));
    };
    const ir = (n) => { act = (n + total) % total; pintar(); };
    const andar = () => { if (!quieto) { clearInterval(reloj); reloj = setInterval(() => ir(act + 1), 3800); } };
    const frenar = () => clearInterval(reloj);

    puntos.forEach((p, i) => p.addEventListener("click", () => { frenar(); ir(i); andar(); }));
    // Tocar una tarjeta lateral la trae al centro: es lo que uno espera al
    // hacer clic en algo que se ve a medias.
    tarjetas.forEach((t, i) => t.addEventListener("click", () => { frenar(); ir(i); andar(); }));
    car.addEventListener("pointerenter", frenar);
    car.addEventListener("pointerleave", andar);
    car.addEventListener("focusin", frenar);

    pintar();
    andar();
  });

  // Hero rotativo (solo en el inicio). Se detiene al pasar el ratón y al
  // enfocar con teclado: un titular que cambia mientras alguien lo lee es una
  // molestia, no una gracia.
  const slides = [...document.querySelectorAll("#slides .slide")];
  if (slides.length) {
    const puntos = [...document.querySelectorAll(".punto")];
    let i = 0, timer = 0;
    const mostrar = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("on", k === i));
      puntos.forEach((p, k) => p.setAttribute("aria-selected", String(k === i)));
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


const CLIENTES = ["PlanetaShop", "Vitalen", "Smartech", "Veci", "Rat.IA"];
const carrusel = `
<section class="clientes">
  <div class="titulo">Empresas que han confiado en nosotros</div>
  <div class="pista">
    ${CLIENTES.map((c) => `<span>${c}</span>`).join("")}
    ${CLIENTES.map((c) => `<span>${c}</span>`).join("")}
  </div>
</section>
`;


/* Carrusel por producto, en coverflow.
   La tarjeta del centro manda y las laterales se alejan en Z, se inclinan y
   se atenúan: la profundidad ordena la lectura sin necesidad de un marco que
   grite cuál es la activa.

   DISTINCIÓN QUE IMPORTA Y NO ES ESTÉTICA:
   · SITIOS son capturas de sitios REALES que entregamos y están en línea. Se
     presentan como trabajo propio porque lo son.
   · CASOS_AGENTES y CASOS_CONSULTORIA usan fotos de Unsplash (licencia libre
     para uso comercial). NO son capturas de nuestro trabajo, así que se
     presentan como CASOS DE USO, no como entregas. Poner una foto de banco
     de imágenes bajo el rótulo "lo que hemos hecho" sería mentir. */
const SITIOS = [
  { img: "/assets/sitios/ecommerce.webp",    nombre: "Tienda en línea",      tipo: "Comercio",
    desc: "Catálogo, carro y pago en línea. Pensada para vender desde el teléfono." },
  { img: "/assets/sitios/inmobiliario.webp", nombre: "Portal inmobiliario",  tipo: "Propiedades",
    desc: "Buscador con filtros, fichas de propiedad y contacto directo con el corredor." },
  { img: "/assets/sitios/restaurante.webp",  nombre: "Sitio de restaurante", tipo: "Gastronomía",
    desc: "Carta, reservas y ubicación. Carga rápido incluso con fotos grandes." },
  { img: "/assets/sitios/servicios.webp",    nombre: "Sitio de servicios",   tipo: "Salud",
    desc: "Servicios, equipo y agenda de horas. Diseñado para generar confianza." },
  { img: "/assets/sitios/esencial.webp",     nombre: "Sitio esencial",       tipo: "Empresa",
    desc: "La versión directa: quiénes son, qué hacen y cómo contactarlos." },
];

const CASOS_AGENTES = [
  { img: "/assets/casos/agentes-1.jpg", nombre: "Atención en WhatsApp",     tipo: "Caso de uso",
    desc: "El agente responde consultas frecuentes a cualquier hora y deriva a una persona cuando hace falta." },
  { img: "/assets/casos/agentes-2.jpg", nombre: "Clasificación de entrada", tipo: "Caso de uso",
    desc: "Cada mensaje se etiqueta por tipo y urgencia antes de llegar al equipo, sin lectura manual." },
  { img: "/assets/casos/agentes-3.jpg", nombre: "Seguimiento automático",   tipo: "Caso de uso",
    desc: "El agente retoma conversaciones que quedaron sin respuesta y avisa cuando alguien vuelve a escribir." },
  { img: "/assets/casos/agentes-4.jpg", nombre: "Agenda de reuniones",      tipo: "Caso de uso",
    desc: "Propone horarios disponibles, confirma y deja la reunión creada en el calendario del equipo." },
  { img: "/assets/casos/agentes-5.jpg", nombre: "Integración con sistemas", tipo: "Caso de uso",
    desc: "Consulta el CRM o el ERP en la misma conversación para responder con datos reales, no genéricos." },
];

const CASOS_CONSULTORIA = [
  { img: "/assets/casos/consul-1.jpg", nombre: "Levantamiento de procesos", tipo: "Etapa",
    desc: "Sesiones con quienes ejecutan el proceso todos los días, no solo con la gerencia." },
  { img: "/assets/casos/consul-2.jpg", nombre: "Priorización con el cliente", tipo: "Etapa",
    desc: "Se ordenan los casos por impacto y esfuerzo, y se decide en conjunto por dónde partir." },
  { img: "/assets/casos/consul-3.jpg", nombre: "Estimación de impacto",     tipo: "Etapa",
    desc: "Cuánto tiempo o costo libera cada caso, calculado antes de escribir una línea de código." },
  { img: "/assets/casos/consul-4.jpg", nombre: "Implementación",            tipo: "Etapa",
    desc: "No entregamos un informe y nos retiramos: dejamos el caso funcionando en la operación." },
  { img: "/assets/casos/consul-5.jpg", nombre: "Capacitación del equipo",   tipo: "Etapa",
    desc: "Transferencia al equipo interno para que pueda operar y ajustar sin depender de nosotros." },
];

const CARRUSELES = { codigo: SITIOS, agente: CASOS_AGENTES, brujula: CASOS_CONSULTORIA };
const ETIQUETA = {
  codigo: "Sitios que hemos entregado",
  agente: "Casos de uso de agentes de IA",
  brujula: "Etapas de una consultoría",
};

const carruselProducto = (clave) => {
  const datos = CARRUSELES[clave];
  return '<div class="sitios" aria-label="' + ETIQUETA[clave] + '"><div class="sitios-pista">' +
    datos.map((x, i) =>
      '<article class="sitio" data-i="' + i + '">' +
        '<div class="captura"><img src="' + x.img + '" alt="' + x.nombre + '" loading="lazy" /></div>' +
        '<div class="sitio-txt"><span class="sitio-tipo">' + x.tipo + '</span>' +
        '<h4>' + x.nombre + '</h4><p>' + x.desc + '</p></div>' +
      '</article>').join("") +
    '</div><div class="sitios-puntos" role="tablist" aria-label="Elegir">' +
    datos.map((x, i) =>
      '<button class="s-punto" role="tab" aria-selected="' + (i === 0) + '" aria-label="' + x.nombre + '"></button>'
    ).join("") +
    '</div></div>';
};

const PRODUCTOS = [
  { n: "01", ico: "codigo", tit: "Desarrollo de software y sitios web",
    intro: "Plataformas, portales y sitios corporativos desarrollados a medida, con foco en rendimiento, mantenibilidad y medición.",
    puntos: ["Análisis funcional y definición de arquitectura", "Desarrollo, pruebas y puesta en producción",
             "Dominio, código y accesos a nombre del cliente", "Instrumentación y métricas desde el primer día"],
    aplica: "Empresas que necesitan un sistema propio, no una plantilla configurada." },
  { n: "02", ico: "agente", tit: "Asistentes y agentes de IA",
    intro: "Agentes conectados a los canales y sistemas que la empresa ya utiliza, capaces de atender, clasificar y ejecutar tareas de forma autónoma.",
    puntos: ["Atención continua en WhatsApp y canales web", "Integración con CRM, bases de datos y ERP",
             "Derivación a una persona cuando corresponde", "Registro auditable de cada interacción"],
    aplica: "Operaciones con alto volumen de consultas repetitivas." },
  { n: "03", ico: "brujula", tit: "Consultoría e implementación de IA",
    intro: "Diagnóstico de procesos, definición de casos de uso con retorno medible e implementación efectiva. No entregamos un informe y nos retiramos.",
    puntos: ["Levantamiento y priorización de procesos", "Estimación de impacto antes de desarrollar",
             "Implementación y puesta en marcha", "Capacitación y transferencia al equipo interno"],
    aplica: "Organizaciones que necesitan decidir dónde invertir en IA." },
];

/* Los productos se muestran ABIERTOS, no en acordeón.
   Un acordeón esconde justo lo que la página vino a contar, y obliga a tres
   clics para leer tres párrafos. Si el contenido cabe, se muestra. */
const bloquesProducto = () => PRODUCTOS.map((p) => `
  <article class="fila">
    <div class="marca-fila">${icono(p.ico)}<span class="n">${p.n}</span></div>
    <div>
      <h3>${p.tit}</h3>
      <p class="desc">${p.intro}</p>
      <ul class="puntos-lista">${p.puntos.map((x) => `<li>${x}</li>`).join("")}</ul>
      ${carruselProducto(p.ico)}
      <p class="aplica"><b>Aplica a</b> ${p.aplica}</p>
    </div>
  </article>`).join("");

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

// Las dos fotos de oficina, cada una con su pie. Sin pie, dos imágenes
// seguidas son decoración; con pie, cada una dice algo que el texto no dice.
const OFICINA = `
  <div class="oficina-dos">
    <figure>
      <div class="marco"><img src="/assets/oficina/equipo.webp" alt="El equipo de condor.ai trabajando en la oficina" loading="lazy" /></div>
      <figcaption><b>El equipo, un martes cualquiera</b>Trabajamos en una sola sala y sobre una sola mesa. Las decisiones de un proyecto se toman entre quienes lo van a construir, sin capas intermedias.</figcaption>
    </figure>
    <figure>
      <div class="marco"><img src="/assets/oficina/oficina.webp" alt="Oficina de condor.ai en Santiago" loading="lazy" /></div>
      <figcaption><b>Nuestra oficina en Santiago</b>Aquí se hacen las reuniones de levantamiento y las revisiones de avance. Si prefiere una reunión presencial, es donde lo recibimos.</figcaption>
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
  titulo: "condor.ai — Software, agentes de IA y consultoría para empresas",
  desc: "Desarrollo de software a medida, asistentes y agentes de inteligencia artificial, y consultoría e implementación de IA para empresas en Chile y la región.",
  ruta: "/",
}) + `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <div class="slides" id="slides">
      <article class="slide on">
        <h1>Soluciones inteligentes para tu empresa</h1>
        <p class="bajada">Diseñamos, construimos y mantenemos los sistemas que sostienen procesos críticos de empresas en Chile y la región.</p>
      </article>
      <article class="slide">
        <h1>Agentes de inteligencia artificial dentro de su operación</h1>
        <p class="bajada">Asistentes conectados a sus sistemas y canales, que atienden, clasifican y hacen seguimiento sin intervención manual.</p>
      </article>
      <article class="slide">
        <h1>Consultoría de IA con responsabilidad sobre el resultado</h1>
        <p class="bajada">Identificamos dónde la inteligencia artificial genera retorno medible, y la dejamos implementada y en operación.</p>
      </article>
    </div>
    <div class="hero-cta">
      <a class="btn btn-primario" href="/agendar">Agendar una reunión</a>
      <a class="btn btn-linea" href="/productos/">Ver productos</a>
    </div>
    <div class="puntos" role="tablist" aria-label="Cambiar mensaje">
      <button class="punto" role="tab" aria-selected="true" aria-label="Mensaje 1 de 3"></button>
      <button class="punto" role="tab" aria-selected="false" aria-label="Mensaje 2 de 3"></button>
      <button class="punto" role="tab" aria-selected="false" aria-label="Mensaje 3 de 3"></button>
    </div>
  </div>
  <div>
    <div class="hero-marco"><img src="/assets/oficina/oficina.webp" alt="Oficina de condor.ai" /></div>

  </div>
</div></section>

${carrusel}

<!-- COMPAÑÍA (resumen) -->
<section class="seccion"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Optimizamos procesos de empresas con inteligencia artificial</h2></div>
    ${verMas("/inicio/", "Ver más")}
  </div>
  <p style="font-size:clamp(16px,1.6vw,19px);max-width:70ch">Ayudamos a empresas a automatizar sus procesos con inteligencia artificial: desde un emprendedor que quiere dejar de perder horas en tareas repetitivas, hasta compañías que ahorran miles de dólares al año en operación. Fundada en 2025, con operación en Chile, Perú y Colombia.</p>
  </div>
</div></section>

<!-- EQUIPO (resumen, con las fotos y las personas) -->
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



<!-- PROCESO (resumen) -->
<section class="seccion"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Un método definido, sin sorpresas de alcance</h2></div>
    ${verMas("/proceso/", "Ver el proceso completo")}
  </div>
  <div class="lista">
    <article class="fila"><div class="marca-fila">${icono("lupa")}<span class="n">01</span></div>
      <div><h3>Levantamiento</h3><p class="desc">Una reunión inicial para entender el proceso y su contexto. Se entrega un alcance escrito con supuestos, plazos y costo antes de comenzar.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("martillo")}<span class="n">02</span></div>
      <div><h3>Desarrollo</h3><p class="desc">Avances revisables de forma periódica sobre el sistema real, no sobre maquetas. Las correcciones se incorporan antes de que sean costosas.</p></div></article>
    <article class="fila"><div class="marca-fila">${icono("entrega")}<span class="n">03</span></div>
      <div><h3>Entrega y soporte</h3><p class="desc">Puesta en producción, documentación y capacitación. La propiedad y los accesos quedan a nombre del cliente, con soporte posterior acordado.</p></div></article>
  </div>
</div></section>

<!-- PRODUCTOS (resumen) -->
<section class="seccion"><div class="wrap">
  <div class="cab">
    <div>
      <h2 style="margin-top:20px">Tres líneas de servicio, cada una con equipo dedicado</h2></div>
    ${verMas("/productos/", "Ver todos los productos")}
  </div>
  <div class="lista">
${PRODUCTOS.map((p) => `    <article class="fila">
      <div class="marca-fila">${icono(p.ico)}<span class="n">${p.n}</span></div>
      <div><h3>${p.tit}</h3><p class="desc">${p.intro}</p>${carruselProducto(p.ico)}</div>
    </article>`).join("\n")}
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

/* ── PRODUCTOS ──────────────────────────────────────────────────────── */
escribir("productos/index.html", cab({
  titulo: "Productos — condor.ai",
  desc: "Desarrollo de software y sitios web, asistentes y agentes de IA, y consultoría e implementación de inteligencia artificial.",
  ruta: "/productos/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Tres líneas de servicio, cada una con equipo dedicado</h1>
  <p class="bajada">No trabajamos por horas ni revendemos licencias. Cada línea tiene un responsable técnico y un alcance escrito antes de comenzar.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
<div class="lista">${bloquesProducto()}</div>
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
` + cierre("¿Cuál de las tres necesita?") + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── COMPAÑÍA ───────────────────────────────────────────────────────── */
/* La página se llama Inicio. Se escribe DOS veces: en /inicio/, que es su
   dirección, y en /compania/, que queda como copia para que cualquier enlace
   antiguo siga respondiendo 200 en vez de caer al 404. */
const paginaInicio = cab({
  titulo: "Inicio — condor.ai",
  desc: "condor.ai es una empresa chilena de servicios de software con operación en Chile y Colombia.",
  ruta: "/inicio/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Optimizamos procesos de empresas con inteligencia artificial</h1>
  <p class="bajada">condor.ai automatiza procesos de empresas con inteligencia artificial. Fundada en 2025, con operación en Chile, Perú y Colombia.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap dos-col">
  <div><h2>Cómo trabajamos</h2></div>
  <div>
    <p>Ayudamos a empresas a automatizar sus procesos con inteligencia artificial: desde un emprendedor que quiere dejar de perder horas en tareas repetitivas, hasta compañías que ahorran miles de dólares al año en operación. Fundada en 2025, con operación en Chile, Perú y Colombia.</p>
    <p>Trabajamos con empresas que ya tienen operación y necesitan que la tecnología reduzca carga, no que agregue otro sistema sin uso. Antes de proponer un desarrollo estimamos su impacto; cuando un proceso todavía no conviene automatizar, lo decimos.</p>
    <p>Cada proyecto se entrega documentado, con la propiedad intelectual y los accesos a nombre del cliente. No usamos la dependencia técnica como forma de retención.</p>
      <div class="hecho"><b>Chile y Colombia</b><span>Operación regional</span></div>
      <div class="hecho"><b>Equipo propio</b><span>Sin subcontratación</span></div>
      <div class="hecho"><b>Soporte continuo</b><span>Posterior a la entrega</span></div>
    </div>
  </div>
</div></section>

${carrusel}
` + cierre() + pie.replace("</body>", JS_COMUN + "</body>");
escribir("inicio/index.html", paginaInicio);
escribir("compania/index.html", paginaInicio);

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

/* ── PROCESO ────────────────────────────────────────────────────────── */
escribir("proceso/index.html", cab({
  titulo: "Proceso — condor.ai",
  desc: "Un método definido en tres etapas, con alcance escrito antes de comenzar y sin sorpresas de presupuesto.",
  ruta: "/proceso/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Un método definido, sin sorpresas de alcance</h1>
  <p class="bajada">El costo y el plazo se acuerdan por escrito antes de escribir la primera línea de código. Si el alcance cambia, se vuelve a acordar.</p>
</div></section>

<section style="padding-bottom:clamp(56px,7vw,96px)"><div class="wrap">
  <div class="pasos" style="margin-top:0">
    <div class="paso"><div class="n">ETAPA 01</div><h3>Levantamiento</h3>
      <p>Una reunión inicial para entender el proceso y su contexto. Se entrega un alcance escrito con supuestos, plazos y costo antes de comenzar.</p></div>
    <div class="paso"><div class="n">ETAPA 02</div><h3>Desarrollo</h3>
      <p>Avances revisables de forma periódica sobre el sistema real, no sobre maquetas. Las correcciones se incorporan antes de que sean costosas.</p></div>
    <div class="paso"><div class="n">ETAPA 03</div><h3>Entrega y soporte</h3>
      <p>Puesta en producción, documentación y capacitación. La propiedad y los accesos quedan a nombre del cliente, con soporte posterior acordado.</p></div>
  </div>
</div></section>

<section class="seccion"><div class="wrap dos-col">
  <div><h2>Qué esperamos de su parte</h2></div>
  <div>
    <p>Una contraparte con capacidad de decidir. La mayoría de los atrasos en proyectos de software no son técnicos: son decisiones que quedan esperando aprobación.</p>
    <p>Acceso a quien conoce el proceso de verdad. Normalmente no es la gerencia, sino quien lo ejecuta todos los días.</p>
    <p>Disponibilidad para las revisiones de avance. Son cortas y espaciadas, pero es donde se corrige barato lo que después sale caro.</p>
  </div>
</div></section>
` + cierre() + pie.replace("</body>", JS_COMUN + "</body>"));

/* ── CLIENTES ───────────────────────────────────────────────────────── */
escribir("clientes/index.html", cab({
  titulo: "Clientes — condor.ai",
  desc: "Empresas que han confiado en condor.ai para desarrollar software y automatizar procesos.",
  ruta: "/clientes/",
}) + `
<section class="cabecera"><div class="wrap">
  <h1>Empresas que han confiado en nosotros</h1>
  <p class="bajada">Trabajamos con compañías de comercio, servicios y administración de propiedades en Chile y Colombia.</p>
</div></section>

${carrusel}

<section class="seccion oscura" style="border-top:0"><div class="wrap">
  <div class="cab"><div>
    <h2 style="margin-top:20px">Empresas que trabajan con nosotros</h2></div></div>
    <div class="testi"><p>“El sistema entró en producción en el plazo comprometido y la transferencia al equipo interno fue ordenada.”</p>
      <div class="quien"><b>Dirección</b><span>Retail</span></div></div>
    <div class="testi"><p>“Nos indicaron qué procesos no convenía automatizar todavía. Esa recomendación evitó una inversión innecesaria.”</p>
      <div class="quien"><b>Administración</b><span>Servicios inmobiliarios</span></div></div>
  </div>
</div></section>
` + cierre() + pie.replace("</body>", JS_COMUN + "</body>"));

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

/* ── FICHAS DE EQUIPO ───────────────────────────────────────────────── */
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
