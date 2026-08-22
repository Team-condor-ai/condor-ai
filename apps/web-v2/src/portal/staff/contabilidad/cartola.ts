/**
 * Leer una cartola bancaria en PDF y convertirla en movimientos.
 *
 * POR QUÉ ESTO NO CONFÍA EN SÍ MISMO
 * ---------------------------------------------------------------------------
 * Un PDF no tiene tabla: tiene textos con coordenadas. Reconstruir columnas a
 * partir de eso es adivinar, y adivinar mal en contabilidad significa dejar la
 * plata mal registrada sin que nadie se entere. Por eso el parser termina
 * SIEMPRE con la misma prueba: recalcular el saldo corrido desde el saldo
 * inicial y exigir que aterrice exactamente en el SALDO FINAL que imprime la
 * cartola. Si no cuadra, no se importa nada.
 *
 * Esa prueba no es decorativa: durante el desarrollo cachó tres formas
 * distintas de leer mal el mismo archivo antes de que llegaran a la base.
 *
 * LA TRAMPA DE LAS COLUMNAS
 * ---------------------------------------------------------------------------
 * Los montos van alineados a la DERECHA, y los encabezados no están sobre sus
 * propias columnas. Entonces "463" y "39.604" empiezan en posiciones muy
 * distintas aunque vivan en la misma columna. Agrupar por dónde empieza el
 * número los manda a columnas distintas; hay que agrupar por dónde TERMINA.
 */

export type FilaTexto = {
  y: number;
  piezas: { x: number; xFin: number; texto: string }[];
};

export type LineaCartola = {
  fecha: string;
  detalle: string;
  cargo: number;
  abono: number;
  saldoCartola: number | null;
  ordenEnDia: number;
};

export type Cartola = {
  lineas: LineaCartola[];
  desde: string | null;
  hasta: string | null;
  saldoInicial: number;
  saldoFinal: number | null;
  saldoCalculado: number;
  cuadra: boolean;
  /** Qué se probó y por qué falló, para poder decírselo a alguien. */
  diagnostico: string;
};

const aNumero = (s: string) => Number(s.replace(/\./g, ""));
const RE_MONTO = /\b\d{1,3}(?:\.\d{3})*\b/g;
const RE_FECHA_FILA = /^(\d{2})\/(\d{2})\b/;

/** Junta las piezas de una fila en un texto plano, respetando el orden. */
const textoDe = (f: FilaTexto) =>
  f.piezas.map((p) => p.texto).join(" ").replace(/\s+/g, " ").trim();

/**
 * Agrupa los bordes derechos en columnas. Dos montos son de la misma columna
 * si sus bordes derechos caen a menos de `tolerancia` uno del otro.
 */
function columnas(bordes: number[], tolerancia = 6): number[] {
  const ordenados = [...bordes].sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const b of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && b - ultimo[ultimo.length - 1] <= tolerancia) ultimo.push(b);
    else grupos.push([b]);
  }
  return grupos.map((g) => g.reduce((s, x) => s + x, 0) / g.length);
}

/** dd/mm + el año del período. Si la fecha cae después del cierre, es del año anterior. */
function conAnio(dia: string, mes: string, hasta: string | null): string {
  const anio = hasta ? Number(hasta.slice(0, 4)) : new Date().getFullYear();
  const tentativa = `${anio}-${mes}-${dia}`;
  if (hasta && tentativa > hasta) return `${anio - 1}-${mes}-${dia}`;
  return tentativa;
}

function fechaISO(texto: string): string | null {
  const m = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function fechaTras(texto: string, etiqueta: "DESDE" | "HASTA"): string | null {
  const m = texto.match(new RegExp(`${etiqueta}\\s*:?\\s*(\\d{2}\\/\\d{2}\\/\\d{4})`, "i"));
  return m ? fechaISO(m[1]) : null;
}

/**
 * Interpreta las filas ya extraídas del PDF. Función pura a propósito: acá
 * vive toda la lógica frágil, así que tiene que poder probarse sin un PDF.
 */
export function parsearCartola(filas: FilaTexto[]): Cartola {
  const enOrden = [...filas].sort((a, b) => a.y - b.y);
  const textos = enOrden.map(textoDe);

  // Período: de ahí sale el año, que las filas de movimiento no traen.
  let desde: string | null = null;
  let hasta: string | null = null;
  for (const t of textos) {
    if (!desde) desde = fechaTras(t, "DESDE") ?? desde;
    hasta = fechaTras(t, "HASTA") ?? hasta;
  }

  const filasMov = enOrden.filter((f) => RE_FECHA_FILA.test(textoDe(f)));

  // Todos los bordes derechos de montos que estén a la derecha del detalle.
  const bordes: number[] = [];
  for (const f of filasMov) {
    for (const p of f.piezas) {
      if (RE_MONTO.test(p.texto.trim()) && /^\d[\d.]*$/.test(p.texto.trim())) {
        bordes.push(p.xFin);
      }
      RE_MONTO.lastIndex = 0;
    }
  }
  const cols = columnas(bordes);

  const cercaDe = (x: number, centro: number) => Math.abs(x - centro) <= 6;

  /** Lee una fila usando una asignación concreta de columnas. */
  function leer(iCargo: number, iAbono: number, iSaldo: number) {
    const lineas: LineaCartola[] = [];
    let saldoInicial = 0;
    let saldoFinal: number | null = null;
    const vistosPorDia = new Map<string, number>();

    for (const f of filasMov) {
      const t = textoDe(f);
      const m = t.match(RE_FECHA_FILA)!;
      const montos = f.piezas
        .filter((p) => /^\d[\d.]*$/.test(p.texto.trim()))
        .map((p) => ({ xFin: p.xFin, valor: aNumero(p.texto.trim()) }));

      const tomar = (i: number) =>
        i < 0 ? null : montos.find((x) => cercaDe(x.xFin, cols[i]))?.valor ?? null;

      const cargo = tomar(iCargo) ?? 0;
      const abono = tomar(iAbono) ?? 0;
      const saldo = tomar(iSaldo);

      if (/SALDO\s+INICIAL/i.test(t)) { saldoInicial = saldo ?? 0; continue; }
      if (/SALDO\s+FINAL/i.test(t)) { saldoFinal = saldo; continue; }
      if (!cargo && !abono) continue;

      const fecha = conAnio(m[1], m[2], hasta);
      const n = vistosPorDia.get(fecha) ?? 0;
      vistosPorDia.set(fecha, n + 1);

      // El detalle es todo lo que hay antes del primer monto de la fila.
      const primerMonto = montos.length
        ? Math.min(...montos.map((x) => x.xFin))
        : Infinity;
      const detalle = f.piezas
        .filter((p) => p.xFin < primerMonto && !/^\d{2}\/\d{2}$/.test(p.texto.trim()))
        .map((p) => p.texto)
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/\b(INTERNET|CENTRAL)\b\s*$/i, "")
        .trim();

      lineas.push({ fecha, detalle, cargo, abono, saldoCartola: saldo, ordenEnDia: n });
    }

    let corrido = saldoInicial;
    for (const l of lineas) corrido += l.abono - l.cargo;
    return { lineas, saldoInicial, saldoFinal, saldoCalculado: corrido };
  }

  // El saldo es siempre la columna más a la derecha. Entre las otras dos no se
  // asume cuál es cargo y cuál abono: se prueban las dos y gana la que hace
  // cuadrar el saldo. Así el parser sobrevive a que el banco cambie el orden.
  const iSaldo = cols.length - 1;
  const candidatas: [number, number][] = cols.length >= 3
    ? [[cols.length - 3, cols.length - 2], [cols.length - 2, cols.length - 3]]
    : cols.length === 2 ? [[0, -1], [-1, 0]] : [[0, -1]];

  const intentos = candidatas.map(([a, b]) => leer(a, b, iSaldo));
  const bueno = intentos.find((r) => r.saldoFinal !== null && r.saldoCalculado === r.saldoFinal);
  const elegido = bueno ?? intentos[0];

  const diagnostico = bueno
    ? `Cuadra: ${elegido.lineas.length} movimientos, saldo final ${elegido.saldoFinal}.`
    : `El saldo recalculado (${elegido.saldoCalculado}) no coincide con el saldo final de la ` +
      `cartola (${elegido.saldoFinal ?? "no encontrado"}). Se probaron ${intentos.length} ` +
      `lecturas de columnas sobre ${cols.length} detectadas. No se importa nada.`;

  return {
    lineas: elegido.lineas,
    desde,
    hasta,
    saldoInicial: elegido.saldoInicial,
    saldoFinal: elegido.saldoFinal,
    saldoCalculado: elegido.saldoCalculado,
    cuadra: Boolean(bueno),
    diagnostico,
  };
}

/**
 * Convierte los textos que entrega pdf.js en filas.
 *
 * pdf.js devuelve cada trozo de texto con su matriz de transformación: el x
 * está en `transform[4]` y el y en `transform[5]`. El y crece hacia ARRIBA en
 * PDF, así que se invierte para que ordenar por y sea leer de arriba a abajo.
 * Dos trozos son de la misma fila si su y difiere en menos de 3 puntos: un
 * mismo renglón nunca queda perfectamente alineado al punto.
 */
export function filasDeItems(
  items: { str: string; width: number; transform: number[] }[],
  desplazamientoY = 0,
): FilaTexto[] {
  const piezas = items
    .filter((i) => i.str.trim() !== "")
    .map((i) => ({
      // Cada página vuelve a comenzar sus coordenadas. El llamador suma un
      // desplazamiento por página para que al ordenar no se intercalen las
      // filas de la página 1 con las de la 2.
      y: desplazamientoY - i.transform[5],
      x: i.transform[4],
      xFin: i.transform[4] + i.width,
      texto: i.str.trim(),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const filas: FilaTexto[] = [];
  for (const p of piezas) {
    const ultima = filas[filas.length - 1];
    if (ultima && Math.abs(ultima.y - p.y) < 3) ultima.piezas.push(p);
    else filas.push({ y: p.y, piezas: [p] });
  }
  for (const f of filas) f.piezas.sort((a, b) => a.x - b.x);
  return filas;
}
