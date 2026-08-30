import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODELO_POR_DEFECTO,
  credencial,
  generarConReferencia,
  generarImagen,
  imagenDisponible,
  tamanoPara,
  verificarCredenciales,
} from "./openai-imagen.mjs";

const ENV = { OPENAI_API_KEY: "sk-prueba" };

/** fetch falso: guarda lo que se le pidió y devuelve lo que se le indique. */
function fetchFalso(respuesta, { ok = true, status = 200 } = {}) {
  const llamadas = [];
  const fn = async (url, opciones = {}) => {
    llamadas.push({ url, opciones, cuerpo: opciones.body ? JSON.parse(opciones.body) : null });
    return { ok, status, text: async () => JSON.stringify(respuesta), json: async () => respuesta };
  };
  fn.llamadas = llamadas;
  return fn;
}

const UNA_IMAGEN = { data: [{ b64_json: "aGVsbG8=" }] };

test("sin key, el módulo se declara no disponible en vez de fallar al usarlo", () => {
  assert.equal(imagenDisponible({}), false);
  assert.equal(credencial({}), null);
  assert.equal(imagenDisponible(ENV), true);
});

test("sin key, generar avisa qué falta", async () => {
  await assert.rejects(
    () => generarImagen("algo", { env: {}, fetchFn: fetchFalso(UNA_IMAGEN) }),
    /OPENAI_API_KEY/,
  );
});

test("un prompt vacío no llega a gastar una llamada", async () => {
  const fetchFn = fetchFalso(UNA_IMAGEN);
  await assert.rejects(() => generarImagen("   ", { env: ENV, fetchFn }), /vac/i);
  assert.equal(fetchFn.llamadas.length, 0, "no debería haber llamado a la API");
});

test("pide vertical por defecto: es lo más cercano al 4:5 de Instagram", () => {
  assert.equal(tamanoPara(), "1024x1536");
  assert.equal(tamanoPara("cuadrada"), "1024x1024");
  assert.equal(tamanoPara("vertical", "2K"), "1536x2048");
  // Una forma o resolución desconocida cae a vertical 1K en vez de romper:
  // una pieza con la proporción equivocada es mejor que ninguna pieza.
  assert.equal(tamanoPara("diagonal", "8K"), "1024x1536");
});

test("devuelve data URI listo para la plantilla", async () => {
  const salida = await generarImagen("bodegón sobre madera", { env: ENV, fetchFn: fetchFalso(UNA_IMAGEN) });
  assert.match(salida.dataUri, /^data:image\/png;base64,/);
  assert.equal(salida.base64, "aGVsbG8=");
});

test("acepta también la forma con url, no sólo base64", async () => {
  const salida = await generarImagen("x", {
    env: ENV, fetchFn: fetchFalso({ data: [{ url: "https://ejemplo/x.png" }] }),
  });
  assert.equal(salida.url, "https://ejemplo/x.png");
  assert.equal(salida.dataUri, undefined);
});

test("una respuesta sin imagen se reporta clara, no como undefined", async () => {
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: fetchFalso({ data: [] }) }),
    /no devolvió ninguna imagen/,
  );
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn: fetchFalso({ data: [{ revised_prompt: "..." }] }) }),
    /ni b64_json ni url/,
  );
});

test("el error de la API llega con su motivo real, no como 'HTTP 400'", async () => {
  const fetchFn = fetchFalso(
    { error: { message: "Billing hard limit has been reached" } },
    { ok: false, status: 400 },
  );
  await assert.rejects(
    () => generarImagen("x", { env: ENV, fetchFn }),
    /Billing hard limit/,
    "sin el motivo, un problema de saldo se ve igual que un prompt inválido",
  );
});

test("el modelo se puede cambiar por variable de entorno", async () => {
  const fetchFn = fetchFalso(UNA_IMAGEN);
  await generarImagen("x", { env: ENV, fetchFn });
  assert.equal(fetchFn.llamadas[0].cuerpo.model, MODELO_POR_DEFECTO);

  const otro = fetchFalso(UNA_IMAGEN);
  await generarImagen("x", { env: { ...ENV, OPENAI_MODELO_IMAGEN: "gpt-image-9" }, fetchFn: otro });
  assert.equal(otro.llamadas[0].cuerpo.model, "gpt-image-9",
    "el id del modelo tiene que ser corregible sin un deploy");
});

test("sin referencias no se manda el campo image", async () => {
  const fetchFn = fetchFalso(UNA_IMAGEN);
  await generarImagen("x", { env: ENV, fetchFn });
  assert.equal("image" in fetchFn.llamadas[0].cuerpo, false);
});

test("con referencias, el envase real viaja en la petición", async () => {
  const fetchFn = fetchFalso(UNA_IMAGEN);
  await generarConReferencia("manteca sobre madera", ["data:image/png;base64,AAA"], { env: ENV, fetchFn });
  assert.deepEqual(fetchFn.llamadas[0].cuerpo.image, ["data:image/png;base64,AAA"]);
});

test("generarConReferencia exige al menos una referencia", async () => {
  await assert.rejects(
    () => generarConReferencia("x", [], { env: ENV, fetchFn: fetchFalso(UNA_IMAGEN) }),
    /al menos una imagen/,
  );
});

test("verificarCredenciales no gasta una generación", async () => {
  const fetchFn = fetchFalso({ data: [{ id: MODELO_POR_DEFECTO }] });
  const r = await verificarCredenciales({ env: ENV, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(r.visible, true);
  assert.match(fetchFn.llamadas[0].url, /\/models$/, "debe consultar modelos, no generar");
});

test("verificarCredenciales informa el motivo en vez de lanzar", async () => {
  assert.deepEqual(await verificarCredenciales({ env: {} }), { ok: false, motivo: "falta OPENAI_API_KEY" });
  const r = await verificarCredenciales({ env: ENV, fetchFn: fetchFalso({}, { ok: false, status: 401 }) });
  assert.deepEqual(r, { ok: false, motivo: "HTTP 401" });
});
