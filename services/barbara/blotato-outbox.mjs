import { readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { construirPayloadPublicacion } from "./blotato.mjs";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

function rutaSegura(directorio, archivo) {
  const raiz = resolve(directorio);
  const candidata = resolve(raiz, archivo);
  if (candidata !== raiz && !candidata.startsWith(raiz + sep)) {
    throw new TypeError(`Ruta fuera del outbox: ${archivo}`);
  }
  return candidata;
}

export function leerOutbox(directorio) {
  const manifestPath = rutaSegura(directorio, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== 1) throw new TypeError("Versión de outbox no soportada");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new TypeError("El outbox no contiene archivos");
  }
  return manifest;
}

export async function publicarOutbox(cliente, {
  directorio,
  accountId,
  scheduledTime,
  useNextFreeSlot,
}) {
  const manifest = leerOutbox(directorio);
  const mediaUrls = [];

  for (const archivo of manifest.files) {
    const path = rutaSegura(directorio, archivo);
    const mime = MIME[extname(path).toLowerCase()];
    if (!mime) throw new TypeError(`Formato multimedia no soportado: ${archivo}`);
    const dataUrl = `data:${mime};base64,${readFileSync(path).toString("base64")}`;
    const subida = await cliente.subirMedia(dataUrl);
    if (!subida?.url) throw new Error(`Blotato no devolvió URL para ${archivo}`);
    mediaUrls.push(subida.url);
  }

  const payload = construirPayloadPublicacion({
    accountId,
    platform: manifest.platform,
    text: manifest.caption || "",
    mediaUrls,
    target: manifest.target || {},
    scheduledTime,
    useNextFreeSlot,
  });
  return cliente.crearPublicacion(payload);
}

