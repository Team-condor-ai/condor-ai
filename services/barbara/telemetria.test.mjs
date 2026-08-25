import test from "node:test";
import assert from "node:assert/strict";
import { finalizarTelemetria, guardarTelemetria, iniciarTelemetria, registrarClaude, registrarMedia, telemetriaActiva } from "./telemetria.mjs";

test("agrega tokens y unidades sin guardar contenido", () => {
  iniciarTelemetria({ generacion_id: "g", intento: 1 });
  registrarClaude({ usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 }, contenido_privado: "no guardar" }, "sonnet");
  registrarMedia({ proveedor: "kie", modelo: "gpt-image-2", imagenes: 2 });
  registrarMedia({ proveedor: "kie", modelo: "seedance-2-0", videoSegundos: 6 });
  const r = finalizarTelemetria({ estado: "completa" });
  assert.equal(r.tokens_entrada, 100);
  assert.equal(r.tokens_salida, 20);
  assert.equal(r.imagenes, 2);
  assert.equal(r.video_segundos, 6);
  assert.doesNotMatch(JSON.stringify(r), /no guardar/);
  assert.equal(telemetriaActiva(), false);
});

test("una corrida fallida conserva consumo previo y error acotado", () => {
  iniciarTelemetria({ generacion_id: "g2", intento: 2 });
  registrarClaude({ usage: { input_tokens: 10, output_tokens: 5 } }, "sonnet");
  const r = finalizarTelemetria({ estado: "fallida", error: "x".repeat(1000) });
  assert.equal(r.estado, "fallida");
  assert.equal(r.error.length, 500);
  assert.equal(r.tokens_entrada, 10);
});

test("guardar usa una RPC estrecha y el intento como idempotencia", async () => {
  let llamada;
  const db = { async rpc(nombre, body) { llamada = [nombre, body]; return true; } };
  await guardarTelemetria(db, {
    generacion_id: "g", intento: 3, estado: "completa", inicio: "i", fin: "f",
    tokens_entrada: 1, tokens_salida: 2, tokens_cache_lectura: 3, tokens_cache_escritura: 4,
    imagenes: 1, video_segundos: 0, llamadas: [], error: null,
  });
  assert.equal(llamada[0], "barbara_registrar_consumo");
  assert.equal(llamada[1].p_intento, 3);
});

