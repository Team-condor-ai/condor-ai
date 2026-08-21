/** Las columnas reales de las tablas de contabilidad. Ver 20260821_contabilidad.sql. */
export type Cuenta = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "gasto";
  corriente: boolean;
  /** Es plata disponible: de acá sale el "cuánto tengo líquido". */
  liquida: boolean;
  activa: boolean;
  orden: number;
};

export type Linea = {
  id: string;
  asiento_id: string;
  cuenta_id: string;
  debe: number;
  haber: number;
  detalle: string | null;
};

export type Asiento = {
  id: string;
  fecha: string;
  glosa: string;
  origen: string;
  referencia: string | null;
  documento: string | null;
  creado_por: string | null;
  creado_en: string | null;
  asiento_lineas?: Linea[];
};

export type SaldoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: Cuenta["tipo"];
  corriente: boolean;
  liquida: boolean;
  total_debe: number;
  total_haber: number;
  saldo: number;
};

export type GastoFijo = {
  id: string;
  nombre: string;
  monto: number;
  moneda: string;
  cuenta_id: string | null;
  dia_del_mes: number | null;
  activo: boolean;
  notas: string | null;
  creado_en: string | null;
};

/** Gasto diario que el workflow importa desde Meta Marketing API. */
export type GastoMeta = {
  id: string;
  fecha: string;
  cuenta_publicitaria: string;
  nombre_cuenta: string | null;
  campana_id: string;
  campana_nombre: string;
  monto_original: number;
  moneda_original: string;
  tasa_a_clp: number;
  monto_clp: number;
  asiento_id: string | null;
  datos: Record<string, unknown> | null;
  sincronizado_en: string;
};

/**
 * Arma un asiento de partida doble con dos líneas.
 *
 * Es la ÚNICA forma en que el portal escribe contabilidad: así no hay manera
 * de dejar un asiento con una sola pata, que es el error que después obliga a
 * cuadrar a mano un mes entero.
 */
export function lineasDe(
  cuentaDebe: string,
  cuentaHaber: string,
  monto: number,
  detalle?: string,
) {
  return [
    { cuenta_id: cuentaDebe, debe: monto, haber: 0, detalle: detalle ?? null },
    { cuenta_id: cuentaHaber, debe: 0, haber: monto, detalle: detalle ?? null },
  ];
}
