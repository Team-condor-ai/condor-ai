/**
 * Worker de publicaciones programadas multi-cliente.
 *
 * Sólo procesa filas reclamadas atómicamente por la RPC. La base exige que la
 * pieza esté `programada`, vencida y con un canal `auto_publicar=true`. El
 * estado `publicada` se escribe únicamente después de que Blotato responde
 * literalmente `published`; cualquier otra cosa vuelve a cola o falla visible.
 */

import { fileURLToPath } from "node:url";
import { crearClienteBlotato, construirPayloadPublicacion, esperarPublicacion } from "./blotato.mjs";
import { limitarHashtags } from "./blotato-outbox.mjs";
import { supabase, tg } from "./motor.mjs";

function uno(v) { return Array.isArray(v) ? v[0] : v; }

export async function cargarDetalle(db, programacionId) {
  const filas = await db.get(
    `barbara_programaciones?id=eq.${programacionId}` +
    `&select=id,barbara_cliente_id,claim_token,external_id,tipo,plataforma,programada_para,estado,` +
    `barbara_canales(account_ref,target,activo,auto_publicar),` +
    `barbara_memoria(id,angulo,contenido,barbara_media(storage_path,tipo,mime_type)),` +
    `barbara_clientes(telegram_chat_id,clientes(negocio))`
  );
  if (!filas[0]) throw new Error("Programación reclamada no encontrada");
  return filas[0];
}

function idPublicacion(respuesta) {
  return String(
    respuesta?.postSubmissionId || respuesta?.submissionId || respuesta?.postId || respuesta?.id || "",
  ).trim();
}

export async function procesarProgramacion({
  db, blotato, programacion, esperar = esperarPublicacion, notificar = async () => {},
} = {}) {
  const id = programacion?.id;
  const claimToken = programacion?.claim_token;
  let detalle;
  let submissionId = "";
  try {
    if (!id || !claimToken) throw new Error("Programación sin id o claim_token");
    detalle = await cargarDetalle(db, id);
    const canal = uno(detalle.barbara_canales);
    const memoria = uno(detalle.barbara_memoria);
    const cliente = uno(detalle.barbara_clientes);
    const media = memoria?.barbara_media || [];
    if (detalle.estado !== "publicando") throw new Error(`Estado inesperado: ${detalle.estado}`);
    if (!canal?.activo || !canal?.auto_publicar) throw new Error("Canal sin autorización de publicación automática");
    if (!canal.account_ref) throw new Error("Canal sin account_ref");
    if (!memoria || !media.length) throw new Error("Pieza sin media persistida");

    submissionId = String(detalle.external_id || "").trim();
    if (!submissionId) {
      const mediaUrls = [];
      for (const archivo of media) {
        const firmada = await db.sign("barbara-media", archivo.storage_path, 3600);
        const subida = await blotato.subirMedia(firmada);
        if (!subida?.url) throw new Error(`Blotato no devolvió URL para ${archivo.storage_path}`);
        mediaUrls.push(subida.url);
      }
      const caption = limitarHashtags(String(memoria.contenido?.caption || ""), detalle.plataforma === "instagram" ? 5 : undefined);
      const payload = construirPayloadPublicacion({
        accountId: canal.account_ref,
        platform: detalle.plataforma,
        text: caption,
        mediaUrls,
        target: canal.target || {},
      });
      const creada = await blotato.crearPublicacion(payload);
      submissionId = idPublicacion(creada);
      if (!submissionId) throw new Error("Blotato no devolvió id de seguimiento");
      await db.rpc("barbara_registrar_submission", {
        p_programacion_id: id, p_claim_token: claimToken, p_external_id: submissionId,
      });
    }
    const resultado = await esperar(blotato, submissionId);
    if (resultado?.status !== "published") {
      const error = new Error(`Proveedor terminó en estado ${resultado?.status || "desconocido"}: ${resultado?.message || "sin detalle"}`);
      error.terminal = resultado?.status === "failed";
      throw error;
    }
    const externalId = idPublicacion(resultado) || submissionId;
    await db.rpc("barbara_finalizar_publicacion", {
      p_programacion_id: id,
      p_claim_token: claimToken,
      p_publicada: true,
      p_external_id: externalId,
      p_error: null,
    });
    await db.post("barbara_eventos", {
      barbara_cliente_id: detalle.barbara_cliente_id,
      tipo: "publicacion_confirmada",
      actor: "barbara-worker",
      fuente_tipo: detalle.plataforma,
      fuente_id: externalId,
      payload: { programacion_id: id, estado_proveedor: "published" },
    }).catch(() => {});
    let notificacionOk = true;
    try {
      await notificar({
        ok: true,
        chatId: cliente?.telegram_chat_id,
        negocio: uno(cliente?.clientes)?.negocio || "tu marca",
        plataforma: detalle.plataforma,
        angulo: memoria.angulo,
        externalId,
      });
    } catch (e) {
      // La publicación ya fue confirmada: una falla de Telegram no puede
      // deshacerla ni convertirla en reintento (eso duplicaría contenido).
      notificacionOk = false;
      console.error(`[${id}] publicación confirmada, notificación falló:`, String(e).slice(0, 220));
      await db.post("barbara_eventos", {
        barbara_cliente_id: detalle.barbara_cliente_id,
        tipo: "notificacion_fallida",
        actor: "barbara-worker",
        fuente_tipo: "telegram",
        fuente_id: id,
        payload: { evento: "publicacion_confirmada", error: String(e).slice(0, 500) },
      }).catch(() => {});
    }
    return { ok: true, id, externalId, notificacionOk };
  } catch (e) {
    const mensaje = String(e?.message || e).slice(0, 1000);
    if (id && claimToken) {
      await db.rpc("barbara_finalizar_publicacion", {
        p_programacion_id: id,
        p_claim_token: claimToken,
        p_publicada: false,
        // Un timeout conserva el submission para seguir consultándolo. Un
        // estado terminal `failed` lo limpia para permitir un nuevo intento.
        p_external_id: e?.terminal ? null : submissionId || null,
        p_error: mensaje,
      }).catch((finalError) => {
        console.error(`[${id}] no se pudo finalizar el claim:`, String(finalError).slice(0, 240));
      });
    }
    if (detalle?.barbara_cliente_id) {
      await db.post("barbara_eventos", {
        barbara_cliente_id: detalle.barbara_cliente_id,
        tipo: "publicacion_fallida",
        actor: "barbara-worker",
        fuente_tipo: detalle.plataforma,
        fuente_id: id || null,
        payload: { programacion_id: id, error: mensaje },
      }).catch(() => {});
      const cliente = uno(detalle.barbara_clientes);
      await notificar({
        ok: false,
        chatId: cliente?.telegram_chat_id,
        negocio: uno(cliente?.clientes)?.negocio || "tu marca",
        plataforma: detalle.plataforma,
        error: mensaje,
      }).catch(() => {});
    }
    return { ok: false, id, error: mensaje };
  }
}

export async function ejecutarWorker({ db, blotato, notificar, limite = 10 } = {}) {
  await db.rpc("barbara_recuperar_publicaciones_colgadas", {}).catch((e) =>
    console.error("No se pudieron recuperar claims antiguos:", String(e).slice(0, 200)));
  const reclamadas = await db.rpc("barbara_reclamar_publicaciones", { p_limite: limite }) || [];
  const resultados = [];
  // Secuencial a propósito: reduce rate limits y conserva el orden horario.
  for (const programacion of reclamadas) {
    resultados.push(await procesarProgramacion({ db, blotato, programacion, notificar }));
  }
  return resultados;
}

async function main() {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const blotatoKey = process.env.BLOTATO_API_KEY;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!sbUrl || !sbKey || !blotatoKey || !telegramToken) {
    throw new Error("Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOTATO_API_KEY o TELEGRAM_BOT_TOKEN");
  }
  const db = supabase(sbUrl, sbKey);
  const blotato = crearClienteBlotato({ apiKey: blotatoKey });
  const notificar = async ({ ok, chatId, negocio, plataforma, angulo, error }) => {
    if (!chatId) return;
    const texto = ok
      ? `✅ ${negocio}: ya publiqué “${angulo || "tu contenido"}” en ${plataforma}. La plataforma confirmó la publicación.`
      : `⚠️ ${negocio}: no pude publicar en ${plataforma}. Quedó registrado y ${/3|tercer/i.test(error || "") ? "lo revisará soporte" : "lo reintentaré de forma segura"}.`;
    const r = await tg(telegramToken, "sendMessage", { chat_id: chatId, text: texto });
    if (!r.ok) throw new Error("Telegram no aceptó la notificación: " + r.status);
  };
  const resultados = await ejecutarWorker({ db, blotato, notificar, limite: Number(process.env.LIMITE || 10) });
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`Worker Bárbara: ${resultados.length - fallas}/${resultados.length} publicaciones confirmadas.`);
  if (fallas) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
