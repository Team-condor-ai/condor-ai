/**
 * Bárbara · cortacircuito de proveedores de generación.
 *
 * EL CASO REAL QUE LO PIDIÓ
 * ---------------------------------------------------------------------------
 * Del 24 al 27-ago-2026 Bárbara no publicó NADA. Se habían agotado los
 * créditos de Anthropic y cada corrida programada moría con "Your credit
 * balance is too low" — reintentando, cliente por cliente, quemando minutos de
 * runner, durante tres días, sin que nadie se enterara.
 *
 * Con UN cliente eso fue molesto. `clientes.mjs` recorre TODOS los clientes
 * activos dentro del MISMO proceso (el `for (const cliente of clientes)` del
 * final del archivo) y cada carrusel son 6 slides = 6 imágenes. Con cientos de
 * clientes, un proveedor caído deja de ser un error y pasa a ser una factura:
 * cientos de llamadas condenadas, cada una con su timeout de minutos.
 *
 * QUÉ HACE
 * ---------------------------------------------------------------------------
 * Cuenta fallos de INFRAESTRUCTURA seguidos por proveedor. Al segundo, lo marca
 * caído por un rato y la cascada lo SALTA en vez de volver a pagarle el
 * timeout. Pasado ese rato se lo vuelve a probar solo, sin que nadie lo
 * destrabe a mano.
 *
 * QUÉ NO HACE, A PROPÓSITO
 * ---------------------------------------------------------------------------
 * · No reintenta. Reintentar dentro del mismo proveedor ya lo hacen los
 *   clientes (`kie-api.mjs` hace polling, la rama CLI de `motor.mjs` hace 3
 *   intentos). Acá se decide a QUIÉN llamar, no cuántas veces.
 * · No juzga calidad. Una imagen fea es problema de `revision.mjs`.
 * · No se rinde. Cortar es para SALTAR al siguiente proveedor de la cascada.
 *   Sólo cuando no queda ninguno vivo falla — y falla diciendo exactamente eso.
 */

/* ── 1. Qué fallo justifica cortar ───────────────────────────────────────── */

/* Un fallo de CALIDAD dice algo del prompt; uno de INFRAESTRUCTURA dice algo
   del PROVEEDOR. Sólo el segundo justifica cortar: si el proveedor está caído,
   el próximo intento va a fallar igual y sólo cuesta plata y tiempo de runner.
   Si en cambio el prompt se rechazó por política de contenido, cortar sería
   castigar a los 99 clientes siguientes por el prompt de uno.

   Estas exclusiones se evalúan PRIMERO y ganan, porque los mensajes reales
   mezclan las dos cosas: un rechazo de moderación de OpenAI llega como HTTP
   400 con `invalid_request_error` adentro, y basta un número suelto en el
   detalle para que parezca infraestructura. */
export const PATRONES_DE_CALIDAD = [
  /content[ _-]?polic/i,
  /moderation|safety system|flagged/i,
  /invalid[ _-]?prompt|prompt vac[ií]o/i,
  /no devolvi[óo] ninguna imagen|ni b64_json ni url/i,
  /qued[óo] success pero sin url/i,
];

/* Adaptado de `es_fallo_de_infraestructura` (repo `barbara`,
   cerebro/feedback.py), NO portado: aquel clasifica para APRENDER, éste para
   decidir si se sigue GASTANDO. Tres diferencias deliberadas:

   · Los códigos numéricos van con \b. feedback.py busca "429" como substring
     suelto; acá eso cortaría un proveedor por un taskId de Kie tipo "t429ab",
     o por el "1500" del recorte de prompt que aparece en varios mensajes.
   · "cannot find module" / "err_module_not_found" quedan AFUERA. Eso es un
     deploy roto (el `npm ci` que le faltaba a barbara-publicar-automatico.yml),
     no un proveedor caído. Si entrara, la corrida diría "openai cortado" y
     mandaría a debuggear al lado equivocado — el proveedor no hizo nada.
   · Entran los mensajes REALES que tiran los módulos de este directorio, que
     no usan ninguna de las palabras típicas: `openai-imagen.mjs:100` traduce el
     AbortError a "sin respuesta en 120s", y `kie-api.mjs:123` traduce el
     timeout del polling a "no terminó en 9 min". Sin estas dos, el fallo MÁS
     caro de todos — colgarse esperando minutos a un proveedor muerto — no se
     detectaría nunca. */
export const PATRONES_DE_INFRAESTRUCTURA = [
  // Saldo y cuota. El literal del incidente de agosto, y el de OpenAI que ya
  // está guionado en openai-imagen.test.mjs ("Billing hard limit").
  /credit balance|insufficient|billing|hard limit|saldo|quota|payment required/i,
  // Techo de uso: no dice nada del prompt, sólo que hay que esperar.
  /rate[ _-]?limit|too many requests|overloaded/i,
  // Timeouts, en las tres formas en que llegan hasta acá.
  /timeout|timed out|sin respuesta en|no termin[óo] en|aborterror/i,
  // Red, tal como la reporta Node (undici anida el motivo real en `cause`).
  /econnreset|econnrefused|etimedout|enotfound|eai_again|socket hang up|fetch failed|network/i,
  // HTTP del lado del servidor, incluidos los 52x de Cloudflare que usa Kie.
  /\b(408|429|500|502|503|504|522|524|529)\b/,
  /bad gateway|service unavailable|temporarily unavailable|internal server error/i,
  // Credenciales. En un clasificador de aprendizaje son un caso aparte; para un
  // cortacircuito son EL mejor motivo para cortar: un OAuth vencido no se
  // arregla solo, y hasta que una persona lo toque cada llamada es plata
  // regalada. Es exactamente lo que pasó con el CLI de Higgsfield el 22, 23 y
  // 24-ago-2026, cuatro veces en tres días.
  /\b(401|403)\b|unauthorized|forbidden|invalid api key|session expired|no workspace/i,
];

/** Aplana el error a un texto buscable: mensaje, `code`/`status`/`errno`, y la
 *  cadena de `cause` — sin ella, el `TypeError: fetch failed` de Node esconde
 *  el ECONNRESET real un nivel más abajo y todo se ve como fallo genérico. */
export function textoDelError(error) {
  const partes = [];
  let actual = error;
  for (let nivel = 0; actual != null && nivel < 5; nivel++) {
    if (typeof actual !== "object") { partes.push(String(actual)); break; }
    partes.push(String(actual.message ?? ""));
    for (const campo of ["code", "status", "errno", "type"]) {
      if (actual[campo] !== undefined && actual[campo] !== null) partes.push(`${campo}=${actual[campo]}`);
    }
    actual = actual.cause;
  }
  return partes.join(" | ");
}

/**
 * ¿Este fallo dice que el proveedor está caído, o que el pedido estaba mal?
 *
 * Ante la duda devuelve false, al revés que feedback.py. Allá un falso negativo
 * sólo ensucia el aprendizaje; acá un falso POSITIVO saca de la cascada a un
 * proveedor sano, y ése es el error caro: puede terminar en "todos cortados" y
 * dejar al cliente sin pieza por un prompt raro.
 */
export function esFalloDeInfraestructura(error) {
  const texto = textoDelError(error);
  if (!texto.trim()) return false;
  if (PATRONES_DE_CALIDAD.some((p) => p.test(texto))) return false;
  return PATRONES_DE_INFRAESTRUCTURA.some((p) => p.test(texto));
}

/* ── 2. Los dos números ──────────────────────────────────────────────────── */

/* DOS fallos seguidos, no uno ni tres.
   · Uno solo es ruido: un 503 aislado o un ECONNRESET pasan y el proveedor
     sigue vivo. Cortar con uno haría que un hipo mande todo a la rama de
     Higgsfield, que está abandonada desde el 28-ago.
   · Tres es tarde: son 6 slides por carrusel, así que esperar al tercero
     significa pagar medio carrusel de timeouts ANTES de reaccionar, y volver a
     pagarlos completos con el cliente siguiente.
   Con dos, el costo del falso positivo es bajísimo (la cascada salta al
   siguiente proveedor y en 5 min se lo vuelve a probar) y el del falso negativo
   se termina a partir del tercer slide. */
export const FALLOS_PARA_CORTAR = 2;

/* 5 minutos de corte.
   Una corrida de `clientes.mjs` dura del orden de decenas de minutos (cada
   imagen es ~1 min, más los 45 s de espera de la rama CLI), así que 5 min es la
   ventana que cumple las dos cosas a la vez:
   · larga como para que lo que resta del carrusel actual, y casi seguro el
     cliente entero, deje de golpear a un proveedor muerto;
   · corta como para que un corte transitorio —una ventana de rate limit, un 503
     de dos minutos— se recupere DENTRO de la misma corrida en vez de quedar
     castigado hasta que termine.
   Un corte más largo que la corrida sería, en la práctica, "apagado hasta
   mañana": el reintento automático no llegaría a ocurrir nunca. */
export const CORTE_MS = 5 * 60 * 1000;

/* Si el proveedor vuelve a fallar apenas se lo reprueba, el corte siguiente
   dura el doble, con techo de 30 min. Dentro de una corrida rara vez pasa del
   segundo escalón; existe para que el módulo siga siendo correcto si algún día
   el estado se persiste, y para que un caso como el de los tres días sin
   crédito no termine regalando una llamada condenada cada 5 minutos. */
export const CORTE_MAXIMO_MS = 30 * 60 * 1000;

/* ── 3. Dónde vive el estado ─────────────────────────────────────────────── */

/**
 * EN MEMORIA, POR PROCESO. Decisión consciente, no una simplificación.
 *
 * Cada corrida de GitHub Actions arranca un proceso nuevo, así que este contador
 * se pierde entre corridas. Eso alcanza, y persistirlo hoy sería peor:
 *
 * 1. TODO el dinero de una corrida está dentro de la corrida. `clientes.mjs`
 *    procesa a todos los clientes activos en el mismo proceso, y cada uno son
 *    hasta 6 imágenes. Un contador en memoria cubre N clientes × 6 slides —
 *    que es exactamente donde se quema la plata.
 * 2. `telemetria.mjs` no sirve de almacén, y mirarlo antes fue lo correcto:
 *    registra CONSUMO, no fallos (`registrarMedia` se llama DESPUÉS de que el
 *    proveedor respondió bien), y recién escribe al final, vía la RPC
 *    `barbara_registrar_consumo`. No hay forma de leerlo a mitad de corrida
 *    para decidir. Usarlo obligaría a una tabla y una RPC nuevas — justo lo que
 *    no hay que agregar sin necesidad.
 * 3. Un corte que sobrevive a la corrida es ACTIVAMENTE peligroso: saltearía a
 *    un proveedor que ya se recuperó mientras nadie miraba, con estado escrito
 *    por un proceso que hace horas no existe.
 * 4. Y sobre todo: los tres días de silencio no los causó la falta de un
 *    contador persistente, los causó que NADIE SE ENTERÓ. Eso se arregla
 *    avisando, no recordando. Por eso hay un callback `alAbrir` que se dispara
 *    en el momento exacto en que un proveedor se declara caído, y un `resumen()`
 *    para el cierre de la corrida.
 *
 * Si mañana hace falta persistirlo igual, la costura ya está puesta: `estado`
 * se puede precargar al crear la instancia y `resumen()` devuelve algo
 * serializable. No habría que tocar la lógica.
 */

const enHumano = (ms) => (ms >= 60000 ? `${Math.ceil(ms / 60000)} min` : `${Math.ceil(ms / 1000)} s`);

export function crearCortacircuito({
  // El reloj es un parámetro para que los tests puedan probar la recuperación
  // sin esperar 5 minutos reales. No hay `setTimeout` en ningún lado: el corte
  // se decide comparando marcas de tiempo, nunca durmiendo.
  ahora = () => Date.now(),
  fallosParaCortar = FALLOS_PARA_CORTAR,
  corteMs = CORTE_MS,
  corteMaximoMs = CORTE_MAXIMO_MS,
  estado = new Map(),
  // Por defecto grita a la consola: es la señal que faltó en agosto. Quien
  // llame puede reemplazarlo por un aviso a Telegram sin tocar este módulo.
  alAbrir = ({ proveedor, motivo, corteMs: espera }) => {
    console.error(`⛔ ${proveedor} cortado por ${enHumano(espera)} — fallos de infraestructura seguidos: ${motivo}`);
  },
} = {}) {
  const filaDe = (proveedor) => {
    const clave = String(proveedor);
    if (!estado.has(clave)) estado.set(clave, { fallos: 0, aperturas: 0, reintentarDesde: 0, ultimoMotivo: null });
    return estado.get(clave);
  };

  /** ms que faltan para poder volver a probar; 0 si está disponible. */
  function esperaRestante(proveedor) {
    const fila = estado.get(String(proveedor));
    if (!fila) return 0;
    return Math.max(0, fila.reintentarDesde - ahora());
  }

  const cortado = (proveedor) => esperaRestante(proveedor) > 0;

  /** El proveedor contestó: la racha vuelve a cero. */
  function anotarExito(proveedor) {
    const fila = filaDe(proveedor);
    fila.fallos = 0;
    fila.aperturas = 0;
    fila.reintentarDesde = 0;
    fila.ultimoMotivo = null;
  }

  /**
   * Anota un fallo. Devuelve `{ infraestructura, cortado, fallos }`.
   *
   * Un fallo que NO es de infraestructura resetea la racha en vez de ignorarla:
   * si el proveedor devolvió un rechazo de moderación es porque está VIVO, y
   * dejar la racha a medio camino haría que dos hipos separados por diez
   * respuestas sanas terminen cortando a un proveedor que anda perfecto.
   */
  function anotarFallo(proveedor, error) {
    const infraestructura = esFalloDeInfraestructura(error);
    if (!infraestructura) {
      anotarExito(proveedor);
      return { infraestructura: false, cortado: false, fallos: 0 };
    }
    const fila = filaDe(proveedor);
    fila.fallos += 1;
    fila.ultimoMotivo = textoDelError(error).slice(0, 200);

    if (fila.fallos >= fallosParaCortar) {
      // `fallos` NO se resetea al abrir. Así, cuando vence la ventana, el primer
      // intento vale de sonda: si vuelve a fallar por infraestructura el corte
      // se renueva en el acto, sin pedir otros dos fallos. El proveedor ya
      // demostró que estaba caído; no hay que pagarlo dos veces.
      fila.aperturas += 1;
      const espera = Math.min(corteMs * 2 ** (fila.aperturas - 1), corteMaximoMs);
      fila.reintentarDesde = ahora() + espera;
      try {
        alAbrir({ proveedor: String(proveedor), motivo: fila.ultimoMotivo, corteMs: espera, aperturas: fila.aperturas });
      } catch {
        // Avisar nunca puede tumbar la generación: el aviso es lo secundario.
      }
      return { infraestructura: true, cortado: true, fallos: fila.fallos };
    }
    return { infraestructura: true, cortado: false, fallos: fila.fallos };
  }

  /**
   * Recorre la cascada y devuelve lo primero que salga bien.
   *
   * `pasos`: `[{ nombre, disponible, ejecutar }]`, en orden de preferencia.
   *   · `disponible` — booleano o función; responde "¿está CONFIGURADO?" (hay
   *     key), no "¿está sano?". Lo sano lo decide el corte.
   *   · `ejecutar` — la llamada real, sync o async.
   *
   * Las dos reglas duras viven acá y no en quien llama:
   *   · Se prueban TODOS los proveedores vivos antes de fallar, sea cual sea el
   *     motivo por el que falló el anterior. Hasta ahora un 500 de OpenAI dejaba
   *     al cliente sin imagen aunque Kie estuviera configurado y sano, porque
   *     `genImagen` hacía `return` dentro del primer `if`.
   *   · Si no queda ninguno vivo, el error lo dice con esas palabras y con
   *     `todosCortados = true`, en vez de propagar el último error suelto — que
   *     en el log se leería como un problema del prompt.
   */
  async function cascada(pasos, { etiqueta = "generación" } = {}) {
    const candidatos = pasos.filter((p) => (typeof p.disponible === "function" ? p.disponible() : p.disponible !== false));
    if (!candidatos.length) {
      throw new Error(`${etiqueta}: no hay ningún proveedor configurado (faltan las variables de entorno de todos)`);
    }

    const saltados = [];
    const fallados = [];
    for (const paso of candidatos) {
      const espera = esperaRestante(paso.nombre);
      if (espera > 0) {
        saltados.push({ nombre: paso.nombre, espera });
        continue;
      }
      try {
        const salida = await paso.ejecutar();
        anotarExito(paso.nombre);
        return salida;
      } catch (error) {
        const anotado = anotarFallo(paso.nombre, error);
        fallados.push({ nombre: paso.nombre, error, ...anotado });
      }
    }

    if (!fallados.length) {
      // Nadie llegó a intentar: estaban todos cortados. Éste es el mensaje que
      // tiene que ser literal y no genérico, para que el log diga la verdad.
      const detalle = saltados.map((s) => `${s.nombre} reintenta en ${enHumano(s.espera)}`).join("; ");
      const cuantos = saltados.length === 1
        ? `el único proveedor (${saltados[0].nombre}) está cortado`
        : "todos los proveedores están cortados";
      const e = new Error(`${etiqueta}: ${cuantos} por fallos de infraestructura — ${detalle}`);
      e.todosCortados = true;
      e.proveedores = saltados.map((s) => s.nombre);
      // NO se marca `permanent`: un corte se cura solo al vencer la ventana, y
      // `clientes.mjs:641` usa `permanent` para abortar la corrida ENTERA.
      throw e;
    }

    const motivos = [
      ...saltados.map((s) => `${s.nombre}: saltado, cortado ${enHumano(s.espera)} más`),
      ...fallados.map((f) => `${f.nombre}: ${textoDelError(f.error).slice(0, 160)}`),
    ].join(" | ");
    const e = new Error(`${etiqueta}: ningún proveedor pudo generar — ${motivos}`);
    e.errores = fallados.map((f) => f.error);
    e.cortados = saltados.map((s) => s.nombre);
    e.cause = fallados[fallados.length - 1].error;
    // `permanent` (auth/config: aborta la corrida entera, ver clientes.mjs:641)
    // sólo si TODOS los que llegaron a intentar eran permanentes. Si la key de
    // OpenAI está muerta pero Kie anda, tumbar la corrida sería tirar a la
    // basura a todos los clientes que faltan por una cascada que igual funciona.
    if (fallados.every((f) => f.error?.permanent)) e.permanent = true;
    throw e;
  }

  /** Foto serializable, para el cierre de corrida y para los tests. */
  function resumen() {
    const t = ahora();
    return [...estado.entries()]
      .filter(([, f]) => f.fallos > 0 || f.reintentarDesde > 0)
      .map(([nombre, f]) => ({
        proveedor: nombre,
        fallos: f.fallos,
        aperturas: f.aperturas,
        cortado: f.reintentarDesde > t,
        reintentaEnMs: Math.max(0, f.reintentarDesde - t),
        motivo: f.ultimoMotivo,
      }));
  }

  const reiniciar = () => estado.clear();

  return { cascada, anotarExito, anotarFallo, cortado, esperaRestante, resumen, reiniciar, estado };
}

/** La instancia que comparte toda la corrida. Ése es el punto: que el slide 3
 *  aproveche lo que aprendieron los slides 1 y 2, y el cliente 40 lo que
 *  aprendieron los 39 anteriores. */
export const cortacircuito = crearCortacircuito();
