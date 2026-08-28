/**
 * Bárbara · corrida semanal del cruce de datos.
 *
 * Toma, para cada cliente activo, sus reglas declaradas y sus piezas
 * publicadas, y guarda en `barbara_cruces` qué dice la evidencia sobre cada
 * preferencia. La lógica de decisión vive en `cruzar-datos.mjs`; acá solo está
 * el ir a buscar los datos, mapear el resultado a filas y escribirlo.
 *
 * SEMANAL, Y NO MÁS SEGUIDO, A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Las métricas de una publicación se mueven en días, no en minutos, y el cruce
 * exige un mínimo de muestras por lado. Correrlo a diario devolvería el mismo
 * veredicto una y otra vez gastando lecturas para nada.
 *
 * NO NOTIFICA A NADIE (decisión de Joaquín, 28-ago-2026)
 * ---------------------------------------------------------------------------
 * Los hallazgos se acumulan en la tabla y nadie los ve todavía. Un aviso del
 * tipo "la regla que pediste rinde peor" recién es útil con varias semanas de
 * historial detrás; mandarlo la primera vez, con tres muestras, sería ruido
 * con cara de conclusión.
 */

import { fileURLToPath } from "node:url";
import { supabase } from "./motor.mjs";
import { cruzar } from "./cruzar-datos.mjs";

// Ventana de piezas que se mira. Más atrás que esto, la marca, el público y el
// algoritmo de la red ya no son los mismos y comparar deja de ser honesto.
const DIAS_VENTANA = 180;

/** Un veredicto sin comparación no tiene rendimiento: va nulo, no cero. */
function rendimientoONulo(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : null;
}

/** Resultado de `cruzar` → filas listas para `barbara_cruces`. */
export function filasDeCruce(barbaraClienteId, resultado = {}) {
  const { hallazgos = [], piezas_evaluadas: piezasEvaluadas = 0 } = resultado;
  return hallazgos.map((h) => ({
    barbara_cliente_id: barbaraClienteId,
    regla_id: h.regla_id ?? null,
    regla: h.regla,
    veredicto: h.veredicto,
    accion: h.accion,
    motivo: h.motivo,
    muestras_a_favor: h.muestras_a_favor ?? 0,
    muestras_resto: h.muestras_resto ?? 0,
    rendimiento_con_regla: rendimientoONulo(h.rendimiento_con_regla),
    rendimiento_sin_regla: rendimientoONulo(h.rendimiento_sin_regla),
    piezas_evaluadas: piezasEvaluadas,
  }));
}

/** Corre el cruce de todos los clientes activos y escribe el historial. */
export async function ejecutarCruceSemanal({ db, ahora = new Date() } = {}) {
  const desde = new Date(ahora.getTime() - DIAS_VENTANA * 86_400_000).toISOString();
  const { data: clientes, error: errClientes } = await db
    .from("barbara_clientes").select("id").eq("activo", true);
  if (errClientes) throw new Error(`no se pudieron leer los clientes: ${errClientes.message}`);

  const resumen = { clientes: 0, hallazgos: 0, accionables: 0 };
  for (const cliente of clientes ?? []) {
    const [{ data: reglas }, { data: piezas }] = await Promise.all([
      db.from("barbara_reglas").select("id,regla,activa,etiquetas")
        .eq("barbara_cliente_id", cliente.id).eq("activa", true),
      db.from("barbara_memoria").select("id,tipo,angulo,estado,metricas,creado_en")
        .eq("barbara_cliente_id", cliente.id).eq("estado", "publicada").gte("creado_en", desde),
    ]);

    const resultado = cruzar({ reglas: reglas ?? [], piezas: piezas ?? [] });
    const filas = filasDeCruce(cliente.id, resultado);
    if (!filas.length) continue;

    const { error: errInsert } = await db.from("barbara_cruces").insert(filas);
    // Que un cliente falle no puede dejar sin cruce a los demás.
    if (errInsert) { console.error(`cruce de ${cliente.id} no se guardó: ${errInsert.message}`); continue; }

    resumen.clientes += 1;
    resumen.hallazgos += filas.length;
    resumen.accionables += filas.filter((f) => f.accion === "revisar_con_cliente").length;
  }
  return resumen;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const r = await ejecutarCruceSemanal({ db: supabase(url, key) });
  console.log(`Cruce semanal: ${r.hallazgos} hallazgos en ${r.clientes} clientes, ${r.accionables} para revisar con el cliente.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
