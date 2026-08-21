import { useEffect, useState } from "react";
import { sb } from "./supabase";

type Tasa = { moneda: string; a_clp: number; actualizado_en: string; fuente?: string | null };

export type Cambio = {
  /** Pasa un monto de su moneda a pesos chilenos. Sin tasa devuelve 0. */
  aCLP: (monto: number | null | undefined, moneda: string | null | undefined) => number;
  /** Si esta moneda se puede convertir. Sirve para avisar qué quedó fuera. */
  tieneTasa: (moneda: string | null | undefined) => boolean;
  /** Cuándo se actualizó el dato. Null mientras carga o si no hay ninguno. */
  fecha: string | null;
  listo: boolean;
};

/**
 * El tipo de cambio del día, para mostrar todo en una sola moneda.
 *
 * POR QUÉ NO ES UNA CONSTANTE EN EL CÓDIGO
 * ---------------------------------------------------------------------------
 * El panel viejo tenía `USD: 950` escrito a mano desde junio. Un número así no
 * falla nunca: sigue dando un total, cada vez más equivocado, y nadie se
 * entera. Acá viene con fecha, así que si está viejo se puede decir.
 *
 * SI NO HAY TASA, NO SE INVENTA
 * ---------------------------------------------------------------------------
 * Una moneda sin tasa devuelve 0 y `tieneTasa` da false, para que la pantalla
 * avise que hay plata fuera del total. Convertirla con un valor cualquiera
 * sería peor: el total saldría igual, y saldría mal.
 */
export function useCambio(): Cambio {
  // CLP arranca en 1 para que la conversión funcione aunque la función no
  // responda: el caso normal (todo en pesos) no depende de la red.
  const [tasas, setTasas] = useState<Record<string, number>>({ CLP: 1 });
  const [fecha, setFecha] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // La función refresca el dato si está viejo y lo guarda en la base, así
        // que todo el equipo ve el mismo número y con la misma fecha.
        const { data, error } = await sb.functions.invoke("tipo-cambio", { method: "GET" });
        if (error) throw error;
        const filas = ((data as { tasas?: Tasa[] })?.tasas ?? []).filter(
          (t) => t?.moneda && Number(t.a_clp) > 0,
        );
        if (!vivo || !filas.length) return;
        setTasas({ CLP: 1, ...Object.fromEntries(filas.map((t) => [t.moneda, Number(t.a_clp)])) });
        setFecha(filas.map((t) => t.actualizado_en).filter(Boolean).sort().pop() ?? null);
      } catch {
        // Sin función desplegada o sin red: se queda con CLP=1, y todo lo que
        // no sea CLP va a aparecer como "no convertido", que es la verdad.
      } finally {
        if (vivo) setListo(true);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const norm = (m: string | null | undefined) => (m || "CLP").toUpperCase();

  return {
    aCLP: (monto, moneda) => {
      const t = tasas[norm(moneda)];
      return t ? Math.round(Number(monto || 0) * t) : 0;
    },
    tieneTasa: (moneda) => !!tasas[norm(moneda)],
    fecha,
    listo,
  };
}
