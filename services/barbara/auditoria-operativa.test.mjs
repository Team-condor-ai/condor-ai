import test from "node:test";
import assert from "node:assert/strict";
import { auditarBarbara, ejecutarAuditoria, resumenAlertas } from "./auditoria-operativa.mjs";

const ahora = new Date("2026-08-25T12:00:00Z");

test("detecta publicación colgada, entrega rota y patrón débil", () => {
  const salida = auditarBarbara({
    ahora,
    programaciones: [{ id: "p", estado: "publicando", claimed_at: "2026-08-25T10:00:00Z" }],
    memorias: [{ id: "m", creado_en: "2026-08-25T10:00:00Z", entrega_estado: "pendiente", barbara_media: [] }],
    patrones: [{ id: "g", activo: true, muestras: 4, marcas: 1, confianza_numerica: .05 }],
  });
  assert.deepEqual(new Set(salida.map((a) => a.tipo)), new Set(["publicacion_colgada", "entrega_sin_media", "pieza_sin_decision", "patron_debil_activo"]));
});

test("un estado sano no inventa alertas", () => {
  const salida = auditarBarbara({
    ahora,
    programaciones: [{ id: "p", estado: "publicada", external_id: "ext", programada_para: "2026-08-25T10:00:00Z" }],
    memorias: [{ id: "m", creado_en: "2026-08-25T10:00:00Z", entrega_estado: "entregada", barbara_media: [{ id: "x" }] }],
    decisiones: [{ barbara_memoria_id: "m" }],
    canales: [{ id: "c", activo: true, auto_publicar: true, account_ref: "acc" }],
  });
  assert.deepEqual(salida, []);
});

test("la clave de una incidencia es estable y no incluye texto sensible", () => {
  const base = { ahora, programaciones: [{ id: "p", estado: "fallida", intentos_publicacion: 4, ultimo_error: "detalle A" }] };
  const a = auditarBarbara(base)[0];
  const b = auditarBarbara({ ...base, programaciones: [{ ...base.programaciones[0], ultimo_error: "detalle B" }] })[0];
  assert.equal(a.clave, b.clave);
  assert.doesNotMatch(a.clave, /detalle/);
});

test("resume alertas en un único mensaje acotado", () => {
  const texto = resumenAlertas(Array.from({ length: 100 }, (_, i) => ({ severidad: "alta", resumen: `Problema ${i}`, detalles: { id: i } })));
  assert.ok(texto.length <= 4000);
  assert.match(texto, /Bárbara detectó 100/);
});

test("confirma todos los claims sólo después de notificar", async () => {
  const llamadas = [];
  const db = {
    async get() { return []; },
    async rpc(nombre, body) {
      llamadas.push([nombre, body]);
      if (nombre === "barbara_sincronizar_alertas_operativas") return [
        { clave: "a", claim_token: "1", severidad: "alta", resumen: "A", detalles: {} },
        { clave: "b", claim_token: "2", severidad: "media", resumen: "B", detalles: {} },
      ];
      return true;
    },
  };
  const salida = await ejecutarAuditoria({ db, ahora, notificar: async () => ({ message_id: 99 }) });
  assert.equal(salida.notificadas, 2);
  assert.equal(llamadas.filter((x) => x[0] === "barbara_finalizar_alerta_operativa").length, 2);
});

