/**
 * Bárbara · generación de imagen con OpenAI, directo.
 *
 * POR QUÉ DIRECTO Y NO POR KIE
 * ---------------------------------------------------------------------------
 * Kie revende el mismo modelo de OpenAI. Para imagen el precio es casi igual
 * (bitácora del 27/28-ago: el "oficial" que muestra Kie parece ser el de
 * Fal.ai, no el de OpenAI real), así que ir directo no cuesta más — y da dos
 * cosas que el cliente de Kie no tiene:
 *
 *   · REFERENCIA DE IMAGEN. `kie-api.mjs` sólo hace text-to-image. Sin
 *     referencia, el envase de un producto y el logo de una marca se
 *     "aproximan": el modelo dibuja algo parecido, con la etiqueta inventada.
 *     Para una marca como Silver Roots, cuyo estilo exige el envase real con
 *     su etiqueta, eso es la diferencia entre servible e inservible.
 *   · Un salto menos: una caída de Kie deja de afectar a las imágenes.
 *
 * NO reemplaza a Kie. Se reparten el trabajo (decisión del 29-ago-2026):
 *   · imagen → OpenAI (este módulo)
 *   · video  → Kie con seedance-2-0 (`kie-api.mjs`)
 *
 * ⚠️ SIN VERIFICAR CONTRA UNA KEY REAL
 * ---------------------------------------------------------------------------
 * No hay `OPENAI_API_KEY` en ningún secret ni en el entorno al 29-ago-2026, así
 * que el nombre exacto del modelo y la forma de la respuesta NO están
 * confirmados contra una llamada real — están tomados de la documentación y de
 * lo que ya usa `kie-api.mjs` (que llama al modelo "gpt-image-2").
 *
 * El modelo es configurable por `OPENAI_MODELO_IMAGEN` justamente por eso: si
 * el id cambió, se corrige con una variable y no con un deploy. Y la lectura
 * de la respuesta acepta las dos formas que devuelve la API (`b64_json` y
 * `url`), en vez de asumir una.
 *
 * Antes de depender de esto en producción: correr `verificarCredenciales()` y
 * una generación real, como se hizo con nano-banana y con Higgsfield.
 */

const BASE = "https://api.openai.com/v1";

/* 1K es el escalón barato (~US$0.03 por imagen). Se usa como fondo de un
   lienzo de 1080×1350 que la plantilla recorta con `center/cover`, así que
   subir a 2K sólo agrandaría el archivo: el recorte tira ese detalle igual. */
export const RESOLUCIONES = {
  "1K": { cuadrada: "1024x1024", vertical: "1024x1536", horizontal: "1536x1024" },
  "2K": { cuadrada: "2048x2048", vertical: "1536x2048", horizontal: "2048x1536" },
};

export const MODELO_POR_DEFECTO = "gpt-image-2";

export function credencial(env = process.env) {
  return (env.OPENAI_API_KEY || "").trim() || null;
}

export const imagenDisponible = (env = process.env) => Boolean(credencial(env));

function modeloDe(env = process.env) {
  return (env.OPENAI_MODELO_IMAGEN || "").trim() || MODELO_POR_DEFECTO;
}

/**
 * Tamaño a pedir según la forma que se quiera.
 *
 * OpenAI no ofrece 4:5 (el formato de Instagram que usa Bárbara): sus opciones
 * son 1:1, 2:3 y 3:2. Se pide VERTICAL (2:3) y la plantilla lo recorta a 4:5
 * con `center/cover`. Recortar de 2:3 a 4:5 saca ~17% de alto; pedir 1:1 y
 * estirarlo deformaría el producto, que es justo lo que no se puede hacer con
 * la foto de un envase.
 */
export function tamanoPara(forma = "vertical", resolucion = "1K") {
  const escalon = RESOLUCIONES[resolucion] || RESOLUCIONES["1K"];
  return escalon[forma] || escalon.vertical;
}

async function pedir(ruta, { cuerpo, env = process.env, fetchFn = fetch, timeoutMs = 120000 } = {}) {
  const key = credencial(env);
  if (!key) throw new Error("Falta OPENAI_API_KEY");

  /* Sin timeout, un cuelgue del proveedor deja el job de GitHub Actions
     esperando hasta que lo mate el runner (6 h por defecto), y el cliente se
     queda sin su pieza ese día sin que nadie vea un error. */
  const control = new AbortController();
  const alarma = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetchFn(`${BASE}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });
    const texto = await r.text();
    if (!r.ok) {
      // El cuerpo de error de OpenAI trae el motivo real (saldo, modelo
      // inexistente, prompt rechazado). Sin él, todo se ve como "HTTP 400".
      let detalle = texto.slice(0, 300);
      try { detalle = JSON.parse(texto)?.error?.message || detalle; } catch { /* texto plano */ }
      throw new Error(`OpenAI imagen ${r.status}: ${detalle}`);
    }
    return JSON.parse(texto);
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`OpenAI imagen: sin respuesta en ${timeoutMs / 1000}s`);
    throw e;
  } finally {
    clearTimeout(alarma);
  }
}

/** Saca la imagen de la respuesta, venga como base64 o como URL. */
function imagenDeLaRespuesta(datos) {
  const primera = datos?.data?.[0];
  if (!primera) throw new Error("OpenAI no devolvió ninguna imagen");
  if (primera.b64_json) return { base64: primera.b64_json, dataUri: `data:image/png;base64,${primera.b64_json}` };
  if (primera.url) return { url: primera.url };
  throw new Error("La respuesta de OpenAI no trae ni b64_json ni url");
}

/**
 * Genera una imagen. Devuelve `{ dataUri }` o `{ url }` según lo que responda
 * la API — el llamador usa `dataUri` si existe.
 *
 * Se devuelve data URI y no un archivo porque es lo que la plantilla necesita:
 * `plantillas.mjs` mete el fondo en un `background:url(...)` que Chrome
 * resuelve sin tocar la red. Un archivo temporal obligaría a limpiarlo y una
 * URL remota metería una descarga más que puede fallar.
 */
export async function generarImagen(prompt, {
  forma = "vertical",
  resolucion = "1K",
  calidad = "medium",
  referencias = [],
  env = process.env,
  fetchFn = fetch,
} = {}) {
  const limpio = String(prompt || "").trim();
  if (!limpio) throw new Error("Prompt vacío");

  const cuerpo = {
    model: modeloDe(env),
    prompt: limpio.slice(0, 4000),
    size: tamanoPara(forma, resolucion),
    quality: calidad,
    n: 1,
  };

  /* Las referencias van sólo si hay: el endpoint de generación las acepta
     como `image`, pero mandarlo vacío es un campo de más que algunas versiones
     rechazan. Ver `generarConReferencia` para el caso del envase real. */
  if (Array.isArray(referencias) && referencias.length) {
    cuerpo.image = referencias.slice(0, 4);
  }

  return imagenDeLaRespuesta(await pedir("/images/generations", { cuerpo, env, fetchFn }));
}

/**
 * Igual que `generarImagen`, pero con el producto real como referencia.
 *
 * Es LA razón por la que existe este módulo: sin referencia, el modelo dibuja
 * un envase parecido con una etiqueta inventada. Con referencia, compone la
 * escena alrededor del producto real.
 *
 * `referencias` son data URIs o URLs de las fotos del producto — normalmente
 * las que el cliente subió a su brand book.
 */
export async function generarConReferencia(prompt, referencias, opciones = {}) {
  if (!Array.isArray(referencias) || !referencias.length) {
    throw new Error("generarConReferencia necesita al menos una imagen de referencia");
  }
  return generarImagen(prompt, { ...opciones, referencias });
}

/**
 * Comprueba que la key sirve, sin gastar una generación.
 *
 * Listar modelos cuesta cero y falla por la misma razón por la que fallaría
 * una generación (key inválida, cuenta sin acceso). Lo que NO detecta es falta
 * de saldo — eso sólo aparece al generar, y es exactamente lo que dejó a
 * Bárbara sin publicar del 24 al 27-ago.
 */
export async function verificarCredenciales({ env = process.env, fetchFn = fetch } = {}) {
  const key = credencial(env);
  if (!key) return { ok: false, motivo: "falta OPENAI_API_KEY" };
  try {
    const r = await fetchFn(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { ok: false, motivo: `HTTP ${r.status}` };
    const modelos = (await r.json())?.data || [];
    const buscado = modeloDe(env);
    return {
      ok: true,
      modelo: buscado,
      // Informativo, no bloqueante: la lista puede no incluir los modelos de
      // imagen aunque estén disponibles para la cuenta.
      visible: modelos.some((m) => m?.id === buscado),
    };
  } catch (e) {
    return { ok: false, motivo: String(e.message || e).slice(0, 160) };
  }
}
