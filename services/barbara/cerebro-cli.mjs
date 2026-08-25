/** Exporta/importa el cerebro como carpeta Obsidian. Importar crea propuestas. */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsearNota, serializarCerebro } from "./obsidian.mjs";
import { supabase } from "./motor.mjs";

async function exportar(db, clienteId, directorio) {
  const [nodos, relaciones] = await Promise.all([
    db.get(`barbara_memoria_nodos?barbara_cliente_id=eq.${clienteId}&select=id,tipo,titulo,contenido,peso,activo,confianza,etiquetas,version,creado_en,actualizado_en&order=actualizado_en.desc`),
    db.get(`barbara_memoria_relaciones?barbara_cliente_id=eq.${clienteId}&select=origen_id,destino_id,tipo,peso,activa`),
  ]);
  const salida = serializarCerebro({ nodos, relaciones });
  await mkdir(directorio, { recursive: true });
  for (const archivo of salida.archivos) await writeFile(resolve(directorio, archivo.ruta), archivo.contenido, "utf8");
  await writeFile(resolve(directorio, "MEMORY.md"), salida.indice, "utf8");
  await writeFile(resolve(directorio, "manifest.json"), JSON.stringify(salida.manifest, null, 2) + "\n", "utf8");
  return salida.archivos.length;
}

async function importar(db, clienteId, directorio, aplicar) {
  const nombres = (await readdir(directorio)).filter((x) => x.toLowerCase().endsWith(".md") && x !== "MEMORY.md").sort();
  const notas = [];
  for (const nombre of nombres) notas.push(parsearNota(await readFile(resolve(directorio, nombre), "utf8")));
  if (!aplicar) return notas;
  const resultados = [];
  for (const nota of notas) resultados.push(await db.rpc("barbara_proponer_importacion_obsidian", {
    p_barbara_cliente_id: clienteId, p_nodo_id: nota.nodo_id, p_version_esperada: nota.version,
    p_tipo: nota.tipo, p_titulo: nota.titulo, p_contenido: nota.contenido,
    p_etiquetas: nota.etiquetas, p_hash: nota.hash,
  }));
  return resultados;
}

async function main() {
  const [comando, directorioArg] = process.argv.slice(2);
  const clienteId = process.env.BARBARA_CLIENTE_ID || "";
  const url = process.env.SUPABASE_URL || "", key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clienteId)) throw new Error("Faltan Supabase o BARBARA_CLIENTE_ID válido");
  const directorio = resolve(directorioArg || `barbara-cerebro-${clienteId.slice(0, 8)}`);
  const db = supabase(url, key);
  if (comando === "exportar") console.log(`Exportadas ${await exportar(db, clienteId, directorio)} notas en ${directorio}`);
  else if (comando === "importar") {
    const aplicar = process.argv.includes("--aplicar");
    const salida = await importar(db, clienteId, directorio, aplicar);
    console.log(`${salida.length} nota(s) ${aplicar ? "propuestas para aprobación" : "válidas en dry-run"}.`);
  } else throw new Error("Uso: cerebro-cli.mjs exportar|importar [directorio] [--aplicar]");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
