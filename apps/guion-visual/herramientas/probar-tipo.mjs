// Vista rápida de las letras: node herramientas/probar-tipo.mjs salida.svg [peso] [esqueleto]
import fs from "node:fs";
import { componer } from "./tipo.mjs";
const [salida, peso = "semibold", esq] = process.argv.slice(2);
const W = componer(peso);
const d = W.letras.map((l) => l.d).join("");
const e = esq ? W.letras.flatMap((l) => l.e).map((p) => `<path d="${p}" fill="none" stroke="#E0007A" stroke-width="1.2"/>`).join("") : "";
fs.writeFileSync(salida, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 ${W.top - 8} ${W.w + 16} ${W.h - W.top + 16}"><path fill="${esq ? "#c9cbd6" : "#151517"}" d="${d}"/>${e}</svg>`);
