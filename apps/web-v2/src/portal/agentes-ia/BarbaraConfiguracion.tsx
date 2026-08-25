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
};

/** Reutiliza el editor de marca (staff) + el formulario de entrada (cliente):
 * los dos son igual de válidos para cualquiera que esté configurando SU
 * Bárbara, sea un cliente externo o Cóndor viendo la suya. */
export function BarbaraConfiguracion({ barbaraClienteId, negocio, rubro, brandBook, formulario, onCambio }: Props) {
  const [editandoFormulario, setEditandoFormulario] = useState(false);

  return (
    <div>
      <section className="bloque" style={{ marginBottom: 18 }}>
        <h3>Identidad de marca</h3>
        <BrandBookEditor
          barbaraClienteId={barbaraClienteId}
          negocio={negocio}
          rubro={rubro}
          inicial={brandBook}
          onGuardado={onCambio}
        />
      </section>

      <section className="bloque">
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
