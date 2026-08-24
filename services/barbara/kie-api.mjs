/**
 * Bárbara · cliente de la API de Kie.ai — reemplazo de Higgsfield.
 *
 * POR QUÉ EXISTE
 * ---------------------------------------------------------------------------
 * Higgsfield rompió a Bárbara repetidas veces (29-jun, 22-ago, 23-ago, 24-ago)
 * por el OAuth del CLI que caduca y por confusión de cuentas (la sesión activa
 * en CI terminó en una cuenta free de 0 créditos, no la Plus pagada). Kie.ai
 * usa una key ESTÁTICA (`Authorization: Bearer <key>`) que no caduca ni rota,
 * mismo problema que se intentó resolver con la API oficial de Higgsfield en
 * `higgsfield-api.mjs` — pero esa API no sirve los modelos que Bárbara usa
 * (404 model_not_found en nano-banana y seedance). Kie.ai sí los sirve.
 *
 * Decisión de modelos (24-ago-2026, pedido explícito de Joaquín):
 *   - Imagen: `gpt-image-2` (OpenAI) — NO Nano Banana, Joaquín no lo quiere.
 *   - Video: `seedance-2-0` (ByteDance) — subiendo calidad desde el
 *     `seedance1_5` que usaba Higgsfield.
 *
 * FORMATO DE LA API (confirmado contra docs.kie.ai el 24-ago-2026)
 * ---------------------------------------------------------------------------
 * Un solo endpoint para crear cualquier tarea:
 *   POST https://api.kie.ai/api/v1/jobs/createTask
 *   Authorization: Bearer <KIE_API_KEY>
 *   body: { model: "<id-del-modelo>", input: { ...parámetros del modelo } }
 * Devuelve { taskId }. Es asíncrona — hay que consultar:
 *   GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>
 * hasta que `state` sea "success" o "fail".
 *
 * ⚠️ SIN VERIFICAR TODAVÍA CONTRA UNA KEY REAL (no hay cuenta creada aún):
 * los nombres exactos de los campos de `input` para gpt-image-2 (aspect_ratio,
 * resolution — confirmados por docs) y para seedance-2-0 (duration,
 * aspect_ratio, resolution, con_audio — sin confirmar, es la mejor lectura de
 * la documentación pública) y la ruta exacta del resultado dentro de
 * `recordInfo` (asumo `resultJson.resultUrls[0]`, patrón típico de Kie, pero
 * hay que confirmarlo con una llamada real). Antes de depender de esto en
 * producción, correr `verificarCredenciales` y una generación de prueba real,
 * igual que se hizo con nano-banana y con la API oficial de Higgsfield.
 *
 * MIGRACIÓN SEGURA: igual patrón que higgsfield-api.mjs — este módulo NO
 * reemplaza al CLI de Higgsfield por su cuenta. `motor.mjs` y `barbara.mjs`
 * lo prefieren sólo si existe `KIE_API_KEY`; si no, siguen con el CLI de
 * Higgsfield exactamente como hasta hoy (aunque esa cuenta esté rota, ver
 * memoria del 24-ago — es un problema aparte, no algo que este cambio deba
 * arreglar en silencio).
 */

const BASE = "https://api.kie.ai/api/v1";

export const MODELOS_IMAGEN = {
  "gpt-image-2": {
    id: "gpt-image-2-text-to-image",
    ratios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"],
    resoluciones: ["1K", "2K", "4K"],
  },
};

export const MODELOS_VIDEO = {
  "seedance-2-0": {
    id: "bytedance/seedance-2-0-text-to-video",
    ratios: ["9:16", "16:9", "1:1"],
  },
};

const TERMINALES = new Set(["success", "fail"]);

export function credencialesAPI(env = process.env) {
  const key = env.KIE_API_KEY;
  return key || null;
}

/** ¿Está configurada la API? Lo usan motor.mjs y barbara.mjs para decidir. */
export const apiDisponible = (env = process.env) => Boolean(credencialesAPI(env));

async function pedir(ruta, { metodo = "GET", cuerpo = null, env = process.env, fetchFn = fetch } = {}) {
  const key = credencialesAPI(env);
  if (!key) throw new Error("Falta KIE_API_KEY");

  const r = await fetchFn(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await r.text();
  if (!r.ok) {
    let pista = "";
    if (r.status === 401) pista = " · la key no sirve (revisá KIE_API_KEY).";
    else if (r.status === 402 || /credit|insufficient/i.test(texto)) pista = " · la cuenta de Kie.ai no tiene saldo — cargar en kie.ai.";
    else if (r.status === 404) pista = " · modelo o ruta no encontrada. Revisá el id del modelo contra docs.kie.ai.";

    const err = new Error(`Kie API ${metodo} ${ruta}: ${r.status} ${texto.slice(0, 200)}${pista}`);
    if ([401, 402, 404].includes(r.status)) err.permanent = true;
    err.status = r.status;
    throw err;
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Kie API devolvió algo que no es JSON (${r.status}): ${texto.slice(0, 200)}`);
  }
}

/** Espera a que una tarea termine. Devuelve el objeto de estado final. */
export async function esperar(taskId, {
  env = process.env,
  fetchFn = fetch,
  intervaloMs = 5000,
  timeoutMs = 9 * 60 * 1000,
  dormir = (ms) => new Promise((res) => setTimeout(res, ms)),
} = {}) {
  const limite = Date.now() + timeoutMs;
  let ultimo = null;

  while (Date.now() < limite) {
    const r = await pedir(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { env, fetchFn });
    ultimo = r.data || r;
    if (TERMINALES.has(ultimo.state)) return ultimo;
    await dormir(intervaloMs);
  }
  throw new Error(`Kie API: la tarea ${taskId} no terminó en ${Math.round(timeoutMs / 60000)} min (último estado: ${ultimo?.state || "desconocido"})`);
}

function exigirCompletada(estado, que) {
  if (estado.state === "success") return estado;
  throw new Error(`Kie API · ${que}: falló en el servidor — ${estado.failMsg || estado.errorMessage || "sin detalle"}`);
}

/** URL del resultado. Sin confirmar el path exacto contra una respuesta real todavía. */
function urlDelResultado(estado) {
  const rj = estado.resultJson ? (typeof estado.resultJson === "string" ? JSON.parse(estado.resultJson) : estado.resultJson) : estado;
  return rj?.resultUrls?.[0] || rj?.result_urls?.[0] || rj?.url || null;
}

/** Genera una imagen con gpt-image-2 y devuelve su URL. */
export async function generarImagen(prompt, {
  aspectRatio = "4:5",
  resolucion = "2K",
  env = process.env,
  fetchFn = fetch,
  ...opciones
} = {}) {
  const modelo = MODELOS_IMAGEN["gpt-image-2"];

  const creada = await pedir("/jobs/createTask", {
    metodo: "POST",
    cuerpo: {
      model: modelo.id,
      input: { prompt, aspect_ratio: aspectRatio, resolution: resolucion },
    },
    env, fetchFn,
  });

  const estado = exigirCompletada(
    await esperar(creada.data?.taskId || creada.taskId, { env, fetchFn, ...opciones }),
    "imagen"
  );
  const url = urlDelResultado(estado);
  if (!url) throw new Error("Kie API: la imagen quedó success pero sin URL — revisar la forma real de recordInfo");
  return url;
}

/** Genera un clip de video con seedance-2-0 y devuelve su URL. */
export async function generarVideo(prompt, {
  duracion = 5,
  aspectRatio = "9:16",
  resolucion = "720p",
  env = process.env,
  fetchFn = fetch,
  ...opciones
} = {}) {
  const modelo = MODELOS_VIDEO["seedance-2-0"];

  const creada = await pedir("/jobs/createTask", {
    metodo: "POST",
    cuerpo: {
      model: modelo.id,
      input: {
        prompt,
        duration: Math.min(Math.max(Math.round(duracion), 2), 30),
        aspect_ratio: aspectRatio,
        resolution: resolucion,
      },
    },
    env, fetchFn,
  });

  const estado = exigirCompletada(
    await esperar(creada.data?.taskId || creada.taskId, { env, fetchFn, timeoutMs: 15 * 60 * 1000, ...opciones }),
    "video"
  );
  const url = urlDelResultado(estado);
  if (!url) throw new Error("Kie API: el video quedó success pero sin URL — revisar la forma real de recordInfo");
  return url;
}

/** Chequeo de credenciales sin gastar créditos. */
export async function verificarCredenciales({ env = process.env, fetchFn = fetch } = {}) {
  try {
    await pedir("/jobs/recordInfo?taskId=00000000-0000-0000-0000-000000000000", { env, fetchFn });
    return { ok: true };
  } catch (e) {
    if (e.status === 401) return { ok: false, motivo: "credenciales inválidas" };
    return { ok: true };
  }
}
