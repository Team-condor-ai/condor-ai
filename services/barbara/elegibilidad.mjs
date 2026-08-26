// Compuertas puras de decisión de clientes.mjs — separadas en su propio
// módulo (sin imports de motor.mjs/sharp ni lectura de env vars) para que
// clientes.test.mjs las pruebe sin arrastrar el punto de entrada del CLI,
// que aborta el proceso si faltan ANTHROPIC_API_KEY/SUPABASE_*.

export function decidirElegibilidad({ telegram_chat_id, bb, form }) {
  if (!telegram_chat_id) return { elegible: false, motivo: "sin_telegram" };
  if (!bb || !form) return { elegible: false, motivo: "sin_brand_book_o_formulario" };
  return { elegible: true, motivo: null };
}

export function decidirCuota({ isRetry, limite, usadas, meta, respetarRitmo }) {
  if (isRetry) return { puede: true, motivo: null };
  if (!limite) return { puede: false, motivo: "plan_sin_tipo" };
  if (usadas >= limite) return { puede: false, motivo: "cuota_completa" };
  if (respetarRitmo && usadas >= meta) return { puede: false, motivo: "ritmo" };
  return { puede: true, motivo: null };
}
