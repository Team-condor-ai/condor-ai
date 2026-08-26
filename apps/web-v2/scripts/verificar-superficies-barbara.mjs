import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assets = join(process.cwd(), "dist", "assets");
const archivo = readdirSync(assets).find((nombre) => /^Portal-.*\.css$/.test(nombre));

if (!archivo) throw new Error("No se generó el CSS del portal de Bárbara");

const css = readFileSync(join(assets, archivo), "utf8");
const contrato = css.match(/--barbara-produccion-superficie:([^;}]+)/);

if (!contrato) throw new Error("El bundle perdió el contrato de superficies de Bárbara");
if (/transparent|#0000|rgba\([^)]*,0\)/i.test(contrato[1])) {
  throw new Error("La superficie base de Bárbara quedó completamente transparente");
}

for (const selector of [
  ".barbara-inicio-principal .barbara-chat",
  ".barbara-calendario-celda.pasado",
  ".barbara-calendario-chip",
]) {
  if (!css.includes(selector)) throw new Error(`Falta ${selector} en el CSS de producción`);
}

console.log(`superficies-barbara: ${archivo} conserva fondos y fallbacks de producción`);
