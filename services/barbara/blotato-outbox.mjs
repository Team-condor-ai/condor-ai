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

// Instagram (vía Blotato) rechaza la publicación entera con un 422 si el texto
// trae más de 5 hashtags. Se recorta ACÁ y no en el prompt del director porque
// es un límite de la plataforma, no una preferencia de estilo: pedírselo al
// modelo es esperar que obedezca, y el 22-ago-2026 mandó 8 y tiró abajo la
// publicación después de haber subido las 6 imágenes.
//
// Se conservan los PRIMEROS, que es donde el director pone los más relevantes.
const MAX_HASHTAGS = { instagram: 5 };

export function limitarHashtags(texto, max) {
  if (!max || !texto) return texto;
  let vistos = 0;
  const podado = texto.replace(/#[\p{L}\p{N}_]+/gu, (etiqueta) => (++vistos <= max ? etiqueta : ""));
  if (vistos <= max) return texto;
  // Al sacar etiquetas quedan huecos: se colapsan los espacios que dejaron y se
  // limpia el final, para que no se publique con una cola de espacios.
  return podado.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "").trimEnd();
}

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

  const texto = limitarHashtags(manifest.caption || "", MAX_HASHTAGS[manifest.platform]);
  if (texto !== (manifest.caption || "")) {
    console.log(`Caption recortada a ${MAX_HASHTAGS[manifest.platform]} hashtags (límite de ${manifest.platform}).`);
  }

  const payload = construirPayloadPublicacion({
    accountId,
    platform: manifest.platform,
    text: texto,
    mediaUrls,
    target: manifest.target || {},
    scheduledTime,
    useNextFreeSlot,
  });
  return cliente.crearPublicacion(payload);
}

