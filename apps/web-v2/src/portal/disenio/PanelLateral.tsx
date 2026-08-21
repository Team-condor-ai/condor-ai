import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Ico } from "./iconos";

/**
 * El cajón que entra por la derecha. La ficha va adentro.
 *
 * ESTÁ ACÁ Y NO COPIADO EN CADA FICHA
 * ---------------------------------------------------------------------------
 * Clientes y Rat.IA usan el mismo. Duplicar la animación habría dejado dos
 * cajones que se ven iguales y se mueven distinto apenas alguien afine uno.
 *
 * LA ANIMACIÓN LA HACE GSAP, NO EL CSS
 * ---------------------------------------------------------------------------
 * El panel se monta y se desmonta con React, así que una transición de CSS se
 * ve al entrar pero NO al salir: el nodo desaparece antes de poder animarse.
 * Con GSAP se anima el cierre y recién al terminar se avisa al padre.
 *
 * POR QUÉ SE APAGA EL DESENFOQUE MIENTRAS SE MUEVE
 * ---------------------------------------------------------------------------
 * El panel es de vidrio, y `backdrop-filter` obliga al navegador a recalcular
 * el desenfoque de TODO lo que queda detrás en cada fotograma. Con una lista y
 * dos gráficas ahí abajo eso no llega a 60fps y la entrada sale a tirones. Se
 * apaga mientras viaja y se enciende al llegar: nadie nota un vidrio sin
 * desenfoque durante 400 ms, pero el tironeo sí se ve.
 */
export function PanelLateral({
  titulo,
  bajada,
  cerrar,
  children,
}: {
  titulo: string;
  bajada?: string;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const cerrando = useRef(false);

  const quieto =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Layout effect: coloca el cajón fuera de pantalla antes del primer paint.
  // Con useEffect aparecía abierto un fotograma y luego "saltaba" al inicio.
  useLayoutEffect(() => {
    const el = panel.current, v = velo.current;
    if (!el || !v) return;
    if (quieto) {
      gsap.set(el, { xPercent: 0 });
      gsap.set(v, { opacity: 1 });
      return;
    }
    el.classList.add("moviendo");
    gsap.set(el, { xPercent: 101, willChange: "transform", force3D: true });
    gsap.set(v, { opacity: 0 });
    const t = gsap.timeline({
      onComplete: () => {
        el.classList.remove("moviendo");
        gsap.set(el, { willChange: "auto" });
      },
    });
    // `power3.out` y no un rebote: es una superficie de trabajo, no un juguete.
    // Llega rápido y frena suave, que es lo que la hace sentir liviana.
    t.to(el, { xPercent: 0, duration: 0.4, ease: "power3.out", force3D: true }, 0);
    t.to(v, { opacity: 1, duration: 0.26, ease: "power1.out" }, 0);
    return () => { t.kill(); };
  }, [quieto]);

  function salir() {
    if (cerrando.current) return;
    cerrando.current = true;
    const el = panel.current, v = velo.current;
    if (quieto || !el || !v) { cerrar(); return; }
    el.classList.add("moviendo");
    const t = gsap.timeline({ onComplete: cerrar });
    t.to(el, { xPercent: 101, duration: 0.26, ease: "power2.in", force3D: true }, 0);
    t.to(v, { opacity: 0, duration: 0.26 }, 0);
  }

  // Escape cierra. Es lo que espera cualquiera que abra algo encima de otra
  // cosa, y no cuesta nada darlo.
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") salir(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="velo" ref={velo} onClick={salir} />
      <aside
        ref={panel}
        className="panel-lat ancho abierto"
        role="dialog"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2>{titulo}</h2>
            {bajada && <p>{bajada}</p>}
          </div>
          <button className="icono-btn" onClick={salir} title="Cerrar" aria-label="Cerrar">
            {Ico.salir({ t: 15 })}
          </button>
        </header>
        <div className="contenido">{children}</div>
      </aside>
    </>
  );
}
