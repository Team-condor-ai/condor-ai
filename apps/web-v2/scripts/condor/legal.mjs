/* Páginas legales. Los términos salen de src/legal/contenido.mjs (fuente única con el portal, 25-oct-2026):
   términos generales + contrato por servicio + anexo por país. Cancelación y privacidad dicen lo mismo en simple.
   Conviene que un abogado las revise. */
import { CORREO, WSP_VISIBLE, FECHA_LEGAL } from "./datos.mjs";
import { pagina } from "./plantilla.mjs";
import { ANEXOS, CONTRATOS, EMPRESA, GENERALES, VERSION, VIGENTE_DESDE, resumen } from "../../src/legal/contenido.mjs";

const marco = ({ titulo, desc, ruta, bajada, html, fecha = FECHA_LEGAL }) => pagina({
  titulo: `${titulo} — Cóndor AI`, desc, ruta,
  cuerpo: `<section class="texto-hero"><div class="wrap"><div class="migas"><a href="/">Inicio</a><span>/</span><span>${titulo}</span></div>
  <h1>${titulo}</h1><p class="bajada">${bajada}</p><p class="actualizado">Última actualización: ${fecha}</p></div></section>
  <div class="wrap"><div class="prosa">${html}</div></div>`,
});

const doc = (d) => `<h2 id="${d.id}">${d.titulo}</h2>
<p><em>${d.bajada}</em></p>
${d.secciones.map((s) => `<h3>${s.n}. ${s.titulo}</h3>\n${s.parrafos.map((p) => `<p>${p}</p>`).join("\n")}`).join("\n")}`;

export const terminos = () => marco({
  titulo: "Términos y condiciones", ruta: "/legal/terminos/", fecha: VIGENTE_DESDE,
  desc: "Términos y condiciones de Cóndor Sites, Cóndor Ecommerce y Cóndor CRM: términos generales, contrato de cada servicio y anexo por país (Chile, Perú, Colombia, México y Argentina).",
  bajada: "Las reglas de nuestros servicios en un solo lugar: lo común a todos, el contrato de cada servicio y lo propio de cada país.",
  html: `
<p class="ilustrativo">Versión ${VERSION}</p>
<div class="caja">
<p><strong>En simple</strong> (lo que vale es el texto completo):</p>
<ul>${resumen("sites").filter((_, i) => i !== 1).map(([t, x]) => `<li><strong>${t}.</strong> ${x}</li>`).join("")}</ul>
</div>
<p>Si eres cliente, aceptas estos términos al entrar por primera vez a tu portal, y ahí puedes verlos y descargarlos cuando quieras. Te aplican los <a href="#generales">Términos Generales</a>, el contrato de tu servicio y el anexo de tu país:</p>
<ul>
<li><strong>Contratos por servicio:</strong> ${Object.values(CONTRATOS).map((c) => `<a href="#${c.id}">${c.titulo.replace("Contrato de suscripción a ", "")}</a>`).join(" · ")}</li>
<li><strong>Anexos por país:</strong> ${Object.values(ANEXOS).map((a) => `<a href="#${a.id}">${a.titulo.replace("Anexo de País: ", "")}</a>`).join(" · ")}</li>
</ul>
${doc(GENERALES)}
${Object.values(CONTRATOS).map(doc).join("\n")}
${Object.values(ANEXOS).map(doc).join("\n")}
<p><small>Versión ${VERSION}, vigente desde el ${VIGENTE_DESDE}. ${EMPRESA.razonSocial}, RUT ${EMPRESA.rut}.</small></p>`,
});

export const cancelacion = () => marco({
  titulo: "Política de cancelación", ruta: "/legal/cancelacion/",
  desc: "Cómo cancelar un servicio de Cóndor AI y qué recibes al terminar: la carpeta completa de tu proyecto, las credenciales y tus datos.",
  bajada: "Cómo se termina una relación con Cóndor, dicho de frente: sin multas, sin llamadas y llevándote tu trabajo.",
  html: `
<h2>1. Cómo cancelar</h2>
<p>Cuando quieras y sin dar motivos, por <strong>cualquiera</strong> de estos medios (basta uno):</p>
<ul>
<li>el botón <strong>«Cancelar servicio»</strong> en Mi cuenta de tu portal;</li>
<li>un mensaje en el <strong>chat</strong> de tu portal;</li>
<li>un correo a <a href="mailto:${CORREO}">${CORREO}</a>;</li>
<li>un WhatsApp al ${WSP_VISIBLE}.</li>
</ul>
<p>No te pedimos llamadas, trámites ni escuchar ofertas. Con el botón queda confirmada al instante; por los otros medios te la confirmamos por escrito en máximo 5 días hábiles, con la fecha de término.</p>

<h2>2. Hasta cuándo sigue tu servicio</h2>
<ul>
<li><strong>Plan mensual:</strong> sigue hasta el final del mes pagado y después no hay más cobros.</li>
<li><strong>Plan anual</strong> (25 % de descuento frente a doce mensualidades): sigue hasta el final del año pagado; los meses restantes no se reembolsan.</li>
</ul>
<p>Si eres consumidor, tienes además 10 días desde que contratas para retractarte antes de que empecemos a prestar el servicio (o el plazo mayor que fije la ley de tu país).</p>

<h2>3. Lo que recibes al terminar</h2>
<p>Dentro de <strong>10 días hábiles</strong> desde que termina el servicio, por cualquier causa (también si se deja de pagar), te entregamos sin costo:</p>
<ul>
<li>la <strong>carpeta completa del proyecto</strong>, para que tú o quien elijas pueda volver a publicarlo;</li>
<li>las <strong>credenciales</strong> de los servicios que usamos como proveedor para tu proyecto: hosting, DNS, dominio y los demás que correspondan;</li>
<li>una <strong>exportación de tus datos</strong> en formatos comunes.</li>
</ul>
<p>No te quedas sin tu trabajo.</p>

<h2>4. Dominio y datos</h2>
<p>El dominio queda a nombre de tu empresa desde el inicio. Los datos de tus clientes y de tu negocio te pertenecen. Más detalle en la <a href="/legal/privacidad/">política de privacidad</a>.</p>

<h2>5. Cómo se aplica a cada servicio</h2>
<table><thead><tr><th>Servicio</th><th>Al terminar</th></tr></thead><tbody>
<tr><td>Cóndor Sites</td><td>El sitio sigue en línea hasta el final de lo pagado y luego se da de baja; recibes la carpeta del proyecto y las credenciales.</td></tr>
<tr><td>Cóndor Ecommerce</td><td>La tienda opera hasta el final de lo pagado; las ventas hasta esa fecha generan comisión. Recibes la carpeta, las credenciales, el catálogo, los pedidos y tu base de clientes, y te traspasamos las cuentas de pagos, anuncios y dominio.</td></tr>
<tr><td>Cóndor CRM</td><td>Recibes tus contactos, conversaciones, agenda y configuraciones, y te ayudamos a traspasar líneas y cuentas. Si tu propuesta pactó un plazo inicial, se aplica lo que dice ahí.</td></tr>
</tbody></table>

<h2>6. Las reglas completas</h2>
<p>Todo esto está en las cláusulas 7, 8 y 10 de los <a href="/legal/terminos/#generales">Términos y condiciones</a>. Si tienes una duda, escríbenos a <a href="mailto:${CORREO}">${CORREO}</a>: preferimos aclararla antes que resolver un malentendido después.</p>`,
});

export const privacidad = () => marco({
  titulo: "Política de privacidad", ruta: "/legal/privacidad/",
  desc: "Qué datos recoge Cóndor AI, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos.",
  bajada: "Qué datos recogemos, para qué los usamos y qué puedes hacer con ellos. En palabras simples.",
  html: `
<h2>1. Quiénes somos</h2>
<p>${EMPRESA.razonSocial} («Cóndor»), RUT ${EMPRESA.rut}, con domicilio en ${EMPRESA.domicilio}, crea sitios web, tiendas online y sistemas de seguimiento de clientes para negocios de Chile, Perú, Colombia, México y Argentina. Para cualquier tema de esta política, escríbenos a <a href="mailto:${CORREO}">${CORREO}</a>.</p>

<h2>2. Qué datos recogemos</h2>
<ul>
<li><strong>Si agendas una reunión o nos escribes:</strong> tu nombre, WhatsApp, correo, el día y la hora que elegiste y el mensaje que quieras dejarnos.</li>
<li><strong>Si eres cliente:</strong> los datos necesarios para prestarte el servicio, facturarte y cobrarte (por ejemplo, datos de tu empresa y de contacto), y el registro de tu aceptación de los términos (fecha, hora, versión, dirección IP y navegador).</li>
<li><strong>En este sitio:</strong> guardamos en tu navegador solo tu elección de país, para mostrarte los precios correctos. En tu portal guardamos tu sesión. No usamos cookies de publicidad ni de seguimiento.</li>
</ul>

<h2>3. Para qué los usamos</h2>
<ul>
<li>Responderte, confirmar tu reunión y enviarte una propuesta.</li>
<li>Prestar, cobrar y dar soporte a los servicios que contratas.</li>
<li>Cumplir obligaciones legales y tributarias, y probar lo que se acordó.</li>
</ul>
<p>No vendemos tus datos ni los usamos para fines distintos a los que te explicamos aquí.</p>

<h2>4. Los datos de tus clientes</h2>
<p>Cuando administramos tu sitio, tienda o CRM, los datos de tus compradores y contactos son tuyos: tú eres el responsable y nosotros los tratamos solo por tu cuenta y según tus instrucciones (cláusula 15 de los <a href="/legal/terminos/#generales">Términos y condiciones</a>).</p>

<h2>5. Con quién los compartimos</h2>
<p>Solo con los proveedores que necesitamos para operar: alojamiento y base de datos, mensajería y medios de pago (Mercado Pago y dLocal Go). Cada uno trata los datos únicamente para prestarnos su servicio. Algunos almacenan datos fuera de tu país (por ejemplo, en Brasil o Estados Unidos), con medidas de protección equivalentes.</p>

<h2>6. Cuánto tiempo los conservamos</h2>
<p>Mientras sea necesario para la finalidad para la que los recogimos, o por el tiempo que la ley exija (por ejemplo, para fines tributarios). Si nos pides eliminarlos, lo haremos salvo que la ley nos obligue a conservarlos.</p>

<h2>7. Tus derechos</h2>
<p>Puedes pedirnos acceso a tus datos, que los corrijamos, que los eliminemos, que dejemos de usarlos para una finalidad o una copia para llevártelos. Escríbenos a <a href="mailto:${CORREO}">${CORREO}</a> y te respondemos. Aplicamos la Ley N° 19.628 de Chile, la Ley N° 21.719 desde su entrada en vigencia y la ley de protección de datos de tu país (Perú: Ley 29733; Colombia: Ley 1581 de 2012; México: Ley Federal de Protección de Datos Personales en Posesión de los Particulares; Argentina: Ley 25.326). También puedes reclamar ante la autoridad de datos de tu país.</p>

<h2>8. Seguridad</h2>
<p>Tomamos medidas razonables para proteger tus datos: accesos con credenciales propias, conexiones cifradas y acceso limitado a quienes lo necesitan para trabajar. Ningún sistema es infalible; si ocurre un incidente que te afecte, te lo informaremos sin demora.</p>

<h2>9. Cambios</h2>
<p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha de actualización.</p>`,
});
