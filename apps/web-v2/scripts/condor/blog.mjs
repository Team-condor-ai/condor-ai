/* Blog de Cóndor AI. Cada artículo declara su territorio y su enfoque (ver docs/narrativa-condor.md).
   Regla de la casa: ninguna cifra, cita ni caso que no se pueda respaldar. Lo ilustrativo se marca. */
import { pagina, flecha } from "./plantilla.mjs";

const invita = (titulo, texto, href, boton) => `<aside class="invita acrilico denso grano"><h3>${titulo}</h3><p>${texto}</p><a class="btn" href="${href}">${boton} ${flecha}</a></aside>`;

const TODOS = [
  {
    slug: "te-escribieron-anoche",
    titulo: "Te escribieron anoche. ¿Quién respondió?",
    extracto: "Un mensaje que llega fuera de horario no es un problema de tiempo: es un problema de sistema. Dónde se enfría una consulta y cómo evitarlo.",
    territorio: "Atención y seguimiento", enfoque: "Problema-solución", min: 5, destacado: true,
    cuerpo: `
<p><span class="ilustrativo">Escena ilustrativa</span></p>
<p>Son las 10 de la noche. Alguien vio tu publicación, le interesó y te escribió por Instagram: «Hola, ¿tienen hora para esta semana?». Tú ya cerraste. El mensaje queda ahí, sin leer.</p>
<p>A la mañana siguiente lo ves, respondes con cariño y esperas. Pero esa persona ya le escribió a otro negocio, que sí le contestó anoche.</p>
<p>Esta escena no es un caso real de un cliente; es un mecanismo que se repite en casi cualquier negocio que atiende por mensajes. Lo importante es entender <strong>dónde</strong> se rompe.</p>

<h2>Cuatro puntos donde se enfría una consulta</h2>
<ol>
<li><strong>Llega cuando nadie está.</strong> Fuera de horario, en fin de semana, mientras atiendes a otro cliente.</li>
<li><strong>La respuesta tarda.</strong> Quien pregunta precio o disponibilidad suele preguntar en varios lugares a la vez.</li>
<li><strong>Nadie anota.</strong> La conversación vive en un chat personal, mezclada con todo lo demás.</li>
<li><strong>Nadie retoma.</strong> El cliente dijo «déjame pensarlo» y ahí terminó el seguimiento.</li>
</ol>

<h2>La práctica instalada: «yo respondo cuando puedo»</h2>
<p>Funciona mientras llegan pocas consultas. El problema aparece cuando tu publicidad, tu web o tus redes empiezan a traer gente: el mismo esfuerzo trae más mensajes, y el método de responder «cuando se puede» se vuelve el cuello de botella.</p>
<p>No hace falta que respondas más rápido tú. Hace falta que <strong>el camino de una consulta no dependa de que estés disponible</strong>.</p>

<h2>Qué cambia cuando hay un sistema</h2>
<ul>
<li>Todos los canales (WhatsApp, Instagram, Facebook, correo, formularios) llegan al mismo lugar.</li>
<li>Quien escribe recibe una primera respuesta al instante, aunque sea de noche, y puede elegir una hora para conversar.</li>
<li>Cada conversación queda registrada, con su etapa: consulta, reunión, propuesta, cierre.</li>
<li>Si alguien se queda en silencio, el sistema vuelve a escribirle.</li>
</ul>
<div class="caja"><p><strong>Un chequeo rápido.</strong> Revisa tus últimas diez consultas: ¿cuánto tardaste en responder la primera? ¿Cuántas quedaron sin un segundo mensaje? No necesitas un número exacto; necesitas saber si tu respuesta depende de tu horario.</p></div>
<p>Esto es, en simple, lo que hace un CRM. No es una herramienta para empresas grandes: es una forma de que ninguna consulta dependa de la memoria de una sola persona.</p>
${invita("Mira cómo quedaría en tu negocio", "Cuéntanos cómo llegan hoy tus clientes y armamos el recorrido contigo.", "/productos/crm/", "Conocer Cóndor CRM")}`,
  },
  {
    slug: "web-profesional-2026",
    titulo: "«Con Instagram me basta»: lo que se te escapa si no tienes web",
    extracto: "Las redes son una vitrina excelente, pero no son tuyas. Qué cubre una web que Instagram no puede cubrir, y qué tiene que tener para trabajar.",
    territorio: "Presencia y confianza", enfoque: "Mito vs. realidad", min: 5,
    cuerpo: `
<p>«Con Instagram me basta» es una de las frases más comunes entre dueños de negocio. Y no es una locura: Instagram funciona, te muestra, te trae mensajes. El problema no es que sea poco, es que <strong>no es tuyo</strong>.</p>

<h2>El mito</h2>
<p>«Si tengo buen contenido y respondo los mensajes, una web es un gasto de más».</p>

<h2>La realidad, con matices</h2>
<p>Las redes son un muy buen lugar para que te descubran. Pero una persona que ya te conoce y quiere decidir suele buscar otra cosa: <strong>una página donde esté todo claro</strong>. Qué haces, cuánto cuesta (o cómo se cotiza), dónde estás, cómo se contacta contigo, qué opinan otros.</p>
<ul>
<li><strong>Las reglas cambian.</strong> El alcance de una publicación depende de decisiones de la plataforma, no tuyas.</li>
<li><strong>La cuenta puede tener problemas.</strong> Una suspensión, un hackeo o un cambio de políticas te deja sin tu vitrina.</li>
<li><strong>La información se pierde.</strong> Lo que publicaste hace seis meses está enterrado. En una web, lo importante siempre está a un clic.</li>
<li><strong>Google te busca ahí.</strong> Cuando alguien escribe tu nombre en un buscador, lo natural es que encuentre un sitio con tu información.</li>
</ul>
<p>Esto no quiere decir que dejes las redes. Quiere decir que no las uses como único lugar donde existes.</p>

<h2>Qué tiene que tener una web para trabajar</h2>
<ol>
<li><strong>Un objetivo claro:</strong> que te escriban, reserven o compren. Una sola cosa principal por página.</li>
<li><strong>Información que responde las dudas de siempre:</strong> qué haces, para quién, cómo se trabaja contigo.</li>
<li><strong>Contacto a un clic</strong>, especialmente WhatsApp si así te escribe tu gente.</li>
<li><strong>Que se vea bien en el celular</strong>, que es desde donde te va a mirar la mayoría.</li>
<li><strong>Cosas reales:</strong> tus fotos, tus textos, tu forma de hablar. Lo genérico no genera confianza.</li>
<li><strong>Que esté al día.</strong> Una web con horarios viejos es peor que no tener web.</li>
</ol>
<div class="caja"><p><strong>Para pensar:</strong> si hoy alguien que no te conoce busca tu nombre, ¿qué encuentra? Hazlo tú ahora, desde el celular.</p></div>
${invita("Que alguien se encargue de la web", "En Cóndor Sites diseñamos, publicamos y mantenemos tu sitio. Tú te preocupas de tu negocio.", "/productos/sites/", "Ver Cóndor Sites")}`,
  },
  {
    slug: "tienda-abierta-no-es-tienda-que-vende",
    titulo: "Tienda abierta no es tienda que vende: cuatro cosas que mirar antes de lanzar",
    extracto: "El error más común al abrir una tienda online es creer que lo difícil era construirla. Lo difícil empieza el día que se publica.",
    territorio: "Ventas en línea", enfoque: "Error frecuente", min: 5,
    cuerpo: `
<p>Abrir una tienda online se ha vuelto fácil. Y justamente por eso se subestima lo que viene después: <strong>publicar es el primer paso, no el último</strong>.</p>

<h2>El error frecuente</h2>
<p>Subir los productos, conectar el pago y esperar. Es una práctica instalada, y es comprensible: parece que, con la tienda en línea, las ventas deberían venir solas. Lo que suele faltar son las cuatro cosas de abajo.</p>

<h2>1. ¿Puede alguien pagar sin pedirte ayuda?</h2>
<p>Prueba tu tienda como si fueras un cliente: desde el celular, sin ayuda, con una tarjeta de verdad. Si algo te frena a ti, frena a quien compra. Los medios de pago tienen que ser los que usa tu cliente, no solo los que te acomodan a ti.</p>

<h2>2. ¿El stock que ve el cliente es el que tienes?</h2>
<p>Vender algo que ya no hay es de lo más caro que existe: pierdes la venta, el tiempo de pedir disculpas y, muchas veces, al cliente. Si tu stock vive en una bodega, en un sistema y en una planilla, tarde o temprano no van a coincidir.</p>

<h2>3. ¿Alguien sabe que existe tu tienda?</h2>
<p>Una tienda nueva no tiene visitas por sí sola. Necesitas una forma de traer gente: tus redes, tu lista de clientes, buscadores o publicidad. No hace falta todo a la vez, pero sí decidir <strong>cuál</strong> y con qué presupuesto, antes de lanzar.</p>

<h2>4. ¿Quién mira los números?</h2>
<p>Si nadie revisa qué se vende, qué no y de dónde llegan los compradores, estás decidiendo a ciegas. Un reporte simple, cada mes, ya cambia las decisiones: qué reponer, qué dejar de ofrecer, dónde invertir.</p>

<div class="caja"><p><strong>Antes de lanzar, responde por escrito:</strong> (1) ¿cómo paga mi cliente?, (2) ¿de dónde sale mi stock real?, (3) ¿cómo van a llegar las primeras visitas?, (4) ¿quién revisa los números y cada cuánto?</p></div>
<p>Si alguna respuesta es «no sé», no necesitas una tienda más bonita: necesitas resolver ese punto.</p>
${invita("Una tienda con alguien detrás", "Cóndor Ecommerce incluye construcción, pagos, stock, reporte mensual y, si quieres, la gestión de tus anuncios.", "/productos/ecommerce/", "Ver Cóndor Ecommerce")}`,
  },
  {
    slug: "whatsapp-business-o-crm",
    titulo: "WhatsApp Business o CRM: cuándo conviene dar el salto",
    extracto: "No son rivales. WhatsApp Business es una gran herramienta hasta que deja de alcanzar. Cómo saber en qué punto estás.",
    territorio: "Herramientas y criterio", enfoque: "A versus B", min: 5,
    cuerpo: `
<p>Preguntar «¿WhatsApp Business o un CRM?» es como preguntar «¿cuaderno o planilla?». Cada uno sirve en un momento distinto. Y declarar un ganador universal sería engañoso: <strong>depende de cuánto y cómo te escriben</strong>.</p>

<h2>Dónde WhatsApp Business es suficiente</h2>
<ul>
<li>Te escribe poca gente al día y puedes responder rápido.</li>
<li>Atiende una sola persona (o dos, de confianza).</li>
<li>Tus ventas se cierran en una sola conversación, sin etapas largas.</li>
<li>Con etiquetas, respuestas rápidas y catálogo ya te alcanza.</li>
</ul>
<p>Si es tu caso, no cambies nada por moda. Una herramienta simple bien usada vale más que un sistema grande mal usado.</p>

<h2>Las señales de que dejó de alcanzar</h2>
<ol>
<li><strong>Te escriben por más de un canal</strong> (WhatsApp, Instagram, correo, formulario) y ya no sabes quién escribió por dónde.</li>
<li><strong>Atiende más de una persona</strong> y nadie sabe qué le dijo el otro al mismo cliente.</li>
<li><strong>Hay etapas</strong>: consulta, reunión, propuesta, decisión. Y se te olvida a quién le debías el siguiente paso.</li>
<li><strong>Se te van clientes fuera de horario</strong> porque la respuesta llega al día siguiente.</li>
<li><strong>No sabes de dónde vienen</strong> tus clientes, así que no sabes qué publicidad funciona.</li>
</ol>

<h2>Qué agrega un CRM</h2>
<table>
<tr><th>Necesidad</th><th>WhatsApp Business</th><th>CRM</th></tr>
<tr><td>Responder rápido</td><td>Si estás disponible</td><td>También de noche y fines de semana</td></tr>
<tr><td>Varios canales</td><td>Solo WhatsApp</td><td>Todos en una bandeja</td></tr>
<tr><td>Varias personas</td><td>Limitado</td><td>Cada conversación con su responsable</td></tr>
<tr><td>Seguimiento</td><td>De memoria</td><td>Etapas y recordatorios</td></tr>
<tr><td>Saber qué funciona</td><td>Difícil</td><td>Reportes por canal</td></tr>
</table>
<p>La comparación no dice que uno sea malo. Dice <strong>qué problema resuelve cada uno</strong>. Y muchos negocios usan los dos: WhatsApp como canal, CRM como el lugar donde nada se pierde.</p>
${invita("¿Estás en el punto del salto?", "Cuéntanos cómo te escriben hoy y te decimos con honestidad si te conviene un CRM o seguir como estás.", "/agendar/", "Agendar una reunión")}`,
  },
  {
    slug: "medula-el-cerebro-de-tu-empresa",
    titulo: "Medula: por qué tu empresa necesita un cerebro",
    extracto: "Los clientes, los precios y los acuerdos de tu empresa viven repartidos en chats, correos y planillas. Qué cambia cuando todo está en un solo lugar.",
    territorio: "Orden del negocio", enfoque: "Problema-solución", min: 4,
    cuerpo: `
<p>Pregunta rápida: ¿dónde está el precio que le prometiste a ese cliente el mes pasado? ¿En un correo? ¿En un chat? ¿En la cabeza de alguien del equipo que hoy está de vacaciones?</p>
<p>Si la respuesta es «depende», tu empresa tiene el conocimiento repartido. Y mientras todo funciona, nadie lo nota.</p>

<h2>El problema: el conocimiento vive donde nadie lo encuentra</h2>
<p>Lo que una empresa sabe se escribe todos los días: acuerdos con clientes, condiciones de un proveedor, cómo se resolvió un problema, qué se decidió en una reunión. Pero se escribe en lugares distintos: chats, correos, documentos, notas sueltas.</p>
<p>El costo aparece cuando alguien nuevo entra, cuando alguien se va, o cuando necesitas una respuesta y no sabes dónde buscarla. Nadie ha perdido la información; solo no hay <strong>un lugar</strong> donde preguntar.</p>

<h2>Qué es Medula</h2>
<p>Medula es el producto de Optimizo, empresa con la que trabajamos, y lo describe así: <strong>«el cerebro de tu empresa»</strong>. Reúne clientes, precios, acuerdos y conversaciones en un solo cerebro que aprende de tus aplicaciones. Y las herramientas de inteligencia artificial que ya usas, como ChatGPT y Claude, piensan con él.</p>
<p>En simple: en lugar de explicarle a una herramienta de IA tu empresa cada vez que la usas, la empresa ya está ahí.</p>

<h2>Cómo empezar a ordenar tu conocimiento (con o sin Medula)</h2>
<ol>
<li><strong>Elige las cinco preguntas que más se repiten</strong> en tu equipo («¿cuánto cobramos por…?», «¿cómo se hace…?»).</li>
<li><strong>Anota dónde vive hoy cada respuesta.</strong> Si vive en más de un lugar, ya encontraste el problema.</li>
<li><strong>Decide un solo lugar</strong> y una persona responsable de mantenerlo.</li>
<li><strong>Escribe como si lo fuera a leer alguien que entró ayer.</strong></li>
</ol>
<div class="caja"><p><strong>Hazlo hoy:</strong> pregúntale a dos personas de tu equipo dónde buscarían el precio de tu servicio principal. Si responden distinto, tienes tu primera tarea.</p></div>
<p>Si quieres ver cómo piensa, Medula tiene su propio sitio y una prueba gratuita de 7 días de los planes Pro o Team, sin tarjeta.</p>
${invita("Conoce Medula", "Ve cómo funciona el cerebro de una empresa en su propio sitio.", "https://medula.condorai.cl/", "Ir a Medula")}`,
  },
  {
    slug: "que-pasa-si-dejas-de-pagar-tu-web",
    titulo: "¿Qué pasa con tu web si dejas de pagar? Te lo decimos de frente",
    extracto: "Es la pregunta que casi nadie hace y casi todos deberían hacer. Esta es nuestra respuesta, sin letra chica.",
    territorio: "Cóndor por dentro", enfoque: "Causa y efecto", min: 4,
    cuerpo: `
<p>Antes de contratar a quien te administra la web, vale la pena una pregunta incómoda: <strong>¿qué pasa si algún día dejo de pagar?</strong> Muchas empresas la descubren tarde. Nosotros preferimos decirlo antes.</p>

<h2>Cómo funciona</h2>
<p>En Cóndor Sites y Cóndor Ecommerce, <strong>nosotros administramos el hosting</strong>: es decir, el lugar donde vive tu sitio en internet. Eso es parte del servicio y de lo que pagas.</p>
<p>Si el servicio se deja de pagar, <strong>el sitio se da de baja</strong>. Así de simple. No lo dejamos funcionando gratis indefinidamente, porque el hosting y su mantención tienen un costo real.</p>

<h2>Lo que no pasa: que te quedes sin tu trabajo</h2>
<p>Dar de baja el sitio no significa quedarte con las manos vacías. Cuando termina el servicio, te entregamos:</p>
<ul>
<li><strong>La carpeta completa del proyecto</strong>, para que tú o quien tú elijas pueda volver a publicarla.</li>
<li><strong>Las credenciales de todo lo que usamos como proveedor</strong>: hosting, DNS y los demás servicios del proyecto.</li>
</ul>
<p>Con eso, cualquier informático puede volver a subir tu sitio. Tendrá un trabajo que hacer, pero no tendrá que empezar de cero.</p>

<h2>Y el dominio</h2>
<p>El dominio queda a nombre de tu empresa desde el inicio. Nunca estuvo en nuestras manos, así que no hay nada que «devolver».</p>

<h2>Por qué lo contamos así</h2>
<p>Porque una relación de largo plazo se construye sabiendo cómo se termina. Si un día decides cambiar de proveedor, o simplemente cerrar este capítulo, tienes que saber que <strong>tu información y tu trabajo no son rehenes de nadie</strong>.</p>
<div class="caja"><p>La política completa está en la página de <a href="/legal/cancelacion/">cancelación</a>. Y si algo no te queda claro, escríbenos antes de contratar: preferimos una pregunta incómoda hoy que un problema mañana.</p></div>
${invita("¿Quieres conocer las condiciones completas?", "Todo queda por escrito en la propuesta, antes de empezar.", "/agendar/", "Agendar una reunión")}`,
  },
  {
    slug: "google-maps",
    titulo: "Cómo aparecer mejor en Google Maps, paso a paso",
    extracto: "Si tu negocio atiende a quienes están cerca, Google Maps es tu segunda vitrina. Cinco pasos concretos para cuidarla.",
    territorio: "Presencia y confianza", enfoque: "Paso a paso", min: 5,
    cuerpo: `
<p>Cuando alguien busca «restaurante cerca» o «lavandería en Providencia», Google le muestra un mapa con algunos negocios destacados. Aparecer ahí, o no, hace diferencia para cualquier negocio que atienda a quienes están a la vuelta de la esquina.</p>
<p>Nadie puede prometerte la primera posición, pero sí hay cosas que dependen de ti. Este es el paso a paso.</p>

<h2>1. Reclama y completa tu perfil de empresa</h2>
<p>Crea o reclama tu ficha en <strong>Google Business Profile</strong>, que es gratis. Completa todo: nombre exacto, categoría correcta, dirección, horario, teléfono, WhatsApp y sitio web. Una ficha incompleta le da menos información a Google y menos confianza a quien te mira.</p>

<h2>2. Sube fotos reales</h2>
<p>Tu local, tus productos, tu equipo. Las fotos propias generan más confianza que las de banco de imágenes, porque muestran lo que de verdad va a encontrar el cliente.</p>

<h2>3. Pide reseñas y responde todas</h2>
<ul>
<li>Pídelas a clientes satisfechos, por ejemplo con un mensaje por WhatsApp después de la compra.</li>
<li>Responde las buenas y las malas, con respeto. Una mala reseña bien respondida muestra cómo trabajas.</li>
</ul>

<h2>4. Conecta tu ficha con tu web</h2>
<p>Tu ficha y tu sitio se complementan. En el mapa, la persona descubre tu negocio; en tu web, termina de decidir. Si ahí encuentra información clara y un botón para escribirte, el camino se completa.</p>

<h2>5. Mantenla viva</h2>
<p>Actualiza horarios en feriados, publica novedades y fotos de vez en cuando. Una ficha abandonada se nota.</p>

<h2>El error de casi todo negocio local</h2>
<p>Reclamar la ficha, poner el nombre y el teléfono… y abandonarla. Es una tarea que parece de una vez, pero es <strong>un espacio que se cuida</strong>. La buena noticia: con poco esfuerzo constante ya haces más que muchos.</p>
${invita("Que tu web esté a la altura de tu ficha", "Cuando alguien te encuentra en el mapa, lo siguiente es mirar tu sitio.", "/productos/sites/", "Ver Cóndor Sites")}`,
  },
  {
    slug: "que-preparar-antes-de-hacer-tu-web",
    titulo: "Qué preparar antes de hacer tu web (y ahorrarte semanas)",
    extracto: "Lo que más atrasa un sitio web no es el diseño: es el contenido que llega tarde. Una lista simple para llegar preparado.",
    territorio: "Presencia y confianza", enfoque: "Diagnóstico o checklist", min: 4,
    cuerpo: `
<p>Casi todos los atrasos al hacer una web tienen la misma causa, y no es técnica: <strong>falta el contenido</strong>. Textos que no están, fotos que hay que buscar, datos que nadie recuerda.</p>
<p>Esta lista te ayuda a llegar a la primera reunión con lo necesario. No necesitas tenerla perfecta; necesitas saber qué falta.</p>

<h2>Lo básico (sin esto no se puede empezar)</h2>
<ul>
<li><strong>Tu logo</strong>, idealmente en un archivo con fondo transparente.</li>
<li><strong>Los datos de contacto:</strong> teléfono, WhatsApp, correo, dirección y horarios.</li>
<li><strong>Tu lista de servicios o productos</strong>, con una frase simple para cada uno.</li>
</ul>

<h2>Lo que hace que la web convenza</h2>
<ul>
<li><strong>Fotos propias</strong> de tu negocio, tu equipo o tus productos. Aunque sean de celular, si están bien iluminadas sirven.</li>
<li><strong>Quiénes son:</strong> dos o tres líneas sobre tu historia o por qué haces lo que haces.</li>
<li><strong>Las preguntas que más te hacen</strong> y sus respuestas. Eso es una sección de preguntas frecuentes ya escrita.</li>
<li><strong>Experiencias de clientes</strong>, solo si son reales y tienes permiso para publicarlas.</li>
</ul>

<h2>Lo que muchos olvidan</h2>
<ul>
<li><strong>¿Tienes dominio?</strong> Si tu empresa ya tiene uno, ten a mano quién lo administra.</li>
<li><strong>¿Quién aprueba?</strong> Define una persona que diga «sí, así». Cuando aprueban cinco, el proceso se alarga.</li>
<li><strong>¿Qué quieres que haga quien entra?</strong> Escribirte, reservar, comprar. Una sola acción principal.</li>
</ul>
<div class="caja"><p><strong>Una regla útil:</strong> si no puedes explicar en una frase qué hace tu negocio y para quién, empieza por ahí. Esa frase será lo primero que se lea en tu web.</p></div>
${invita("Llega con lo que tengas", "En la primera reunión vemos qué hay y qué falta, y lo dejamos por escrito en la propuesta.", "/agendar/", "Agendar una reunión")}`,
  },

  {
    slug: "primer-mensaje-respuesta",
    titulo: "El primer mensaje decide: cómo responder una consulta sin sonar a máquina",
    extracto: "«Hola, ¿en qué te puedo ayudar?» no avanza nada. Cuatro errores comunes al responder una consulta y cómo se ve una respuesta que sí mueve la conversación.",
    territorio: "Atención y seguimiento", enfoque: "Error frecuente", min: 4,
    cuerpo: `
<p>Cuando alguien te escribe por primera vez, está haciendo una pequeña apuesta: que valga la pena seguir conversando. Tu primera respuesta puede confirmarla o desinflarla. Y casi siempre se desinfla por errores muy parecidos.</p>

<h2>El error frecuente: responder para cumplir</h2>
<p>Contestar rápido es bueno. Contestar rápido <em>algo que no avanza</em> no lo es. Estos son los cuatro errores que más se repiten.</p>

<h2>1. El saludo que no dice nada</h2>
<p>«Hola, buenas tardes, ¿en qué te puedo ayudar?». Quien escribió ya dijo en qué necesita ayuda. Preguntárselo de nuevo suena a plantilla y le devuelve el trabajo.</p>

<h2>2. El muro de texto</h2>
<p>Una respuesta de diez líneas con todos los servicios, los precios y las condiciones. Quien pregunta por un dato recibe un folleto. Responde lo que preguntó y deja la puerta abierta a lo demás.</p>

<h2>3. Ignorar lo que dijo</h2>
<p>Si alguien escribió «necesito una web para mi clínica dental» y la respuesta habla de «soluciones digitales», no se sintió escuchado. Usa sus palabras.</p>

<h2>4. No proponer el siguiente paso</h2>
<p>Responder y quedarse esperando. Una buena respuesta termina con algo concreto que hacer: elegir una hora, mandar una foto, contestar una pregunta.</p>

<h2>Cómo se ve una respuesta que avanza</h2>
<p><em>Ejemplo inventado para ilustrar:</em></p>
<blockquote>«Hola, Camila. Gracias por escribir. Para una clínica dental lo habitual es mostrar tus servicios, tu equipo y una forma simple de pedir hora. ¿Te acomoda que lo veamos en una reunión de 30 minutos esta semana? Puedo el jueves a las 10:30 o el viernes a las 16:00.»</blockquote>
<p>Tiene cuatro cosas: usa su nombre y su rubro, responde en una frase lo que pidió, propone un paso y ofrece opciones concretas. No necesita más.</p>
<div class="caja"><p><strong>Plantilla simple:</strong> (1) Saludo con su nombre. (2) Una frase que muestre que entendiste. (3) Una sola pregunta o propuesta. (4) Dos opciones de horario.</p></div>
<p>Y si te escriben a las 11 de la noche, lo ideal es que esa primera respuesta salga igual, aunque tú estés durmiendo. Ahí es donde un sistema hace la diferencia.</p>
${invita("Que la primera respuesta salga siempre", "Cóndor CRM responde al instante, agenda y sigue la conversación, de día o de noche.", "/productos/crm/", "Conocer Cóndor CRM")}`,
  },
  {
    slug: "planilla-de-clientes-se-queda-corta",
    titulo: "Tu planilla de clientes ya es un CRM (y se está quedando corta)",
    extracto: "Casi todos los negocios empiezan con una planilla. Cómo ordenarla bien, y cómo saber cuándo dejó de alcanzar.",
    territorio: "Orden del negocio", enfoque: "Antes y después", min: 5,
    cuerpo: `
<p>Si anotas tus clientes en una planilla, ya tienes un CRM. Uno básico, manual y sin recordatorios, pero un CRM. Y no hay nada malo en eso: <strong>una planilla bien llevada es mejor que un sistema que nadie usa</strong>.</p>
<p>La pregunta útil no es «¿planilla o sistema?». Es «¿mi planilla todavía me ayuda a no perder clientes?».</p>

<h2>Antes: lo que suele pasar</h2>
<ul>
<li>Los clientes están en una planilla, pero las conversaciones están en el WhatsApp personal de quien atendió.</li>
<li>Cada persona del equipo anota a su manera, con sus propias columnas.</li>
<li>El seguimiento depende de que alguien se acuerde de mirar.</li>
<li>No hay forma de saber qué consultas llegaron fuera de horario ni cuáles se quedaron sin respuesta.</li>
</ul>

<h2>Primero, ordena la planilla que ya tienes</h2>
<p>Antes de cambiar de herramienta, vale la pena que tu planilla tenga estas columnas. Con ellas ya funciona mucho mejor:</p>
<table>
<tr><th>Columna</th><th>Para qué sirve</th></tr>
<tr><td>Nombre y contacto</td><td>Saber quién es y cómo escribirle</td></tr>
<tr><td>Canal de origen</td><td>Saber de dónde llegó (Instagram, web, recomendación…)</td></tr>
<tr><td>Etapa</td><td>Consulta, reunión, propuesta enviada, cerrado, perdido</td></tr>
<tr><td>Próxima acción</td><td>Qué hay que hacer con esta persona</td></tr>
<tr><td>Fecha de la próxima acción</td><td>Cuándo, para no depender de la memoria</td></tr>
<tr><td>Responsable</td><td>Quién la tiene</td></tr>
</table>
<p>La columna que más cambia las cosas es <strong>«próxima acción + fecha»</strong>: convierte una lista de nombres en una lista de pendientes.</p>

<h2>Después: cuando la planilla deja de alcanzar</h2>
<ol>
<li>Pasas más tiempo actualizándola que atendiendo.</li>
<li>Tienes que revisar la planilla cada mañana para ver a quién escribirle.</li>
<li>Más de una persona la edita y empiezan los datos distintos.</li>
<li>Quieres saber qué canal te trae clientes y no puedes sacarlo sin armar un reporte a mano.</li>
</ol>
<p>Ahí es donde un CRM cambia el trabajo: las conversaciones quedan registradas solas, las etapas se mueven con cada paso y el sistema te avisa a quién retomar. No reemplaza tu criterio: te quita la parte que depende de acordarse.</p>

<div class="caja"><p><strong>Una prueba simple:</strong> elige diez clientes al azar de tu planilla. ¿Sabes en qué etapa está cada uno y cuándo fue el último mensaje? Si no, ya sabes qué falta.</p></div>
${invita("¿Tu planilla ya te queda corta?", "Cuéntanos cómo llevas hoy tus clientes y vemos cuál es el siguiente paso, aunque sea ordenar lo que ya tienes.", "/agendar/", "Agendar una reunión")}`,
  },
];


const ORDEN = ["te-escribieron-anoche", "web-profesional-2026", "tienda-abierta-no-es-tienda-que-vende", "whatsapp-business-o-crm", "medula-el-cerebro-de-tu-empresa", "que-pasa-si-dejas-de-pagar-tu-web", "google-maps", "primer-mensaje-respuesta", "que-preparar-antes-de-hacer-tu-web", "planilla-de-clientes-se-queda-corta"];
export const ARTICULOS = ORDEN.map((slug) => TODOS.find((a) => a.slug === slug));

/* ── Páginas ──────────────────────────────────────────────────────────── */
const tarjeta = (a, i = 0) => `<a class="post${a.destacado ? " destacado" : ""} revelar" style="--d:${(i % 3) * 0.06}s" href="/blog/${a.slug}/">
  <div><div class="etq"><span>${a.territorio}</span><span>${a.min} min de lectura</span></div>
  <h3 style="margin-top:14px">${a.titulo}</h3></div>
  <div style="display:grid;gap:14px;align-content:end"><p>${a.extracto}</p><span class="pie-post"><span>Enfoque: ${a.enfoque}</span><span class="azul">Leer ${flecha}</span></span></div>
</a>`;

export function blogIndice() {
  const cuerpo = `
<section class="texto-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><span>Blog</span></div>
  <p class="rotulo" style="margin-bottom:18px">Blog</p>
  <h1>Ideas para que tu negocio no pierda clientes.</h1>
  <p class="bajada">Criterio, no relleno. Qué mirar, qué evitar y cuándo conviene cada herramienta.</p>
</div></section>
<section class="seccion" style="padding-top:clamp(16px,3vw,32px)"><div class="wrap"><div class="blog-grid">${ARTICULOS.map(tarjeta).join("")}</div></div></section>`;
  return pagina({ titulo: "Blog — Cóndor AI", desc: "Ideas prácticas sobre web, tienda online, atención y seguimiento de clientes. Criterio para decidir qué herramienta conviene y cuándo.", ruta: "/blog/", cuerpo });
}

export function blogArticulo(a) {
  const otros = ARTICULOS.filter((x) => x.slug !== a.slug).slice(0, 3);
  const cuerpo = `
<article>
<section class="texto-hero"><div class="wrap">
  <div class="migas"><a href="/">Inicio</a><span>/</span><a href="/blog/">Blog</a></div>
  <div class="articulo-meta"><span class="etq">${a.territorio}</span><span>${a.min} min de lectura</span></div>
  <h1 style="max-width:20ch">${a.titulo}</h1>
  <p class="bajada">${a.extracto}</p>
</div></section>
<div class="wrap"><div class="prosa">${a.cuerpo}</div></div>
</article>
<section class="seccion relacionados" style="padding-top:0"><div class="wrap"><h2>Sigue leyendo</h2><div class="blog-grid">${otros.map((o, i) => tarjeta({ ...o, destacado: false }, i)).join("")}</div></div></section>`;
  return pagina({
    titulo: `${a.titulo} — Cóndor AI`, desc: a.extracto, ruta: `/blog/${a.slug}/`, cuerpo,
    jsonld: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.titulo, description: a.extracto, author: { "@type": "Organization", name: "Cóndor AI" }, publisher: { "@type": "Organization", name: "Cóndor AI" }, mainEntityOfPage: `https://condorai.cl/blog/${a.slug}/` }),
  });
}
