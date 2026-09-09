import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PRECIOS_SITES } from './sitios-landing.mjs';

const arrow = '<span aria-hidden="true">↗</span>';
const solutions = [
  { id: 'sites', need: 'Quiero una web\nque me represente.', name: 'Cóndor Sites', text: 'Un lugar propio para mostrar lo que haces y hacer más fácil que te contacten. Nosotros lo diseñamos, publicamos y mantenemos.', includes: 'Diseño personalizado · hosting · soporte', cta: 'Ver el plan de Sites' },
  { id: 'ecommerce', need: 'Quiero vender\npor internet.', name: 'Cóndor Ecommerce', text: 'Tu catálogo, tus productos y una experiencia de compra pensada para tus clientes. Te ayudamos a llevar tu negocio a una tienda online.', includes: 'Tienda online · catálogo · integración de pagos', cta: 'Conocer Ecommerce' },
  { id: 'media', need: 'Quiero contenido\na la altura de mi marca.', name: 'Cóndor Media', text: 'Fotos, videos y piezas para comunicar mejor lo que vendes. Definimos la producción según tu marca, tus canales y tu campaña.', includes: 'Producción visual · piezas para campañas', cta: 'Conocer Media' },
  { id: 'track', need: 'Quiero dejar atrás\nlas tareas manuales.', name: 'Cóndor Track', text: 'Si las planillas y los procesos desconectados ya no alcanzan, construimos software a medida para ordenar el trabajo de tu empresa.', includes: 'Software a medida · procesos · integraciones', cta: 'Explorar una solución' },
];

export function inicioLanding({ cab, pie, jsComun, personas, wsp }) {
  const version = createHash('sha1').update(readFileSync(new URL('../public/rediseno/inicio.css', import.meta.url))).digest('hex').slice(0, 10);
  const whatsapp = `https://wa.me/${wsp}?text=${encodeURIComponent('Hola, quiero contarles lo que necesita mi negocio y conocer cómo me pueden ayudar.')}`;
  const price = PRECIOS_SITES.find(p => p.id === 'cl').mensual.toLocaleString('es-CL');
  const head = cab({ titulo: 'Cóndor AI — Tu negocio, con la tecnología que necesita', desc: 'Creamos tu web, tu tienda online, contenido y software a medida. Un equipo que construye contigo y te acompaña después. Conoce Cóndor AI.', ruta: '/' })
    .replace('</head>', `<link rel="stylesheet" href="/rediseno/inicio.css?v=${version}" /></head>`)
    .replace('class="public-editorial"', 'class="public-editorial home-page"');
  return head + `
<a class="hm-skip" href="#home-main">Saltar al contenido</a>
<main id="home-main">
  <section class="hm-hero"><div class="hm-wrap hm-hero-grid">
    <div class="hm-hero-copy">
      <p class="hm-eyebrow">Tecnología para tu negocio</p>
      <h1>Tú haces crecer<br>tu negocio.<br><span>Nosotros nos encargamos de la tecnología.</span></h1>
      <p class="hm-intro">Creamos tu web, tu tienda online y las herramientas que necesitas para operar. Un equipo que lo construye contigo y te acompaña después.</p>
      <div class="hm-actions"><a class="hm-button" href="#soluciones">Encuentra lo que necesitas <span aria-hidden="true">↓</span></a><a class="hm-text-link" href="${whatsapp}" target="_blank" rel="noopener">Conversemos por WhatsApp ${arrow}</a></div>
      <p class="hm-note">No necesitas saber de tecnología. Para eso estamos.</p>
    </div>
    <figure class="hm-hero-visual">
      <img src="/assets/hero/hero-sites.webp" alt="Ejemplo de una web inmobiliaria presentada en un computador portátil" width="1024" height="1024" fetchpriority="high" />
      <figcaption><span>De tu idea a una web propia.</span><a href="/productos/sites/">Conoce Sites ${arrow}</a></figcaption>
    </figure>
  </div></section>

  <section class="hm-trust" aria-label="Empresas que han confiado en Cóndor"><div class="hm-wrap">
    <p>Empresas que han confiado en nosotros</p>
    <div class="hm-logos">${[['tecnobox','Tecnobox'],['neisstech','Neisstech'],['delta-force','Delta Force'],['bafles-viva','Bafles Viva'],['ebi-foods','Ebi Foods']].map(([file,name])=>`<img src="/assets/clientes/${file}.png" alt="${name}" width="140" height="60" loading="lazy" />`).join('')}</div>
  </div></section>

  <section class="hm-section" id="soluciones"><div class="hm-wrap">
    <div class="hm-heading"><div><p class="hm-eyebrow">01 / Encuentra tu punto de partida</p><h2>¿Qué necesita<br><span>hoy tu negocio?</span></h2></div><p>No tienes que elegir una tecnología.<br>Empieza por lo que quieres resolver.</p></div>
    <div class="hm-solutions">${solutions.map(s=>`<article class="hm-solution">
      <div class="hm-product"><img src="/assets/productos/condor-${s.id}.png" alt="" width="40" height="40" loading="lazy" /><span>${s.name}</span></div>
      <h3>${s.need.replace('\n','<br>')}</h3><p>${s.text}</p><p class="hm-includes">${s.includes}</p>
      ${s.id === 'sites' ? `<p class="hm-price">$${price} <span>CLP / mes · IVA incluido</span></p><p class="hm-price-note">También en Perú y Colombia. Ahorra 25% con pago anual.</p>` : '<p class="hm-quote">Conoce el alcance y las opciones para tu negocio.</p>'}
      <a class="hm-text-link" href="/productos/${s.id}/">${s.cta} ${arrow}</a>
    </article>`).join('')}</div>
    <p class="hm-barbara">¿Buscas un agente de IA para el contenido de tu Instagram? <a href="/productos/barbara/">Conoce Bárbara ${arrow}</a></p>
  </div></section>

  <section class="hm-section hm-dark" id="ejemplos"><div class="hm-wrap">
    <div class="hm-heading"><div><p class="hm-eyebrow">02 / De la idea a algo concreto</p><h2>Imagínalo con<br><span>el nombre de tu negocio.</span></h2></div><p>Explora estos sitios de demostración. Son ejemplos de diseño y funcionalidades, no casos de clientes ni resultados comerciales.</p></div>
    <div class="hm-demos">
      <article><a class="hm-demo-image" href="/demos/servicios/"><img src="/assets/sitios/servicios.webp" alt="Demo de sitio de servicios: clínica dental Vértice" width="900" height="563" loading="lazy" /><span>Explorar demo ${arrow}</span></a><div class="hm-demo-title"><h3>Que te conozcan.<br>Que sepan cómo contactarte.</h3><span class="hm-tag">Demo / Servicios</span></div><p>Una presentación clara de tus servicios, información útil para decidir y un camino directo al contacto.</p></article>
      <article><a class="hm-demo-image" href="/demos/ecommerce/"><img src="/assets/sitios/ecommerce.webp" alt="Demo de tienda online con catálogo de productos" width="900" height="563" loading="lazy" /><span>Explorar demo ${arrow}</span></a><div class="hm-demo-title"><h3>De mirar tus productos<br>a encontrar el indicado.</h3><span class="hm-tag">Demo / Tienda</span></div><p>Un catálogo organizado y una experiencia de compra que pone tus productos al frente.</p></article>
    </div>
  </div></section>

  <section class="hm-section" id="como-empezamos"><div class="hm-wrap">
    <div class="hm-heading"><div><p class="hm-eyebrow">03 / Un paso a la vez</p><h2>Empezar no tiene<br><span>por qué ser complicado.</span></h2></div><p>Antes de construir, acordamos qué necesitas, qué incluye el proyecto y cómo vamos a trabajar.</p></div>
    <ol class="hm-steps">
      <li><span>01</span><h3>Nos cuentas.</h3><p>Tu negocio, lo que quieres lograr y lo que hoy te está quitando tiempo.</p></li>
      <li><span>02</span><h3>Ves una propuesta.</h3><p>Definimos la solución, el alcance, los plazos y el precio antes de empezar.</p></li>
      <li><span>03</span><h3>Lo construimos.</h3><p>Revisamos contigo el avance y coordinamos los ajustes y la puesta en marcha.</p></li>
      <li><span>04</span><h3>Te acompañamos.</h3><p>El soporte y la mantención se definen según el producto o plan que contrates.</p></li>
    </ol>
  </div></section>

  <section class="hm-section hm-team" id="equipo"><div class="hm-wrap hm-team-grid">
    <div><p class="hm-eyebrow">04 / Personas detrás de la tecnología</p><h2>Un equipo.<br><span>Del otro lado.</span></h2><p>Hablamos contigo, construimos y revisamos. La tecnología nos ayuda a avanzar; las decisiones y el acompañamiento siguen en manos de personas.</p><a class="hm-text-link" href="/equipo/">Conoce al equipo ${arrow}</a></div>
    <div class="hm-people">${personas.map(p=>`<figure><a href="/equipo/${p.slug}.html" aria-label="Conocer a ${p.nombre}"><img src="/assets/${p.foto}" alt="${p.nombre}" width="300" height="380" loading="lazy" /></a><figcaption>${p.nombre}<span>${p.rol}</span></figcaption></figure>`).join('')}</div>
  </div></section>

  <section class="hm-section hm-dark hm-contact" id="conversemos"><div class="hm-wrap">
    <p class="hm-eyebrow">El siguiente paso es una conversación</p><h2>No necesitas tener<br>todas las respuestas.<br><span>Cuéntanos tu idea.</span></h2>
    <p>Si buscas una web, podemos empezar por WhatsApp. Si necesitas una solución a medida, agenda una reunión para revisar tu proyecto.</p>
    <div class="hm-actions"><a class="hm-button hm-button-light" href="${whatsapp}" target="_blank" rel="noopener">Hablemos por WhatsApp ${arrow}</a><a class="hm-text-link" href="/agendar">Agendar una reunión ${arrow}</a></div>
  </div></section>
</main>
` + pie.replace('</body>', jsComun + '</body>');
}
