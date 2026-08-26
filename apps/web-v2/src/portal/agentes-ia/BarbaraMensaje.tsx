import type { ReactNode } from "react";
import { bloquesRespuestaBarbara } from "./barbaraRespuesta";

function textoEnLinea(texto: string): ReactNode[] {
  return texto
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((parte, indice) => {
      if (parte.startsWith("**") && parte.endsWith("**")) {
        return <strong key={indice}>{parte.slice(2, -2)}</strong>;
      }
      if (parte.startsWith("`") && parte.endsWith("`")) {
        return <code key={indice}>{parte.slice(1, -1)}</code>;
      }
      return parte;
    });
}

export function BarbaraMensaje({ texto }: { texto: string }) {
  return (
    <div className="barbara-mensaje-formateado">
      {bloquesRespuestaBarbara(texto).map((bloque, indice) => {
        if (bloque.tipo === "titulo") return <h4 key={indice}>{textoEnLinea(bloque.texto)}</h4>;
        if (bloque.tipo === "cita") return <blockquote key={indice}>{textoEnLinea(bloque.texto)}</blockquote>;
        if (bloque.tipo === "lista" || bloque.tipo === "pasos") {
          const Lista = bloque.tipo === "lista" ? "ul" : "ol";
          return <Lista key={indice}>{bloque.items.map((item, itemIndice) => <li key={itemIndice}>{textoEnLinea(item)}</li>)}</Lista>;
        }
        if ("texto" in bloque) return <p key={indice}>{textoEnLinea(bloque.texto)}</p>;
        return null;
      })}
    </div>
  );
}
