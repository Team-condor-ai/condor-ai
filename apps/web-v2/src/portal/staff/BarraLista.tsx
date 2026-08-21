import { Ico } from "../disenio/iconos";

/**
 * La barra de una lista: buscar, filtrar y ordenar, en UNA fila.
 *
 * POR QUÉ EN UNA FILA
 * ---------------------------------------------------------------------------
 * Estaban en tres: buscador, orden y filtros, cada uno en su renglón. Ocupaban
 * cuatro centímetros de pantalla antes de la primera fila de datos y no se
 * leían como un conjunto — parecían tres cosas sueltas que quedaron ahí.
 *
 * El orden es el de cualquier tabla de la web hoy: la búsqueda a la izquierda
 * porque es lo que más se usa, los filtros al centro porque acotan lo que se
 * buscó, y el criterio de orden a la derecha porque se toca una vez y no se
 * vuelve a mirar.
 *
 * La misma barra la usan Clientes y Rat.IA: dos listas que se ven y se manejan
 * igual no dan para dos barras distintas.
 */
export function BarraLista({
  busca,
  setBusca,
  marcador,
  orden,
  setOrden,
  ordenes,
  chips,
  resultado,
}: {
  busca: string;
  setBusca: (v: string) => void;
  marcador: string;
  orden: string;
  setOrden: (v: string) => void;
  ordenes: { id: string; texto: string }[];
  chips?: React.ReactNode;
  /** "5 de 12" — solo aparece cuando hay algo filtrando. */
  resultado?: string;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div className="mini-busca" style={{ flex: "1 1 260px", maxWidth: 380 }}>
        {Ico.buscar({ t: 15 })}
        <input
          placeholder={marcador}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button
            className="icono-btn"
            style={{ width: 22, height: 22, border: 0, flex: "none" }}
            onClick={() => setBusca("")}
            title="Limpiar"
            aria-label="Limpiar búsqueda"
          >
            {Ico.salir({ t: 12 })}
          </button>
        )}
      </div>

      {/* Los filtros pueden ser muchos: se deslizan en vez de saltar de línea
          y empujar la tabla hacia abajo. */}
      {chips && (
        <div
          className="chips"
          style={{ margin: 0, flexWrap: "nowrap", overflowX: "auto", flex: "1 1 auto", paddingBottom: 2 }}
        >
          {chips}
        </div>
      )}

      {resultado && <span className="conteo">{resultado}</span>}

      <select
        className="campo"
        style={{ width: 186, flex: "none", marginLeft: "auto" }}
        value={orden}
        onChange={(e) => setOrden(e.target.value)}
        aria-label="Ordenar la lista"
      >
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>{o.texto}</option>
        ))}
      </select>
    </div>
  );
}
