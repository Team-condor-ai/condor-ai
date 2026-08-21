#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { construirPayloadPublicacion, crearClienteBlotato, esperarPublicacion } from "./blotato.mjs";

const [comando = "ayuda", argumento] = process.argv.slice(2);

function jsonEnv(nombre, fallback) {
  const raw = process.env[nombre];
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new TypeError(`${nombre} debe contener JSON válido`); }
}

function booleanEnv(nombre) {
  const raw = String(process.env[nombre] || "").trim().toLowerCase();
  if (!raw) return undefined;
  return ["1", "true", "si", "sí"].includes(raw);
}

function payloadDesdeEntorno() {
  if (process.env.BLOTATO_PAYLOAD_FILE) {
    return JSON.parse(readFileSync(process.env.BLOTATO_PAYLOAD_FILE, "utf8"));
  }
  return construirPayloadPublicacion({
    accountId: process.env.BLOTATO_ACCOUNT_ID,
    platform: process.env.BLOTATO_PLATFORM,
    text: process.env.BLOTATO_TEXT || "",
    mediaUrls: jsonEnv("BLOTATO_MEDIA_URLS", []),
    target: jsonEnv("BLOTATO_TARGET_JSON", {}),
    scheduledTime: process.env.BLOTATO_SCHEDULED_TIME || undefined,
    useNextFreeSlot: booleanEnv("BLOTATO_USE_NEXT_FREE_SLOT"),
  });
}

function imprimir(data) {
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  if (comando === "ayuda" || comando === "--help" || comando === "-h") {
    console.log("Uso: node services/barbara/blotato-cli.mjs <me|cuentas|subcuentas|dry-run|publicar|estado> [id]");
    return;
  }

  if (comando === "dry-run") {
    imprimir(payloadDesdeEntorno());
    return;
  }

  if (comando === "publicar" && process.env.BLOTATO_CONFIRMAR_PUBLICACION !== "PUBLICAR") {
    throw new Error("Publicación bloqueada. Define BLOTATO_CONFIRMAR_PUBLICACION=PUBLICAR de forma explícita.");
  }

  const cliente = crearClienteBlotato();
  if (comando === "me") return imprimir(await cliente.obtenerUsuario());
  if (comando === "cuentas") return imprimir(await cliente.listarCuentas());
  if (comando === "subcuentas") return imprimir(await cliente.listarSubcuentas(argumento || process.env.BLOTATO_ACCOUNT_ID));
  if (comando === "estado") return imprimir(await cliente.obtenerPublicacion(argumento || process.env.BLOTATO_POST_ID));

  if (comando === "publicar") {
    const resultado = await cliente.crearPublicacion(payloadDesdeEntorno());
    imprimir(resultado);
    if (process.env.BLOTATO_ESPERAR_RESULTADO === "1" && resultado?.postSubmissionId) {
      imprimir(await esperarPublicacion(cliente, resultado.postSubmissionId));
    }
    return;
  }

  throw new Error(`Comando desconocido: ${comando}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
