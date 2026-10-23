/* Páginas legales. Redactadas desde lo que Cóndor realmente hace y lo que Max definió (23-oct-2026).
   No inventan razón social, RUT ni condiciones que la empresa no haya fijado: lo que depende de
   cada contrato remite a «la propuesta que aceptas». Conviene que un abogado las revise. */
import { CORREO, WSP_VISIBLE, FECHA_LEGAL } from "./datos.mjs";
import { pagina } from "./plantilla.mjs";

const marco = ({ titulo, desc, ruta, bajada, html }) => pagina({
  titulo: `${titulo} — Cóndor AI`, desc, ruta,
  cuerpo: `<section class="texto-hero"><div class="wrap"><div class="migas"><a href="/">Inicio</a><span>/</span><span>${titulo}</span></div>
  <h1>${titulo}</h1><p class="bajada">${bajada}</p><p class="actualizado">Última actualización: ${FECHA_LEGAL}</p></div></section>
  <div class="wrap"><div class="prosa">${html}</div></div>`,
});

export const cancelacion = () => marco({
  titulo: "Política de cancelación", ruta: "/legal/cancelacion/",
  desc: "Cómo cancelar un servicio de Cóndor AI y qué pasa con tu sitio, tu dominio y tu información si el servicio se deja de pagar.",
  bajada: "Cómo se termina una relación con Cóndor, dicho de frente: qué pasa con tu sitio, tu dominio y tu información.",
  html: `
<h2>1. Cómo cancelar</h2>
<p>Avísanos por escrito a <a href="mailto:${CORREO}">${CORREO}</a> o por WhatsApp al ${WSP_VISIBLE}. Te confirmamos la recepción y te explicamos el cierre paso a paso.</p>

<h2>2. Planes mensual y anual</h2>
<ul>
<li><strong>Plan mensual:</strong> se paga mes a mes.</li>
<li><strong>Plan anual:</strong> se paga por adelantado por doce meses y tiene 25 % de descuento frente a doce mensualidades.</li>
</ul>
<p>Las condiciones particulares de tu servicio (plazo, alcance y valor) constan por escrito en la propuesta que aceptaste. Si tienes dudas sobre un caso concreto, escríbenos antes de decidir.</p>

<h2>3. Si el servicio deja de pagarse</h2>
<p>Nosotros administramos el hosting de tu sitio. Por eso, <strong>si el servicio se deja de pagar, el sitio se da de baja</strong>.</p>
<p>Cuando eso ocurre, <strong>te entregamos</strong>:</p>
<ul>
<li>la <strong>carpeta completa del proyecto</strong>, para que tú o quien tú elijas pueda volver a publicarlo; y</li>
<li>las <strong>credenciales de todos los servicios que usamos como proveedor</strong> para tu proyecto: hosting, DNS y los demás que correspondan.</li>
</ul>
<p>Con eso, otra persona de tu confianza (por ejemplo, un informático) puede volver a subir el sitio. No te quedas sin tu trabajo.</p>

<h2>4. Dominio</h2>
<p>El dominio y sus accesos quedan a nombre de tu empresa desde el inicio. Si necesitamos tocar el DNS para dar de baja o traspasar el sitio, lo coordinamos contigo.</p>

<h2>5. Tu información</h2>
<p>Los datos de tus clientes y de tu negocio que hayamos administrado por ti te pertenecen. Si necesitas una copia al terminar el servicio, pídela por escrito y te la entregamos. Más detalle en la <a href="/legal/privacidad/">política de privacidad</a>.</p>

<h2>6. Cómo se aplica a cada servicio</h2>
<table>
<tr><th>Servicio</th><th>Al terminar</th></tr>
<tr><td>Cóndor Sites</td><td>El sitio se da de baja; recibes la carpeta del proyecto y las credenciales.</td></tr>
<tr><td>Cóndor Ecommerce</td><td>La tienda se da de baja; recibes la carpeta del proyecto y las credenciales. Lo pendiente de la comisión por ventas se aclara por escrito en el cierre.</td></tr>
<tr><td>Cóndor CRM</td><td>Se traspasa lo que corresponda de tu sistema y tus datos; las condiciones del cierre constan en tu propuesta.</td></tr>
</table>

<h2>7. Contacto</h2>
<p>Escríbenos a <a href="mailto:${CORREO}">${CORREO}</a>. Preferimos aclarar una duda antes que resolver un malentendido después.</p>`,
});

export const privacidad = () => marco({
  titulo: "Política de privacidad", ruta: "/legal/privacidad/",
  desc: "Qué datos recoge Cóndor AI, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos.",
  bajada: "Qué datos recogemos, para qué los usamos y qué puedes hacer con ellos. En palabras simples.",
  html: `
<h2>1. Quiénes somos</h2>
<p>Cóndor AI («Cóndor») es una empresa con base en Santiago de Chile que crea sitios web, tiendas online y sistemas de seguimiento de clientes. Para cualquier tema de esta política, escríbenos a <a href="mailto:${CORREO}">${CORREO}</a>.</p>

<h2>2. Qué datos recogemos</h2>
<ul>
<li><strong>Si agendas una reunión o nos escribes:</strong> tu nombre, WhatsApp, correo, el día y la hora que elegiste y el mensaje que quieras dejarnos.</li>
<li><strong>Si eres cliente:</strong> los datos necesarios para prestarte el servicio, facturarte y cobrarte (por ejemplo, datos de tu empresa y de contacto).</li>
<li><strong>En este sitio:</strong> guardamos en tu navegador solo tu elección de país, para mostrarte los precios correctos. No usamos cookies de publicidad ni de seguimiento.</li>
</ul>

<h2>3. Para qué los usamos</h2>
<ul>
<li>Responderte, confirmar tu reunión y enviarte una propuesta.</li>
<li>Prestar, cobrar y dar soporte a los servicios que contratas.</li>
<li>Cumplir obligaciones legales y tributarias.</li>
</ul>
<p>No vendemos tus datos ni los usamos para fines distintos a los que te explicamos aquí.</p>

<h2>4. Con quién los compartimos</h2>
<p>Solo con los proveedores que necesitamos para operar: alojamiento y base de datos, mensajería y medios de pago (Mercado Pago y dLocal Go). Cada uno trata los datos únicamente para prestarnos su servicio.</p>

<h2>5. Cuánto tiempo los conservamos</h2>
<p>Mientras sea necesario para la finalidad para la que los recogimos, o por el tiempo que la ley exija (por ejemplo, para fines tributarios). Si nos pides eliminarlos, lo haremos salvo que la ley nos obligue a conservarlos.</p>

<h2>6. Tus derechos</h2>
<p>Puedes pedirnos acceso a tus datos, que los corrijamos, que los eliminemos o que dejemos de usarlos para una finalidad. Escríbenos a <a href="mailto:${CORREO}">${CORREO}</a> y te respondemos. Aplicamos la normativa de protección de datos del país donde vives, incluida la Ley 19.628 de Chile.</p>

<h2>7. Seguridad</h2>
<p>Tomamos medidas razonables para proteger tus datos: accesos con credenciales propias, conexiones cifradas y acceso limitado a quienes lo necesitan para trabajar. Ningún sistema es infalible; si ocurre un incidente que te afecte, te lo informaremos.</p>

<h2>8. Cambios</h2>
<p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha de actualización.</p>`,
});

export const terminos = () => marco({
  titulo: "Términos y condiciones", ruta: "/legal/terminos/",
  desc: "Condiciones generales de uso del sitio condorai.cl y de contratación de los servicios de Cóndor AI: Cóndor CRM, Cóndor Ecommerce y Cóndor Sites.",
  bajada: "Las reglas generales de uso del sitio y de los servicios. Lo específico de cada proyecto queda en tu propuesta.",
  html: `
<h2>1. Alcance</h2>
<p>Estos términos regulan el uso de condorai.cl y la contratación de los servicios de Cóndor AI («Cóndor»): <strong>Cóndor CRM</strong>, <strong>Cóndor Ecommerce</strong> y <strong>Cóndor Sites</strong>. Al usar el sitio o contratar un servicio, los aceptas.</p>

<h2>2. La propuesta manda</h2>
<p>Antes de empezar recibes una propuesta por escrito con el alcance, el plazo y el valor de tu proyecto. Lo que ahí diga prevalece sobre estos términos generales en lo que sea más específico.</p>

<h2>3. Precios y pagos</h2>
<ul>
<li>Los precios publicados en el sitio se muestran en la moneda de tu país, con impuestos incluidos donde así se indica.</li>
<li>El valor que cobramos es el que aceptas por escrito en la propuesta.</li>
<li>Los pagos se procesan a través de Mercado Pago y dLocal Go.</li>
<li><strong>Cóndor Ecommerce</strong> tiene un valor mensual base más una comisión de 6,7 % por venta facturada, que incluye la gestión de campañas de publicidad. El presupuesto de anuncios se acuerda contigo antes de activarlas.</li>
</ul>

<h2>4. Planes mensual y anual</h2>
<p>El plan mensual se paga mes a mes. El plan anual se paga por adelantado por doce meses, con 25 % de descuento frente a doce mensualidades. Cómo se termina cada uno está en la <a href="/legal/cancelacion/">política de cancelación</a>.</p>

<h2>5. Qué incluye el soporte</h2>
<p>El soporte incluye los ajustes menores sobre lo ya publicado: textos, imágenes, horarios, datos de contacto y contenido. Las funciones nuevas, las integraciones y los rediseños completos se cotizan por separado, siempre antes de trabajar.</p>

<h2>6. Hosting y dominio</h2>
<p>Cóndor administra el hosting de tu sitio mientras el servicio esté vigente. El dominio y sus accesos quedan a nombre de tu empresa. Qué ocurre con tu sitio si el servicio se deja de pagar está descrito en la <a href="/legal/cancelacion/">política de cancelación</a>.</p>

<h2>7. Contenidos</h2>
<p>Los textos, imágenes, logos y demás materiales que nos entregues deben ser tuyos o contar con autorización para usarse. Tú respondes por ellos. Los diseños y textos que preparemos para tu proyecto se te entregan junto con la carpeta del proyecto. Las marcas, logos y materiales propios de Cóndor siguen siendo de Cóndor.</p>

<h2>8. Lo que no prometemos</h2>
<p>Hacemos nuestro trabajo con dedicación, pero no prometemos una cantidad específica de ventas, clientes o posicionamiento: los resultados dependen también de tu negocio y del mercado. Tampoco garantizamos que un servicio de terceros (alojamiento, mensajería, medios de pago) esté disponible sin interrupciones.</p>

<h2>9. Uso del sitio</h2>
<p>No uses este sitio para actividades ilegales, para intentar acceder a sistemas que no te corresponden ni para enviar contenido malicioso. Podemos limitar el acceso si detectamos un uso indebido.</p>

<h2>10. Datos personales</h2>
<p>Tratamos tus datos según nuestra <a href="/legal/privacidad/">política de privacidad</a>.</p>

<h2>11. Cambios y ley aplicable</h2>
<p>Podemos actualizar estos términos; publicaremos la versión vigente aquí con su fecha. Se rigen por las leyes de Chile. Para cualquier duda: <a href="mailto:${CORREO}">${CORREO}</a>.</p>`,
});
