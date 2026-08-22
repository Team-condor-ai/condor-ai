const BASE_URL = "https://backend.blotato.com/v2";

export class BlotatoError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "BlotatoError";
    this.status = status;
    this.body = body;
  }
}

function requerido(value, nombre) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new TypeError(`${nombre} es obligatorio`);
  }
  return String(value).trim();
}

function limpiarUrl(url) {
  const valor = requerido(url, "Cada URL de media");
  if (!/^https?:\/\//i.test(valor) && !/^data:/i.test(valor)) {
    throw new TypeError("Las imágenes y videos deben usar una URL http(s) pública o data URL");
  }
  return valor;
}

export function construirPayloadPublicacion({
  accountId,
  platform,
  text = "",
  mediaUrls = [],
  target = {},
  scheduledTime,
  useNextFreeSlot,
}) {
  const cuenta = requerido(accountId, "accountId");
  const plataforma = requerido(platform, "platform").toLowerCase();
  const urls = Array.isArray(mediaUrls) ? mediaUrls.map(limpiarUrl) : [];

  if (!text.trim() && urls.length === 0) {
    throw new TypeError("La publicación necesita texto o al menos un archivo multimedia");
  }

  const payload = {
    post: {
      accountId: cuenta,
      content: {
        text: String(text),
        mediaUrls: urls,
        platform: plataforma,
      },
      target: {
        ...target,
        targetType: plataforma,
      },
    },
  };

  // Blotato exige estos campos en la raíz, no dentro de post.
  if (scheduledTime) payload.scheduledTime = new Date(scheduledTime).toISOString();
  if (useNextFreeSlot !== undefined) payload.useNextFreeSlot = Boolean(useNextFreeSlot);
  return payload;
}

export function crearClienteBlotato({
  apiKey = process.env.BLOTATO_API_KEY,
  fetchImpl = globalThis.fetch,
  baseUrl = BASE_URL,
} = {}) {
  const clave = requerido(apiKey, "BLOTATO_API_KEY");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch no está disponible");

  async function request(method, path, body) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        "blotato-api-key": clave,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const raw = await response.text();
    let data = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) {
      const detalle = typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300);
      throw new BlotatoError(`Blotato ${response.status}: ${detalle}`, { status: response.status, body: data });
    }
    return data;
  }

  return {
    obtenerUsuario: () => request("GET", "/users/me"),
    listarCuentas: () => request("GET", "/users/me/accounts"),
    listarSubcuentas: (accountId) => request("GET", `/users/me/accounts/${encodeURIComponent(requerido(accountId, "accountId"))}/subaccounts`),
    subirMedia: (url) => request("POST", "/media", { url: limpiarUrl(url) }),
    crearPublicacion: (payload) => request("POST", "/posts", payload),
    obtenerPublicacion: (postSubmissionId) => request("GET", `/posts/${encodeURIComponent(requerido(postSubmissionId, "postSubmissionId"))}`),
  };
}

export async function esperarPublicacion(cliente, postSubmissionId, {
  intervaloMs = 2000,
  timeoutMs = 120000,
} = {}) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const resultado = await cliente.obtenerPublicacion(postSubmissionId);
    if (["published", "failed"].includes(resultado?.status)) return resultado;
    await new Promise((resolve) => setTimeout(resolve, intervaloMs));
  }
  throw new BlotatoError(`Tiempo de espera agotado para ${postSubmissionId}`);
}
