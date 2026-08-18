import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

/**
 * Lo que Bárbara aprendió de una marca.
 *
 * POR QUÉ SE MUESTRA Y NO SE ESCONDE
 * ---------------------------------------------------------------------------
 * Estas reglas salen de lo que el cliente mismo corrigió, y son de su marca.
 * Verlas es parte de por qué el producto se siente propio en vez de una caja
 * negra: el cliente comprueba que lo escucharon. La política de la base ya lo
 * permitía (`cliente_ve_sus_reglas`), pero no había ninguna pantalla que lo
 * leyera — la regla existía y nadie la veía nunca.
 *
 * EL BOTÓN DE APAGAR ES SOLO DE STAFF
 * ---------------------------------------------------------------------------
 * Una regla mal destilada empeora todo el contenido siguiente, así que tiene
 * que poder apagarse. Pero se apaga, no se borra: saber que se aprendió algo
 * equivocado, y de dónde salió, es justo lo que sirve para arreglar el
 * destilador. El cliente la ve; solo staff la apaga.
 */
export type Regla = {
  id: string;
  regla: string;
  categoria: string | null;
  origen: string | null;
  veces_reforzada: number;
  activa: boolean;
  creado_en: string;
};

const COLOR: Record<string, string> = {
  copy: "#5B8DEF",
  diseno: "#B36BE8",
  producto: "#3FA45E",
  tono: "#E2564C",
  formato: "#E9AC17",
};

export function ReglasAprendidas({
  barbaraClienteId,
  puedeApagar = false,
}: {
  barbaraClienteId: string;
  puedeApagar?: boolean;
}) {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("barbara_reglas")
      .select("id, regla, categoria, origen, veces_reforzada, activa, creado_en")
      .eq("barbara_cliente_id", barbaraClienteId)
      .order("activa", { ascending: false })
      .order("veces_reforzada", { ascending: false });
    if (error) setError(error.message);
    else setReglas(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, [barbaraClienteId]);

  async function alternar(r: Regla) {
    // Se pinta al tiro y se manda después: esperar la respuesta para mover el
    // interruptor hace que revisar diez reglas seguidas se sienta lento.
    setReglas((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, activa: !x.activa } : x)),
    );
    const { error } = await sb
      .from("barbara_reglas")
      .update({ activa: !r.activa, actualizado_en: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      cargar(); // se deshace pidiendo el estado real, no adivinando
    }
  }

  if (cargando) return <p className="tenue">Cargando lo aprendido…</p>;
  if (error) return <p className="error">{error}</p>;

  if (!reglas.length) {
    return (
      <p className="tenue">
        Todavía no hay nada aprendido. Cada vez que se pide un cambio por
        Telegram, Bárbara destila de ahí la preferencia duradera y la anota acá
        para no volver a equivocarse en lo mismo.
      </p>
    );
  }

  const activas = reglas.filter((r) => r.activa).length;

  return (
    <>
      <p className="tenue" style={{ marginBottom: 10 }}>
        {activas} regla{activas === 1 ? "" : "s"} influyendo en cada pieza que
        se genera. Las que se pidieron más veces pesan más.
      </p>

      <ul className="lista-reglas">
        {reglas.map((r) => (
          <li key={r.id} className={"regla" + (r.activa ? "" : " apagada")}>
            <div className="regla-txt">
              <span>{r.regla}</span>
              <div className="regla-meta">
                {r.categoria ? (
                  <span
                    className="etiqueta-cat"
                    style={{ background: COLOR[r.categoria] ?? "#8A8F98" }}
                  >
                    {r.categoria}
                  </span>
                ) : null}
                {r.veces_reforzada > 1 ? (
                  <span className="veces">lo pidió {r.veces_reforzada} veces</span>
                ) : null}
                {/* De dónde salió, para poder auditar una regla rara. */}
                {r.origen ? <span className="origen">“{r.origen}”</span> : null}
              </div>
            </div>

            {puedeApagar ? (
              <button
                type="button"
                className="btn chico"
                onClick={() => alternar(r)}
                title={
                  r.activa
                    ? "Dejar de aplicarla. No se borra: queda registrada."
                    : "Volver a aplicarla."
                }
              >
                {r.activa ? "Apagar" : "Encender"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
