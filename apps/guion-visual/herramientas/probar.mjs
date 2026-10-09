// Corre las suites de interacción real del guion (necesita `npm run dev` en :5320).
// node herramientas/probar.mjs        → kit, patrones (escritorio, celular, reducido) y navegación
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "pruebas");
const suites = [
  ["kit", "prueba.mjs", []],
  ["patrones", "probar.mjs", ["escritorio"]],
  ["patrones", "probar.mjs", ["movil"]],
  ["patrones", "probar.mjs", ["reducido"]],
  ["navegacion", "nav.mjs", []],
];
let malas = 0;
for (const [dir, archivo, args] of suites) {
  const r = spawnSync(process.execPath, [archivo, ...args], { cwd: path.join(raiz, dir), encoding: "utf8" });
  const salida = `${r.stdout || ""}${r.stderr || ""}`;
  const fallas = salida.split("\n").filter((l) => /^FALLA/.test(l));
  const oks = salida.split("\n").filter((l) => /^OK/.test(l)).length;
  console.log(`${fallas.length ? "✗" : "✓"} ${dir} ${args.join(" ")}: ${oks} OK, ${fallas.length} fallas`);
  fallas.forEach((f) => console.log("   " + f));
  if (fallas.length) malas++;
}
console.log(malas ? `\n${malas} suite(s) con fallas (revisar si son las esperadas por diseño: ver CONTEXTO.md)` : "\nTodo OK");
