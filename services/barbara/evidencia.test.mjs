import test from "node:test";
import assert from "node:assert/strict";
import { evaluarEvidencia } from "./evidencia.mjs";
test("no llama éxito al silencio reciente", () => assert.equal(evaluarEvidencia({ aprobada_sin_cambios: null, diasDesdePublicacion: 1 }).apta, false));
test("una pieza corregida no alimenta patrón global", () => assert.equal(evaluarEvidencia({ aprobada_sin_cambios: true, correcciones_pedidas: 1 }).apta, false));
test("aprobación limpia puede aprender con confianza limitada", () => assert.deepEqual(evaluarEvidencia({ aprobada_sin_cambios: true }), { apta: true, confianza: 0.45, razon: "aprobación limpia sin métricas externas" }));
test("métricas reales elevan la confianza", () => assert.ok(evaluarEvidencia({ aprobada_sin_cambios: true, metricas: { alcance: 1000, interacciones: 80 } }).confianza > .45));
