import test from "node:test";
import assert from "node:assert/strict";
import { construirContrastes, extraerRasgos, huellaEvidencia, materialAnonimo, puntuarResultados } from "./rendimiento.mjs";

test("extrae sólo rasgos de forma, sin copiar contenido de marca", () => {
  const r = extraerRasgos({
    tipo: "carrusel", pilar: "educar",
    contenido: { slides: [{ titular: "Tres pasos claros", cuerpo: "Hazlo hoy" }, { titular: "¿Lo intentamos?", cuerpo: "" }], caption: "Texto #uno #dos" },
  });
  assert.deepEqual(r, {
    tipo: "carrusel", pilar: "educar", slides: "2-5", titular: "corto",
    cuerpo: "breve", cierre_pregunta: "si", caption: "corta", hashtags: "0-2",
  });
  assert.doesNotMatch(JSON.stringify(r), /Tres pasos|Hazlo/);
});

test("UGC no fabrica rasgos de slides inexistentes", () => {
  const r = extraerRasgos({ tipo: "ugc", pilar: "mostrar", contenido: { caption: "hola" } });
  assert.equal(r.slides, undefined);
  assert.equal(r.titular, undefined);
  assert.equal(r.tipo, "ugc");
});

function pieza(id, cliente, ok, pregunta) {
  return {
    id, barbara_cliente_id: cliente, tipo: "carrusel", pilar: "educar", aprobada_sin_cambios: ok,
    contenido: { slides: [{ titular: "Idea breve", cuerpo: pregunta ? "¿Te pasa?" : "Fin." }], caption: "caption" },
  };
}

test("sólo produce contraste con muestra y varias marcas", () => {
  const piezas = [
    pieza("1", "a", true, true), pieza("2", "b", true, true), pieza("3", "c", true, true), pieza("4", "a", true, true),
    pieza("5", "a", false, false), pieza("6", "b", false, false), pieza("7", "c", false, false), pieza("8", "a", false, false),
  ];
  const r = construirContrastes(piezas, { minGrupo: 4, minMarcas: 3, minDelta: 0.2 });
  const pregunta = r.find((x) => x.id === "cierre_pregunta:si");
  assert.equal(pregunta.direccion, "mejor");
  assert.equal(pregunta.marcas, 3);
  assert.ok(pregunta.delta > 0.5);
});

test("una sola marca nunca se convierte en patrón global", () => {
  const piezas = Array.from({ length: 12 }, (_, i) => pieza(String(i), "solo-una", i < 6, i < 6));
  assert.deepEqual(construirContrastes(piezas), []);
});

test("la huella es estable e incluye cambios de veredicto", () => {
  const a = [pieza("1", "a", true, true), pieza("2", "b", false, false)];
  assert.equal(huellaEvidencia(a), huellaEvidencia([...a].reverse()));
  const b = structuredClone(a); b[0].aprobada_sin_cambios = false;
  assert.notEqual(huellaEvidencia(a), huellaEvidencia(b));
});

test("las métricas se normalizan dentro de cada marca y no por tamaño bruto", () => {
  const piezas = [
    { ...pieza("a1", "grande", true, true), metricas: { alcance: 100_000, interacciones: 2_000 } },
    { ...pieza("a2", "grande", true, true), metricas: { alcance: 100_000, interacciones: 5_000 } },
    { ...pieza("a3", "grande", true, true), metricas: { alcance: 100_000, interacciones: 8_000 } },
    { ...pieza("b1", "chica", true, true), metricas: { alcance: 1_000, interacciones: 20 } },
    { ...pieza("b2", "chica", true, true), metricas: { alcance: 1_000, interacciones: 50 } },
    { ...pieza("b3", "chica", true, true), metricas: { alcance: 1_000, interacciones: 80 } },
  ];
  const r = puntuarResultados(piezas);
  assert.equal(r.find((p) => p.id === "a3").resultado, r.find((p) => p.id === "b3").resultado);
  assert.ok(r.find((p) => p.id === "a3").resultado > r.find((p) => p.id === "a1").resultado);
});

test("menos de tres piezas comparables no inventa señal social", () => {
  const r = puntuarResultados([
    { ...pieza("1", "a", true, true), metricas: { alcance: 1000, interacciones: 900 } },
    { ...pieza("2", "a", false, false), metricas: { alcance: 1000, interacciones: 1 } },
  ]);
  assert.deepEqual(r.map((p) => p.resultado), [1, 0]);
  assert.ok(r.every((p) => !p.evidencia_social));
});

test("el material anónimo sólo contiene agregados y referencias", () => {
  const texto = materialAnonimo([{ id: "titular:corto", direccion: "mejor", aprobadas: 8, muestras: 10, marcas: 4, con_metricas: 6, tasa: .75, tasa_resto: .45, delta: .3 }]);
  assert.match(texto, /titular:corto/);
  assert.match(texto, /4 marcas/);
  assert.doesNotMatch(texto, /cliente|producto/);
});
