import assert from "node:assert/strict";
import test from "node:test";
import {
  apiDisponible, credencialesAPI, esperar, generarImagen, generarVideo, verificarCredenciales,
} from "./higgsfield-api.mjs";

const ENV = { HIGGSFIELD_API_KEY_ID: "id123", HIGGSFIELD_API_KEY_SECRET: "sec456" };
const sinDormir = async () => {};

/* Doble de fetch: responde según la ruta, guardando cada llamada. */
function fetchFalso(rutas) {
  const llamadas = [];
  const fn = async (url, opt) => {
    llamadas.push({ url, opt });
    const ruta = url.replace("https://platform.higgsfield.ai", "");
    const manejador = rutas[ruta] ?? rutas.__default;
    if (!manejador) throw new Error(`fetchFalso: ruta no guionada ${ruta}`);
    const r = typeof manejador === "function" ? manejador(llamadas.length) : manejador;
    return {
      ok: r.status ? r.status < 400 : true,
      status: r.status || 200,
      text: async () => JSON.stringify(r.body ?? {}),
    };
  };
  fn.llamadas = llamadas;
  return fn;
}

test("apiDisponible sólo con las dos credenciales", () => {
  assert.equal(apiDisponible(ENV), true);
  assert.equal(apiDisponible({ HIGGSFIELD_API_KEY_ID: "solo-id" }), false);
  assert.equal(apiDisponible({}), false);
  assert.equal(credencialesAPI({}), null);
});

test("manda el header Authorization en el formato exacto del OpenAPI", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [{ url: "https://x/i.png" }] } },
  });
  await generarImagen("hola", { env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(f.llamadas[0].opt.headers.Authorization, "Key id123:sec456");
});

test("generarImagen pide 4:5 png y devuelve la URL", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [{ url: "https://x/i.png" }] } },
  });
  const url = await generarImagen("un carrusel", { env: ENV, fetchFn: f, dormir: sinDormir });

  assert.equal(url, "https://x/i.png");
  const cuerpo = JSON.parse(f.llamadas[0].opt.body);
  assert.equal(cuerpo.aspect_ratio, "4:5");
  assert.equal(cuerpo.output_format, "png");
  assert.equal(cuerpo.num_images, 1);
});

test("hace polling hasta que deja de estar in_progress", async () => {
  let n = 0;
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": () => {
      n++;
      return n < 3
        ? { body: { status: "in_progress" } }
        : { body: { status: "completed", images: [{ url: "https://x/ok.png" }] } };
    },
  });
  const url = await generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir, intervaloMs: 1 });
  assert.equal(url, "https://x/ok.png");
  assert.equal(n, 3, "debe seguir consultando mientras no sea terminal");
});

test("nsfw se reporta como rechazo del filtro, no como error genérico", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "nsfw" } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => /filtro de contenido/.test(e.message) && /reintentar no sirve/.test(e.message),
  );
});

test("failed arrastra el error del servidor al mensaje", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "failed", error: "modelo caído" } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => /modelo caído/.test(e.message),
  );
});

test("401 se marca permanent para que el llamador aborte el run", async () => {
  // Misma convención que genImagen del CLI: los errores de credenciales no se
  // reintentan, porque reintentar sólo quema tiempo y cuota.
  const f = fetchFalso({ "/nano-banana": { status: 401, body: { detail: "Invalid credentials" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => e.permanent === true && /401/.test(e.message),
  );
});

test("un 500 NO es permanent: es transitorio y se puede reintentar", async () => {
  const f = fetchFalso({ "/nano-banana": { status: 500, body: { detail: "boom" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => e.permanent !== true,
  );
});

test("completed sin URL se reporta claro en vez de devolver undefined", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [] } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    /completed pero sin URL/,
  );
});

test("generarVideo acota la duración al rango que acepta el endpoint", async () => {
  const f = fetchFalso({
    "/bytedance/seedance/v1/lite/text-to-video": { body: { request_id: "v1", status: "queued" } },
    "/requests/v1/status": { body: { status: "completed", video: { url: "https://x/v.mp4" } } },
  });
  await generarVideo("x", { duracion: 99, env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(JSON.parse(f.llamadas[0].opt.body).duration, 12, "el OpenAPI tope es 12s");

  const f2 = fetchFalso({
    "/bytedance/seedance/v1/lite/text-to-video": { body: { request_id: "v1", status: "queued" } },
    "/requests/v1/status": { body: { status: "completed", video: { url: "https://x/v.mp4" } } },
  });
  await generarVideo("x", { duracion: 0, env: ENV, fetchFn: f2, dormir: sinDormir });
  assert.equal(JSON.parse(f2.llamadas[0].opt.body).duration, 2, "el OpenAPI mínimo es 2s");
});

test("generarVideo pide 9:16 y devuelve la URL del video", async () => {
  const f = fetchFalso({
    "/bytedance/seedance/v1/lite/text-to-video": { body: { request_id: "v1", status: "queued" } },
    "/requests/v1/status": { body: { status: "completed", video: { url: "https://x/v.mp4" } } },
  });
  const url = await generarVideo("x", { env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(url, "https://x/v.mp4");
  assert.equal(JSON.parse(f.llamadas[0].opt.body).aspect_ratio, "9:16");
});

test("esperar corta por timeout en vez de quedarse colgado para siempre", async () => {
  const f = fetchFalso({ "/requests/r1/status": { body: { status: "in_progress" } } });
  await assert.rejects(
    () => esperar("r1", { env: ENV, fetchFn: f, dormir: sinDormir, intervaloMs: 1, timeoutMs: 5 }),
    /no terminó en/,
  );
});

test("verificarCredenciales distingue clave mala de request inexistente", async () => {
  const malas = fetchFalso({ __default: { status: 401, body: {} } });
  assert.deepEqual(await verificarCredenciales({ env: ENV, fetchFn: malas }),
    { ok: false, motivo: "credenciales inválidas" });

  // 404 significa que la auth pasó y sólo no existe esa request.
  const buenas = fetchFalso({ __default: { status: 404, body: {} } });
  assert.equal((await verificarCredenciales({ env: ENV, fetchFn: buenas })).ok, true);

  // Y 403 (sin saldo) TAMBIEN prueba que la credencial sirve. Es el caso real
  // de la cuenta al 23-ago-2026 y confundirlo con "clave mala" mandaria a
  // revisar la key en vez de a cargar creditos.
  const sinSaldo = fetchFalso({ __default: { status: 403, body: { detail: "not_enough_credits" } } });
  assert.equal((await verificarCredenciales({ env: ENV, fetchFn: sinSaldo })).ok, true);
});

test("sin credenciales falla diciendo qué variables faltan", async () => {
  await assert.rejects(
    () => generarImagen("x", { env: {}, fetchFn: fetchFalso({}) }),
    /HIGGSFIELD_API_KEY_ID/,
  );
});

/* Mapeo real del 23-ago-2026: nano-banana y seedance dan 404 en esta cuenta,
   mientras soul/* da 403 (existe, falta saldo). De ahí que el modelo sea
   configurable y que cada código se traduzca a un remedio distinto. */

test("el modelo de imagen es configurable por entorno", async () => {
  const f = fetchFalso({
    "/higgsfield-ai/soul/standard": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [{ url: "https://x/s.png" }] } },
  });
  const url = await generarImagen("x", {
    env: { ...ENV, HIGGSFIELD_MODELO_IMAGEN: "soul" }, fetchFn: f, dormir: sinDormir,
  });
  assert.equal(url, "https://x/s.png");

  const cuerpo = JSON.parse(f.llamadas[0].opt.body);
  assert.equal(cuerpo.resolution, "1080p", "soul pide resolución en 720p/1080p, no 2K");
  assert.equal(cuerpo.output_format, undefined, "soul NO acepta output_format");
  // 3:4 y no 4:5: soul rechaza 4:5 con 422 aunque el OpenAPI diga lo
  // contrario. Lo cubre en detalle el test del fallback de ratio.
  assert.equal(cuerpo.aspect_ratio, "3:4");
});

test("un modelo inventado falla nombrando las opciones válidas", async () => {
  await assert.rejects(
    () => generarImagen("x", { env: { ...ENV, HIGGSFIELD_MODELO_IMAGEN: "no-existe" }, fetchFn: fetchFalso({}) }),
    (e) => /no existe/.test(e.message) && /nano-banana/.test(e.message) && /soul/.test(e.message),
  );
});

test("404 model_not_found explica que hay que cambiar de modelo, no reintentar", async () => {
  const f = fetchFalso({ "/nano-banana": { status: 404, body: { detail: "model_not_found" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => e.permanent === true && /NO está habilitado/.test(e.message) && /HIGGSFIELD_MODELO_IMAGEN/.test(e.message),
  );
});

test("403 not_enough_credits avisa que los créditos de API son APARTE del plan", async () => {
  // Es la confusión cara: el plan mensual de higgsfield.ai tiene créditos y la
  // plataforma de API tiene los suyos. Verificado en vivo el 23-ago-2026.
  const f = fetchFalso({ "/nano-banana": { status: 403, body: { detail: "not_enough_credits" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => /APARTE/.test(e.message) && /cloud\.higgsfield\.ai/.test(e.message),
  );
});

test("el modelo de video también es configurable", async () => {
  const f = fetchFalso({
    "/kling-video/v2.5-turbo/pro/text-to-video": { body: { request_id: "v1", status: "queued" } },
    "/requests/v1/status": { body: { status: "completed", video: { url: "https://x/k.mp4" } } },
  });
  const url = await generarVideo("x", {
    env: { ...ENV, HIGGSFIELD_MODELO_VIDEO: "kling" }, fetchFn: f, dormir: sinDormir,
  });
  assert.equal(url, "https://x/k.mp4");
});

test("si el modelo no acepta 4:5 cae al vertical más parecido", async () => {
  // El OpenAPI dice que soul acepta 4:5; la API real lo rechaza con 422.
  // Degradar a 3:4 es preferible a fallar: Instagram acepta los dos.
  const f = fetchFalso({
    "/higgsfield-ai/soul/standard": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [{ url: "https://x/s.png" }] } },
  });
  await generarImagen("x", {
    env: { ...ENV, HIGGSFIELD_MODELO_IMAGEN: "soul" }, fetchFn: f, dormir: sinDormir,
  });
  assert.equal(JSON.parse(f.llamadas[0].opt.body).aspect_ratio, "3:4");
});

test("nano-banana conserva 4:5 porque sí lo acepta", async () => {
  const f = fetchFalso({
    "/nano-banana": { body: { request_id: "r1", status: "queued" } },
    "/requests/r1/status": { body: { status: "completed", images: [{ url: "https://x/i.png" }] } },
  });
  await generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(JSON.parse(f.llamadas[0].opt.body).aspect_ratio, "4:5");
});
