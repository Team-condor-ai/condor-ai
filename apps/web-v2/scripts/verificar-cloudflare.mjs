import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(raiz, "dist");
const LIMITE = 25 * 1024 * 1024;

function archivos(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    return entrada.isDirectory() ? archivos(ruta) : [ruta];
  });
}

const lista = archivos(dist);
const grandes = lista
  .map((ruta) => ({ ruta, bytes: statSync(ruta).size }))
  .filter((archivo) => archivo.bytes > LIMITE);

if (grandes.length) {
  console.error("Cloudflare rechazaría estos archivos por superar 25 MiB:");
  for (const archivo of grandes) {
    console.error(
      `  ${relative(dist, archivo.ruta)} · ${(archivo.bytes / 1024 / 1024).toFixed(2)} MiB`,
    );
  }
  process.exit(1);
}

const portada = readFileSync(join(dist, "index.html"), "utf8");
const shell = readFileSync(join(dist, "404.html"), "utf8");

if (!portada.includes("rediseno/estilo.css")) {
  throw new Error("dist/index.html no es la portada corporativa estática");
}
if (!shell.includes('id="root"')) {
  throw new Error("dist/404.html no contiene la cáscara React del portal");
}

const total = lista.reduce((suma, ruta) => suma + statSync(ruta).size, 0);
console.log(
  `Cloudflare listo: ${lista.length} archivos · ${(total / 1024 / 1024).toFixed(2)} MiB · máximo individual bajo 25 MiB.`,
);
