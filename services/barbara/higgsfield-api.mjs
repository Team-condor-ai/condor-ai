/**
 * Bárbara · cliente de la API oficial de Higgsfield.
 *
 * POR QUÉ EXISTE
 * ---------------------------------------------------------------------------
 * Hasta ahora todo pasaba por el CLI (`higgsfield generate create …`), que se
 * autentica con OAuth: un access_token que caduca y un refresh_token que ROTA
 * en cada uso. Eso obliga a que una persona vuelva a loguearse por navegador
 * cada vez que la cadena se corta — pasó el 29-jun, el 22-ago y otra vez el
 * 23-ago, dejando a Bárbara muda días enteros.
 *
 * Ese modelo no escala a decenas de clientes: un token que caduca es un
 * incidente esperando, y multiplicarlo por cada cuenta lo vuelve un trabajo
 * fijo de alguien.
 *
 * La API oficial (`https://platform.higgsfield.ai`) usa credenciales ESTÁTICAS
 * — `Authorization: Key {id}:{secret}` — que no caducan ni rotan. Se crean una
 * vez en https://cloud.higgsfield.ai y se guardan como secrets. Fin del
 * problema.
 *
 * QUÉ CUBRE
 * ---------------------------------------------------------------------------
 * Los dos modelos que Bárbara usa hoy, verificados contra el OpenAPI oficial
 * el 23-ago-2026:
 *   · POST /nano-banana                              → imágenes (carruseles)
 *   · POST /bytedance/seedance/v1/lite/text-to-video  → video (UGC)
 *
 * La API es asíncrona: el POST devuelve un `request_id` y hay que consultar
 * `/requests/{id}/status` hasta que quede en `completed`. La doc también
 * ofrece webhooks, que no se usan acá a propósito: GitHub Actions no tiene
 * dónde recibirlos, y el polling en un job que igual está esperando no cuesta
 * nada.
 *
 * MIGRACIÓN SEGURA
 * ---------------------------------------------------------------------------
 * Este módulo NO reemplaza al CLI por su cuenta. `motor.mjs` y `barbara.mjs`
 * lo prefieren sólo si existen las credenciales; si no, siguen con el CLI
 * exactamente como hasta hoy. Así se puede probar sin arriesgar las corridas
 * que ya funcionan.
 */

const BASE = "https://platform.higgsfield.ai";

/**
 * QUÉ MODELOS TIENE DE VERDAD LA CUENTA (mapeado el 23-ago-2026)
 * ---------------------------------------------------------------------------
 * Se probaron los 48 endpoints del OpenAPI con la key real. La API distingue
 * tres cosas con códigos distintos, y conviene saber leerlos:
 *
 *   404 model_not_found    → el modelo NO está habilitado en esta cuenta
 *   403 not_enough_credits → el modelo SÍ está, falta saldo de API
 *   423 model_blocked      → bloqueado (reve/*)
 *   400/422                → está disponible; sólo faltaban parámetros
 *
 * El hallazgo incómodo: `nano-banana` y `bytedance/seedance/*`, que son
 * justo los dos que usa Bárbara por el CLI, dan 404 — no están habilitados
 * por API en esta cuenta. Sí están los modelos propios de Higgsfield
 * (`soul/*`, `dop/*`, `popcorn`) y varios de video (kling, minimax, wan).
 *
 * Por eso el modelo es CONFIGURABLE en vez de estar fijo: según cómo se
 * resuelva (habilitar nano-banana con soporte, o migrar a soul), se cambia
 * una variable de entorno y no el código.
 */
/**
 * ⚠️ El OpenAPI publicado NO es confiable para los enums. Dice que
 * `soul/standard` acepta `4:5`, y la API real lo rechaza con 422: sólo admite
 * 9:16, 16:9, 4:3, 3:4, 1:1, 2:3 y 3:2. Comprobado en vivo el 23-ago-2026.
 * Por eso cada modelo declara los aspect ratios que de verdad acepta y hay una
 * traducción explícita — descubrirlo en producción costaría una corrida entera.
 */
export const MODELOS_IMAGEN = {
  "nano-banana": {
    ruta: "/nano-banana",
    soportaFormato: true,
    ratios: ["auto", "1:1", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "16:9", "9:16", "21:9"],
  },
  soul: {
    ruta: "/higgsfield-ai/soul/standard",
    soportaFormato: false,
    // El OpenAPI dice 2K/4K; la API real sólo acepta 720p/1080p (422 con 2K).
    resolucion: "1080p",
    ratios: ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"],
  },
};

/* Si el modelo no acepta el ratio pedido, se cae al vertical más parecido que
   sí acepte, en orden de cercanía. 4:5 (0.80) → 3:4 (0.75) → 2:3 (0.67).
   Instagram acepta los tres en carrusel, así que degradar es preferible a
   fallar. */
const EQUIVALENTES = { "4:5": ["3:4", "2:3", "9:16"], "3:4": ["4:5", "2:3"], "9:16": ["2:3", "3:4"] };

function ratioSoportado(modelo, pedido) {
  if (!modelo.ratios || modelo.ratios.includes(pedido)) return pedido;
  const alternativa = (EQUIVALENTES[pedido] || []).find((r) => modelo.ratios.includes(r));
  if (!alternativa) {
    throw new Error(
      `El modelo no acepta aspect_ratio "${pedido}" ni un equivalente. Acepta: ${modelo.ratios.join(", ")}`
    );
  }
  console.log(`   (este modelo no acepta ${pedido}; se usa ${alternativa})`);
  return alternativa;
}

export const MODELOS_VIDEO = {
  seedance: { ruta: "/bytedance/seedance/v1/lite/text-to-video" },
  kling: { ruta: "/kling-video/v2.5-turbo/pro/text-to-video" },
  minimax: { ruta: "/minimax/hailuo-2.3/standard/text-to-video" },
};

/* Estados terminales según el OpenAPI. `nsfw` es un rechazo del filtro de
   contenido: es definitivo, reintentarlo sólo quema créditos. */
const TERMINALES = new Set(["completed", "failed", "canceled", "nsfw"]);

export function credencialesAPI(env = process.env) {
  const id = env.HIGGSFIELD_API_KEY_ID;
  const secret = env.HIGGSFIELD_API_KEY_SECRET;
  return id && secret ? { id, secret } : null;
}

/** ¿Está configurada la API? Lo usan motor.mjs y barbara.mjs para decidir. */
export const apiDisponible = (env = process.env) => Boolean(credencialesAPI(env));

async function pedir(ruta, { metodo = "GET", cuerpo = null, env = process.env, fetchFn = fetch } = {}) {
  const cred = credencialesAPI(env);
  if (!cred) throw new Error("Faltan HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET");

  const r = await fetchFn(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      // Formato exacto del OpenAPI: `Key {api_key_id}:{api_key_secret}`.
      Authorization: `Key ${cred.id}:${cred.secret}`,
      "Content-Type": "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await r.text();
  if (!r.ok) {
    // Los errores de configuración de cuenta no son transitorios: reintentar
    // sólo quema tiempo. Se marcan `permanent`, misma convención que ya usa
    // genImagen del CLI, para que el llamador aborte el run entero.
    //
    // Cada código dice algo distinto y el arreglo es distinto para cada uno,
    // así que el mensaje lo traduce en vez de dejar el JSON crudo.
    let pista = "";
    if (r.status === 401) pista = " · las credenciales no sirven (revisá KEY_ID y KEY_SECRET).";
    else if (r.status === 403 && /credit/i.test(texto)) {
      pista = " · la cuenta de API no tiene saldo. OJO: los créditos de la API son " +
        "APARTE de los del plan mensual de higgsfield.ai — hay que cargarlos en cloud.higgsfield.ai.";
    } else if (r.status === 404 && /model_not_found/.test(texto)) {
      pista = ` · el modelo de esa ruta NO está habilitado en esta cuenta de API. ` +
        `Probá otro con HIGGSFIELD_MODELO_IMAGEN/HIGGSFIELD_MODELO_VIDEO ` +
        `(opciones: ${Object.keys(MODELOS_IMAGEN).join(", ")} / ${Object.keys(MODELOS_VIDEO).join(", ")}), ` +
        `o pedile a soporte de Higgsfield que lo habiliten.`;
    } else if (r.status === 423) pista = " · el modelo está bloqueado para esta cuenta.";

    const err = new Error(`Higgsfield API ${metodo} ${ruta}: ${r.status} ${texto.slice(0, 200)}${pista}`);
    if ([401, 403, 404, 423].includes(r.status)) err.permanent = true;
    // El status va aparte de `permanent` porque no todo error permanente es
    // de credenciales: un 404 puede ser "ese modelo no está" o simplemente
    // "esa request no existe", y verificarCredenciales necesita distinguirlo.
    err.status = r.status;
    throw err;
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Higgsfield API devolvió algo que no es JSON (${r.status}): ${texto.slice(0, 200)}`);
  }
}

/**
 * Espera a que una request termine. Devuelve el objeto de estado final.
 *
 * `dormir` es inyectable para poder testear sin esperar de verdad.
 */
export async function esperar(requestId, {
  env = process.env,
  fetchFn = fetch,
  intervaloMs = 5000,
  timeoutMs = 9 * 60 * 1000,
  dormir = (ms) => new Promise((res) => setTimeout(res, ms)),
} = {}) {
  const limite = Date.now() + timeoutMs;
  let ultimo = null;

  while (Date.now() < limite) {
    ultimo = await pedir(`/requests/${requestId}/status`, { env, fetchFn });
    if (TERMINALES.has(ultimo.status)) return ultimo;
    await dormir(intervaloMs);
  }
  throw new Error(
    `Higgsfield API: la request ${requestId} no terminó en ${Math.round(timeoutMs / 60000)} min ` +
    `(último estado: ${ultimo?.status || "desconocido"})`
  );
}

/* Un estado terminal que no sea `completed` no es un error de red: es la
   generación que no se pudo hacer. Se traduce a un mensaje que dice cuál de
   las tres razones fue, porque el arreglo es distinto para cada una. */
function exigirCompletada(estado, que) {
  if (estado.status === "completed") return estado;
  const detalle = {
    nsfw: "el filtro de contenido la rechazó (revisa el prompt, reintentar no sirve)",
    failed: `falló en el servidor: ${estado.error || "sin detalle"}`,
    canceled: "quedó cancelada",
  }[estado.status] || `terminó en estado ${estado.status}`;
  throw new Error(`Higgsfield API · ${que}: ${detalle}`);
}

/**
 * Genera una imagen y devuelve su URL.
 * Reemplaza a `higgsfield generate create nano_banana_2 …`.
 */
export async function generarImagen(prompt, {
  aspectRatio = "4:5",
  formato = "png",
  env = process.env,
  fetchFn = fetch,
  ...opciones
} = {}) {
  const clave = env.HIGGSFIELD_MODELO_IMAGEN || "nano-banana";
  const modelo = MODELOS_IMAGEN[clave];
  if (!modelo) {
    throw new Error(
      `HIGGSFIELD_MODELO_IMAGEN="${clave}" no existe. Opciones: ${Object.keys(MODELOS_IMAGEN).join(", ")}`
    );
  }

  const creada = await pedir(modelo.ruta, {
    metodo: "POST",
    cuerpo: {
      prompt,
      aspect_ratio: ratioSoportado(modelo, aspectRatio),
      num_images: 1,
      // soul no acepta output_format y sí pide resolución; nano-banana al revés.
      ...(modelo.soportaFormato ? { output_format: formato } : {}),
      ...(modelo.resolucion ? { resolution: modelo.resolucion } : {}),
    },
    env, fetchFn,
  });

  const estado = exigirCompletada(
    await esperar(creada.request_id, { env, fetchFn, ...opciones }),
    "imagen"
  );
  const url = estado.images?.[0]?.url;
  if (!url) throw new Error("Higgsfield API: la imagen quedó completed pero sin URL");
  return url;
}

/**
 * Genera un clip de video y devuelve su URL.
 * Reemplaza a `higgsfield generate create seedance1_5 …`.
 */
export async function generarVideo(prompt, {
  duracion = 5,
  aspectRatio = "9:16",
  resolucion = "720",
  env = process.env,
  fetchFn = fetch,
  ...opciones
} = {}) {
  const clave = env.HIGGSFIELD_MODELO_VIDEO || "seedance";
  const modelo = MODELOS_VIDEO[clave];
  if (!modelo) {
    throw new Error(
      `HIGGSFIELD_MODELO_VIDEO="${clave}" no existe. Opciones: ${Object.keys(MODELOS_VIDEO).join(", ")}`
    );
  }

  const creada = await pedir(modelo.ruta, {
    metodo: "POST",
    cuerpo: {
      prompt,
      // El OpenAPI acota la duración a 2-12s; Bárbara pide 4-6.
      duration: Math.min(Math.max(Math.round(duracion), 2), 12),
      aspect_ratio: aspectRatio,
      resolution: resolucion,
    },
    env, fetchFn,
  });

  const estado = exigirCompletada(
    // Un video tarda bastante más que una imagen.
    await esperar(creada.request_id, { env, fetchFn, timeoutMs: 15 * 60 * 1000, ...opciones }),
    "video"
  );
  const url = estado.video?.url;
  if (!url) throw new Error("Higgsfield API: el video quedó completed pero sin URL");
  return url;
}

/** Chequeo de credenciales sin gastar créditos: pregunta por una request falsa. */
export async function verificarCredenciales({ env = process.env, fetchFn = fetch } = {}) {
  try {
    await pedir("/requests/00000000-0000-0000-0000-000000000000/status", { env, fetchFn });
    return { ok: true };
  } catch (e) {
    // SÓLO 401 es "la clave no sirve". Un 403 ya es autenticación válida sin
    // saldo, y un 404 es la request falsa que se pidió a propósito — los dos
    // prueban que la credencial funciona.
    if (e.status === 401) return { ok: false, motivo: "credenciales inválidas" };
    return { ok: true };
  }
}
