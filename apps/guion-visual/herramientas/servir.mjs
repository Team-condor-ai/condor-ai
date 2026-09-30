// Servidor estático mínimo para ver el guion en local: npm run dev → http://127.0.0.1:5320
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puerto = Number(process.env.PORT) || 5320;
const tipos = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".json": "application/json",
};

http
  .createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let archivo = path.join(raiz, ruta === "/" ? "index.html" : ruta);
    if (!archivo.startsWith(raiz) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404).end("No existe");
      return;
    }
    res.writeHead(200, { "Content-Type": tipos[path.extname(archivo)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(archivo).pipe(res);
  })
  .listen(puerto, "127.0.0.1", () => console.log(`Guion visual en http://127.0.0.1:${puerto}`));
