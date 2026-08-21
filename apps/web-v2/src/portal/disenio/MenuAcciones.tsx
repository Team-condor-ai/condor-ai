import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ico } from "./iconos";

export type Accion = {
  texto: string;
  icono?: React.ReactNode;
  /** Una de las dos: acción o enlace. */
  onClick?: () => void;
  href?: string;
  /** Rojo, para lo que no se puede deshacer. */
  peligro?: boolean;
  /** Dibuja una línea antes de esta opción. */
  separar?: boolean;
};

/**
 * El menú de los tres puntitos de una fila.
 *
 * POR QUÉ UN MENÚ Y NO CUATRO ICONOS
 * ---------------------------------------------------------------------------
 * Una fila con cuatro iconos obliga a reconocerlos de memoria: un teléfono, un
 * cuadrito con flecha, una caja, un tacho. Al pasar de tres a cinco acciones ya
 * no cabían, y ninguno decía qué hacía sin dejar el mouse encima esperando el
 * tooltip. Detrás de los tres puntos caben las que sean, cada una con su
 * nombre escrito.
 *
 * SE POSICIONA FIJO, Y NO ES UN CAPRICHO
 * ---------------------------------------------------------------------------
 * `.tabla-caja` tiene `overflow:hidden` (lo necesita para que las esquinas
 * redondeadas recorten la tabla). Un menú `position:absolute` dentro de ella
 * queda cortado por ese borde: se ve la primera línea y nada más. Con
 * `position:fixed` el menú escapa de ese recorte, pero deja de seguir a la
 * página — por eso se cierra al hacer scroll en vez de quedarse flotando
 * lejos del botón que lo abrió.
 *
 * Se dibuja EN SU LUGAR del árbol y no en un portal a `document.body` a
 * propósito: el CSS del portal cuelga de `.portal-app`, así que fuera de ese
 * div el menú saldría sin estilos (ver la nota al principio de `estilo.css`).
 */
export function MenuAcciones({
  acciones,
  etiqueta = "Más acciones",
}: {
  acciones: Accion[];
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const ANCHO = 208;

  // Se mide DESPUÉS de montar el menú pero ANTES de pintarlo, o se ve un
  // fotograma en la esquina superior izquierda antes de saltar a su sitio.
  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    // Alineado por la derecha con el botón, y traído hacia adentro si se
    // saldría de la pantalla. Abre hacia arriba si abajo no cabe.
    const alto = Math.min(acciones.length * 38 + 16, 320);
    const cabeAbajo = r.bottom + alto + 8 < window.innerHeight;
    setPos({
      top: cabeAbajo ? r.bottom + 6 : Math.max(8, r.top - alto - 6),
      left: Math.max(8, Math.min(r.right - ANCHO, window.innerWidth - ANCHO - 8)),
    });
  }, [abierto, acciones.length]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    // `capture` en el scroll: si no, un contenedor interno que scrollea no
    // avisa y el menú se queda flotando sobre otra fila.
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    window.addEventListener("pointerdown", fuera);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("pointerdown", fuera);
      window.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div className={"sel" + (abierto ? " abierto" : "")} ref={raiz}>
      <button
        ref={boton}
        className="icono-btn"
        title={etiqueta}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v); }}
      >
        {Ico.puntos({ t: 16 })}
      </button>

      {abierto && (
        <div
          className="sel-menu"
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, right: "auto", minWidth: ANCHO }}
          onClick={(e) => e.stopPropagation()}
        >
          {acciones.map((a, i) => {
            const contenido = (
              <>
                <span style={{ display: "grid", placeItems: "center", width: 16, opacity: 0.75 }}>
                  {a.icono}
                </span>
                {a.texto}
              </>
            );
            const estilo = a.peligro ? { color: "var(--mal-tx)" } : undefined;
            return (
              <div key={i}>
                {a.separar && <div className="sep" />}
                {a.href ? (
                  <a
                    className="op"
                    role="menuitem"
                    href={a.href}
                    target="_blank"
                    rel="noreferrer"
                    // `color: inherit` porque `.portal-app a` pinta de azul
                    // todo enlace: sin esto, las opciones que abren algo
                    // saldrían de otro color que las que ejecutan una acción,
                    // y el menú se vería en dos idiomas.
                    style={{ color: "inherit", ...estilo, textDecoration: "none" }}
                    onClick={() => setAbierto(false)}
                  >
                    {contenido}
                  </a>
                ) : (
                  <button
                    className="op"
                    role="menuitem"
                    type="button"
                    style={estilo}
                    onClick={() => { setAbierto(false); a.onClick?.(); }}
                  >
                    {contenido}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
