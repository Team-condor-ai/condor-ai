import assert from "node:assert/strict";
import test from "node:test";
import {
  apiDisponible, credencialesAPI, esperar, generarImagen, generarVideo, verificarCredenciales,
} from "./kie-api.mjs";

const ENV = { KIE_API_KEY: "key123" };
const sinDormir = async () => {};

/* Doble de fetch: responde según la ruta (ignorando querystring en recordInfo). */
function fetchFalso(rutas) {
  const llamadas = [];
  const fn = async (url, opt) => {
    llamadas.push({ url, opt });
    const sinBase = url.replace("https://api.kie.ai/api/v1", "");
    const ruta = sinBase.startsWith("/jobs/recordInfo") ? "/jobs/recordInfo" : sinBase;
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

test("apiDisponible sólo con KIE_API_KEY", () => {
  assert.equal(apiDisponible(ENV), true);
  assert.equal(apiDisponible({}), false);
  assert.equal(credencialesAPI({}), null);
});

test("manda Bearer en el header Authorization", async () => {
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "t1" } } },
    "/jobs/recordInfo": { body: { data: { state: "success", resultJson: { resultUrls: ["https://x/i.png"] } } } },
  });
  await generarImagen("hola", { env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(f.llamadas[0].opt.headers.Authorization, "Bearer key123");
});

test("generarImagen manda gpt-image-2 con aspect_ratio y resolution, y devuelve la URL", async () => {
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "t1" } } },
    "/jobs/recordInfo": { body: { data: { state: "success", resultJson: { resultUrls: ["https://x/i.png"] } } } },
  });
  const url = await generarImagen("un carrusel", { env: ENV, fetchFn: f, dormir: sinDormir });

  assert.equal(url, "https://x/i.png");
  const cuerpo = JSON.parse(f.llamadas[0].opt.body);
  assert.equal(cuerpo.model, "gpt-image-2-text-to-image");
  // 26-ago-2026: "4:5" explícito le hacía 422 a createTask -- "auto" + "1K"
  // da el mismo 4:5 exacto (1122×1402) sin pasar por esa ruta rota.
  assert.equal(cuerpo.input.aspect_ratio, "auto");
  assert.equal(cuerpo.input.resolution, "1K");
});

test("createTask sin taskId falla YA, en vez de colgar 9 min preguntando por 'undefined'", async () => {
  // 26-ago-2026: Kie a veces envuelve un error (ratio no soportado, sin
  // crédito) en un 200 HTTP con `data: null` -- sin este chequeo, `esperar`
  // pregunta por un taskId inexistente hasta el timeout.
  const f = fetchFalso({
    "/jobs/createTask": { body: { code: 422, msg: "temporarily unavailable", data: null } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    /createTask no devolvió taskId/,
  );
  // Un solo llamado: nunca llegó a golpear recordInfo con "undefined".
  assert.equal(f.llamadas.length, 1);
});

test("hace polling hasta que deja de estar en curso", async () => {
  let n = 0;
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "t1" } } },
    "/jobs/recordInfo": () => {
      n++;
      return n < 3
        ? { body: { data: { state: "generating" } } }
        : { body: { data: { state: "success", resultJson: { resultUrls: ["https://x/ok.png"] } } } };
    },
  });
  const url = await generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir, intervaloMs: 1 });
  assert.equal(url, "https://x/ok.png");
  assert.equal(n, 3, "debe seguir consultando mientras no sea terminal");
});

test("fail arrastra el mensaje del servidor", async () => {
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "t1" } } },
    "/jobs/recordInfo": { body: { data: { state: "fail", failMsg: "modelo caído" } } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => /modelo caído/.test(e.message),
  );
});

test("401 se marca permanent para que el llamador aborte el run", async () => {
  const f = fetchFalso({ "/jobs/createTask": { status: 401, body: { msg: "invalid key" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => e.permanent === true && /401/.test(e.message),
  );
});

test("un 500 NO es permanent: es transitorio", async () => {
  const f = fetchFalso({ "/jobs/createTask": { status: 500, body: { msg: "boom" } } });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    (e) => e.permanent !== true,
  );
});

test("success sin URL se reporta claro en vez de devolver undefined", async () => {
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "t1" } } },
    "/jobs/recordInfo": { body: { data: { state: "success", resultJson: { resultUrls: [] } } } },
  });
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: f, dormir: sinDormir }),
    /success pero sin URL/,
  );
});

test("generarVideo manda seedance-2-0 con duración, 9:16 y 720p, y devuelve la URL", async () => {
  const f = fetchFalso({
    "/jobs/createTask": { body: { data: { taskId: "v1" } } },
    "/jobs/recordInfo": { body: { data: { state: "success", resultJson: { resultUrls: ["https://x/v.mp4"] } } } },
  });
  const url = await generarVideo("x", { duracion: 5, env: ENV, fetchFn: f, dormir: sinDormir });
  assert.equal(url, "https://x/v.mp4");
  const cuerpo = JSON.parse(f.llamadas[0].opt.body);
  assert.equal(cuerpo.model, "bytedance/seedance-2-0-text-to-video");
  assert.equal(cuerpo.input.duration, 5);
  assert.equal(cuerpo.input.aspect_ratio, "9:16");
  assert.equal(cuerpo.input.resolution, "720p");
});

test("esperar corta por timeout en vez de quedarse colgado para siempre", async () => {
  const f = fetchFalso({ "/jobs/recordInfo": { body: { data: { state: "generating" } } } });
  await assert.rejects(
    () => esperar("t1", { env: ENV, fetchFn: f, dormir: sinDormir, intervaloMs: 1, timeoutMs: 5 }),
    /no terminó en/,
  );
});

test("verificarCredenciales distingue clave mala de request inexistente", async () => {
  const malas = fetchFalso({ __default: { status: 401, body: {} } });
  assert.deepEqual(await verificarCredenciales({ env: ENV, fetchFn: malas }),
    { ok: false, motivo: "credenciales inválidas" });

  const buenas = fetchFalso({ __default: { status: 404, body: {} } });
  assert.equal((await verificarCredenciales({ env: ENV, fetchFn: buenas })).ok, true);
});

test("sin credenciales falla diciendo qué variable falta", async () => {
  await assert.rejects(
    () => generarImagen("x", { env: {}, fetchFn: fetchFalso({}) }),
    /KIE_API_KEY/,
  );
});
