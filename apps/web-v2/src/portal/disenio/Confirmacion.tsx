import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "./Dialogos";

type Pedido =
  | { tipo: "confirmar"; titulo: string; detalle?: string; accion: string; resolver: (v: boolean) => void }
  | { tipo: "texto"; titulo: string; detalle?: string; accion: string; etiqueta?: string; valor: string; placeholder?: string; resolver: (v: string | null) => void };

type Api = {
  confirmar: (titulo: string, detalle?: string, accion?: string) => Promise<boolean>;
  pedirTexto: (o: { titulo: string; detalle?: string; accion?: string; etiqueta?: string; valor?: string; placeholder?: string }) => Promise<string | null>;
};

const Contexto = createContext<Api | null>(null);
/** Las acciones que borran o sacan algo se pintan en rojo, para que no se aprieten por costumbre. */
const esPeligro = (accion: string) => /eliminar|borrar|quitar|cancelar plan/i.test(accion);

/** Confirmaciones y preguntas cortas con las ventanas del portal (nunca `confirm()` ni `prompt()` del navegador). */
export function ConfirmacionProvider({ children }: { children: React.ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState("");

  const confirmar = useCallback<Api["confirmar"]>((titulo, detalle, accion = "Confirmar") =>
    new Promise<boolean>((resolver) => setPedido({ tipo: "confirmar", titulo, detalle, accion, resolver })), []);
  const pedirTexto = useCallback<Api["pedirTexto"]>((o) =>
    new Promise<string | null>((resolver) => { setTexto(o.valor ?? ""); setPedido({ tipo: "texto", accion: "Guardar", valor: "", ...o, resolver }); }), []);

  const cerrar = useCallback((acepta: boolean) => {
    setPedido((p) => {
      if (p?.tipo === "confirmar") p.resolver(acepta);
      if (p?.tipo === "texto") p.resolver(acepta && texto.trim() ? texto.trim() : null);
      return null;
    });
  }, [texto]);

  return (
    <Contexto.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {pedido && (
        <Modal
          tamano="sm"
          titulo={pedido.titulo}
          onCerrar={() => cerrar(false)}
          pie={<>
            <button type="button" className="btn" onClick={() => cerrar(false)}>Cancelar</button>
            <button type="submit" form="dlg-form" className={`btn solido${pedido.tipo === "confirmar" && esPeligro(pedido.accion) ? " peligro" : ""}`} autoFocus={pedido.tipo === "confirmar"}>{pedido.accion}</button>
          </>}
        >
          <form id="dlg-form" onSubmit={(e) => { e.preventDefault(); cerrar(true); }}>
            {pedido.detalle && <p className="dlg-texto">{pedido.detalle}</p>}
            {pedido.tipo === "texto" && (
              <label className="dlg-campo">{pedido.etiqueta && <span>{pedido.etiqueta}</span>}
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedido.placeholder} autoFocus />
              </label>
            )}
          </form>
        </Modal>
      )}
    </Contexto.Provider>
  );
}

export function useConfirmacion() {
  const api = useContext(Contexto);
  if (!api) throw new Error("useConfirmacion debe usarse dentro de ConfirmacionProvider");
  return api.confirmar;
}

export function usePedirTexto() {
  const api = useContext(Contexto);
  if (!api) throw new Error("usePedirTexto debe usarse dentro de ConfirmacionProvider");
  return api.pedirTexto;
}
