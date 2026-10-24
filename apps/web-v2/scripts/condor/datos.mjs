/* Datos de condorai.cl 2.0 — una sola fuente para todas las páginas.
   Lo que no está confirmado por Max NO se inventa: se marca como «cotiza». */

export const SITIO = "https://condorai.cl";
export const WSP = "56988989824";
export const WSP_VISIBLE = "+56 9 8898 9824";
export const CORREO = "contacto@teamcondorcl.com"; // Max, 23-oct: se mantiene este correo
export const FECHA_LEGAL = "23 de octubre de 2026";

export const wsp = (texto) => `https://wa.me/${WSP}?text=${encodeURIComponent(texto)}`;

/* ── Países y precios ─────────────────────────────────────────────────
   Precios por país (24-oct-2026), con el remate comercial de cada mercado: CL 34.990 · PE S/ 119 ·
   CO 116.900 · MX $649 · AR $49.999. Chile es la referencia; los demás se ajustan por poder de
   compra sin bajar de ~90 % del precio chileno al cambio. Argentina: revisar cada mes (inflación). */
export const PAISES = [
  { id: "cl", nombre: "Chile", moneda: "CLP", impuesto: "IVA incluido", simbolo: "$", decimales: 0 },
  { id: "pe", nombre: "Perú", moneda: "PEN", impuesto: "IGV incluido", simbolo: "S/", decimales: 0 },
  { id: "co", nombre: "Colombia", moneda: "COP", impuesto: "IVA incluido", simbolo: "$", decimales: 0 },
  { id: "mx", nombre: "México", moneda: "MXN", impuesto: "IVA incluido", simbolo: "$", decimales: 0, miles: "," },
  { id: "ar", nombre: "Argentina", moneda: "ARS", impuesto: "IVA incluido", simbolo: "$", decimales: 0 },
];
export const DESCUENTO_ANUAL = 0.25;
export const PRECIOS = {
  sites: { cl: 34990, pe: 119, co: 116900, mx: 649, ar: 49999 },
  ecommerce: { cl: 54990, pe: 189, co: 179900, mx: 999, ar: 79999 },
};
export const COMISION_ECOMMERCE = "6,7 %";

export function dinero(valor, paisId) {
  const p = PAISES.find((x) => x.id === paisId);
  const [entero, dec] = valor.toFixed(p.decimales).split(".");
  return p.simbolo + entero.replace(/\B(?=(\d{3})+(?!\d))/g, p.miles || ".") + (dec ? "," + dec : "");
}
export const anual = (mensual) => Math.round(mensual * 12 * (1 - DESCUENTO_ANUAL) * 100) / 100;

/* ── Navegación ─────────────────────────────────────────────────────── */
export const NAV = [
  { href: "/productos/crm/", texto: "CRM" },
  { href: "/productos/ecommerce/", texto: "Ecommerce" },
  { href: "/productos/sites/", texto: "Sites" },
  { href: "/#trabajos", texto: "Trabajos" },
  { href: "/equipo/", texto: "Equipo" },
  { href: "/blog/", texto: "Blog" },
];

/* ── Servicios (los tres que Max dejó, 23-oct) ───────────────────────── */
export const SERVICIOS = {
  sites: {
    clave: "sites", href: "/productos/sites/", nombre: "Cóndor Sites", icono: "/condor/marca/producto-sites.svg",
    momento: "Te encuentran", num: "01",
    pregunta: "¿Tu web existe… o trabaja?",
    resumen: "Tu sitio web, publicado y mantenido por nosotros. Quien te busca encuentra quién eres, qué haces y cómo escribirte.",
    puntos: ["Diseño propio para tu negocio", "Hosting y soporte incluidos", "Ajustes menores cada mes", "Sin costo de creación"],
  },
  ecommerce: {
    clave: "ecommerce", href: "/productos/ecommerce/", nombre: "Cóndor Ecommerce", icono: "/condor/marca/producto-ecommerce.svg",
    momento: "Te compran", num: "02",
    pregunta: "¿Tu tienda vende o solo está abierta?",
    resumen: "Una tienda online administrada de punta a punta: construcción, pagos, stock y, si quieres, la gestión de tus campañas.",
    puntos: ["Pagos con Mercado Pago y dLocal Go", "Stock y boleta electrónica", "Reporte mensual claro", "Gestión de anuncios incluida en la comisión"],
  },
  crm: {
    clave: "crm", href: "/productos/crm/", nombre: "Cóndor CRM", icono: "/condor/marca/producto-crm.svg",
    momento: "No se enfrían", num: "03",
    pregunta: "Te escribieron. ¿Quién respondió?",
    resumen: "El sistema que recibe cada consulta, responde al instante, agenda y da seguimiento hasta que el cliente decide.",
    puntos: ["Todos los mensajes en un solo lugar", "Respuesta inmediata, de día o de noche", "Agenda con recordatorios", "Seguimiento hasta cerrar"],
  },
};
export const ORDEN_SERVICIOS = ["sites", "ecommerce", "crm"];

/* «Desde» por país para las tarjetas del inicio */
export function desdeServicio(clave, paisId) {
  const pais = PAISES.find((x) => x.id === paisId);
  if (clave === "sites") {
    const m = PRECIOS.sites[paisId];
    return m ? [`Desde ${dinero(m, paisId)} / mes`, `${pais.moneda} · ${pais.impuesto} · sin costo de creación`] : ["Cotiza en tu moneda", `Te respondemos para ${pais.nombre}`];
  }
  if (clave === "ecommerce") {
    const m = PRECIOS.ecommerce[paisId];
    return m ? [`Desde ${dinero(m, paisId)} / mes`, `${pais.moneda} · ${pais.impuesto} + ${COMISION_ECOMMERCE} por venta facturada`] : ["Cotiza para tu país", `Te respondemos para ${pais.nombre}`];
  }
  return ["Cotización a tu medida", "Según tu operación y tus canales"];
}

/* ── Equipo (roles de Cóndor 2.0, 21-oct) ───────────────────────────── */
export const EQUIPO = [
  { slug: "maximiliano", nombre: "Maximiliano Pino", rol: "Presidente y Director Estratégico", nivel: 1, foto: "/condor/equipo/maximiliano.jpg",
    texto: "Define el rumbo de Cóndor, revisa la calidad del trabajo y decide lo importante. No opera el día a día: su trabajo es que la empresa apunte bien." },
  { slug: "alejandro", nombre: "Alejandro Tobar", rol: "CEO · Gerente General", nivel: 2, foto: "/condor/equipo/alejandro.jpg",
    texto: "Lleva la operación diaria: ventas, clientes y finanzas. Es quien responde por que lo prometido llegue a tiempo." },
  { slug: "orkut", nombre: "Orkut", rol: "CTO", nivel: 3, iniciales: "O",
    texto: "Responsable de los sistemas: la arquitectura del CRM, las plantillas, las integraciones y la parte técnica de cada proyecto." },
  { slug: "kalfu", nombre: "Kalfu", rol: "CMO", nivel: 3, iniciales: "K",
    texto: "Marca y contenido: cómo se ve y cómo habla Cóndor, los guiones, el video y los textos de cada mensaje." },
  { slug: "alberto", nombre: "Alberto Huerta", rol: "Head of Automation", nivel: 3, iniciales: "AH",
    texto: "Implementa cada cliente en el sistema y da el soporte después. Trabaja junto al CTO." },
];

/* ── Marcas (Max, 23-oct). `alto` = altura en px para que todas pesen parecido.
   Sin logo en disco: Eternity Homes y Vitalen (van en texto hasta que Max mande los archivos). ── */
export const MARCAS = [
  { n: "Delta Force", logo: "/condor/clientes/delta-force.png", alto: 46 },
  { n: "Ebi Foods", logo: "/condor/clientes/ebi-foods.png", alto: 44 },
  { n: "Eternity Homes" },
  { n: "Neisstech", logo: "/condor/clientes/neisstech.png", alto: 30 },
  { n: "Optimizo", logo: "/condor/clientes/optimizo.svg", alto: 34 },
  { n: "Tecnobox", logo: "/condor/clientes/tecnobox.png", alto: 32 },
  { n: "Urpa Logístico", logo: "/condor/clientes/urpa-logistico.png", alto: 34 },
  { n: "Veci", logo: "/condor/clientes/veci.png", alto: 34, texto: true },
  { n: "Vitalen" },
  { n: "Medula", logo: "/condor/clientes/medula.svg", alto: 30, texto: true },
  { n: "Shirushi", logo: "/condor/clientes/shirushi.svg", alto: 38 },
];

/* Sitios reales y en línea (capturas del 23-oct-2026) */
export const TRABAJOS = [
  { marca: "Delta Force", tipo: "Escuela de aviación", url: "https://vueladeltaforce.com/", img: "/condor/trabajos/deltaforce.jpg",
    texto: "Captación de interesados con seguimiento." },
  { marca: "Tecnobox", tipo: "Tienda online", url: "https://tiotecnobox.cl/", img: "/condor/trabajos/tecnobox.jpg",
    texto: "Catálogo, ofertas por temporada y pago propio." },
  { marca: "Neisstech", tipo: "Soluciones industriales", url: "https://www.neisstech.com/", img: "/condor/trabajos/neisstech.jpg",
    texto: "Sitio corporativo y páginas de captación." },
  { marca: "Medula", tipo: "Sitio de producto", url: "https://medula.condorai.cl/", img: "/condor/trabajos/medula.jpg",
    texto: "El sitio de Medula, el producto de Optimizo." },
];

/* ── Preguntas frecuentes ───────────────────────────────────────────────
   Lo de «si dejas de pagar» es la política que dictó Max (23-oct). */
export const FAQ = [
  { id: "plazos", q: "¿Cuánto demora tener mi web o mi tienda?",
    a: ["El plazo depende del contenido y del alcance, y lo dejamos por escrito en la propuesta antes de empezar.", "Para una tienda online, nuestro objetivo es publicar entre 7 y 10 días hábiles desde que arranca la construcción."] },
  { id: "soporte", q: "¿Qué incluye el soporte?",
    a: ["Los ajustes menores sobre lo que ya está publicado: textos, imágenes, horarios, datos de contacto y contenido. Nos escribes por WhatsApp o correo y lo resolvemos.", "Las funciones nuevas, las integraciones y los rediseños completos se cotizan por separado, siempre antes de trabajar."] },
  { id: "cancelar", q: "¿Cómo cancelo?",
    a: ["Nos avisas por escrito, por correo o WhatsApp, y te explicamos el cierre paso a paso.", "Tienes la política completa en la página de <a href=\"/legal/cancelacion/\">cancelación</a>."] },
  { id: "dejar-de-pagar", q: "¿Qué pasa con mi web si dejo de pagar?",
    a: ["Nosotros administramos el hosting, así que si el servicio se deja de pagar, el sitio se da de baja.", "Pero no te quedas sin nada: te entregamos la carpeta completa del proyecto y las credenciales de todo lo que usamos como proveedor (hosting, DNS y lo demás), para que tú, o quien tú elijas, lo vuelva a publicar."] },
  { id: "dominio", q: "¿El dominio es mío?",
    a: ["Sí. Si ya tienes uno, lo conectamos. Si necesitas uno, te ayudamos a elegirlo y te confirmamos el costo de registro y renovación. El dominio y sus accesos quedan a nombre de tu empresa."] },
  { id: "pagos", q: "¿Cómo se paga?",
    a: ["Con Mercado Pago y dLocal Go: tarjeta y los medios de pago disponibles en tu país. Ves el precio en la moneda de tu país y lo confirmamos por escrito antes de cobrar."] },
  { id: "contrato", q: "¿Hay contrato o permanencia mínima?",
    a: ["Las condiciones de cada servicio (plazo, alcance y valor) quedan por escrito en la propuesta que aceptas. El plan mensual se paga mes a mes; el anual se paga por adelantado y tiene 25 % de descuento."] },
  { id: "paises", q: "¿Trabajan solo en Chile?",
    a: ["Atendemos desde Santiago a clientes de Chile, Perú, Colombia, México y Argentina, con precios en su moneda. Si estás en otro país de la región, escríbenos y te cotizamos."] },
  { id: "tecnologia", q: "¿Tengo que saber de tecnología?",
    a: ["No. Tú nos cuentas qué hace tu negocio y qué quieres lograr; nosotros diseñamos, publicamos y administramos."] },
];

export const REDES = [
  ["Instagram", "https://www.instagram.com/condor.ai/", '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/>'],
  ["TikTok", "https://www.tiktok.com/@condor_ai", '<path d="M15 2h3c.3 2.4 1.7 3.9 4 4.2v3.1a8.1 8.1 0 0 1-4-1.2v7.2a6.7 6.7 0 1 1-5.9-6.6V12a3.4 3.4 0 1 0 2.9 3.3V2Z"/>'],
  ["LinkedIn", "https://www.linkedin.com/company/condorai-development/", '<path d="M4 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM2.3 9h3.4v12H2.3ZM9 9h3.3v1.7C13 9.5 14.2 9 15.8 9c3.2 0 4.2 2 4.2 5v7h-3.4v-6.3c0-1.5-.3-2.8-2-2.8s-2.2 1.3-2.2 2.8V21H9Z"/>'],
  ["Facebook", "https://www.facebook.com/p/Condor-ai-61589812719000/", '<path d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.6-1.5h2V3.8c-.4-.1-1.6-.2-2.8-.2-2.8 0-4.6 1.7-4.6 4.8V10H7v3h3.2v9Z"/>'],
];
