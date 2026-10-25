/* Páginas del sitio: inicio, servicios, equipo, contacto y agendar. */
import { readFileSync } from "node:fs";
import {
  SITIO, CORREO, WSP, WSP_VISIBLE, wsp, PAISES, PRECIOS, COMISION_ECOMMERCE, DESCUENTO_ANUAL,
  dinero, anual, SERVICIOS, ORDEN_SERVICIOS, desdeServicio, EQUIPO, TRABAJOS, FAQ,
} from "./datos.mjs";
import { pagina, esc, flecha, selectorPais, franjaMarcas, faqHtml, faqJsonLd, cierre, cabSeccion, personaHtml } from "./plantilla.mjs";

const check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

/* ══════════════════════════════ INICIO ══════════════════════════════ */
function tarjetaServicio(s, i) {
  const desde = PAISES.map((p, k) => {
    const [a, b] = desdeServicio(s.clave, p.id);
    return `<span data-p="${p.id}"${k ? " hidden" : ""}>${a}<small>${b}</small></span>`;
  }).join("");
  return `<article class="momento revelar" style="--d:${i * 0.08}s">
    <div class="momento-cab"><span class="num">${s.num} · ${s.momento.toUpperCase()}</span><img class="ico" src="${s.icono}" alt="" width="64" height="64"></div>
    <div><h3>${s.nombre}</h3><p class="pregunta" style="margin-top:8px">${s.pregunta}</p></div>
    <p class="tenue" style="font-size:var(--cn-t-15)">${s.resumen}</p>
    <ul>${s.puntos.map((p) => `<li>${p}</li>`).join("")}</ul>
    <div class="momento-pie"><span class="desde">${desde}</span><a class="btn chico suave" href="${s.href}">Ver ${s.nombre.replace("Cóndor ", "")} ${flecha}</a></div>
  </article>`;
}

export function inicio() {
  const cuerpo = `
<section class="hero foto">
  <picture class="hero-fondo" aria-hidden="true"><source media="(max-width: 760px)" srcset="/assets/hero/hero-office-mobile.webp"><img src="/assets/hero/hero-office-panorama.webp" alt="" width="1920" height="900" fetchpriority="high"></picture>
  <div class="wrap">
    <div class="hero-texto">
      <p class="rotulo" style="margin-bottom:22px">Cóndor AI · Chile · Perú · Colombia · México · Argentina</p>
      <h1>Te escribieron.<span class="azul">¿Quién respondió?</span></h1>
      <p class="bajada">Hacemos tu web, tu tienda online y el sistema que atiende, agenda y da seguimiento a cada cliente que llega. Para que ninguno se enfríe.</p>
      <div class="hero-acciones">
        <a class="btn blanco" href="/agendar/">Agendar una reunión ${flecha}</a>
        <a class="btn suave" href="#como">Ver cómo trabajamos</a>
      </div>
      <p class="hero-nota">Primera reunión de treinta minutos, sin compromiso.</p>
    </div>
    <div class="cifras">
      <div class="cifra"><b>+2 años</b><span>de recorrido construyendo para negocios de la región</span></div>
      <div class="cifra"><b>+50 millones</b><span>generados a nuestros clientes</span></div>
      <div class="cifra"><b>+15 personas</b><span>en el equipo detrás de cada proyecto</span></div>
    </div>
  </div>
</section>

${franjaMarcas()}

<section class="seccion" id="soluciones">
  <div class="wrap">
    ${cabSeccion({ rotulo: "Lo que hacemos", titulo: "Un cliente pasa por tres momentos. Estamos en los tres.", bajada: "Primero te encuentra, después te compra y, si todo sale bien, vuelve. Cada servicio cubre uno de esos momentos, y funcionan mejor juntos." })}
    ${selectorPais()}
    <div class="momentos">${ORDEN_SERVICIOS.map((c, i) => tarjetaServicio(SERVICIOS[c], i)).join("")}</div>
  </div>
</section>

<section class="seccion hundida" id="como">
  <div class="wrap">
    ${cabSeccion({ rotulo: "Cómo trabajamos", titulo: "Primero escuchamos. Después lo dejamos por escrito.", bajada: "Sin presentaciones de venta ni letra chica. Así se ve el camino, de la primera reunión a la entrega." })}
    <div class="pasos">
      <div class="paso revelar"><h3>Conversamos</h3><p>Treinta minutos, por videollamada o presencial en Santiago. Nos cuentas qué te está costando tiempo o clientes.</p></div>
      <div class="paso revelar" style="--d:.08s"><h3>Propuesta por escrito</h3><p>Alcance, plazo y valor, sin letra chica. Si no somos la empresa indicada, te lo decimos en esa misma reunión.</p></div>
      <div class="paso revelar" style="--d:.16s"><h3>Construimos</h3><p>Diseñamos, publicamos y conectamos lo que necesitas. Ves un borrador antes de que salga al aire.</p></div>
      <div class="paso revelar" style="--d:.24s"><h3>Te acompañamos</h3><p>Soporte, ajustes y reportes. Tu negocio sigue cambiando y tu sistema cambia con él.</p></div>
    </div>
  </div>
</section>

<section class="seccion" id="trabajos">
  <div class="wrap">
    ${cabSeccion({ rotulo: "Trabajos", titulo: "Sitios reales, en línea hoy." })}
    <div class="trabajos">${TRABAJOS.map((t, i) => `<a class="trabajo revelar" style="--d:${(i % 2) * 0.06}s" href="${t.url}" target="_blank" rel="noopener">
      <div class="captura"><img src="${t.img}" alt="Sitio de ${esc(t.marca)}" width="1280" height="800" loading="lazy"></div>
      <div class="trabajo-txt"><span class="rotulo">${esc(t.tipo)}</span><h3>${esc(t.marca)}</h3><p>${t.texto}</p></div><span class="ir" aria-hidden="true">↗</span></a>`).join("")}</div>
  </div>
</section>

<section class="seccion oscura">
  <div class="wrap">
    ${cabSeccion({ rotulo: "De frente", titulo: "Lo que normalmente se esconde, aquí está a la vista." })}
    <div class="frente">
      <article class="revelar"><h3>Precio y plazo por escrito</h3><p>Antes de empezar recibes una propuesta con alcance, plazo y valor. Nada se cobra sin que lo hayas aceptado.</p></article>
      <article class="revelar" style="--d:.06s"><h3>Tu dominio es tuyo</h3><p>El dominio y sus accesos quedan a nombre de tu empresa. Nosotros lo conectamos, no te lo quedamos.</p></article>
      <article class="revelar" style="--d:.12s"><h3>Si dejas de pagar</h3><p>Como nosotros administramos el hosting, el sitio se da de baja. Te entregamos la carpeta del proyecto y las credenciales de todo lo que usamos, para que lo vuelvas a publicar con quien quieras. <a href="/legal/cancelacion/">Política completa ${flecha}</a></p></article>
      <article class="revelar" style="--d:.18s"><h3>Lo que se cotiza aparte</h3><p>Los ajustes menores van incluidos. Funciones nuevas, integraciones y rediseños completos se cotizan antes de trabajar, nunca después.</p></article>
    </div>
  </div>
</section>

<section class="seccion">
  <div class="wrap">
    ${cabSeccion({ rotulo: "El equipo", titulo: "Cinco cabezas visibles. Más de quince personas detrás.", bajada: "Cada proyecto lo responde una persona con nombre y cargo. Y detrás, un equipo completo que lo hace posible." })}
    <div class="revelar" style="display:flex;flex-wrap:wrap;align-items:center;gap:24px">
      <div class="mini-equipo">${EQUIPO.map((p) => `<span class="foto">${p.foto ? `<img src="${p.foto}" alt="${esc(p.nombre)}" loading="lazy">` : esc(p.iniciales)}</span>`).join("")}</div>
      <a class="btn suave" href="/equipo/">Conocer al equipo ${flecha}</a>
    </div>
  </div>
</section>

<section class="seccion hundida">
  <div class="wrap faq">
    <div class="revelar"><p class="rotulo" style="margin-bottom:14px">Preguntas frecuentes</p><h2 class="titulo">Antes de decidir.</h2><p class="bajada" style="margin-top:16px">Lo que más nos preguntan, sin rodeos. Si falta algo, <a href="/contacto/">escríbenos</a>.</p></div>
    ${faqHtml()}
  </div>
</section>

${cierre()}`;

  return pagina({
    titulo: "Cóndor AI — Web, tienda online y CRM para tu negocio",
    desc: "Te escribieron. ¿Quién respondió? Creamos tu web, tu tienda online y el sistema que atiende, agenda y da seguimiento a cada cliente que llega.",
    ruta: "/",
    cuerpo,
    jsonld: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Cóndor AI", url: SITIO, logo: SITIO + "/condor/marca/condor-isotipo.svg", email: CORREO, telephone: WSP_VISIBLE, sameAs: ["https://www.instagram.com/condor.ai/", "https://www.tiktok.com/@condor_ai", "https://www.linkedin.com/company/condorai-development/", "https://www.facebook.com/p/Condor-ai-61589812719000/"] }),
    scripts: `<script type="application/ld+json">${faqJsonLd()}</script>`,
  });
}

/* ══════════════════════════ SERVICIOS ══════════════════════════ */
const ico = {
  pantalla: '<path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5Zm5 14.5h8"/><path d="M3 8.5h18"/>',
  servidor: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  ajuste: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.3A8 8 0 1 1 21 12Z"/>',
  mundo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  etiqueta: '<path d="M3 12V4h8l10 10-8 8Z"/><path d="M7.5 8h.01"/>',
  tarjeta: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  caja: '<path d="m3 7 9-4 9 4v10l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  megafono: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  embudo: '<path d="M3 5h18l-7 8v6l-4-2v-4Z"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  repetir: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
};
const pic = (n) => `<span class="pic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[n]}</svg></span>`;
const incluye = (lista) => `<div class="incluye">${lista.map(([i, t, d], k) => `<article class="revelar" style="--d:${(k % 3) * 0.07}s">${pic(i)}<h3>${t}</h3><p>${d}</p></article>`).join("")}</div>`;
const cadena = (lista) => `<div class="cadena">${lista.map(([t, d], i) => `<div class="eslabon revelar" style="--d:${i * 0.08}s"><span class="n">${i + 1}</span><div><b>${t}</b><span>${d}</span></div></div>`).join("")}</div>`;
const medios = '<p class="medios">Pagas con <b>Mercado Pago</b> <b>dLocal Go</b> <span>· tarjeta y los medios disponibles en tu país</span></p>';

function panelCotiza(servicio, p) {
  return `<div class="cotiza"><h3>Cotiza en tu moneda</h3><p>Todavía no publicamos precios de ${servicio} para ${p.nombre}. Cuéntanos qué necesitas y te respondemos con el valor en ${p.moneda}, por escrito.</p><a class="btn" href="${wsp(`Hola, me interesa ${servicio} en ${p.nombre}. Quiero cotizar en ${p.moneda}.`)}" target="_blank" rel="noopener">Pedir cotización por WhatsApp ${flecha}</a></div>`;
}
function preciosSites() {
  return PAISES.map((p, i) => {
    const m = PRECIOS.sites[p.id];
    let cont;
    if (!m) cont = panelCotiza("Cóndor Sites", p);
    else {
      const a = anual(m), ahorro = m * 12 - a;
      const msg = (tipo, monto) => wsp(`Hola, me interesa Cóndor Sites en ${p.nombre}. Quiero conocer el plan ${tipo} de ${monto} ${p.moneda} (${p.impuesto.toLowerCase()}).`);
      cont = `<div class="precios-grid">
        <article class="precio-card"><span class="tag">Mes a mes</span><h3>Plan mensual</h3>
          <div class="monto"><strong>${dinero(m, p.id)}</strong><span>${p.moneda} / mes</span></div>
          <p class="nota">${p.impuesto} · creación sin costo adicional</p>
          <ul><li>Diseño y publicación de tu sitio</li><li>Hosting y soporte</li><li>Hasta 4 ajustes menores por semana</li></ul>
          <a class="btn suave bloque" href="${msg("mensual", dinero(m, p.id))}" target="_blank" rel="noopener">Elegir plan mensual ${flecha}</a></article>
        <article class="precio-card dest"><span class="tag">Ahorras ${Math.round(DESCUENTO_ANUAL * 100)} %</span><h3>Plan anual</h3>
          <div class="monto"><strong>${dinero(a, p.id)}</strong><span>${p.moneda} / año</span></div>
          <p class="nota">${p.impuesto} · equivale a ${dinero(a / 12, p.id)} al mes. Ahorras ${dinero(ahorro, p.id)} frente a 12 mensualidades.</p>
          <ul><li>Todo lo del plan mensual</li><li>Pagas los 12 meses por adelantado</li><li>Mantienes esa tarifa durante el período</li></ul>
          <a class="btn bloque" href="${msg("anual", dinero(a, p.id))}" target="_blank" rel="noopener">Elegir plan anual ${flecha}</a></article>
      </div>`;
    }
    return `<div class="precios-panel" data-p="${p.id}"${i ? " hidden" : ""}>${cont}</div>`;
  }).join("");
}
function preciosEcommerce() {
  return PAISES.map((p, i) => {
    const m = PRECIOS.ecommerce[p.id];
    let cont;
    if (!m) cont = panelCotiza("Cóndor Ecommerce", p);
    else cont = `<div class="precios-grid">
      <article class="precio-card dest"><span class="tag">Base mensual</span><h3>Tu tienda, administrada</h3>
        <div class="monto"><strong>${dinero(m, p.id)}</strong><span>${p.moneda} / mes</span></div>
        <p class="nota">${p.impuesto}. Construcción y administración de tu ecommerce, con el alcance acordado antes de comenzar.</p>
        <a class="btn bloque" href="${wsp(`Hola, me interesa Cóndor Ecommerce en ${p.nombre}. Quiero conversar sobre mi tienda (${dinero(m, p.id)} ${p.moneda} al mes + ${COMISION_ECOMMERCE} por venta facturada).`)}" target="_blank" rel="noopener">Conversemos sobre tu tienda ${flecha}</a></article>
      <article class="precio-card"><span class="tag">Por venta facturada</span><h3>Comisión</h3>
        <div class="monto"><strong>${COMISION_ECOMMERCE}</strong><span>por venta</span></div>
        <p class="nota">Incluye la gestión de paid media, sin honorarios adicionales. El presupuesto de anuncios se acuerda contigo antes de activar campañas. Se desglosa en tu reporte mensual.</p></article>
    </div>`;
    return `<div class="precios-panel" data-p="${p.id}"${i ? " hidden" : ""}>${cont}</div>`;
  }).join("");
}

const CONTENIDO = {
  sites: {
    titulo: "Cóndor Sites — Tu web, publicada y mantenida | Cóndor AI",
    desc: "Sitio web propio con diseño a tu medida, hosting y soporte incluidos, sin costo de creación. Plan mensual o anual en la moneda de tu país.",
    h1: "Tu web, trabajando para ti.",
    bajada: "Diseñamos, publicamos y mantenemos tu sitio. Tú te preocupas de tu negocio; quien te busque, te encuentra.",
    problema: { titulo: "Una web que existe no es una web que trabaja.", bajada: "Casi siempre pasa igual, y casi nunca por el precio.", pasos: [
      ["Alguien te recomienda", "Lo primero que hace es buscarte en Google."],
      ["Encuentra poco, o algo viejo", "Un sitio lento, desactualizado o directamente nada. La duda aparece en segundos."],
      ["Se va con quien se explicó mejor", "No fue por precio. Fue por confianza."],
    ] },
    incluye: [
      ["pantalla", "Diseño a tu medida", "Una web pensada para tu negocio, que se ve bien en celular y en computador."],
      ["servidor", "Hosting y soporte", "Nosotros lo publicamos y lo mantenemos en línea. Si algo falla, nos escribes."],
      ["ajuste", "Hasta 4 ajustes por semana", "Textos, imágenes, horarios y datos de contacto. Nos pides el cambio completo y lo hacemos."],
      ["chat", "Contacto directo", "Botón de WhatsApp y formulario, para que quien te encuentra pueda escribirte en un clic."],
      ["mundo", "Dominio a tu nombre", "Si ya tienes uno, lo conectamos. Si no, te ayudamos a elegirlo. Queda a nombre de tu empresa."],
      ["etiqueta", "Sin costo de creación", "Pagas solo la mensualidad. La creación del sitio no se cobra aparte."],
    ],
    faq: ["plazos", "soporte", "dominio", "dejar-de-pagar", "contrato", "tecnologia"],
    cierre: { titulo: "Hagamos que se vea.", texto: "Cuéntanos de tu negocio y te mostramos cómo quedaría tu web." },
  },
  ecommerce: {
    titulo: "Cóndor Ecommerce — Tienda online administrada | Cóndor AI",
    desc: "Tienda online administrada de punta a punta: construcción, pagos, stock y gestión de anuncios incluida en la comisión por venta facturada.",
    h1: "Una tienda que vende, no solo que existe.",
    bajada: "Creamos y administramos tu tienda online. Si quieres, también gestionamos la publicidad para traerte compradores.",
    problema: { titulo: "Abrir la tienda es el primer paso, no el último.", bajada: "Una tienda sin seguimiento se queda abierta, pero quieta.", pasos: [
      ["Subes los productos y esperas", "La tienda está en línea. Nadie sabe que existe."],
      ["El stock y los pagos se vuelven un trabajo aparte", "Planillas, transferencias y mensajes para confirmar si queda algo."],
      ["Nadie mira los números", "Sin un reporte claro, no sabes qué vende ni qué sobra."],
    ] },
    incluye: [
      ["tarjeta", "Pagos configurados y probados", "Mercado Pago y dLocal Go, para que tu cliente pague con tarjeta y los medios de su país."],
      ["etiqueta", "Boleta electrónica", "Emisión de boleta electrónica para tus ventas en Chile."],
      ["caja", "Stock al día", "Sincronizado con tu bodega o tu sistema, sin planillas paralelas."],
      ["grafico", "Reporte mensual", "Ventas facturadas y comisión desglosadas, con el corte del mes anterior."],
      ["megafono", "Publicidad, si la quieres", "La gestión de campañas está cubierta por la comisión por venta facturada, sin honorarios aparte."],
      ["chat", "Canal directo", "Escribes por WhatsApp y te respondemos. Y una reunión de seguimiento cada trimestre."],
    ],
    faq: ["plazos", "pagos", "soporte", "dejar-de-pagar", "contrato", "paises"],
    cierre: { titulo: "¿Conversamos sobre tu tienda?", texto: "Cuéntanos qué vendes y cómo lo despachas. Te respondemos con una propuesta por escrito." },
    pasos: [
      ["Cotización", "Reunión de 30 a 45 minutos sobre tu catálogo y lo que necesitas conectar. Propuesta escrita dentro de 24 horas."],
      ["Puesta en marcha", "Pasarela de pago, construcción de la tienda y stock. Nuestro objetivo es publicar entre 7 y 10 días hábiles."],
      ["Mantención", "Reporte mensual, reunión trimestral y un canal directo por WhatsApp."],
    ],
  },
  crm: {
    titulo: "Cóndor CRM — Que ningún cliente se enfríe | Cóndor AI",
    desc: "El sistema que recibe cada consulta, responde al instante, agenda y da seguimiento hasta que el cliente decide. WhatsApp, Instagram, Facebook y formularios en un solo lugar.",
    h1: "Que ningún cliente se enfríe.",
    bajada: "Cóndor CRM recibe cada consulta, responde al instante, agenda y da seguimiento hasta que el cliente decide.",
    problema: { titulo: "El mensaje llegó. La venta se decide en cómo sigues.", bajada: "No es falta de interés. Es lo que pasa entre el primer mensaje y la respuesta.", pasos: [
      ["Te escriben cuando tú no estás", "Instagram, WhatsApp, un formulario: llegan de noche, en fin de semana, en medio de una reunión."],
      ["La respuesta tarda", "Mientras esperas, el cliente le escribe a otro."],
      ["Nadie anota ni retoma", "Quedó en «te aviso» y no hubo quien volviera a preguntar."],
      ["La conversación se enfría", "Y una consulta que costó conseguir, se pierde."],
    ] },
    incluye: [
      ["chat", "Todos los mensajes en un lugar", "WhatsApp, Instagram, Facebook, correo y formularios llegan a una sola bandeja."],
      ["reloj", "Respuesta inmediata", "Quien escribe recibe respuesta al instante, también fuera de horario."],
      ["calendario", "Agenda con recordatorios", "El cliente elige su hora y le llega el recordatorio. Tú no persigues a nadie."],
      ["embudo", "Etapas de cada oportunidad", "Ves en qué punto está cada cliente: consulta, reunión, propuesta, cierre."],
      ["repetir", "Seguimiento a quien no respondió", "Si alguien se queda en silencio, el sistema vuelve a escribirle."],
      ["grafico", "De dónde llegan tus clientes", "Reportes simples para saber qué canal te trae consultas y cuáles se cierran."],
    ],
    faq: ["plazos", "soporte", "contrato", "dejar-de-pagar", "pagos", "tecnologia"],
    cierre: { titulo: "Mira cómo quedaría en tu negocio.", texto: "Cuéntanos cómo llegan hoy tus clientes y armamos el recorrido contigo." },
    pasos: [
      ["Levantamos tu proceso", "Vemos cómo llega y cómo se atiende hoy un cliente: canales, horarios, quién responde."],
      ["Armamos el sistema", "Canales, respuestas, agenda y etapas, a la medida de tu forma de trabajar."],
      ["Probamos contigo", "Revisas el recorrido completo, como lo vería tu cliente, antes de encenderlo."],
      ["Soporte y ajustes", "Te acompañamos después: cambios, dudas y mejoras mientras tu equipo se acostumbra."],
    ],
  },
};

export function producto(clave) {
  const s = SERVICIOS[clave], c = CONTENIDO[clave];
  const precios = clave === "sites" ? preciosSites() : clave === "ecommerce" ? preciosEcommerce() : null;
  const pasos = c.pasos || [
    ["Conversamos", "Treinta minutos para entender qué necesitas. Sin presentaciones de venta."],
    ["Propuesta por escrito", "Alcance, plazo y valor, antes de empezar."],
    ["Construimos y publicamos", "Ves un borrador antes de que salga al aire."],
    ["Te acompañamos", "Soporte y ajustes mes a mes."],
  ];
  const seccionPrecios = clave === "crm"
    ? `<section class="seccion hundida" id="precios"><div class="wrap">${cabSeccion({ rotulo: "Cuánto cuesta", titulo: "Un valor a tu medida, por escrito.", bajada: "El precio depende de tus canales y de cuántas personas atienden. Lo definimos juntos en la reunión y queda en la propuesta." })}
        <div class="cotiza revelar"><h3>Cotización a tu medida</h3><p>Sin planes genéricos: partimos de cómo llegan hoy tus clientes y armamos solo lo que necesitas.</p><a class="btn" href="${wsp("Hola, me interesa Cóndor CRM. Quiero conversar sobre cómo atiendo hoy a mis clientes.")}" target="_blank" rel="noopener">Pedir una cotización ${flecha}</a></div>
        ${medios}</div></section>`
    : `<section class="seccion hundida" id="precios"><div class="wrap">${cabSeccion({ rotulo: "Cuánto cuesta", titulo: clave === "sites" ? "Un precio claro, en la moneda de tu país." : "Tu tienda, con un precio claro." })}
        ${selectorPais("Precios para")}${precios}${medios}</div></section>`;
  const cuerpo = `
<section class="prod-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><span>${s.nombre}</span></div>
  <div class="prod-hero-grid">
    <div>
      <p class="rotulo" style="margin-bottom:18px">${s.num} · ${s.momento}</p>
      <h1>${c.h1}</h1>
      <p class="bajada">${c.bajada}</p>
      <div class="hero-acciones"><a class="btn" href="/agendar/">Agendar una reunión ${flecha}</a><a class="btn suave" href="#precios">Ver precios</a></div>
    </div>
    <div class="prod-icono"><img src="${s.icono}" alt="${s.nombre}"></div>
  </div>
</div></section>

<section class="seccion" style="padding-top:clamp(24px,4vw,48px)"><div class="wrap problema">
  <div class="revelar"><p class="rotulo" style="margin-bottom:14px">El problema</p><h2 class="titulo">${c.problema.titulo}</h2><p class="bajada" style="margin-top:16px">${c.problema.bajada}</p></div>
  ${cadena(c.problema.pasos)}
</div></section>

<section class="seccion hundida"><div class="wrap">
  ${cabSeccion({ rotulo: "Qué incluye", titulo: "Lo que recibes con " + s.nombre + "." })}
  ${incluye(c.incluye)}
</div></section>

${seccionPrecios}

<section class="seccion"><div class="wrap">
  ${cabSeccion({ rotulo: "Cómo se construye", titulo: "Paso a paso, sin sorpresas." })}
  <div class="pasos c${Math.min(pasos.length, 4)}">${pasos.map(([t, d], i) => `<div class="paso revelar" style="--d:${i * 0.08}s"><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
</div></section>

<section class="seccion hundida"><div class="wrap faq">
  <div class="revelar"><p class="rotulo" style="margin-bottom:14px">Preguntas frecuentes</p><h2 class="titulo">Antes de decidir.</h2><p class="bajada" style="margin-top:16px">Lo que más nos preguntan sobre ${s.nombre}. ¿Te falta algo? <a href="/contacto/">Escríbenos</a>.</p></div>
  ${faqHtml(c.faq)}
</div></section>

${cierre({ titulo: c.cierre.titulo, texto: c.cierre.texto, mensaje: `Hola, me interesa ${s.nombre}.` })}`;
  return pagina({ titulo: c.titulo, desc: c.desc, ruta: s.href, cuerpo, scripts: `<script type="application/ld+json">${faqJsonLd(c.faq)}</script>` });
}

/* ══════════════════════════ EQUIPO ══════════════════════════ */
export function equipo() {
  const n = (k) => EQUIPO.filter((p) => p.nivel === k).map(personaHtml).join("");
  const cuerpo = `
<section class="texto-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><span>Equipo</span></div>
  <p class="rotulo" style="margin-bottom:18px">El equipo</p>
  <h1>Personas con nombre y cargo detrás de tu proyecto.</h1>
  <p class="bajada">Cinco responsables y, detrás, un equipo de más de quince personas. Cuando trabajas con Cóndor sabes quién responde por cada parte.</p>
</div></section>
<section class="seccion" style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="organigrama">
    <div class="nivel n1">${n(1)}</div>
    <div class="conector"></div>
    <div class="nivel n2">${n(2)}</div>
    <div class="conector"></div>
    <div class="nivel n3">${n(3)}</div>
  </div>
  <div class="nota-equipo revelar"><b>+15</b><p>personas trabajan detrás de estas cinco cabezas: diseño, construcción, soporte y atención. Más de dos años de recorrido y más de 50 millones generados a nuestros clientes.</p></div>
</div></section>
${cierre({ titulo: "Conversemos.", texto: "Cuéntanos de tu negocio y te presentamos a quien trabajaría contigo." })}`;
  return pagina({ titulo: "Equipo — Cóndor AI", desc: "Conoce a quienes lideran Cóndor AI: dirección, operación, sistemas, marca e implementación. Más de 15 personas detrás de cada proyecto.", ruta: "/equipo/", cuerpo });
}

/* ══════════════════════════ CONTACTO ══════════════════════════ */
export function contacto() {
  const cuerpo = `
<section class="texto-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><span>Contacto</span></div>
  <h1>Las buenas ideas empiezan conversando.</h1>
  <p class="bajada">La vía más directa es una reunión de treinta minutos. Al terminar tendrás un diagnóstico del problema y una propuesta de alcance, sin compromiso.</p>
</div></section>
<section class="seccion" style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="vias">
    <div class="via revelar"><span class="rotulo">Vía 01</span><h3>Reunión</h3><p>Treinta minutos, por videollamada o presencial en nuestra oficina en Santiago. Es la forma más rápida de saber si podemos ayudar.</p><a class="btn" href="/agendar/" style="justify-self:start">Agendar una reunión</a></div>
    <div class="via revelar" style="--d:.07s"><span class="rotulo">Vía 02</span><h3>Correo</h3><p>Para propuestas formales o consultas con adjuntos. Respondemos el mismo día hábil.</p><a class="valor" href="mailto:${CORREO}">${CORREO}</a></div>
    <div class="via revelar" style="--d:.14s"><span class="rotulo">Vía 03</span><h3>WhatsApp</h3><p>Para consultas breves. Es el mismo número de atención comercial que usamos en todo el sitio.</p><a class="valor" href="https://wa.me/${WSP}" target="_blank" rel="noopener">${WSP_VISIBLE}</a></div>
  </div>
  <div class="frente" style="margin-top:44px"><article class="revelar"><h3>Antes de escribir</h3><p>No hace falta que traigas un requerimiento redactado ni un presupuesto definido. Con que puedas describir lo que hoy te cuesta tiempo o clientes, alcanza para la primera conversación.</p></article>
  <article class="revelar" style="--d:.07s"><h3>Si no somos los indicados</h3><p>Si después de la reunión concluimos que no somos la empresa adecuada para tu problema, te lo decimos en esa misma reunión.</p></article></div>
</div></section>`;
  return pagina({ titulo: "Contacto — Cóndor AI", desc: `Agenda una reunión de treinta minutos, escríbenos a ${CORREO} o por WhatsApp al ${WSP_VISIBLE}.`, ruta: "/contacto/", cuerpo });
}

/* ══════════════════════════ AGENDAR ══════════════════════════
   El formulario, la función de Supabase y los ids vienen de public/condor/agenda.js
   (el mismo script de siempre): solo cambia la cáscara. */
export function agendar() {
  const cuerpo = `
<section class="texto-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><span>Agendar</span></div>
  <h1>Agenda una reunión.</h1>
  <p class="bajada">Treinta minutos, por videollamada o presencial en nuestra oficina en Santiago. Al terminar tendrás un diagnóstico del problema y una propuesta de alcance, sin compromiso.</p>
</div></section>
<div class="wrap ag-grid">
  <form id="agForm" class="ag-form" autocomplete="on">
    <div class="ag-campo"><label for="ag_nombre">Nombre y apellido</label><input id="ag_nombre" name="nombre" type="text" maxlength="80" required placeholder="Nombre y apellido"></div>
    <div class="ag-campo"><label for="ag_wsp">WhatsApp</label><input id="ag_wsp" name="whatsapp" type="tel" maxlength="20" required placeholder="+56 9 1234 5678"></div>
    <div class="ag-campo"><label for="ag_email">Correo</label><input id="ag_email" name="email" type="email" maxlength="120" required placeholder="tucorreo@empresa.cl"></div>
    <div class="ag-campo"><label>Día y hora</label>
      <div class="ag-cal" id="agCal">
        <div class="ag-cal-head"><button type="button" class="ag-cal-nav" id="agCalAnt" aria-label="Mes anterior">←</button><span class="ag-cal-mes" id="agCalMes"></span><button type="button" class="ag-cal-nav" id="agCalSig" aria-label="Mes siguiente">→</button></div>
        <div class="ag-cal-semana"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
        <div class="ag-cal-dias" id="agCalDias"></div>
        <div class="ag-cal-horas" id="agCalHoras" hidden></div>
      </div>
      <p class="ag-cal-elegido" id="agCalElegido">Elige un día para ver las horas disponibles.</p>
      <input type="hidden" id="ag_fecha" name="fecha" required><input type="hidden" id="ag_hora" name="hora" required>
    </div>
    <div class="ag-campo"><label for="ag_msg">Cuéntanos brevemente sobre tu negocio <span>(opcional)</span></label><textarea id="ag_msg" name="mensaje" maxlength="600" rows="4" placeholder="Qué te está costando tiempo o clientes"></textarea></div>
    <input id="ag_web" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn bloque" type="submit" id="agBtn" disabled>Agendar la reunión</button>
    <p id="agMsg" class="ag-msg" role="status" aria-live="polite"></p>
    <p class="ag-nota">Al agendar aceptas que usemos estos datos para contactarte. Más en nuestra <a href="/legal/privacidad/">política de privacidad</a>.</p>
  </form>
  <aside class="ag-lado">
    <h3>Qué pasa después</h3>
    <div class="ag-pasos">
      <div><b>01</b><span>Recibes la confirmación por WhatsApp, normalmente el mismo día.</span></div>
      <div><b>02</b><span>En la reunión revisamos lo que quieres resolver, sin presentación de ventas.</span></div>
      <div><b>03</b><span>Al terminar te enviamos un alcance escrito con plazos y valor.</span></div>
    </div>
    <h3 style="margin-top:20px">Otras vías</h3>
    <a class="ag-via" href="mailto:${CORREO}">${CORREO}</a>
    <a class="ag-via" href="https://wa.me/${WSP}" target="_blank" rel="noopener">${WSP_VISIBLE}</a>
    <p class="ag-nota">Atendemos de lunes a sábado, entre 09:00 y 20:30.</p>
  </aside>
</div>`;
  return pagina({ titulo: "Agendar una reunión — Cóndor AI", desc: "Agenda una reunión de treinta minutos con Cóndor AI. Al terminar tendrás un diagnóstico y una propuesta de alcance, sin compromiso.", ruta: "/agendar/", cuerpo, scripts: '<script src="/condor/agenda.js" defer></script>' });
}
