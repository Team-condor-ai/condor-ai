import { PLANTILLAS_CARRUSEL } from "../../agentes-ia/tipos";

/**
 * La biblioteca de plantillas de carrusel de Bárbara.
 *
 * DÓNDE VIVEN DE VERDAD
 * ---------------------------------------------------------------------------
 * El diseño de cada plantilla es código (`services/barbara/plantillas.mjs`):
 * HTML + CSS que se renderiza con Chrome. Esta pantalla no las EDITA, las
 * MUESTRA — es el catálogo de lo que hay, no un editor visual.
 *
 * CÓMO SE SUMA UNA NUEVA
 * ---------------------------------------------------------------------------
 * Se pide y se agrega al código, igual que las 4 que hay hoy. Se descartó
 * a propósito un editor visual tipo "arma tu plantilla sin código": es un
 * producto aparte del tamaño de un mini-Canva, y cada plantilla ganada a
 * mano queda más pulida que una armada con piezas sueltas. Esta pantalla es
 * la carpeta donde se van viendo crecer, no el taller donde se arman.
 *
 * Las miniaturas de la izquierda son renders REALES del motor (las mismas
 * que se regalan en la página pública de plantillas gratis), no un mockup:
 * lo que se ve acá es exactamente lo que le va a llegar al cliente.
 */
const EJEMPLO: Record<string, string> = {
  editorial: "/productos/barbara/plantillas-gratis/ejemplos/editorial-1.png",
  bloque: "/productos/barbara/plantillas-gratis/ejemplos/bloque-1.png",
  ficha: "/productos/barbara/plantillas-gratis/ejemplos/ficha-1.png",
};

export function Plantillas() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p className="tenue">
        {PLANTILLAS_CARRUSEL.length} plantillas disponibles. Cada marca elige
        la suya desde su brand book (pestaña "Brand book" de su ficha). Para
        sumar una nueva, se agrega al motor — pídela y queda lista.
      </p>

      <div className="plantillas-catalogo">
        {PLANTILLAS_CARRUSEL.map((p) => (
          <div className="plantilla-item" key={p.id}>
            <div className="plantilla-item-img">
              {EJEMPLO[p.id] ? (
                <img src={EJEMPLO[p.id]} alt={`Ejemplo de la plantilla ${p.nombre}`} loading="lazy" />
              ) : (
                <div className="plantilla-item-sinimg">Necesita una foto de fondo</div>
              )}
            </div>
            <div className="plantilla-item-info">
              <b>{p.nombre}</b>
              <span>{p.descripcion}</span>
            </div>
          </div>
        ))}
      </div>

      <a
        className="btn chico"
        href="/productos/barbara/plantillas-gratis/"
        target="_blank"
        rel="noreferrer"
        style={{ alignSelf: "flex-start" }}
      >
        Ver la página pública de plantillas gratis ↗
      </a>
    </div>
  );
}
