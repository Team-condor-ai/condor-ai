import { useState } from "react";
import { BrandBookEditor } from "../staff/agentes-ia/BrandBookEditor";
import { FormularioBarbara } from "../cliente/FormularioBarbara";
import type { BarbaraBrandBook, BarbaraFormulario } from "./tipos";

type Props = {
  barbaraClienteId: string;
  negocio: string;
  rubro: string | null;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  onCambio: () => void;
  esStaff?: boolean;
};

/** Reutiliza el editor de marca (staff) + el formulario de entrada (cliente):
 * los dos son igual de válidos para cualquiera que esté configurando SU
 * Bárbara, sea un cliente externo o Cóndor viendo la suya. */
export function BarbaraConfiguracion({ barbaraClienteId, negocio, rubro, brandBook, formulario, onCambio, esStaff = false }: Props) {
  const [editandoFormulario, setEditandoFormulario] = useState(false);

  return (
    <div className="barbara-configuracion">
      <section className="barbara-config-seccion">
        <h3>Identidad de marca</h3>
        {esStaff ? <BrandBookEditor
          barbaraClienteId={barbaraClienteId}
          negocio={negocio}
          rubro={rubro}
          inicial={brandBook}
          onGuardado={onCambio}
        /> : <ResumenMarca brandBook={brandBook} />}
      </section>

      <section className="barbara-config-seccion">
        <h3>Formulario de entrada</h3>
        <p className="parrafo" style={{ color: "var(--texto-2)" }}>
          Qué tipo de piezas quieres, a quién le hablas, tu tono y qué evitar.
        </p>
        <button className="btn solido" onClick={() => setEditandoFormulario(true)}>
          Editar formulario de entrada
        </button>
      </section>

      {editandoFormulario && (
        <FormularioBarbara
          barbaraClienteId={barbaraClienteId}
          inicial={formulario}
          cerrar={() => setEditandoFormulario(false)}
          guardado={() => { setEditandoFormulario(false); onCambio(); }}
        />
      )}
    </div>
  );
}

function ResumenMarca({ brandBook }: { brandBook: BarbaraBrandBook | null }) {
  if (!brandBook) return <p className="tenue">Tu identidad visual todavía está siendo configurada por el equipo.</p>;
  const colores = brandBook.paleta_colores?.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex)) ?? [];
  return <div className="barbara-marca-resumen">
    <div><small>Paleta de marca</small><span className="barbara-marca-colores">{colores.length ? colores.map((c) => <i key={c.hex} title={c.uso || c.hex} style={{ background: c.hex }} />) : "Sin paleta registrada"}</span></div>
    <div><small>Tipografía</small><b>{brandBook.tipografia || "Definida por el equipo"}</b></div>
    {brandBook.detalles && <p>{brandBook.detalles}</p>}
    <p className="tenue">¿Necesitas cambiar la identidad? Escríbenos y la ajustamos antes de la siguiente pieza.</p>
  </div>;
}
