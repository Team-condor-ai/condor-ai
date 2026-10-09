// Superpone el cóndor redibujado sobre el original para revisar el calco.
// node herramientas/calco.mjs salida.png variante
import sharp from "sharp";
import fs from "node:fs";
import { path, VARIANTES } from "./condor.mjs";
const [salida, variante = "fiel"] = process.argv.slice(2);
const k = 4;
const png = fs.readFileSync("assets/antes/logo-v2.png").toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${285 * k}" height="${248 * k}" viewBox="0 0 285 248">
<rect width="285" height="248" fill="#fff"/>
<image width="900" height="248" xlink:href="data:image/png;base64,${png}" opacity=".45"/>
<path d="${path(VARIANTES[variante])}" fill="rgba(0,0,0,.18)" stroke="#E0007A" stroke-width=".5"/></svg>`;
await sharp(Buffer.from(svg)).png().toFile(salida);
