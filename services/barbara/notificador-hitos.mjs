/** Entrega idempotente de hitos reales de rendimiento por Telegram. */

import { fileURLToPath } from "node:url";
import { supabase, tg } from "./motor.mjs";
import { textoHito } from "./metricas.mjs";

export async function ejecutarNotificador({ db, notificar, limite = 20 } = {}) {
  await db.rpc("barbara_recuperar_notificaciones_colgadas", {}).catch(() => {});
  const filas = await db.rpc("barbara_reclamar_notificaciones", { p_limite: limite }) || [];
  const resultados = [];
  for (const fila of filas) {
    try {
      if (!fila.telegram_chat_id) throw new Error("cliente sin telegram_chat_id");
      const texto = textoHito({
        negocio: fila.negocio,
        plataforma: fila.plataforma,
        angulo: fila.angulo,
        metrica: fila.metrica,
        umbral: fila.umbral,
        valor: fila.valor,
      });
      await notificar({ chatId: fila.telegram_chat_id, texto });
      await db.rpc("barbara_finalizar_notificacion", {
        p_notificacion_id: fila.id, p_claim_token: fila.claim_token, p_enviada: true, p_error: null,
      });
      resultados.push({ id: fila.id, ok: true });
    } catch (error) {
      const mensaje = String(error?.message || error).slice(0, 700);
      await db.rpc("barbara_finalizar_notificacion", {
        p_notificacion_id: fila.id, p_claim_token: fila.claim_token, p_enviada: false, p_error: mensaje,
      }).catch(() => {});
      resultados.push({ id: fila.id, ok: false, error: mensaje });
    }
  }
  return resultados;
}

async function main() {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!sbUrl || !sbKey || !telegramToken) throw new Error("Faltan credenciales de Supabase o Telegram");
  const db = supabase(sbUrl, sbKey);
  const resultados = await ejecutarNotificador({
    db,
    limite: Number(process.env.LIMITE || 20),
    notificar: async ({ chatId, texto }) => {
      const respuesta = await tg(telegramToken, "sendMessage", { chat_id: chatId, text: texto });
      if (!respuesta.ok) throw new Error(`Telegram rechazó el aviso (${respuesta.status})`);
    },
  });
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`Hitos Bárbara: ${resultados.length - fallas}/${resultados.length} avisados.`);
  if (fallas) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

