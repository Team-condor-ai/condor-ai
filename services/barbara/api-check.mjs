/**
 * Verifica las credenciales de la API oficial de Higgsfield sin gastar créditos.
 *
 *   node services/barbara/api-check.mjs
 *
 * Se corre después de crear la key en https://cloud.higgsfield.ai y exportar:
 *   HIGGSFIELD_API_KEY_ID y HIGGSFIELD_API_KEY_SECRET
 *
 * Con `--generar` hace además UNA imagen de prueba real (sí gasta créditos)
 * para confirmar de punta a punta antes de dejarlo en producción.
 */
import { apiDisponible, verificarCredenciales, generarImagen } from "./higgsfield-api.mjs";

const GENERAR = process.argv.includes("--generar");

/* process.exitCode en vez de process.exit(): con un fetch recién resuelto,
   salir de golpe hace que libuv tire una assertion en Windows. Dejar que el
   proceso termine solo da el mismo código de salida sin el ruido. */
async function main() {
  if (!apiDisponible()) {
    console.error(
      "Faltan las credenciales. Creálas en https://cloud.higgsfield.ai y exportá:\n" +
      "  export HIGGSFIELD_API_KEY_ID=...\n" +
      "  export HIGGSFIELD_API_KEY_SECRET=...\n\n" +
      "Y después subilas como secrets del repo (nunca las pegues en un archivo):\n" +
      "  gh secret set HIGGSFIELD_API_KEY_ID -R Team-condor-ai/condor-ai\n" +
      "  gh secret set HIGGSFIELD_API_KEY_SECRET -R Team-condor-ai/condor-ai"
    );
    process.exitCode = 1;
    return;
  }

  const r = await verificarCredenciales();
  if (!r.ok) {
    console.error(`❌ ${r.motivo}. Revisá que copiaste bien el KEY_ID y el KEY_SECRET.`);
    process.exitCode = 1;
    return;
  }
  console.log("✅ Credenciales válidas — la API responde y autentica.");

  if (!GENERAR) {
    console.log("\nPara probar una generación real (gasta créditos):");
    console.log("  node services/barbara/api-check.mjs --generar");
    return;
  }

  console.log("\nGenerando una imagen de prueba (puede tardar un par de minutos)…");
  const url = await generarImagen(
    "A minimal editorial poster, near-white background, one thin lime green line, " +
    "the words 'todo ok' in heavy black grotesque sans, lots of white space.",
    { aspectRatio: "4:5", formato: "png" }
  );
  console.log("✅ Imagen generada:", url);
  console.log("\nListo: Bárbara ya puede dejar de depender del CLI y del re-login manual.");
}

main().catch((e) => {
  console.error("❌", String(e).slice(0, 300));
  process.exitCode = 1;
});
