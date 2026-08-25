import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Pedido = {
  titulo: string;
  detalle?: string;
  accion?: string;
  resolver: (acepta: boolean) => void;
};

const ContextoConfirmacion = createContext<((titulo: string, detalle?: string, accion?: string) => Promise<boolean>) | null>(null);

/** Confirmación React: no usa el diálogo nativo que Firefox puede bloquear. */
export function ConfirmacionProvider({ children }: { children: React.ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const confirmar = useCallback((titulo: string, detalle?: string, accion = "Confirmar") =>
    new Promise<boolean>((resolver) => setPedido({ titulo, detalle, accion, resolver })), []);

  const cerrar = useCallback((acepta: boolean) => {
    setPedido((actual) => {
      actual?.resolver(acepta);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pedido) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pedido, cerrar]);

  return (
    <ContextoConfirmacion.Provider value={confirmar}>
      {children}
      {pedido && (
        <div className="velo" onMouseDown={() => cerrar(false)}>
          <section
            className="panel-modal confirmacion-app"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmacion-titulo"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header><h2 id="confirmacion-titulo">{pedido.titulo}</h2></header>
            {pedido.detalle && <div className="contenido"><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{pedido.detalle}</p></div>}
            <footer>
              <button className="btn" autoFocus onClick={() => cerrar(false)}>Cancelar</button>
              <button className="btn solido" onClick={() => cerrar(true)}>{pedido.accion}</button>
            </footer>
          </section>
        </div>
      )}
    </ContextoConfirmacion.Provider>
  );
}

export function useConfirmacion() {
  const confirmar = useContext(ContextoConfirmacion);
  if (!confirmar) throw new Error("useConfirmacion debe usarse dentro de ConfirmacionProvider");
  return confirmar;
}
