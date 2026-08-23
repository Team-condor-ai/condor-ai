import assert from "node:assert/strict";
import test from "node:test";
import { revisar, rechazadas, resumen } from "./revision.mjs";

function claudeFalso(respuesta) {
  const llamadas = [];
  const fn = async (apiKey, body) => {
    llamadas.push({ apiKey, body });
    if (respuesta instanceof Error) throw respuesta;
    const texto = typeof respuesta === "string" ? respuesta : JSON.stringify(respuesta);
    return { content: [{ type: "text", text: texto }], stop_reason: "end_turn" };
  };
  fn.llamadas = llamadas;
  return fn;
}

const IMG = () => Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test("manda una imagen por pieza, en orden y como base64", async () => {
  const claude = claudeFalso({ piezas: [{ indice: 0, aprobada: true, problemas: [] }] });
  await revisar(claude, "k", [IMG()]);

  const contenido = claude.llamadas[0].body.messages[0].content;
  const imagenes = contenido.filter((c) => c.type === "image");
  assert.equal(imagenes.length, 1);
  assert.equal(imagenes[0].source.type, "base64");
  assert.equal(imagenes[0].source.media_type, "image/png");
});

test("aplica `reducir` antes de mandar, para no pagar el PNG entero", async () => {
  const claude = claudeFalso({ piezas: [] });
  let llamado = 0;
  await revisar(claude, "k", [IMG(), IMG()], {
    reducir: async () => { llamado++; return Buffer.from([1, 2, 3]); },
  });
  assert.equal(llamado, 2, "tiene que reducir cada imagen");
});

test("una pieza aprobada no arrastra problemas", async () => {
  const claude = claudeFalso({
    piezas: [{ indice: 0, aprobada: true, problemas: [{ tipo: "otro", detalle: "ruido" }] }],
  });
  const v = await revisar(claude, "k", [IMG()]);
  assert.equal(v[0].aprobada, true);
  assert.deepEqual(v[0].problemas, [], "si aprobó, los problemas no importan");
});

test("detecta la pieza rechazada y conserva el detalle", async () => {
  const claude = claudeFalso({
    piezas: [
      { indice: 0, aprobada: true, problemas: [] },
      { indice: 1, aprobada: false, problemas: [{ tipo: "ortografia", detalle: '"Espar añados" no existe' }] },
    ],
  });
  const v = await revisar(claude, "k", [IMG(), IMG()]);
  assert.deepEqual(rechazadas(v), [1]);
  assert.match(v[1].problemas[0].detalle, /Espar añados/);
});

test("si el revisor devuelve de menos, lo que falta se da por aprobado", async () => {
  // Bloquear una entrega por una respuesta incompleta del revisor sería peor
  // que dejar pasar la pieza.
  const claude = claudeFalso({ piezas: [{ indice: 0, aprobada: false, problemas: [] }] });
  const v = await revisar(claude, "k", [IMG(), IMG(), IMG()]);
  assert.equal(v.length, 3);
  assert.deepEqual(rechazadas(v), [0]);
  assert.equal(v[2].aprobada, true);
});

test("respeta el índice que declara el revisor, no el orden de la lista", async () => {
  const claude = claudeFalso({
    piezas: [
      { indice: 2, aprobada: false, problemas: [{ tipo: "solape", detalle: "x" }] },
      { indice: 0, aprobada: true, problemas: [] },
    ],
  });
  const v = await revisar(claude, "k", [IMG(), IMG(), IMG()]);
  assert.deepEqual(rechazadas(v), [2]);
});

test("sin imágenes no llama al modelo", async () => {
  const claude = claudeFalso({ piezas: [] });
  assert.deepEqual(await revisar(claude, "k", []), []);
  assert.equal(claude.llamadas.length, 0);
});

test("una respuesta no parseable dice stop_reason y largo, no 'undefined'", async () => {
  const claude = claudeFalso("esto no es json");
  await assert.rejects(
    () => revisar(claude, "k", [IMG()]),
    (e) => /stop_reason=end_turn/.test(e.message) && /15 chars/.test(e.message),
  );
});

test("resumen vacío cuando salió todo limpio", () => {
  assert.equal(resumen([{ indice: 0, aprobada: true, problemas: [] }]), "");
  assert.equal(resumen([]), "");
});

test("resumen numera los slides desde 1, como los ve una persona", () => {
  const txt = resumen([
    { indice: 0, aprobada: true, problemas: [] },
    { indice: 1, aprobada: false, problemas: [{ tipo: "ortografia", detalle: '"Endor cliente"' }] },
  ]);
  assert.match(txt, /slide 2/);
  assert.match(txt, /ortografia/);
  assert.doesNotMatch(txt, /slide 1/);
});

test("resumen aguanta un rechazo sin detalle", () => {
  const txt = resumen([{ indice: 0, aprobada: false, problemas: [] }]);
  assert.match(txt, /sin detalle/);
});
