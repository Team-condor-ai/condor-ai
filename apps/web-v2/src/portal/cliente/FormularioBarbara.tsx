import { useState } from "react";
import { sb } from "../lib/supabase";
import { TIPOS_CONTENIDO, type BarbaraFormulario } from "../agentes-ia/tipos";

type Props = {
  barbaraClienteId: string;
  inicial: BarbaraFormulario | null;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Formulario de entrada que llena el cliente — mismos campos EXACTOS que
 * consume `services/barbara/clientes.mjs`. Solo hace UPDATE (nunca insert):
 * la fila de `barbara_formulario` la crea staff al dar de alta al cliente en
 * Bárbara (ver `AgregarBarbaraCliente.tsx`) — la policy de RLS del cliente
 * es a propósito solo de edición, no de creación.
 */
export function FormularioBarbara({ barbaraClienteId, inicial, cerrar, guardado }: Props) {
  const [tipoContenido, setTipoContenido] = useState<string[]>(inicial?.tipo_contenido ?? []);
  const [publicoObjetivo, setPublicoObjetivo] = useState(inicial?.publico_objetivo ?? "");
  const [tono, setTono] = useState(inicial?.tono ?? "");
  const [restricciones, setRestricciones] = useState(inicial?.restricciones ?? "");
  const [ejemplosReferencia, setEjemplosReferencia] = useState(inicial?.ejemplos_referencia ?? "");
  const [productoDestacar, setProductoDestacar] = useState(inicial?.producto_destacar ?? "");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function alternar(id: string) {
    setTipoContenido((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");

    const { data, error } = await sb
      .from("barbara_formulario")
      .update({
        tipo_contenido: tipoContenido,
        publico_objetivo: publicoObjetivo || null,
        tono: tono || null,
        restricciones: restricciones || null,
        ejemplos_referencia: ejemplosReferencia || null,
        producto_destacar: productoDestacar || null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("barbara_cliente_id", barbaraClienteId)
      .select("id");

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError(
        "Tu formulario todavía no está configurado del lado nuestro. Escríbenos y lo activamos.",
      );
      return;
    }
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>Editar formulario de entrada</h2>
        </header>

        <div className="contenido">
          <div className="campo-lbl">
            Tipo de contenido
            <div className="chips" style={{ marginTop: 6 }}>
              {TIPOS_CONTENIDO.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={"chip" + (tipoContenido.includes(t.id) ? " on" : "")}
                  onClick={() => alternar(t.id)}
                >
                  {t.texto}
                </button>
              ))}
            </div>
          </div>

          <label className="campo-lbl">
            Público objetivo
            <textarea
              className="campo"
              rows={2}
              value={publicoObjetivo}
              onChange={(e) => setPublicoObjetivo(e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Tono
            <textarea
              className="campo"
              rows={2}
              placeholder="3 adjetivos + un ejemplo de texto que suene a ustedes"
              value={tono}
              onChange={(e) => setTono(e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Restricciones
            <textarea
              className="campo"
              rows={2}
              placeholder="Qué no decir o no mostrar"
              value={restricciones}
              onChange={(e) => setRestricciones(e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Ejemplos de referencia
            <textarea
              className="campo"
              rows={2}
              placeholder="Cuentas o piezas que les gustan"
              value={ejemplosReferencia}
              onChange={(e) => setEjemplosReferencia(e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Producto o servicio a destacar
            <textarea
              className="campo"
              rows={2}
              value={productoDestacar}
              onChange={(e) => setProductoDestacar(e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
