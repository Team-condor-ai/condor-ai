import { BarbaraClientesLista } from "./BarbaraClientesLista";

/**
 * "Agentes IA" — pensado para más agentes a futuro, no solo Bárbara.
 *
 * Hoy hay uno solo, así que el selector de agentes es un chip fijo en
 * "Bárbara". El día que se sume el segundo agente, este es el lugar donde se
 * agrega el chip nuevo — la lista de abajo cambia según cuál esté activo, en
 * vez de crecer el menú lateral con un ítem por agente.
 */
export function AgentesIA() {
  return (
    <>
      <div className="barra">
        <h1>Agentes IA</h1>
      </div>

      <div className="cuerpo">
        <div className="chips">
          <button className="chip on">Bárbara</button>
          <button className="chip" disabled title="Todavía no está disponible">
            Más agentes
            <span>PRONTO</span>
          </button>
        </div>

        <h3 style={{ marginTop: 18 }}>Bárbara Clientes</h3>
        <BarbaraClientesLista />
      </div>
    </>
  );
}
