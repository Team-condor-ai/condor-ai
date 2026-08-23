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
    // 401/403 son de credenciales: no son transitorios y reintentar sólo
    // quema tiempo. Se marcan `permanent` con la misma convención que ya usa
    // genImagen del CLI, para que el llamador aborte el run entero.
    const err = new Error(`Higgsfield API ${metodo} ${ruta}: ${r.status} ${texto.slice(0, 200)}`);
    if (r.status === 401 || r.status === 403) err.permanent = true;
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
  const creada = await pedir("/nano-banana", {
    metodo: "POST",
    cuerpo: {
      prompt,
      aspect_ratio: aspectRatio,
      output_format: formato,
      num_images: 1,
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
  const creada = await pedir("/bytedance/seedance/v1/lite/text-to-video", {
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
    // 401/403 = credenciales malas. Cualquier otro error (404 por el id falso,
    // por ejemplo) significa que la autenticación SÍ pasó.
    if (e.permanent) return { ok: false, motivo: "credenciales inválidas" };
    return { ok: true };
  }
}
