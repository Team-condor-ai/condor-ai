import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PRECIOS_SITES } from './sitios-landing.mjs';

const arrow = '<span aria-hidden="true">↗</span>';
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
  <section class="hm-welcome" aria-label="Bienvenido a Cóndor AI">
    <img class="hm-welcome-office" src="/assets/hero/hero-office.webp" alt="Visualización conceptual de una oficina de vidrio de Cóndor AI frente a la cordillera al atardecer" width="1600" height="900" fetchpriority="high" />
    <div class="hm-wrap hm-welcome-content">
      <div class="hm-welcome-brand"><img src="/assets/logo.png" alt="Cóndor AI" width="180" height="60" /></div>
      <div class="hm-welcome-message"><p class="hm-welcome-kicker">Bienvenido a Cóndor</p>
        <h1>Lo que imaginas<br>merece existir.</h1>
        <p class="hm-welcome-intro">Creemos en lo que estás construyendo.<br>Hagamos que tome forma.</p>
        <a class="hm-button" href="#soluciones">Descubre tu próximo paso <span aria-hidden="true">↓</span></a>
      </div>
      <span class="hm-welcome-disclaimer">Visualización conceptual</span>
    </div>
  </section>

  <section class="hm-trust" aria-label="Empresas que han confiado en Cóndor"><div class="hm-wrap">
    <p>Empresas que han confiado en nosotros</p>
    <div class="hm-logo-window"><div class="hm-logos">${[['tecnobox','Tecnobox'],['neisstech','Neisstech'],['delta-force','Delta Force'],['bafles-viva','Bafles Viva'],['ebi-foods','Ebi Foods']].map(([file,name])=>`<img src="/assets/clientes/${file}.png" alt="${name}" width="140" height="60" loading="lazy" />`).join('')}</div></div>
  </div></section>

  <section class="hm-section" id="soluciones"><div class="hm-wrap">
    <div class="hm-heading"><div><p class="hm-eyebrow">01 / Encuentra tu punto de partida</p><h2>¿Qué necesita<br><span>hoy tu negocio?</span></h2></div><p>No empezamos por venderte una herramienta.<br>Empezamos por entender qué vale la pena resolver.</p></div>
    <div class="hm-solutions">${solutions.map(s=>`<article class="hm-solution">
      <div class="hm-product"><img src="/assets/productos/condor-${s.id}.png" alt="" width="40" height="40" loading="lazy" /><span>${s.name}</span></div>
      <h3>${s.need.replace('\n','<br>')}</h3><p class="hm-desktop-copy">${s.text}</p><p class="hm-includes">${s.includes}</p>
      ${s.id === 'sites' ? `<p class="hm-price">$${price} <span>CLP / mes · IVA incluido</span></p><p class="hm-price-note"><span class="hm-desktop-copy">También en Perú y Colombia. </span>Ahorra 25% con pago anual.</p>` : s.id === 'ecommerce' ? '<p class="hm-price">$54.990 <span>CLP / mes · IVA incluido</span></p><p class="hm-price-note">+ 6,7% por venta facturada.<br>Paid media opcional, cotizado por separado.</p>' : s.id === 'media' ? '<p class="hm-price">$68.000 <span>CLP + IVA / video de referencia</span></p><p class="hm-price-note">30 segundos · nivel profesional · entrega estándar.<br>Calcula el valor de tu producción.</p>' : '<p class="hm-price">Desde $84.990 <span>CLP · a medida</span></p><p class="hm-price-note">Valor inicial referencial. El total, impuestos y forma de pago se definen según alcance.</p>'}
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
