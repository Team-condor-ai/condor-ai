/**
 * Outbox confiable de entrega a Telegram.
 *
 * Generar/persistir y entregar son operaciones distintas. El generador deja
 * la pieza y sus assets privados a salvo; este worker los reclama de manera
 * atómica. Si el caption falla después de enviar la media, el checkpoint de
 * IDs permite reintentar sólo el texto y no duplicar seis imágenes.
 */

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { supabase, tg } from "./motor.mjs";

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

function idsTelegram(respuesta) {
  const resultado = respuesta?.result;
  const mensajes = Array.isArray(resultado) ? resultado : resultado ? [resultado] : [];
  return mensajes.map((m) => Number(m?.message_id)).filter(Number.isSafeInteger);
}

async function descargarAssets(db, media, fetchFn = fetch) {
  const salida = [];
  for (const item of [...media].sort((a, b) => String(a.storage_path).localeCompare(String(b.storage_path)))) {
    const url = await db.sign("barbara-media", item.storage_path, 600);
    const respuesta = await fetchFn(url);
    if (!respuesta.ok) throw new Error(`no se pudo descargar ${item.storage_path}: HTTP ${respuesta.status}`);
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (Number(item.bytes) !== buffer.length) throw new Error(`tamaño inválido en ${item.storage_path}`);
    if (item.sha256 && hash(buffer) !== item.sha256) throw new Error(`SHA-256 inválido en ${item.storage_path}`);
    salida.push({ ...item, buffer });
  }
  return salida;
}

async function enviarMedia(telegram, token, fila, assets) {
  const imagenes = assets.filter((a) => String(a.mime_type).startsWith("image/"));
  const videos = assets.filter((a) => String(a.mime_type).startsWith("video/"));
  if (videos.length) {
    const ids = [];
    for (let i = 0; i < videos.length; i++) {
      const fd = new FormData();
      fd.append("chat_id", fila.telegram_chat_id);
      fd.append("caption", `🎬 ${fila.tipo === "ugc" ? "UGC" : "Video"} · ${fila.negocio}`);
      fd.append("video", new Blob([videos[i].buffer], { type: videos[i].mime_type }), `video_${i + 1}.mp4`);
      const respuesta = await (await telegram(token, "sendVideo", fd, true)).json();
      if (!respuesta.ok) throw new Error(`Telegram sendVideo: ${respuesta.description || "rechazado"}`);
      ids.push(...idsTelegram(respuesta));
    }
    return ids;
  }
  if (imagenes.length === 1) {
    const fd = new FormData();
    fd.append("chat_id", fila.telegram_chat_id);
    fd.append("caption", `${fila.tipo === "historia" ? "📱 Historia" : "🖼️ Carrusel"} · ${fila.negocio}`);
    fd.append("photo", new Blob([imagenes[0].buffer], { type: imagenes[0].mime_type }), "pieza.png");
    const respuesta = await (await telegram(token, "sendPhoto", fd, true)).json();
    if (!respuesta.ok) throw new Error(`Telegram sendPhoto: ${respuesta.description || "rechazado"}`);
    return idsTelegram(respuesta);
  }
  if (!imagenes.length) throw new Error("pieza sin media entregable");

  const fd = new FormData();
  fd.append("chat_id", fila.telegram_chat_id);
  const manifiesto = imagenes.map((asset, i) => ({
    type: "photo",
    media: `attach://asset${i}`,
    ...(i === 0 ? { caption: `🖼️ Carrusel · ${fila.negocio}` } : {}),
  }));
  fd.append("media", JSON.stringify(manifiesto));
  imagenes.forEach((asset, i) => fd.append(`asset${i}`, new Blob([asset.buffer], { type: asset.mime_type }), `slide_${i + 1}.png`));
  const respuesta = await (await telegram(token, "sendMediaGroup", fd, true)).json();
  if (!respuesta.ok) throw new Error(`Telegram sendMediaGroup: ${respuesta.description || "rechazado"}`);
  return idsTelegram(respuesta);
}

function textoRevision(fila) {
  return `🤖 Bárbara — contenido listo para revisar y aprobar.\n\n📝 Caption:\n\n${fila.caption || ""}`
    + "\n\nSi quieres cambios, responde a este mensaje describiéndolos "
    + "(máximo 3 correcciones antes de derivar a soporte).";
}

export async function procesarEntrega({ db, telegram = tg, token, fila, fetchFn = fetch } = {}) {
  if (!fila?.id || !fila?.claim_token) throw new Error("entrega sin claim");
  try {
    let mediaIds = Array.isArray(fila.telegram_media_ids) ? fila.telegram_media_ids : [];
    if (!mediaIds.length) {
      const assets = await descargarAssets(db, fila.media || [], fetchFn);
      mediaIds = await enviarMedia(telegram, token, fila, assets);
      if (!mediaIds.length) throw new Error("Telegram no devolvió IDs de media");
      const guardada = await db.rpc("barbara_registrar_media_entregada", {
        p_memoria_id: fila.id, p_claim_token: fila.claim_token, p_message_ids: mediaIds,
      });
      if (guardada !== true) throw new Error("no se pudo confirmar checkpoint de media");
    }
    const respuesta = await (await telegram(token, "sendMessage", {
      chat_id: fila.telegram_chat_id,
      text: textoRevision(fila),
      reply_to_message_id: mediaIds.at(-1),
      allow_sending_without_reply: true,
    })).json();
    if (!respuesta.ok) throw new Error(`Telegram sendMessage: ${respuesta.description || "rechazado"}`);
    const captionId = idsTelegram(respuesta)[0];
    if (!captionId) throw new Error("Telegram no devolvió ID del mensaje de revisión");
    const finalizada = await db.rpc("barbara_confirmar_entrega", {
      p_memoria_id: fila.id, p_claim_token: fila.claim_token, p_caption_message_id: captionId,
    });
    if (finalizada !== true) throw new Error("no se pudo confirmar la entrega en base");
    return { id: fila.id, ok: true, mediaIds, captionId };
  } catch (error) {
    const mensaje = String(error?.message || error).slice(0, 1000);
    await db.rpc("barbara_fallar_entrega", {
      p_memoria_id: fila.id, p_claim_token: fila.claim_token, p_error: mensaje,
    }).catch(() => {});
    return { id: fila.id, ok: false, error: mensaje };
  }
}

export async function ejecutarEntregador({ db, telegram = tg, token, limite = 10, fetchFn = fetch } = {}) {
  await db.rpc("barbara_recuperar_entregas_colgadas", {}).catch(() => {});
  const filas = await db.rpc("barbara_reclamar_entregas", { p_limite: limite }) || [];
  const resultados = [];
  // Secuencial: conserva orden y evita rate limits de Telegram.
  for (const fila of filas) resultados.push(await procesarEntrega({ db, telegram, token, fila, fetchFn }));
  return resultados;
}

async function main() {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!sbUrl || !sbKey || !token) throw new Error("Faltan credenciales de Supabase o Telegram");
  const resultados = await ejecutarEntregador({
    db: supabase(sbUrl, sbKey), token, limite: Number(process.env.LIMITE || 10),
  });
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`Entregas Bárbara: ${resultados.length - fallas}/${resultados.length} confirmadas.`);
  if (fallas) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

