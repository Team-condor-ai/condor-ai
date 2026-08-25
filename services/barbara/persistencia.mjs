/**
 * Copia persistente y verificable de los assets de Bárbara.
 * Telegram es entrega; Supabase Storage es la biblioteca. Cada archivo queda
 * bajo cliente/pieza, con tamaño y SHA-256 para detectar corrupción o mezcla.
 */

import { createHash } from "node:crypto";

const EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

function idSeguro(valor, nombre) {
  const s = String(valor || "").trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(s)) throw new Error(`${nombre} inválido para ruta de storage`);
  return s;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function rutaMedia({ barbaraClienteId, piezaId, indice = 0, mimeType }) {
  const cliente = idSeguro(barbaraClienteId, "barbaraClienteId");
  const pieza = idSeguro(piezaId, "piezaId");
  const ext = EXTENSION[mimeType];
  if (!ext) throw new Error(`mime_type no permitido: ${mimeType}`);
  return `${cliente}/${pieza}/${String(indice + 1).padStart(2, "0")}.${ext}`;
}

export async function persistirMedia(db, {
  barbaraClienteId, piezaId, assets = [], bucket = "barbara-media",
} = {}) {
  const guardados = [];
  for (let indice = 0; indice < assets.length; indice++) {
    const asset = assets[indice];
    const buffer = Buffer.isBuffer(asset.buffer) ? asset.buffer : Buffer.from(asset.buffer || []);
    if (!buffer.length) throw new Error(`asset ${indice + 1} vacío`);
    if (buffer.length > 100 * 1024 * 1024) throw new Error(`asset ${indice + 1} supera 100 MB`);
    if (!["imagen", "video", "portada", "documento"].includes(asset.tipo)) {
      throw new Error(`tipo de asset no permitido: ${asset.tipo}`);
    }
    const storagePath = rutaMedia({ barbaraClienteId, piezaId, indice, mimeType: asset.mimeType });
    const hash = sha256(buffer);
    await db.upload(bucket, storagePath, buffer, { contentType: asset.mimeType, upsert: false });
    try {
      await db.post("barbara_media", {
        barbara_memoria_id: piezaId,
        storage_path: storagePath,
        tipo: asset.tipo,
        mime_type: asset.mimeType,
        bytes: buffer.length,
        sha256: hash,
      });
    } catch (e) {
      // No dejar un objeto huérfano si el catálogo de media no pudo anotarlo.
      await db.remove(bucket, [storagePath]).catch(() => {});
      throw e;
    }
    guardados.push({ storage_path: storagePath, bytes: buffer.length, sha256: hash });
  }
  return guardados;
}
