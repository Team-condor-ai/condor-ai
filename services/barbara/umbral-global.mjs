// Umbral mínimo para promover un patrón global entre clientes (patrones.mjs).
// Separado en su propio módulo (sin imports de motor.mjs ni lectura de env
// vars) para que patrones.test.mjs lo pruebe sin arrastrar el punto de
// entrada del CLI, que aborta el proceso si faltan ANTHROPIC_API_KEY/SUPABASE_*.

/* Mínimo de piezas cerradas para que mirar el conjunto signifique algo. Por
   debajo de esto, cualquier "patrón" es la casualidad de dos clientes. */
export const MINIMO_PIEZAS = 12;
/* Y de cuántas marcas distintas: 20 piezas de un solo cliente describen a ese
   cliente, no un patrón global. Eso es justo lo que la memoria individual ya
   hace mejor. */
export const MINIMO_MARCAS = 3;

// Compuerta pura: protege el invariante "no inventar señal" (ver
// VISION-OBJETIVO-FINAL.md). Con 1 solo cliente activo esto NUNCA da true,
// y eso es el comportamiento correcto, no un bug — patrones.test.mjs lo fija.
export function cumpleUmbralGlobal({ totalPiezas, totalMarcas }) {
  return totalPiezas >= MINIMO_PIEZAS && totalMarcas >= MINIMO_MARCAS;
}
