/* Términos y condiciones de Cóndor: FUENTE ÚNICA (25-oct-2026).
   Base: borrador de Joaquín (Orkut), ajustado con lo que Max definió el 25-oct:
   - un documento + un anexo por país (Chile, Perú, Colombia, México, Argentina); rige la ley chilena,
     sin quitarle al consumidor los derechos irrenunciables de su país;
   - al terminar, el cliente recibe la carpeta completa del proyecto y las credenciales (10 días hábiles);
   - cobro automático (mensual o anual con 25 % menos); el anual no se reembolsa a mitad de año;
   - cancelar por botón, ticket en el chat del portal, correo o WhatsApp: cualquiera basta;
   - soporte: respuesta en 5 días hábiles, urgencias primero; sin porcentaje de disponibilidad;
   - fuera de Chile se emite factura de exportación de servicios.
   Lo usan el sitio (scripts/gen-condor.mjs → /legal/terminos/) y el portal (aceptación al entrar).
   Cambiar el texto = subir VERSION y anotar qué cambió en CAMBIOS: el portal vuelve a pedir la aceptación.
   Conviene que un abogado lo revise antes de cada versión. */

export const VERSION = "1.0";
export const VIGENTE_DESDE = "25 de octubre de 2026";

/** Lo que cambió en cada versión, en simple. Se le muestra a quien aceptó una versión anterior. */
export const CAMBIOS = {
  "1.0": [],
};

export const EMPRESA = {
  razonSocial: "CondorAI Capital Group SpA",
  rut: "78.506.854-8",
  domicilio: "Las Condes, Santiago, Chile",
  correo: "contacto@condorai.cl",
  whatsapp: "56988989824",
  whatsappVisible: "+56 9 8898 9824",
  web: "condorai.cl",
  portal: "condorai.cl/acceso",
};

export const SERVICIOS = {
  sites: { nombre: "Cóndor Sites", corto: "Sites" },
  ecommerce: { nombre: "Cóndor Ecommerce", corto: "Ecommerce" },
  crm: { nombre: "Cóndor CRM", corto: "CRM" },
};

export const PAISES = {
  cl: { nombre: "Chile", moneda: "CLP", monedaNombre: "pesos chilenos" },
  pe: { nombre: "Perú", moneda: "PEN", monedaNombre: "soles" },
  co: { nombre: "Colombia", moneda: "COP", monedaNombre: "pesos colombianos" },
  mx: { nombre: "México", moneda: "MXN", monedaNombre: "pesos mexicanos" },
  ar: { nombre: "Argentina", moneda: "ARS", monedaNombre: "pesos argentinos" },
};

/** El país del cliente sale de la moneda en que paga; sin moneda conocida, Chile. */
export function paisDeMoneda(moneda) {
  const m = (moneda ?? "").toUpperCase();
  return Object.keys(PAISES).find((k) => PAISES[k].moneda === m) ?? "cl";
}

/** Línea del cliente → servicio. Las líneas viejas o vacías se tratan como Sites. */
export function servicioDeLinea(linea) {
  return linea === "ecommerce" || linea === "crm" ? linea : "sites";
}

const E = EMPRESA;
const correo = `<a href="mailto:${E.correo}">${E.correo}</a>`;
const wsp = `<a href="https://wa.me/${E.whatsapp}">${E.whatsappVisible}</a>`;

/* ── Términos generales ─────────────────────────────────────────────────
   Cada sección: { n, titulo, parrafos }. Los párrafos son HTML simple (b, a, em). */
export const GENERALES = {
  id: "generales",
  titulo: "Términos y Condiciones Generales",
  bajada: "Se aplican a Cóndor Sites, Cóndor Ecommerce y Cóndor CRM, en todos los países donde prestamos servicio.",
  secciones: [
    { n: 1, titulo: "Partes y definiciones", parrafos: [
      `1.1. <b>Proveedor</b>: ${E.razonSocial}, RUT ${E.rut}, con domicilio en ${E.domicilio}, que presta sus servicios bajo la marca Cóndor («Cóndor»). Correo ${correo}, WhatsApp ${wsp}, sitio ${E.web}.`,
      `1.2. <b>Cliente</b>: la persona o empresa que contrata uno o más Servicios. <b>Servicio</b>: Cóndor Sites, Cóndor Ecommerce o Cóndor CRM. <b>Propuesta</b>: la cotización o propuesta escrita que el Cliente aceptó. <b>Portal</b>: el área de clientes en ${E.portal}. <b>Período</b>: el mes o el año pagado, contado desde la activación. <b>Anexo de País</b>: las reglas propias del país del Cliente que forman parte de este contrato. <b>Día hábil</b>: de lunes a viernes, sin festivos de Chile.`,
      `1.3. <b>Contenidos del Cliente</b>: textos, imágenes, marcas, catálogos, contactos y conversaciones que el Cliente aporta o genera. <b>Entregables</b>: lo que Cóndor crea para el proyecto del Cliente (diseño, código, textos, configuraciones). <b>Plataforma</b>: el Portal, las herramientas internas de Cóndor y el software de terceros con que se presta el Servicio.`,
    ] },
    { n: 2, titulo: "Documentos del contrato", parrafos: [
      `2.1. El contrato lo forman estos Términos Generales, el Contrato del Servicio contratado, el Anexo del país del Cliente y, si existe, la Propuesta.`,
      `2.2. Si se contradicen, se aplica en este orden: (a) los derechos que la ley del país del Cliente le reconoce como irrenunciables; (b) la Propuesta, en lo que regule de forma específica; (c) el Contrato del Servicio; (d) el Anexo de País; (e) estos Términos Generales.`,
    ] },
    { n: 3, titulo: "Aceptación electrónica", parrafos: [
      `3.1. Estos documentos están siempre disponibles en ${E.web}/legal/terminos y en el Portal, para leerlos, imprimirlos y descargarlos antes y después de contratar.`,
      `3.2. El contrato se perfecciona cuando el Cliente marca la casilla de aceptación y presiona el botón «Aceptar» en el Portal o en la contratación en línea. Esa acción tiene el valor de una firma electrónica conforme a la Ley N° 19.799 de Chile y a las normas equivalentes del país del Cliente.`,
      `3.3. Cóndor guarda un registro de cada aceptación: fecha y hora, versión, Servicio, país, dirección IP, navegador y una huella digital (SHA-256) del texto aceptado. El Cliente puede ver y descargar en el Portal la versión que aceptó; si la pide, se la enviamos por correo.`,
      `3.4. Quien acepta declara ser mayor de edad, que sus datos son verdaderos y, si actúa por una empresa, que tiene facultades para obligarla.`,
      `3.5. Si el Cliente contrató antes mediante una Propuesta, aceptar estos Términos no cambia el precio ni los plazos ya pactados en ella.`,
    ] },
    { n: 4, titulo: "Precios, impuestos y facturación", parrafos: [
      `4.1. El precio es el de la Propuesta o, si no la hay, el publicado en ${E.web} para el país del Cliente al momento de contratar, en la moneda indicada en su Anexo de País.`,
      `4.2. En Chile los precios incluyen IVA, salvo que se indique otra cosa, y se emite boleta o factura electrónica. A Clientes fuera de Chile, Cóndor les emite una factura de exportación de servicios desde Chile. Si la ley del país del Cliente grava el Servicio con impuestos, retenciones o percepciones, se aplican según corresponda y se informan antes de cobrar; los que esa ley pone a cargo del Cliente (por ejemplo, los que agrega su banco o su tarjeta) son del Cliente.`,
      `4.3. El documento tributario se envía al correo del Cliente y queda disponible en el Portal, sección Comprobantes, dentro de 5 días hábiles desde el pago.`,
      `4.4. Los costos de terceros que no están en el precio (dominio, pasarelas de pago, inversión en anuncios, mensajería y aplicaciones) son del Cliente y se informan antes de contratar o de incurrir en ellos.`,
    ] },
    { n: 5, titulo: "Cobro automático, plan mensual y plan anual", parrafos: [
      `5.1. <b>Plan mensual.</b> Se paga por adelantado cada mes, con cobro automático al medio de pago que el Cliente registra en Mercado Pago o dLocal Go. El Cliente autoriza expresamente esos cobros y puede revocar la autorización cuando quiera; revocarla no extingue lo ya devengado y, si no cancela el Servicio, se aplica la cláusula 9.`,
      `5.2. <b>Plan anual.</b> Se paga por adelantado por doce meses, con 25 % de descuento frente a doce mensualidades. Se renueva por otro año salvo que el Cliente cancele antes; Cóndor avisa por correo al menos 15 días antes de la renovación, con monto y fecha, y el Cliente puede pasarse al plan mensual.`,
      `5.3. La fecha y el monto del próximo cobro están siempre a la vista en el Portal, sección Mi plan.`,
      `5.4. Si un cobro falla, Cóndor reintenta y avisa al Cliente. Si cobra intereses por atraso, no superarán el máximo que permita la ley.`,
      `5.5. Los precios solo cambian con aviso escrito de 30 días corridos. El cambio no afecta Períodos ya pagados ni un plan anual en curso, y el Cliente puede cancelar sin costo antes de que rija.`,
    ] },
    { n: 6, titulo: "Duración", parrafos: [
      `El Servicio dura un Período y se renueva solo por Períodos iguales hasta que se cancele. No hay permanencia mínima ni cobro por término anticipado, salvo el plazo inicial que la Propuesta pacte expresamente según el Contrato del Servicio.`,
    ] },
    { n: 7, titulo: "Cancelación por el Cliente", parrafos: [
      `7.1. El Cliente puede cancelar cuando quiera, sin dar motivos ni pagar multas, por <b>cualquiera</b> de estos medios, a su elección (basta uno): (a) el botón «Cancelar servicio» en Mi cuenta del Portal; (b) un mensaje o ticket en el Chat del Portal; (c) un correo a ${correo}; o (d) un WhatsApp al ${wsp}. Cóndor no exige llamadas, trámites presenciales ni escuchar ofertas para cancelar.`,
      `7.2. La cancelación se hace efectiva al terminar el Período pagado. Hasta esa fecha el Servicio sigue activo, y después no hay más cobros. En el plan anual, el Servicio sigue hasta el final del año pagado y no se reembolsan los meses restantes, salvo lo dispuesto en las cláusulas 10 y 11.`,
      `7.3. Con el botón del Portal, la cancelación queda confirmada en pantalla y registrada al instante. Por los otros medios, Cóndor la confirma por escrito dentro de 5 días hábiles, indicando la fecha de término.`,
      `7.4. Si el Cliente cancela al menos 2 días hábiles antes de la renovación y aun así se le cobra, Cóndor le reembolsa el monto completo dentro de 10 días hábiles.`,
      `7.5. La cancelación no extingue los montos ya devengados ni las comisiones por ventas hechas hasta la fecha de término.`,
    ] },
    { n: 8, titulo: "Lo que el Cliente recibe al terminar", parrafos: [
      `8.1. Cuando el Servicio termina, por cualquier causa, Cóndor entrega al Cliente dentro de <b>10 días hábiles</b> (dos semanas hábiles), sin costo: (a) la <b>carpeta completa del proyecto</b> (diseños, código, textos, imágenes y archivos de configuración), para que el Cliente o quien él elija pueda volver a publicarlo; (b) las <b>credenciales</b> de los servicios que Cóndor usó como proveedor para el proyecto, como hosting, DNS y dominio; y (c) una <b>exportación de sus datos</b> en formatos comunes (CSV, JSON o archivos originales).`,
      `8.2. No se entregan el Portal ni las herramientas internas de Cóndor, ni el software de terceros con licencia de Cóndor. Cuando el Servicio funciona sobre software de terceros, se entrega la exportación de los datos y la configuración, y Cóndor coordina el traspaso de las cuentas a nombre del Cliente cuando el tercero lo permite.`,
      `8.3. Después de 30 días desde la entrega, Cóndor puede eliminar sus copias, salvo que la ley le obligue a conservarlas. Los trabajos de migración que excedan esta entrega se cotizan antes de hacerlos.`,
    ] },
    { n: 9, titulo: "Suspensión por falta de pago", parrafos: [
      `9.1. Si un cobro sigue impago 10 días corridos después del aviso, Cóndor puede suspender el Servicio, avisando por escrito. También puede suspenderlo ante un riesgo de seguridad o una orden de autoridad.`,
      `9.2. Cóndor reactiva el Servicio dentro de 1 día hábil desde que se regulariza el pago, y conserva los contenidos durante la suspensión. No suspende por un cobro que el Cliente haya reclamado de buena fe mientras no se resuelva.`,
      `9.3. Si la deuda sigue impaga 30 días corridos, el Servicio puede terminar según la cláusula 11.2, y el Cliente igualmente recibe lo indicado en la cláusula 8.`,
    ] },
    { n: 10, titulo: "Retracto y reembolsos", parrafos: [
      `10.1. Si el Cliente es consumidor, puede retractarse dentro de 10 días corridos desde la contratación, o del plazo mayor que fije la ley de su país (ver su Anexo), siempre que el Servicio no se haya empezado a prestar con su consentimiento expreso. Se le devuelve lo pagado, descontando solo lo ya prestado a su pedido.`,
      `10.2. Fuera del retracto, los Períodos ya iniciados no se reembolsan, salvo cobros indebidos, terminación sin causa por Cóndor o incumplimiento grave de Cóndor. Los reembolsos se hacen por el mismo medio de pago dentro de 10 días hábiles.`,
    ] },
    { n: 11, titulo: "Terminación", parrafos: [
      `11.1. Cóndor puede terminar sin causa con aviso de 30 días corridos, reembolsando la parte no usada del Período pagado.`,
      `11.2. Cóndor puede terminar por incumplimiento grave del Cliente (deuda de más de 30 días, uso ilícito o fraudulento, infracción reiterada de estos Términos o riesgo para la seguridad), con aviso escrito y 5 días hábiles para corregirlo, salvo uso ilícito o riesgo de seguridad.`,
      `11.3. Si Cóndor incumple gravemente y no lo corrige dentro de 5 días hábiles desde el aviso, el Cliente puede terminar de inmediato y recibe la parte no usada del Período pagado.`,
      `11.4. En todos los casos se aplica la cláusula 8.`,
    ] },
    { n: 12, titulo: "Soporte", parrafos: [
      `12.1. El soporte se pide por el Chat del Portal (preferente), por correo o por WhatsApp, en días hábiles y horario de oficina de Chile.`,
      `12.2. Cóndor responde en un plazo máximo de <b>5 días hábiles</b>. Las urgencias (sitio, tienda o CRM fuera de servicio, o un problema de seguridad) se atienden con prioridad sobre el resto.`,
      `12.3. Cóndor presta los Servicios con diligencia profesional, pero no garantiza un funcionamiento ininterrumpido. Las mantenciones programadas se avisan con anticipación cuando es posible.`,
    ] },
    { n: 13, titulo: "Obligaciones del Cliente", parrafos: [
      `Entregar a tiempo los contenidos y accesos que se le pidan (los atrasos corren los plazos de Cóndor); resguardar sus contraseñas; cumplir las normas de su actividad (tributarias, de consumo, de publicidad, de datos y de propiedad intelectual); y no usar el Servicio para enviar comunicaciones masivas no solicitadas, publicar contenidos ilícitos o vulnerar sistemas o derechos de terceros.`,
    ] },
    { n: 14, titulo: "Propiedad intelectual", parrafos: [
      `14.1. Los Contenidos del Cliente, sus marcas y sus bases de datos son suyos. El Cliente da a Cóndor una licencia limitada y revocable solo para prestar el Servicio.`,
      `14.2. Los Entregables hechos a medida para el Cliente son suyos una vez pagados. Si incluyen componentes reutilizables de Cóndor, el Cliente recibe sobre ellos una licencia gratuita, perpetua y no exclusiva para usarlos, modificarlos y publicarlos en su proyecto.`,
      `14.3. La Plataforma, el Portal, las herramientas y la marca Cóndor son de Cóndor o de sus licenciantes.`,
      `14.4. Cóndor puede mostrar el proyecto publicado en su portafolio (nombre, logo y capturas), salvo que el Cliente se oponga por escrito en cualquier momento.`,
    ] },
    { n: 15, titulo: "Datos personales", parrafos: [
      `15.1. Cada parte trata los datos personales conforme a la Ley N° 19.628 de Chile, a la Ley N° 21.719 desde su entrada en vigencia y a la ley de protección de datos del país del Cliente indicada en su Anexo.`,
      `15.2. Sobre los datos de los clientes finales del Cliente (compradores, contactos, conversaciones), el Cliente es el responsable y Cóndor el encargado: los trata solo por cuenta y según instrucciones del Cliente, con medidas de seguridad razonables, sin cederlos ni usarlos para fines propios, y le avisa sin demora de cualquier vulneración que los afecte. Cóndor puede apoyarse en proveedores de hosting, base de datos, mensajería y pagos, que pueden almacenar datos fuera del país del Cliente, con obligaciones equivalentes.`,
      `15.3. Sobre los datos del propio Cliente (contacto y facturación), Cóndor es el responsable y los usa para ejecutar el contrato y cumplir obligaciones legales, según su <a href="https://${E.web}/legal/privacidad/">política de privacidad</a>. Los derechos de acceso, rectificación, supresión, oposición y portabilidad se ejercen escribiendo a ${correo}.`,
    ] },
    { n: 16, titulo: "Confidencialidad y responsabilidad", parrafos: [
      `16.1. Cada parte guarda reserva de la información confidencial de la otra durante el contrato y 2 años después.`,
      `16.2. Cada parte responde por los daños directos que cause con dolo o culpa. Salvo dolo o culpa grave, y sin afectar los derechos irrenunciables del consumidor, la responsabilidad total de cada parte se limita a lo pagado por el Cliente en los 12 meses anteriores al hecho, y ninguna responde por daños indirectos ni lucro cesante.`,
      `16.3. Cóndor no garantiza resultados comerciales (ventas, posicionamiento o conversiones) ni responde por fallas de terceros fuera de su control razonable. El Cliente responde por la licitud de sus contenidos y por sus obligaciones con sus propios clientes.`,
      `16.4. Ninguna parte responde por caso fortuito o fuerza mayor si lo avisa pronto y mitiga sus efectos. Si dura más de 30 días, cualquiera puede terminar sin responsabilidad, con reembolso de la parte no usada del Período.`,
    ] },
    { n: 17, titulo: "Cambios a estos Términos", parrafos: [
      `17.1. Cóndor puede actualizar estos Términos avisando con 30 días corridos por correo y en el Portal. Los cambios no afectan Períodos ya pagados.`,
      `17.2. Para seguir usando el Portal se pedirá aceptar la nueva versión. Si el Cliente no la acepta, puede cancelar sin penalidad desde esa misma pantalla o por cualquiera de los medios de la cláusula 7, y hasta la fecha de término rige la versión que aceptó antes.`,
    ] },
    { n: 18, titulo: "Notificaciones", parrafos: [
      `Las comunicaciones se envían al correo registrado del Cliente o al Portal, y se entienden recibidas el día hábil siguiente. Las del Cliente se dirigen a ${correo} o por el Chat del Portal.`,
    ] },
    { n: 19, titulo: "Ley aplicable y controversias", parrafos: [
      `19.1. Este contrato se rige por la ley de Chile, sin perjuicio de los derechos irrenunciables que la ley del país del Cliente le reconozca como consumidor.`,
      `19.2. Ante un reclamo escrito, las partes buscan primero una solución directa durante 30 días. El Cliente consumidor puede siempre acudir a la autoridad de protección al consumidor y a los tribunales de su domicilio indicados en su Anexo. Si el Cliente contrata para su empresa o negocio, las partes se someten a los tribunales ordinarios de Santiago de Chile.`,
      `19.3. Si una cláusula resulta nula, el resto sigue vigente. Que una parte tolere un incumplimiento no significa que renuncie a sus derechos.`,
    ] },
  ],
};

/* ── Contratos por servicio ─────────────────────────────────────────────── */
export const CONTRATOS = {
  sites: {
    id: "sites",
    titulo: "Contrato de suscripción a Cóndor Sites",
    bajada: "Incorpora los Términos Generales y el Anexo del país del Cliente.",
    secciones: [
      { n: 1, titulo: "Servicio", parrafos: [`Cóndor diseña, publica y mantiene el sitio web del Cliente: diseño propio para su negocio, hosting, soporte y ajustes menores cada mes.`] },
      { n: 2, titulo: "Precio", parrafos: [`El de la Propuesta o el publicado para el país del Cliente al contratar (cláusula 4 de los Términos Generales). La creación inicial no tiene costo, salvo que la Propuesta diga otra cosa.`] },
      { n: 3, titulo: "Puesta en marcha", parrafos: [`La primera versión se entrega en el plazo de la Propuesta o, si no lo indica, dentro de 15 días hábiles desde que el Cliente entrega los contenidos y accesos. El Cliente tiene 5 días hábiles para pedir correcciones razonables antes de publicar.`] },
      { n: 4, titulo: "Ajustes menores", parrafos: [`Incluyen cambios de textos, imágenes, datos de contacto, horarios y enlaces sobre lo ya publicado, hasta 4 solicitudes por semana, atendidas dentro de 5 días hábiles. Cada solicitud debe venir completa en un solo mensaje: qué cambiar, dónde y el material necesario (textos, imágenes o enlaces); si falta algo, el plazo corre desde que llega. Las solicitudes no usadas no se acumulan de una semana a otra. Los rediseños, las secciones o funciones nuevas y las integraciones se cotizan aparte y solo se hacen con aprobación escrita.`] },
      { n: 5, titulo: "Dominio y hosting", parrafos: [`El dominio se registra a nombre del Cliente, que es su titular y puede transferirlo cuando quiera. Si Cóndor gestiona su renovación, informa antes el costo. Cóndor administra el hosting mientras el Servicio esté vigente.`] },
      { n: 6, titulo: "Término", parrafos: [`Se aplican las cláusulas 7 y 8 de los Términos Generales. El sitio sigue en línea hasta el final del Período pagado; luego se da de baja y, dentro de 10 días hábiles, el Cliente recibe la carpeta completa del proyecto y las credenciales de hosting, DNS y dominio para volver a publicarlo donde quiera.`] },
      { n: 7, titulo: "Contenidos", parrafos: [`El Cliente garantiza que los contenidos que entrega son lícitos y suyos o autorizados, y mantiene indemne a Cóndor frente a reclamos de terceros por ellos.`] },
    ],
  },
  ecommerce: {
    id: "ecommerce",
    titulo: "Contrato de suscripción a Cóndor Ecommerce",
    bajada: "Incorpora los Términos Generales y el Anexo del país del Cliente.",
    secciones: [
      { n: 1, titulo: "Servicio", parrafos: [`Administración de la tienda en línea del Cliente de punta a punta: construcción, pagos con Mercado Pago y dLocal Go, stock, boleta electrónica, reporte mensual y, si el Cliente lo pide, gestión de sus campañas de anuncios.`] },
      { n: 2, titulo: "Precio y comisión", parrafos: [
        `2.1. Una tarifa mensual (la de la Propuesta o la publicada para el país del Cliente) más una <b>comisión de 6,7 %</b> sobre el monto facturado de cada venta de la tienda, que incluye la gestión de anuncios.`,
        `2.2. La comisión se liquida cada mes con el detalle de cada venta. Las ventas anuladas, devueltas o con contracargo no generan comisión; si ya se cobró, se descuenta en la liquidación siguiente. Las tarifas de las pasarelas las cobran directamente esos proveedores y son del Cliente.`,
      ] },
      { n: 3, titulo: "Cuentas y fondos", parrafos: [`Las cuentas de las pasarelas, los datos tributarios y los fondos son del Cliente. Los compradores le pagan directamente a sus cuentas; Cóndor no recibe ni custodia fondos, salvo pacto escrito.`] },
      { n: 4, titulo: "El Cliente como vendedor", parrafos: [`El Cliente debe estar habilitado para vender y emitir documentos tributarios en su país. Responde por sus productos, precios, ofertas, despachos, garantías, cambios, devoluciones y retracto frente a sus compradores, y por sus impuestos. Cóndor configura la tienda para facilitarlo, sin reemplazar su asesoría contable o legal.`] },
      { n: 5, titulo: "Anuncios", parrafos: [`Incluye crear, monitorear y optimizar campañas en las plataformas acordadas. La inversión publicitaria la paga el Cliente a las plataformas por el monto que apruebe por escrito; Cóndor no puede exceder el presupuesto autorizado ni garantiza ventas o retorno.`] },
      { n: 6, titulo: "Stock y despachos", parrafos: [`Cóndor entrega las herramientas de inventario. Actualizar existencias, embalar, despachar y atender la postventa corresponde al Cliente, salvo que se contrate aparte.`] },
      { n: 7, titulo: "Reporte y liquidación", parrafos: [`Dentro de los primeros 5 días hábiles de cada mes, Cóndor entrega un reporte con ventas, comisiones e inversión publicitaria. El Cliente tiene 10 días hábiles para observarlo; sin observaciones se entiende aceptado, salvo errores evidentes.`] },
      { n: 8, titulo: "Término", parrafos: [`Se aplican las cláusulas 7 y 8 de los Términos Generales. La tienda opera hasta el final del Período pagado: las ventas hasta esa fecha generan comisión y las posteriores no. Las campañas se pausan al término, salvo otra instrucción. El Cliente atiende los pedidos pagados pendientes. Dentro de 10 días hábiles, Cóndor entrega la carpeta del proyecto, las credenciales, el catálogo, el historial de pedidos y la base de clientes, y traspasa las cuentas de pasarelas, anuncios y dominio, que son del Cliente.`] },
      { n: 9, titulo: "Contracargos y urgencias", parrafos: [`El Cliente asume los contracargos según las reglas de cada pasarela; Cóndor aporta la información para defenderlos y usa herramientas antifraude. Los problemas que impidan vender se atienden con prioridad (cláusula 12 de los Términos Generales).`] },
    ],
  },
  crm: {
    id: "crm",
    titulo: "Contrato de suscripción a Cóndor CRM",
    bajada: "Incorpora los Términos Generales, el Anexo del país del Cliente y la Propuesta aceptada.",
    secciones: [
      { n: 1, titulo: "Servicio", parrafos: [`Un sistema que reúne en un solo lugar los mensajes de los canales contratados, responde de inmediato de día o de noche con respuestas automatizadas configuradas junto al Cliente, gestiona la agenda con recordatorios y da seguimiento a cada consulta hasta que el cliente final decide.`] },
      { n: 2, titulo: "Precio a medida", parrafos: [`El precio mensual y, si corresponde, el costo único de implementación constan en la Propuesta, según la operación, los canales, los usuarios y el volumen de mensajes. Un cambio de alcance que altere el precio requiere la aceptación escrita del Cliente.`] },
      { n: 3, titulo: "Implementación", parrafos: [`Dentro del plazo de la Propuesta o, si no lo indica, de 20 días hábiles desde que el Cliente entrega la información y los accesos necesarios. El Cliente valida las respuestas automatizadas antes de la puesta en marcha.`] },
      { n: 4, titulo: "Plazo inicial", parrafos: [`La suscripción es mensual. Si la Propuesta pacta un plazo inicial de hasta 6 meses porque Cóndor asume o difiere el costo de implementación, y el Cliente cancela antes, solo paga el saldo no amortizado y documentado de ese costo, sin superar las mensualidades que faltan del plazo inicial y sin otras multas. Sin ese pacto, cancelar no tiene costo.`] },
      { n: 5, titulo: "Canales de terceros", parrafos: [`El Servicio funciona sobre WhatsApp Business Platform, Instagram, Messenger, correo y telefonía, y el Cliente debe cumplir sus políticas. Las tarifas de esos terceros son del Cliente y se informan antes. Cóndor no responde por suspensiones o cambios de política de terceros, pero ayuda al Cliente a recuperar sus cuentas.`] },
      { n: 6, titulo: "Respuestas automatizadas", parrafos: [`El Cliente responde por su contenido: informa a sus contactos que hablan con un sistema automatizado cuando la ley lo exija, envía mensajes promocionales solo a quienes lo consintieron y respeta toda solicitud de baja. Cóndor incorpora los mecanismos técnicos para hacerlo.`] },
      { n: 7, titulo: "Datos y seguridad", parrafos: [`Cóndor es encargado y el Cliente responsable de los datos (cláusula 15 de los Términos Generales). Cóndor no usa las conversaciones para entrenar modelos propios ni de terceros, ni para otros fines, sin autorización expresa. Conserva los registros 12 meses o el plazo que indique el Cliente y luego los elimina. Mantiene control de acceso por usuario, cifrado en tránsito, respaldos y registro de accesos; el Cliente administra sus usuarios y da de baja a quienes dejen su organización.`] },
      { n: 8, titulo: "Término", parrafos: [`Se aplican las cláusulas 7 y 8 de los Términos Generales y la cláusula 4 de este contrato. El Servicio sigue activo hasta el final del Período pagado; luego se desconectan los canales y Cóndor ayuda a traspasar líneas y cuentas. Dentro de 10 días hábiles entrega los contactos, el historial de conversaciones, la agenda y las configuraciones en formato estándar, y después elimina la información según la cláusula 8.3.`] },
      { n: 9, titulo: "Alcance", parrafos: [`El Servicio es una herramienta de apoyo comercial: no garantiza que las consultas se conviertan en ventas, y Cóndor no responde por los precios o compromisos que el Cliente asuma con sus contactos. Los incidentes que dejen al CRM sin funcionar se atienden con prioridad (cláusula 12 de los Términos Generales).`] },
    ],
  },
};

/* ── Anexos por país ─────────────────────────────────────────────────────
   Solo lo que cambia por país: moneda, impuestos, ley del consumidor, autoridad, retracto y datos. */
const anexo = (id, filas) => ({
  id: `anexo-${id}`,
  titulo: `Anexo de País: ${PAISES[id].nombre}`,
  bajada: `Se aplica a los Clientes con domicilio en ${PAISES[id].nombre}. Prevalece sobre los Términos Generales en lo que reconozca derechos irrenunciables.`,
  secciones: filas.map(([titulo, texto], i) => ({ n: i + 1, titulo, parrafos: [texto] })),
});

export const ANEXOS = {
  cl: anexo("cl", [
    ["Moneda e impuestos", `Precios en pesos chilenos (CLP), con IVA incluido salvo que se indique otra cosa. Cóndor emite boleta o factura electrónica.`],
    ["Consumidor", `Si el Cliente es consumidor, se aplica la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores. Puede retractarse dentro de 10 días desde la contratación y antes de que el Servicio se preste (artículo 3 bis).`],
    ["Reclamos", `Además de los canales de Cóndor, el consumidor puede acudir al Servicio Nacional del Consumidor (SERNAC) y al Juzgado de Policía Local de su domicilio.`],
    ["Datos personales", `Ley N° 19.628 y, desde su entrada en vigencia, Ley N° 21.719.`],
    ["Firma electrónica", `Ley N° 19.799.`],
  ]),
  pe: anexo("pe", [
    ["Moneda e impuestos", `Precios en soles (PEN). Cóndor emite una factura de exportación de servicios desde Chile; los impuestos peruanos que correspondan se aplican según la cláusula 4.2 de los Términos Generales.`],
    ["Consumidor", `Si el Cliente es consumidor, se aplica el Código de Protección y Defensa del Consumidor (Ley N° 29571). Cóndor le reconoce el derecho de retracto de la cláusula 10 de los Términos Generales.`],
    ["Reclamos", `Cóndor recibe reclamos por el Chat del Portal o en ${correo} y responde en un plazo máximo de 15 días hábiles. El consumidor puede acudir además al INDECOPI.`],
    ["Datos personales", `Ley N° 29733, de Protección de Datos Personales, y su reglamento.`],
    ["Firma electrónica", `Ley N° 27269, de Firmas y Certificados Digitales.`],
  ]),
  co: anexo("co", [
    ["Moneda e impuestos", `Precios en pesos colombianos (COP). Cóndor emite una factura de exportación de servicios desde Chile; los impuestos colombianos que correspondan se aplican según la cláusula 4.2 de los Términos Generales.`],
    ["Consumidor", `Si el Cliente es consumidor, se aplica el Estatuto del Consumidor (Ley 1480 de 2011). El retracto de la cláusula 10 de los Términos Generales (10 días corridos) mejora el plazo legal de 5 días hábiles; se mantiene además la reversión del pago en los casos del artículo 51.`],
    ["Reclamos", `Además de los canales de Cóndor, el consumidor puede acudir a la Superintendencia de Industria y Comercio (SIC).`],
    ["Datos personales", `Ley Estatutaria 1581 de 2012 y sus decretos reglamentarios.`],
    ["Firma electrónica", `Ley 527 de 1999.`],
  ]),
  mx: anexo("mx", [
    ["Moneda e impuestos", `Precios en pesos mexicanos (MXN). Cóndor emite una factura de exportación de servicios desde Chile; los impuestos mexicanos que correspondan se aplican según la cláusula 4.2 de los Términos Generales.`],
    ["Consumidor", `Si el Cliente es consumidor, se aplica la Ley Federal de Protección al Consumidor. El retracto de la cláusula 10 de los Términos Generales (10 días corridos) mejora el plazo de revocación de 5 días hábiles de esa ley.`],
    ["Reclamos", `Además de los canales de Cóndor, el consumidor puede acudir a la Procuraduría Federal del Consumidor (PROFECO).`],
    ["Datos personales", `Ley Federal de Protección de Datos Personales en Posesión de los Particulares.`],
    ["Firma electrónica", `Código de Comercio, en lo relativo a mensajes de datos y firma electrónica.`],
  ]),
  ar: anexo("ar", [
    ["Moneda e impuestos", `Precios en pesos argentinos (ARS). Como esos precios se revisan con frecuencia, todo ajuste se avisa con 30 días corridos según la cláusula 5.5 de los Términos Generales. Cóndor emite una factura de exportación de servicios desde Chile; las percepciones o impuestos argentinos que agreguen el banco o la tarjeta del Cliente son de su cargo.`],
    ["Consumidor", `Si el Cliente es consumidor, se aplica la Ley N° 24.240 de Defensa del Consumidor. Puede revocar la contratación dentro de 10 días corridos (artículo 34), también con el botón «Cancelar servicio» del Portal, que funciona como botón de arrepentimiento y de baja.`],
    ["Reclamos", `Además de los canales de Cóndor, el consumidor puede acudir a la autoridad de defensa del consumidor de su jurisdicción, y son competentes los tribunales de su domicilio.`],
    ["Datos personales", `Ley N° 25.326 de Protección de los Datos Personales.`],
    ["Firma electrónica", `Ley N° 25.506 de Firma Digital.`],
  ]),
};

/* ── Resumen en simple (no reemplaza el texto) ─────────────────────────── */
export function resumen(servicio) {
  const comun = [
    ["Pagas por adelantado", "Cada mes, o cada año con 25 % menos. El cobro es automático y en Mi plan ves siempre la fecha y el monto del próximo."],
    ["Cancelas cuando quieras", "Sin multas ni llamadas: con el botón de Mi cuenta, un mensaje en el chat, un correo o un WhatsApp. Basta uno. Tu servicio sigue hasta el final de lo pagado."],
    ["Te llevas tu trabajo", "Al terminar, en máximo 10 días hábiles recibes la carpeta completa del proyecto, las credenciales y tus datos."],
    ["Lo tuyo es tuyo", "Tu dominio, tus contenidos, tus datos y el diseño hecho para ti."],
    ["Te respondemos", "En máximo 5 días hábiles, y las urgencias primero."],
  ];
  const propio = {
    sites: ["Tu sitio, siempre al día", "Hosting incluido y hasta 4 ajustes menores por semana. Pídelos completos: qué cambiar, dónde y con el material."],
    ecommerce: ["6,7 % por venta", "Además de la tarifa mensual; incluye la gestión de anuncios. La plata de tus ventas llega directo a tus cuentas."],
    crm: ["Precio a medida", "El precio y cualquier plazo inicial están en tu propuesta."],
  }[servicio];
  return [comun[0], propio, ...comun.slice(1)];
}

/** Los tres documentos que acepta un cliente, en orden. */
export function documentosDe(servicio, pais) {
  return [GENERALES, CONTRATOS[servicio], ANEXOS[pais]];
}

/** Texto plano de los documentos, para calcular la huella (SHA-256) de lo aceptado. */
export function textoPlano(docs) {
  const sinHtml = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return [`Versión ${VERSION}`, ...docs.flatMap((d) => [d.titulo, ...d.secciones.flatMap((s) => [`${s.n}. ${s.titulo}`, ...s.parrafos.map(sinHtml)])])].join("\n");
}
