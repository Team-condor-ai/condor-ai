import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PRECIOS_SITES } from './sitios-landing.mjs';

const arrow = '<span aria-hidden="true">↗</span>';
const heroSlides = [
  { id:'office', image:'hero-office.webp', alt:'Visualización conceptual de una oficina de vidrio con señalética Cóndor AI al atardecer', name:'AI', note:'Visualización conceptual', width:1600, height:900 },
  { id:'sites', image:'hero-sites.webp', alt:'Ejemplo de web inmobiliaria en un portátil', caption:'De tu idea a una web propia.', name:'Sites' },
  { id:'ecommerce', image:'../sitios/ecommerce.webp', alt:'Vista de la tienda de demostración Cumbre Café', caption:'Tus productos, listos para descubrir.', name:'Ecommerce' },
  { id:'media', image:'hero-media.webp', alt:'Mockup ilustrativo de producción de contenido para una marca', caption:'Contenido a la altura de tu marca.', name:'Media' },
  { id:'track', image:'hero-track.webp', alt:'Mockup ilustrativo de software para organizar una empresa', caption:'Tu operación, en un mismo lugar.', name:'Track' },
];
const solutions = [
  { id: 'sites', need: 'Quiero una web\nque me represente.', name: 'Cóndor Sites', text: 'Un lugar propio para mostrar lo que haces y hacer más fácil que te contacten. Nosotros lo diseñamos, publicamos y mantenemos.', includes: 'Diseño personalizado · hosting · soporte', cta: 'Ver el plan de Sites' },
  { id: 'ecommerce', need: 'Quiero vender\npor internet.', name: 'Cóndor Ecommerce', text: 'Una tienda para que tus productos encuentren a sus próximos clientes. Si quieres acompañarla con publicidad, también podemos gestionar campañas de paid media de forma opcional.', includes: 'Tienda online · pagos · publicidad opcional', cta: 'Conocer Ecommerce' },
  { id: 'media', need: 'Quiero contenido\na la altura de mi marca.', name: 'Cóndor Media', text: 'Fotos, videos y piezas para comunicar mejor lo que vendes. Definimos la producción según tu marca, tus canales y tu campaña.', includes: 'Producción visual · piezas para campañas', cta: 'Ver calculadora de precios' },
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
      <p class="hm-eyebrow">Lo que nos mueve</p>
      <h1><span class="hm-desktop-copy">Nos importa<br>lo que estás<br><span>construyendo.</span></span><span class="hm-mobile-copy">Nos importa<br><span>lo que estás<br>construyendo.</span></span></h1>
      <p class="hm-intro"><span class="hm-desktop-copy">Detrás de un negocio hay decisiones, esfuerzo y una forma propia de hacer las cosas. Nos mueve ayudar a que eso crezca, con tecnología que tenga sentido para ti.</span><span class="hm-mobile-copy">Tu negocio tiene una forma propia de hacer las cosas. La tecnología debería respetarla.</span></p>
      <div class="hm-actions"><a class="hm-button" href="#soluciones">Encuentra lo que necesitas <span aria-hidden="true">↓</span></a><a class="hm-text-link" href="${whatsapp}" target="_blank" rel="noopener">Conversemos por WhatsApp ${arrow}</a></div>
      <p class="hm-note">Webs, tiendas, contenido y software. Primero el propósito; después, la herramienta.</p>
    </div>
    <div class="hm-hero-visual hm-carousel" role="region" aria-roledescription="carrusel" aria-label="Servicios de Cóndor AI">
      <div class="hm-slide-stack">${heroSlides.map((s,i)=>`<figure class="hm-service-slide${i===0?' is-active':''}" data-service="${s.id}" role="group" aria-roledescription="diapositiva" aria-label="${i+1} de ${heroSlides.length}: ${s.name}"${i?' inert aria-hidden="true"':''}>
        <img src="/assets/hero/${s.image}" alt="${s.alt}" width="${s.width || 1024}" height="${s.height || 1024}" ${s.id === 'office' ? 'srcset="/assets/hero/hero-office-mobile.webp 800w, /assets/hero/hero-office.webp 1600w" sizes="(max-width: 760px) calc(100vw - 48px), 1024px"' : ''} ${i?'loading="lazy"':'fetchpriority="high"'} />
        <figcaption><span>Cóndor ${s.name}</span><span class="hm-visual-note">${s.note || 'Vista ilustrativa'}</span></figcaption>
      </figure>`).join('')}</div>
    </div>
  </div></section>

  <section class="hm-trust" aria-label="Empresas que han confiado en Cóndor"><div class="hm-wrap">
    <p>Empresas que han confiado en nosotros</p>
    <div class="hm-logo-window"><div class="hm-logos">${[['tecnobox','Tecnobox'],['neisstech','Neisstech'],['delta-force','Delta Force'],['bafles-viva','Bafles Viva'],['ebi-foods','Ebi Foods']].map(([file,name])=>`<img src="/assets/clientes/${file}.png" alt="${name}" width="140" height="60" loading="lazy" />`).join('')}</div></div>
  </div></section>

  <section class="hm-section" id="soluciones"><div class="hm-wrap">
    <div class="hm-heading"><div><p class="hm-eyebrow">01 / Encuentra tu punto de partida</p><h2>¿Qué necesita<br><span>hoy tu negocio?</span></h2></div><p>No empezamos por venderte una herramienta.<br>Empezamos por entender qué vale la pena resolver.</p></div>
    <div class="hm-solutions">${solutions.map(s=>`<article class="hm-solution">
      <div class="hm-product"><img src="/assets/productos/condor-${s.id}.png" alt="" width="40" height="40" loading="lazy" /><span>${s.name}</span></div>
      <h3>${s.need.replace('\n','<br>')}</h3><p class="hm-desktop-copy">${s.text}</p><p class="hm-includes">${s.includes}</p>
      ${s.id === 'sites' ? `<p class="hm-price">$${price} <span>CLP / mes · IVA incluido</span></p><p class="hm-price-note"><span class="hm-desktop-copy">También en Perú y Colombia. </span>Ahorra 25% con pago anual.</p>` : '<p class="hm-quote">Conoce el alcance y las opciones para tu negocio.</p>'}
      <a class="hm-text-link" href="/productos/${s.id}/${s.id === 'media' ? '#calculadora' : ''}">${s.cta} ${arrow}</a>
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
    <div class="hm-heading"><div><p class="hm-eyebrow">03 / Un paso a la vez</p><h2>Antes de construir,<br><span>hay que entender.</span></h2></div><p>No todo problema necesita más software. Conversamos sobre tu operación antes de decidir qué construir.</p></div>
    <ol class="hm-steps">
      <li><span>01</span><h3>Escuchamos.</h3><p>Qué quieres cuidar de tu negocio y qué te está impidiendo avanzar.</p></li>
      <li><span>02</span><h3>Cuestionamos.</h3><p>Revisamos los supuestos contigo. Si algo no aporta, lo dejamos fuera.</p></li>
      <li><span>03</span><h3>Decidimos contigo.</h3><p>Acordamos alcance, precio y prioridades. Revisas el trabajo mientras toma forma.</p></li>
      <li><span>04</span><h3>Te acompañamos.</h3><p>El soporte y la mantención se definen según el producto o plan que contrates.</p></li>
    </ol>
  </div></section>

  <section class="hm-section hm-team" id="equipo"><div class="hm-wrap hm-team-grid">
    <div><p class="hm-eyebrow">04 / Personas detrás de la tecnología</p><h2>Un equipo.<br><span>Del otro lado.</span></h2><p>Hablamos contigo, construimos y revisamos. La tecnología nos ayuda a avanzar; las decisiones y el acompañamiento siguen en manos de personas.</p><a class="hm-text-link" href="/equipo/">Conoce al equipo ${arrow}</a></div>
    <div class="hm-people">${personas.map(p=>`<figure><a href="/equipo/${p.slug}.html" aria-label="Conocer a ${p.nombre}"><img src="/assets/${p.foto}" alt="${p.nombre}" width="300" height="380" loading="lazy" /></a><figcaption>${p.nombre}<span>${p.rol}</span></figcaption></figure>`).join('')}</div>
  </div></section>

  <section class="hm-section hm-dark hm-contact" id="conversemos"><div class="hm-wrap">
    <p class="hm-eyebrow">Una forma de trabajar, no solo un servicio</p><h2>Podemos hacer<br><span>buen equipo si…</span></h2>
    <p>Te interesa entender las decisiones, puedes involucrarte en el proceso y prefieres una conversación honesta a un sí automático.</p>
    <div class="hm-actions"><a class="hm-button hm-button-light" href="${whatsapp}" target="_blank" rel="noopener">Conversemos sobre tu negocio ${arrow}</a><a class="hm-text-link" href="/agendar">Agendar una reunión ${arrow}</a></div>
  </div></section>
</main>
` + pie.replace('</body>', jsComun + '<script src="/rediseno/inicio.js?v=' + createHash('sha1').update(readFileSync(new URL('../public/rediseno/inicio.js', import.meta.url))).digest('hex').slice(0,10) + '"></script></body>');
}
