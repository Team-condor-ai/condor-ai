import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./iconos";

/**
 * Las ventanas del portal (24-oct-2026). Un solo componente para todo lo que se abre encima de la página:
 * confirmaciones, formularios cortos (`Modal`) y fichas largas (`Cajon`, desde la derecha). Nunca diálogos
 * del navegador: se ven distinto en cada uno y Firefox puede bloquearlos.
 *
 * Reglas: siempre caben en la pantalla (el cuerpo scrollea por dentro, la cabecera y el pie quedan fijos),
 * Esc y clic afuera cierran, el primer campo recibe el foco, y la página de atrás no se mueve.
 */
/** Las ventanas se montan en una capa propia al final del <body>: así ninguna animación o filtro de la
 *  página las recorta (un `transform` en un padre convierte `position: fixed` en relativo a ese padre). */
function capa(): HTMLElement {
  let c = document.getElementById("portal-capas");
  if (!c) { c = document.createElement("div"); c.id = "portal-capas"; c.className = "portal-app portal-capas"; document.body.appendChild(c); }
  return c;
}

type Base = { titulo: ReactNode; subtitulo?: ReactNode; onCerrar: () => void; pie?: ReactNode; children?: ReactNode; className?: string };

function useVentana(onCerrar: () => void, caja: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCerrar(); } };
    window.addEventListener("keydown", tecla);
    const html = document.documentElement; const antes = html.style.overflow; html.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      // Solo se enfoca un campo si lo pidió (autoFocus); si no, la ventana misma, para no pintar un campo como «en edición».
      const f = caja.current?.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      (f ?? caja.current)?.focus();
    }, 30);
    return () => { window.removeEventListener("keydown", tecla); html.style.overflow = antes; window.clearTimeout(t); previo?.focus?.(); };
  }, [onCerrar, caja]);
}

export function Modal({ titulo, subtitulo, onCerrar, pie, children, className = "", tamano = "md" }: Base & { tamano?: "sm" | "md" | "lg" }) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  useVentana(onCerrar, caja);
  return createPortal(
    <div className="dlg-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={caja} tabIndex={-1} className={`dlg dlg-${tamano} ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="dlg-cab">
          <div><h2 id={id}>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
          <button type="button" className="dlg-x" onClick={onCerrar} aria-label="Cerrar">{Ico.cerrar({ t: 16 })}</button>
        </header>
        {children && <div className="dlg-cuerpo">{children}</div>}
        {pie && <footer className="dlg-pie">{pie}</footer>}
      </div>
    </div>,
    capa(),
  );
}

export function Cajon({ titulo, subtitulo, onCerrar, pie, children, className = "", ancho = 560 }: Base & { ancho?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  useVentana(onCerrar, caja);
  return createPortal(
    <div className="dlg-velo cajon" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={caja} tabIndex={-1} className={`dlg-cajon ${className}`} style={{ width: `min(${ancho}px, 100%)` }} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="dlg-cab">
          <div><h2 id={id}>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
          <button type="button" className="dlg-x" onClick={onCerrar} aria-label="Cerrar">{Ico.cerrar({ t: 16 })}</button>
        </header>
        <div className="dlg-cuerpo">{children}</div>
        {pie && <footer className="dlg-pie">{pie}</footer>}
      </div>
    </div>,
    capa(),
  );
}
