import test from "node:test";
import assert from "node:assert/strict";
import { prepararMemoria, seleccionarGlobales, seleccionarPrivada, terminos } from "./memoria.mjs";

const ahora = new Date("2026-08-24T12:00:00Z");

test("la regla privada reforzada gana sobre gustos y datos", () => {
  const r = seleccionarPrivada({ ahora, reglas: [{ regla: "usa fondo claro", veces_reforzada: 4 }], nodos: [
    { tipo: "gusto", titulo: "Fotos", contenido: "prefiere personas", peso: 2 },
  ] });
  assert.match(r.texto.split("\n")[0], /fondo claro/);
});

test("deduplica una instrucción repetida antes de gastar contexto", () => {
  const r = seleccionarPrivada({ ahora, reglas: [{ regla: "usa fondo claro" }], nodos: [
    { tipo: "dato", titulo: "Regla", contenido: "usa fondo claro", peso: 20 },
  ] });
  assert.equal((r.texto.match(/fondo claro/g) || []).length, 1);
});

test("respeta presupuesto sin cortar notas", () => {
  const r = seleccionarPrivada({ ahora, maxChars: 35, nodos: [
    { tipo: "dato", titulo: "A", contenido: "x".repeat(60), peso: 10 },
    { tipo: "dato", titulo: "B", contenido: "corto", peso: 1 },
  ] });
  assert.match(r.texto, /corto/);
  assert.doesNotMatch(r.texto, /xxxx/);
});

test("una lista larga de reglas no expulsa el perfil ni el dato pertinente", () => {
  const reglas = Array.from({ length: 20 }, (_, i) => ({
    id: `r${i}`, regla: `Regla explícita número ${i} con suficiente texto para ocupar contexto`, veces_reforzada: 10,
  }));
  const nodos = [
    { id: "perfil", tipo: "perfil", titulo: "Perfil", contenido: "Marca cercana y experta", peso: 2 },
    { id: "dato", tipo: "dato", titulo: "Curso logística", contenido: "El curso de logística es para importadores", peso: 1 },
  ];
  const r = seleccionarPrivada({ reglas, nodos, contexto: { consulta: "curso logística importadores" }, maxChars: 260 });
  assert.ok(r.seleccionadas.some((x) => x.id === "perfil"));
  assert.ok(r.seleccionadas.some((x) => x.id === "dato"));
  assert.ok(r.seleccionadas.some((x) => x.clase === "regla"));
});

test("el premio de recencia se extingue durante el primer mes", () => {
  const ahora = new Date("2026-08-25T12:00:00Z");
  const nodos = [
    { id: "viejo", tipo: "dato", titulo: "Dato", contenido: "vende cursos", peso: 1, actualizado_en: "2026-06-01T12:00:00Z" },
    { id: "nuevo", tipo: "dato", titulo: "Dato", contenido: "vende talleres", peso: 1, actualizado_en: "2026-08-24T12:00:00Z" },
  ];
  const r = seleccionarPrivada({ nodos, ahora, contexto: {}, maxChars: 1000 });
  assert.ok(r.seleccionadas.find((x) => x.id === "nuevo").puntaje - r.seleccionadas.find((x) => x.id === "viejo").puntaje > 10);
});

test("un patrón global apagado nunca entra al prompt", () => {
  const r = seleccionarGlobales([{ patron: "patrón privado", muestras: 99, activo: false }]);
  assert.equal(r.texto, "");
});

test("un patrón de UGC no contamina un carrusel", () => {
  const r = seleccionarGlobales([
    { patron: "patrón de video", tipo: "ugc", muestras: 50, activo: true },
    { patron: "patrón general", tipo: "general", muestras: 5, activo: true },
  ], { contexto: { tipo: "carrusel" } });
  assert.doesNotMatch(r.texto, /video/);
  assert.match(r.texto, /general/);
});

test("patrones activos se priorizan por muestra y la salida es auditable", () => {
  const r = prepararMemoria({ ahora, patrones: [
    { patron: "menos evidencia", muestras: 2, activo: true },
    { patron: "más evidencia", muestras: 12, activo: true },
  ] });
  assert.match(r.global.texto.split("\n")[0], /más evidencia/);
  assert.equal(r.diagnostico.global_usada, 2);
});

test("extrae términos útiles sin ruido frecuente", () => {
  assert.deepEqual(terminos("Quiero una pieza para el curso de logística y stock"), ["quiero", "pieza", "curso", "logistica", "stock"]);
});

test("una nota pertinente gana a otra más reforzada pero ajena al pedido", () => {
  const r = seleccionarPrivada({
    contexto: { consulta: "promocionar curso de logística e inventario" },
    nodos: [
      { id: "a", tipo: "dato", titulo: "Cursos", contenido: "El curso principal enseña logística e inventario", peso: 1 },
      { id: "b", tipo: "dato", titulo: "Fundador", contenido: "La fundadora se llama Elena", peso: 9 },
    ],
  });
  assert.equal(r.seleccionadas[0].id, "a");
  assert.deepEqual(r.seleccionadas[0].coincidencias.sort(), ["curso", "inventario", "logistica"]);
});

test("expande un salto del grafo desde una nota pertinente", () => {
  const r = seleccionarPrivada({
    contexto: "campaña del curso de logística",
    maxChars: 130,
    nodos: [
      { id: "curso", tipo: "dato", titulo: "Curso de logística", contenido: "Formación para operadores", peso: 1 },
      { id: "tono", tipo: "gusto", titulo: "Tono", contenido: "Usar ejemplos prácticos y directos", peso: 1 },
      { id: "otro", tipo: "gusto", titulo: "Fotografía", contenido: "Preferir fondos azules", peso: 1 },
    ],
    relaciones: [{ origen_id: "curso", destino_id: "tono", tipo: "aplica", peso: 1 }],
  });
  assert.deepEqual(r.seleccionadas.map((x) => x.id), ["curso", "tono"]);
  assert.match(r.seleccionadas[1].detalle, /relacionada/);
});

test("confianza baja reduce prioridad sin borrar la memoria", () => {
  const r = seleccionarPrivada({
    nodos: [
      { id: "seguro", tipo: "dato", titulo: "A", contenido: "Hecho confirmado", confianza: 1, peso: 1 },
      { id: "dudoso", tipo: "dato", titulo: "B", contenido: "Inferencia tentativa", confianza: 0.2, peso: 3 },
    ],
  });
  assert.equal(r.seleccionadas[0].id, "seguro");
});

test("similitudNodos (pgvector) puede rescatar un recuerdo sin palabras en común", () => {
  const nodos = [
    { id: "literal", tipo: "dato", titulo: "Precio", contenido: "rebaja de verano", peso: 1 },
    { id: "semantico", tipo: "dato", titulo: "Promo", contenido: "descuento por temporada", peso: 1 },
  ];
  // Sin señal semántica, ninguno de los dos comparte palabras con la consulta
  // salvo el literal — "temporada" no aparece en la consulta.
  const sinSimilitud = seleccionarPrivada({ ahora, nodos, contexto: { consulta: "rebaja de verano" } });
  assert.equal(sinSimilitud.seleccionadas[0].id, "literal");

  const similitudNodos = new Map([["semantico", 0.95]]);
  const conSimilitud = seleccionarPrivada({ ahora, nodos, contexto: { consulta: "rebaja de verano" }, similitudNodos });
  assert.ok(conSimilitud.seleccionadas.find((x) => x.id === "semantico").puntaje >
    sinSimilitud.seleccionadas.find((x) => x.id === "semantico").puntaje);
});

test("prepararMemoria pasa similitudNodos hasta seleccionarPrivada", () => {
  const nodos = [{ id: "n1", tipo: "dato", titulo: "X", contenido: "algo sin relación literal", peso: 1 }];
  const similitudNodos = new Map([["n1", 1]]);
  const conSimilitud = prepararMemoria({ nodos, contexto: { consulta: "otra cosa" }, similitudNodos });
  const sinSimilitud = prepararMemoria({ nodos, contexto: { consulta: "otra cosa" } });
  assert.ok(conSimilitud.privada.seleccionadas[0].puntaje > sinSimilitud.privada.seleccionadas[0].puntaje);
});
