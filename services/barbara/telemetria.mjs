/** Telemetría local por intento: contadores, nunca prompts ni contenido. */

let actual = null;

export function iniciarTelemetria(meta = {}) {
  if (actual) throw new Error("ya existe una telemetría activa");
  actual = { meta: { ...meta }, inicio: new Date().toISOString(), llamadas: [] };
}

export function registrarClaude(respuesta = {}, modelo = "desconocido") {
  if (!actual) return;
  const u = respuesta.usage || {};
  actual.llamadas.push({
    proveedor: "anthropic", modelo,
    tokens_entrada: Math.max(0, Number(u.input_tokens) || 0),
    tokens_salida: Math.max(0, Number(u.output_tokens) || 0),
    tokens_cache_lectura: Math.max(0, Number(u.cache_read_input_tokens) || 0),
    tokens_cache_escritura: Math.max(0, Number(u.cache_creation_input_tokens) || 0),
    imagenes: 0, video_segundos: 0,
  });
}

export function registrarMedia({ proveedor, modelo, imagenes = 0, videoSegundos = 0 } = {}) {
  if (!actual) return;
  actual.llamadas.push({
    proveedor: String(proveedor || "desconocido"), modelo: String(modelo || "desconocido"),
    tokens_entrada: 0, tokens_salida: 0, tokens_cache_lectura: 0, tokens_cache_escritura: 0,
    imagenes: Math.max(0, Number(imagenes) || 0), video_segundos: Math.max(0, Number(videoSegundos) || 0),
  });
}

export function finalizarTelemetria({ estado = "completa", error = null } = {}) {
  if (!actual) return null;
  const corrida = actual;
  actual = null;
  const total = (campo) => corrida.llamadas.reduce((s, x) => s + Number(x[campo] || 0), 0);
  return {
    ...corrida.meta,
    inicio: corrida.inicio,
    fin: new Date().toISOString(),
    estado,
    error: error ? String(error?.message || error).slice(0, 500) : null,
    tokens_entrada: total("tokens_entrada"),
    tokens_salida: total("tokens_salida"),
    tokens_cache_lectura: total("tokens_cache_lectura"),
    tokens_cache_escritura: total("tokens_cache_escritura"),
    imagenes: total("imagenes"),
    video_segundos: total("video_segundos"),
    llamadas: corrida.llamadas,
  };
}

export function telemetriaActiva() { return Boolean(actual); }

export async function guardarTelemetria(db, resumen) {
  if (!resumen) return false;
  return db.rpc("barbara_registrar_consumo", {
    p_generacion_id: resumen.generacion_id,
    p_intento: resumen.intento,
    p_estado: resumen.estado,
    p_inicio: resumen.inicio,
    p_fin: resumen.fin,
    p_tokens_entrada: resumen.tokens_entrada,
    p_tokens_salida: resumen.tokens_salida,
    p_tokens_cache_lectura: resumen.tokens_cache_lectura,
    p_tokens_cache_escritura: resumen.tokens_cache_escritura,
    p_imagenes: resumen.imagenes,
    p_video_segundos: resumen.video_segundos,
    p_llamadas: resumen.llamadas,
    p_error: resumen.error,
  });
}

export async function verificarPresupuesto(db, barbaraClienteId) {
  const r = await db.rpc("barbara_verificar_presupuesto", { p_barbara_cliente_id: barbaraClienteId });
  return r || { configurado: false, permitido: true, modo: "observar" };
}

