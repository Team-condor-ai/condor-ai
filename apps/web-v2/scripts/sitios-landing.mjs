import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Una fuente de precios; la comparación anual es contra doce mensualidades
// reales. No se presentan tarifas inventadas como precios anteriores.
export const PRECIOS_SITES = [
  { id: 'cl', pais: 'Chile', moneda: 'CLP', mensual: 34990, anual: 409990, impuesto: 'IVA incluido' },
  { id: 'pe', pais: 'Perú', moneda: 'PEN', mensual: 124.9, anual: 1469, impuesto: 'IGV incluido' },
  { id: 'co', pais: 'Colombia', moneda: 'COP', mensual: 116900, anual: 1379900, impuesto: 'IVA incluido' },
];

function dinero(valor, moneda, decimales = moneda === 'PEN' ? 2 : 0) {
  const [entero, decimal] = valor.toFixed(decimales).split('.');
  return (moneda === 'PEN' ? 'S/' : '$') + entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimal ? ',' + decimal : '');
}
const flecha = '<span aria-hidden="true">↗</span>';
const enlaceWsp = (wsp, texto) => `https://wa.me/${wsp}?text=${encodeURIComponent(texto)}`;
const assetVersion = (file) => createHash('sha1').update(readFileSync(new URL('../public/rediseno/' + file, import.meta.url))).digest('hex').slice(0, 10);

function planes(p, wsp) {
  const totalMensual = p.mensual * 12;
  const ahorro = totalMensual - p.anual;
  const boton = (anual) => `<a class="cs-button ${anual ? 'cs-button-light' : ''}" data-plan-link="${anual ? 'anual' : 'mensual'}" href="${enlaceWsp(wsp, `Hola, me interesa Cóndor Sites en ${p.pais}. Quiero conocer el plan ${anual ? 'anual' : 'mensual'} de ${dinero(anual ? p.anual : p.mensual, p.moneda)} ${p.moneda} (${p.impuesto.toLowerCase()}).`)}" target="_blank" rel="noopener">Elegir plan ${anual ? 'anual' : 'mensual'} ${flecha}</a>`;
  return `<div class="cs-price-panel" id="cs-price-${p.id}" data-price-country="${p.id}"${p.id === 'cl' ? '' : ' hidden'}>
    <article class="cs-price-card">
      <div class="cs-plan-top"><h3>Mes a mes</h3><span>Pago mensual</span></div>
      <p class="cs-plan-description">Empieza con una mensualidad y acompaña el ritmo de tu negocio.</p>
      <div class="cs-amount"><strong>${dinero(p.mensual, p.moneda)}</strong><span>${p.moneda} / mes</span></div>
      <p class="cs-tax">${p.impuesto} · creación sin costo adicional</p>
      ${boton(false)}
      <p class="cs-payment-note">Se cobra ${dinero(p.mensual, p.moneda)} ${p.moneda} cada mes.</p>
    </article>
    <article class="cs-price-card cs-price-annual">
      <div class="cs-plan-top"><h3>Todo el año</h3><span>Ahorro anual</span></div>
      <p class="cs-plan-description">Resuelve doce meses de web con un solo pago y una tarifa fija.</p>
      <div class="cs-amount"><strong>${dinero(p.anual, p.moneda)}</strong><span>${p.moneda} / año</span></div>
      <p class="cs-tax">${p.impuesto} · un pago por 12 meses</p>
      ${boton(true)}
      <p class="cs-payment-note">Equivale a ${dinero(p.anual / 12, p.moneda)} ${p.moneda} al mes.</p>
      <div class="cs-saving"><div><span>12 pagos mensuales</span><s>${dinero(totalMensual, p.moneda)}</s></div><div><span>Ahorras al pagar anual</span><strong>${dinero(ahorro, p.moneda)} ${p.moneda}</strong></div></div>
    </article>
  </div>`;
}

export function sitiosLanding({ cab, pie, jsComun, personas, wsp }) {
  const contacto = enlaceWsp(wsp, 'Hola, quiero una web para mi negocio. Me interesa Cóndor Sites.');
  const demos = [
    { id: 'servicios', nombre: 'Servicios y profesionales', tipo: 'Una primera impresión que da confianza.', texto: 'Presenta lo que haces, responde las dudas importantes y acerca a tu próximo cliente al contacto.', url: '/demos/servicios/', imagen: '/assets/sitios/servicios.webp', alt: 'Demo Vértice: página de servicios de una clínica dental' },
    { id: 'restaurante', nombre: 'Restaurantes', tipo: 'Que conocer tu negocio sea el primer paso.', texto: 'Tu propuesta, tu carta y la forma de encontrarte. Todo en un sitio que habla el idioma de tu marca.', url: 'https://team-condor-ai.github.io/condorweb/demos/restaurante/', imagen: '/assets/sitios/restaurante.webp', alt: 'Demo La Causa de Don Lucho: página de restaurante' },
  ];
  const preguntas = [
    ['¿Tengo que saber de tecnología?', 'No. Tú nos cuentas qué hace tu negocio y qué quieres comunicar. Nosotros diseñamos, publicamos y administramos el sitio. Para pedir un ajuste, nos escribes.'],
    ['¿Qué necesito para empezar?', 'Tu logo, datos de contacto, información de tus servicios y las fotos que quieras usar. En la primera conversación definimos el contenido y el alcance; luego ves un borrador antes de publicar.'],
    ['¿Qué cambios cubre el plan?', 'Ajustes menores sobre el sitio existente: textos, imágenes, horarios, datos de contacto y contenido. Nuevas funcionalidades, integraciones, tiendas en línea o rediseños completos se cotizan por separado, antes de trabajar.'],
    ['¿Qué pasa con mi dominio?', 'Si ya tienes uno, lo conectamos. Si necesitas registrar uno, te ayudamos a elegirlo y confirmamos su costo de registro y renovación. El dominio y sus accesos quedan a nombre de tu empresa.'],
    ['¿Cuándo estará lista mi web?', 'En la primera conversación acordamos un plazo según el contenido y el alcance. Te mostramos una versión para revisar y publicamos cuando los ajustes estén aprobados.'],
    ['¿Cómo funciona el pago anual?', 'Pagas por adelantado los 12 meses que aparecen en la tarjeta del plan. El total incluye el descuento mostrado y mantiene esa tarifa durante el período. El servicio incluido es el mismo del plan mensual.'],
    ['¿Puedo vender productos o agregar un sistema?', 'Sí, podemos ayudarte a crecer. Una tienda con carrito y pagos corresponde a Cóndor Ecommerce; las funciones e integraciones a medida se cotizan según su alcance. El plan Sites está pensado para presentar tu negocio y facilitar el contacto.'],
  ];
  const head = cab({ titulo: 'Cóndor Sites — Una web a la altura de tu negocio', desc: 'Diseñamos, publicamos y cuidamos la web de tu negocio. Sin costo de creación. Plan mensual o anual en Chile, Perú y Colombia.', ruta: '/productos/sites/' })
    .replace('<body>', '<body class="sites-page">')
    .replace(/<link[^>]+(?:api|cdn)\.fontshare\.com[^>]*>\s*/g, '')
    .replace('</head>', `<link rel="preload" href="/assets/fuentes/GeneralSans-Regular.ttf" as="font" type="font/ttf" crossorigin />\n<link rel="stylesheet" href="/rediseno/sites.css?v=${assetVersion('sites.css')}" />\n<script defer src="/rediseno/sites.js?v=${assetVersion('sites.js')}"></script>\n</head>`);
  return head + `
<a class="cs-skip" href="#cs-main">Ir al contenido</a>
<main id="cs-main">
  <section class="cs-hero">
    <div class="cs-wrap">
      <div class="cs-overline"><a href="/productos/">Productos / <span>Cóndor Sites</span></a><span>Diseño + cuidado web</span></div>
      <h1>Una web a la altura<br />de tu negocio<span class="cs-dot">.</span></h1>
      <div class="cs-hero-bottom">
        <div><p class="cs-hero-intro">Tú construiste un buen negocio.<br />Hagamos que se note desde el primer clic.</p><a class="cs-button" href="#planes-sites">Encuentra tu plan ${flecha}</a></div>
        <div class="cs-hero-detail"><p>Diseñamos, publicamos y cuidamos tu sitio. Una presencia profesional para que te conozcan, confíen en ti y sepan cómo contactarte.</p><div class="cs-hero-meta"><span>Creación sin costo inicial</span><span>Un equipo a tu lado</span></div></div>
      </div>
      <a class="cs-scroll" href="#cs-confianza"><span>Tu próximo paso empieza aquí</span><span aria-hidden="true">↓</span></a>
    </div>
  </section>

  <section class="cs-section cs-problem" id="cs-confianza">
    <div class="cs-wrap cs-split">
      <div data-cs-reveal><p class="cs-eyebrow">01 / La primera impresión</p><h2>Antes de escribirte,<br />ya te están<br /><span class="cs-muted">conociendo.</span></h2></div>
      <div class="cs-problem-story" data-cs-reveal><p class="cs-lead">Te recomiendan. Te buscan. Abren tu web.</p><p>Ese momento debería confirmar lo que tus clientes ya saben: que detrás hay un negocio serio, con personas que hacen bien su trabajo.</p><div class="cs-question"><span>Lo que tu cliente necesita sentir</span><h3>“Aquí está<br />lo que buscaba.”</h3></div><p>Una propuesta clara, una imagen cuidada y el contacto a mano. Sin hacerle adivinar qué ofreces ni cómo seguir.</p></div>
    </div>
  </section>

  <section class="cs-section cs-work" id="cs-ejemplos">
    <div class="cs-wrap">
      <div class="cs-section-head" data-cs-reveal><div><p class="cs-eyebrow">02 / Se siente tuyo</p><h2>Tu identidad.<br />En cada detalle.</h2></div><p>Tu web tiene que hablar de tu negocio. Explora estos ejemplos de diseño y encuentra el punto de partida para el tuyo.</p></div>
      <div class="cs-demo-controls" role="group" aria-label="Ejemplos de diseño">${demos.map((d, i) => `<button type="button" data-demo-button="${d.id}" aria-pressed="${i === 0}" aria-controls="cs-demo-${d.id}">${d.nombre}<span aria-hidden="true">↗</span></button>`).join('')}</div>
      ${demos.map((d, i) => `<figure class="cs-demo" id="cs-demo-${d.id}" data-demo-panel="${d.id}"${i ? ' hidden' : ''}>
        <a class="cs-demo-image" href="${d.url}" target="_blank" rel="noopener" aria-label="Abrir ${d.alt} en una pestaña nueva"><img src="${d.imagen}" alt="${d.alt}" width="900" height="563" loading="lazy" /></a>
        <figcaption><div><h3>${d.tipo}</h3><p>${d.texto}</p></div><a class="cs-link" href="${d.url}" target="_blank" rel="noopener">Explorar demo ${flecha}</a></figcaption>
      </figure>`).join('')}
      <p class="cs-caption">Demos de diseño. El contenido y el alcance de tu web se definen contigo.</p>
    </div>
  </section>

  <section class="cs-section cs-care" id="cs-servicio">
    <div class="cs-wrap">
      <div class="cs-section-head" data-cs-reveal><div><p class="cs-eyebrow">03 / Menos pendientes</p><h2>Tu negocio, contigo.<br /><span>Tu web, con nosotros.</span></h2></div><p>No tienes que reservar tiempo para aprender a editar una página. Hay un equipo que se encarga de construirla y acompañarte después.</p></div>
      <div class="cs-service-list">
        <article data-cs-reveal><span>01</span><h3>Diseño que te representa</h3><p>Una estructura, textos e imágenes pensados para presentar tu negocio en celular y computador.</p></article>
        <article data-cs-reveal><span>02</span><h3>Todo listo para publicar</h3><p>Hosting, conexión de tu dominio y certificado de seguridad. Coordinamos la salida en línea.</p></article>
        <article data-cs-reveal><span>03</span><h3>Contenido al día</h3><p>¿Cambió tu horario, una foto o un servicio? Pídenos los ajustes menores sobre tu sitio.</p></article>
        <article data-cs-reveal><span>04</span><h3>Personas que responden</h3><p>Soporte directo para resolver dudas y mantener tu web funcionando durante el plan.</p></article>
      </div>
      <div class="cs-care-footer"><p>Una sola suscripción.<br /><span>Desde el diseño hasta el cuidado.</span></p><a class="cs-button cs-button-light" href="#planes-sites">Ver qué incluye ${flecha}</a></div>
    </div>
  </section>

  <section class="cs-section cs-team">
    <div class="cs-wrap cs-split">
      <div data-cs-reveal><p class="cs-eyebrow">04 / Del otro lado</p><h2>Tecnología ágil.<br /><span class="cs-muted">Trato humano.</span></h2><p class="cs-team-copy">Usamos tecnología e inteligencia artificial para agilizar el trabajo. El criterio de diseño, la revisión y el acompañamiento siguen en manos de personas.</p><a class="cs-link" href="/equipo/">Conoce a Cóndor ${flecha}</a></div>
      <div class="cs-people" data-cs-reveal>${personas.map(p => `<a href="/equipo/${p.slug}.html" class="cs-person"><img src="/assets/${p.foto}" alt="${p.nombre}" width="400" height="400" loading="lazy" /><h3>${p.nombre}</h3><p>${p.rol}</p></a>`).join('')}</div>
    </div>
  </section>

  <section class="cs-section cs-pricing" id="planes-sites">
    <div class="cs-wrap">
      <div class="cs-section-head" data-cs-reveal><div><p class="cs-eyebrow">05 / Un siguiente paso posible</p><h2>Tu web resuelta.<br />Tu inversión, clara.</h2></div><p>Mismo servicio, dos formas de pagar. Elige tu país para comparar el valor mensual con el ahorro de contratar todo el año.</p></div>
      <fieldset class="cs-countries"><legend>País y moneda</legend><div>${PRECIOS_SITES.map(p => `<label><input type="radio" name="cs-country" value="${p.id}" aria-controls="cs-price-${p.id}"${p.id === 'cl' ? ' checked' : ''} /><span>${p.pais}<small>${p.moneda}</small></span></label>`).join('')}</div></fieldset>
      <p class="cs-selection" id="cs-price-status" aria-live="polite" aria-atomic="true">Precios para Chile en CLP · IVA incluido</p>
      <div id="cs-price-panels">${PRECIOS_SITES.map(p => planes(p, wsp)).join('')}</div>
      <div class="cs-included"><h3>En ambos planes</h3><ul><li>Diseño y creación del sitio</li><li>Versión móvil y escritorio</li><li>Hosting y certificado SSL</li><li>Conexión de dominio propio</li><li>Cambios menores de contenido</li><li>Soporte y administración</li></ul></div>
      <p class="cs-pricing-footnote">El registro y la renovación del dominio, las herramientas de terceros y las funcionalidades nuevas se cotizan por separado. Antes de empezar, confirmamos el alcance contigo.</p>
      <noscript><p class="cs-noscript">Sin JavaScript puedes consultar todas las tarifas a continuación. Escríbenos para elegir tu plan.</p><style>.sites-page .cs-price-panel[hidden]{display:grid!important}.sites-page .cs-price-panel{margin-bottom:32px}.sites-page .cs-countries{display:none}</style></noscript>
    </div>
  </section>

  <section class="cs-section cs-start">
    <div class="cs-wrap"><div class="cs-section-head" data-cs-reveal><div><p class="cs-eyebrow">06 / Nos encargamos juntos</p><h2>De “lo tengo pendiente”<br />a “ya está en línea”.</h2></div><a class="cs-link" href="${contacto}" target="_blank" rel="noopener">Cuéntanos tu idea ${flecha}</a></div>
      <div class="cs-steps"><article data-cs-reveal><span>01</span><h3>Conversemos.</h3><p>Nos cuentas qué haces, qué necesitas y qué material tienes. Definimos el alcance y el plazo.</p></article><article data-cs-reveal><span>02</span><h3>Lo ves antes.</h3><p>Preparamos tu sitio y te mostramos un borrador. Lo revisamos contigo y hacemos los ajustes acordados.</p></article><article data-cs-reveal><span>03</span><h3>Seguimos contigo.</h3><p>Publicamos bajo tu dominio. Tu plan mantiene el soporte, la administración y los cambios de contenido.</p></article></div>
    </div>
  </section>

  <section class="cs-section cs-faq"><div class="cs-wrap cs-split"><div data-cs-reveal><p class="cs-eyebrow">Antes de decidir</p><h2>Hablemos claro.</h2><p class="cs-faq-intro">Tu web debería darte tranquilidad desde el primer día.</p></div><div>${preguntas.map(([q,a]) => `<details><summary>${q}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`).join('')}</div></div></section>

  <section class="cs-final"><div class="cs-wrap" data-cs-reveal><p class="cs-eyebrow">Cóndor Sites</p><h2>Tu negocio está listo.<br /><span>Hagamos que se vea.</span></h2><div><a class="cs-button cs-button-light" href="${contacto}" target="_blank" rel="noopener">Hablemos de tu web ${flecha}</a><a class="cs-link" href="/agendar">Prefiero agendar una reunión ${flecha}</a></div><p>Una primera conversación para conocerte y definir el siguiente paso. Sin compromiso.</p></div></section>
</main>
` + pie.replace('</body>', jsComun + '</body>');
}
