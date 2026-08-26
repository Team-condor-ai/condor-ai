import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import {
  TIPOS_CONTENIDO,
  PILARES_CONTENIDO,
  MEZCLA_PILARES_DEFECTO,
  type BarbaraFormulario,
} from "../agentes-ia/tipos";

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
  const [pilares, setPilares] = useState<Record<string, number>>(
    inicial?.pilares ?? MEZCLA_PILARES_DEFECTO,
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !guardando) cerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [cerrar, guardando]);

  function alternar(id: string) {
    setTipoContenido((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  /**
   * Se guardan los pesos crudos, no porcentajes normalizados: si el cliente
   * vuelve a abrir el formulario tiene que ver los mismos números que puso.
   * El porcentaje que se muestra al lado es sólo informativo — el motor
   * normaliza igual (ver `normalizar` en pilares.mjs), así que no hace falta
   * obligar a que sumen 100 exactos y pelear con el redondeo.
   */
  const totalPilares = PILARES_CONTENIDO.reduce((s, p) => s + (pilares[p.id] || 0), 0);
  const porcentaje = (id: string) =>
    totalPilares > 0 ? Math.round(((pilares[id] || 0) / totalPilares) * 100) : 0;

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
        // Si quedó todo en 0 se guarda null: el motor cae a su mezcla por
        // defecto, que es mejor que una mezcla vacía que no elige nada.
        pilares: totalPilares > 0 ? pilares : null,
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
    <div className="velo" onClick={() => { if (!guardando) cerrar(); }}>
      <form
        className="panel-modal barbara-popup-formulario"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barbara-formulario-titulo"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <h2 id="barbara-formulario-titulo">Editar formulario de entrada</h2>
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

          <div className="campo-lbl">
            Mezcla de contenido
            <p style={{ margin: "4px 0 10px", fontSize: 13, opacity: 0.7 }}>
              Cuánto de cada cosa quieres publicar. No tiene que sumar 100: lo
              que importa es el peso relativo entre ellos.
            </p>
            {PILARES_CONTENIDO.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{p.nombre}</strong>
                  <span style={{ fontSize: 14, opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                    {porcentaje(p.id)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pilares[p.id] ?? 0}
                  onChange={(e) =>
                    setPilares((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                  }
                  style={{ width: "100%" }}
                  aria-label={p.nombre}
                />
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{p.ayuda}</p>
              </div>
            ))}
            {totalPilares === 0 && (
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                Todo en cero: usaremos nuestra mezcla recomendada.
              </p>
            )}
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
