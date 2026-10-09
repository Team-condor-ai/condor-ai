// Renderiza SVGs a PNG para revisarlos: node herramientas/vista.mjs salida.png ancho archivo1.svg [archivo2.svg …]
// Los apila en una hoja blanca (útil para comparar logos).
import sharp from "sharp";
import fs from "node:fs";
const [salida, ancho, ...archivos] = process.argv.slice(2);
const W = +ancho;
const piezas = [];
for (const f of archivos) {
  const svg = fs.readFileSync(f, "utf8").replace(/currentColor/g, "#0B0C12");
  const png = await sharp(Buffer.from(svg), { density: 300 }).resize({ width: W }).png().toBuffer();
  const m = await sharp(png).metadata();
  piezas.push({ png, h: m.height });
}
const gap = 24, H = piezas.reduce((a, p) => a + p.h + gap, gap);
let y = gap;
const comp = piezas.map((p) => { const c = { input: p.png, left: 24, top: y }; y += p.h + gap; return c; });
await sharp({ create: { width: W + 48, height: H, channels: 3, background: "#fff" } }).composite(comp).png().toFile(salida);
