/**
 * Bárbara · alertas operativas a STAFF por Telegram.
 *
 * POR QUÉ EXISTE
 * ---------------------------------------------------------------------------
 * La revisión visual (revision.mjs) ya sabe cazar defectos, y clientes.mjs ya
 * sabe rehacer los slides que se arreglan con otro fondo. Pero cuando un slide
 * seguía roto DESPUÉS de rehacerlo, lo único que pasaba era un `console.log`:
 * la pieza salía con el defecto y el aviso moría en el log de GitHub Actions,
 * que nadie abre salvo cuando ya hay un cliente quejándose.
 *
 * O sea que la revisión ya estaba pagada —cuesta una llamada a Claude por
 * corrida— y su resultado no llegaba a ninguna persona. Eso es peor que no
 * revisar: gastás la plata y encima te queda la sensación de que hay control.
 *
 * Este módulo cierra ese último tramo: manda la alerta al grupo de Cóndor.
 *
 * TRES REGLAS QUE NO SE NEGOCIAN
 * ---------------------------------------------------------------------------
 * 1. NUNCA tumba la generación. Todo está envuelto en try/catch y el peor caso
 *    devuelve `{ enviada: false, motivo }`. La pieza del cliente vale más que
 *    la alerta: si Telegram está caído se pierde el aviso, no el carrusel.
 *
 * 2. VA A STAFF, NO AL CLIENTE. El chat sale SIEMPRE del entorno
 *    (`BARBARA_ALERTAS_CHAT_ID`, y si no está, `TELEGRAM_CHAT_ID`, que es el
 *    grupo de Cóndor). Por eso ninguna función de acá acepta un `chatId` por
 *    parámetro: `cliente.telegram_chat_id` anda dando vueltas por clientes.mjs
 *    y bastaría un descuido para mandarle al cliente "tu pieza salió con el
 *    titular pisado". Eso es peor que no avisar. Si no se puede pasar, no se
 *    puede equivocar.
 *
 * 3. UNA ALERTA POR PIEZA, no una por slide. Un carrusel con 4 slides malos
 *    serían 4 notificaciones seguidas diciendo casi lo mismo, y un canal que
 *    vibra 4 veces por un solo problema es un canal que la gente silencia. Se
 *    agrupan los slides en un mensaje que dice qué cliente, qué pieza y qué
 *    tiene cada slide — una alerta que no dice qué hacer es ruido.
 */

/* `tg` NO se importa arriba a propósito. motor.mjs arrastra sharp, la API de
   Higgsfield, la de Kie y la de OpenAI: con un import estático, correr
   `node --test alertas.test.mjs` para revisar un formateador de texto exige un
   `npm install` completo (hoy, sin node_modules, ese import directamente
   revienta con ERR_MODULE_NOT_FOUND — es lo que ya le pasa a
   auditoria-operativa.test.mjs). Se carga recién al momento de enviar, y sólo
   si nadie inyectó un `tgFn`; en producción clientes.mjs ya tiene motor.mjs en
   caché, así que el import no cuesta nada. */
const tgDeMotor = async () => (await import("./motor.mjs")).tg;

/* Telegram rechaza con 400 cualquier `text` de más de 4096 caracteres, y ahí
   no llega NADA: se pierde la alerta entera por un detalle largo. 4000 deja
   margen para los emojis (que cuentan más de un carácter) sin arriesgar el
   envío. Mismo tope que usa resumenAlertas en auditoria-operativa.mjs. */
export const LIMITE_TELEGRAM = 4000;

/* El `detalle` lo escribe Claude en revision.mjs y ahí no tiene tope de largo.
   Con una frase alcanza para saber qué mirar; el resto lo ve quien abra la
   imagen, que es justamente lo que la alerta le está pidiendo que haga. */
const LARGO_DETALLE = 160;

/**
 * De dónde sale el chat de staff. Mismo orden que auditoria-operativa.mjs, a
 * propósito: los dos avisos operativos tienen que poder redirigirse juntos
 * cambiando un solo secret.
 *
 * `BARBARA_ALERTAS_CHAT_ID` hoy no está cargado; el fallback a
 * `TELEGRAM_CHAT_ID` (que sí está) es lo que hace que esto funcione desde el
 * primer día en vez de quedar esperando una tarea de infra.
 */
export function chatDeStaff(env = process.env) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(env.BARBARA_ALERTAS_CHAT_ID || env.TELEGRAM_CHAT_ID || "").trim();
  return { token, chatId };
}

const recortar = (texto, largo) => {
  const limpio = String(texto ?? "").trim();
  return limpio.length > largo ? `${limpio.slice(0, Math.max(largo - 1, 0))}…` : limpio;
};

/**
 * Junta los veredictos por slide.
 *
 * Hoy clientes.mjs no puede meter el mismo índice dos veces (los rehechos se
 * calculan como "las malas que todavía no están en sinArreglo"), pero esa
 * invariante vive lejos de acá y es fácil de romper al tocar el bucle. Agrupar
 * cuesta tres líneas y evita que un refactor futuro parta una alerta en dos.
 *
 * Los problemas repetidos (mismo tipo y mismo detalle) también se colapsan: la
 * segunda pasada de revisión puede reportar textualmente lo mismo que la
 * primera, y leerlo dos veces no agrega nada.
 */
export function agruparSlides(slides = []) {
  const porIndice = new Map();
  for (const s of slides) {
    if (!s) continue;
    const indice = Number.isFinite(Number(s.indice)) ? Number(s.indice) : porIndice.size;
    const previo = porIndice.get(indice) || { indice, problemas: [] };
    previo.problemas.push(...(Array.isArray(s.problemas) ? s.problemas : []));
    porIndice.set(indice, previo);
  }
  return [...porIndice.values()]
    .sort((a, b) => a.indice - b.indice)
    .map(({ indice, problemas }) => {
      const vistos = new Set();
      const unicos = [];
      for (const p of problemas) {
        const tipo = recortar(p?.tipo || "otro", 40);
        const detalle = recortar(p?.detalle || "", LARGO_DETALLE);
        const clave = `${tipo}|${detalle}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        unicos.push({ tipo, detalle });
      }
      return { indice, problemas: unicos };
    });
}

/**
 * El texto de la alerta.
 *
 * Se separa del envío para poder probarlo sin red y —más importante— para que
 * el contenido quede legible de un vistazo en el test: si mañana alguien saca
 * el nombre del cliente del mensaje, el test lo caza.
 *
 * Devuelve "" cuando no hay slides con problemas. Un mensaje que dice "0
 * slides con defectos" es exactamente el ruido que hace que se termine
 * silenciando el canal, así que la ausencia de problema no se notifica.
 */
export function textoAlertaRevision({
  negocio = "cliente sin nombre", tipo = "pieza", plantilla = "", fecha = "",
  total = 0, slides = [],
} = {}) {
  const conProblemas = agruparSlides(slides);
  if (!conProblemas.length) return "";

  // "carrusel · plantilla foto · 2026-08-30", saltando lo que no vino: una
  // etiqueta vacía ("plantilla: ") hace dudar de si el dato falta o está mal.
  const identidad = [tipo, plantilla && `plantilla ${plantilla}`, fecha].filter(Boolean).join(" · ");
  const deCuantos = Number(total) > 0 ? ` de ${Number(total)}` : "";

  const cabecera =
    `⚠️ Bárbara · revisión visual\n` +
    `Cliente: ${negocio}\n` +
    `Pieza: ${identidad}\n` +
    `${conProblemas.length}${deCuantos} slide(s) siguen con defectos después de rehacerlos:\n\n`;

  /* El cierre dice QUÉ HACER. Sin esta línea, quien lee la alerta no sabe si
     la pieza quedó frenada o si ya está en manos del cliente, y termina
     preguntando por interno — que es el costo real de una alerta ambigua. */
  const cierre = `\n\nLa pieza SE ENTREGÓ igual: un defecto menor le sirve más al cliente que ninguna ` +
    `pieza. Hay que mirarla antes de que se publique.`;

  const lineas = conProblemas.map((s) => {
    const detalle = s.problemas.map((p) => `${p.tipo}: ${p.detalle}`).join(" · ") || "sin detalle";
    return `• slide ${s.indice + 1} — ${detalle}`;
  });

  // Se recorta SÓLO la lista de slides: la cabecera dice de quién es el
  // problema y el cierre dice qué hacer, y las dos tienen que sobrevivir
  // aunque un carrusel largo traiga detalles kilométricos.
  const espacio = LIMITE_TELEGRAM - cabecera.length - cierre.length;
  return cabecera + recortar(lineas.join("\n"), Math.max(espacio, 1)) + cierre;
}

/**
 * Manda un texto al grupo de staff. NUNCA lanza.
 *
 * `tgFn` se inyecta para poder probar sin red; en producción es el `tg` de
 * motor.mjs, el mismo que usa auditoria-operativa.mjs. Se reusa ese en vez de
 * escribir otro fetch para que el día que Telegram cambie de host, o haya que
 * meterle un reintento, se toque un solo lugar.
 */
export async function alertarStaff(texto, { env = process.env, tgFn = null, log = console.log } = {}) {
  const mensaje = String(texto || "").trim();
  if (!mensaje) return { enviada: false, motivo: "sin_texto" };
  try {
    const { token, chatId } = chatDeStaff(env);
    if (!token || !chatId) {
      // No es un error: en local y en los tests no hay secrets de Telegram, y
      // fallar acá obligaría a cargar credenciales sólo para correr el
      // generador. Se deja el texto completo en el log, que es donde estaba
      // antes — no se pierde información respecto de lo que ya había.
      log(`[alertas] sin TELEGRAM_BOT_TOKEN o chat de staff — la alerta queda sólo en el log:\n${mensaje}`);
      return { enviada: false, motivo: "sin_credenciales" };
    }
    const enviar = tgFn || await tgDeMotor();
    const respuesta = await enviar(token, "sendMessage", { chat_id: chatId, text: mensaje });
    /* Se mira el `ok` del CUERPO, no sólo el HTTP: Telegram contesta con una
       `description` legible ("chat not found", "bot was blocked by the user")
       y sin ella un chat mal configurado se ve idéntico a un token revocado.
       Si el cuerpo no se puede leer, se cae al estado HTTP. */
    const cuerpo = await respuesta?.json?.().catch(() => null);
    if (cuerpo ? !cuerpo.ok : !respuesta?.ok) {
      const motivo = cuerpo?.description || `HTTP ${respuesta?.status ?? "?"}`;
      log(`[alertas] Telegram rechazó la alerta (${motivo}) — la pieza sigue su curso.`);
      return { enviada: false, motivo };
    }
    return { enviada: true, messageId: Number(cuerpo?.result?.message_id) || null };
  } catch (error) {
    /* Acá cae la red muerta, un DNS que no resuelve o un `tgFn` roto. Se traga
       a propósito: la alternativa sería que una caída de Telegram matara la
       generación de TODOS los clientes de la corrida por un aviso interno. */
    const motivo = String(error?.message || error).slice(0, 200);
    log(`[alertas] no se pudo avisar a staff (${motivo}) — la pieza sigue su curso.`);
    return { enviada: false, motivo };
  }
}

/**
 * Atajo de un solo llamado para clientes.mjs: compone y manda. NUNCA lanza.
 *
 * Que en el sitio de uso sea una línea importa: el bloque de revisión ya está
 * anidado tres niveles, y cualquier cosa más larga invita a "después lo hago"
 * — que es exactamente cómo este aviso terminó siendo un console.log.
 */
export async function alertarRevision(datos = {}, opciones = {}) {
  const texto = textoAlertaRevision(datos);
  if (!texto) return { enviada: false, motivo: "sin_problemas" };
  return alertarStaff(texto, opciones);
}
