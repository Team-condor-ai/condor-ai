import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

function prefiereMenosMovimiento() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Navega con la View Transitions API del navegador cuando está disponible.
 *
 * POR QUÉ ESTO Y NO ANIMAR DOS ÁRBOLES DE REACT A MANO
 * ---------------------------------------------------------------------------
 * El portal y Bárbara son dos mundos visuales completamente distintos
 * (claro/azul vs. casi negro/lima), sin layout compartido entre rutas — el
 * cambio hoy es un corte duro porque `Portal.tsx` desmonta un árbol entero y
 * monta otro. Mantener el árbol viejo vivo un instante para poder animarlo
 * (con GSAP u otra librería) obliga a un estado de transición manual,
 * temporizadores y limpieza — frágil, y encima solo cubriría el clic en el
 * link del menú, no el botón "Volver" ni la navegación del navegador
 * (atrás/adelante).
 *
 * El navegador ya resuelve esto: `startViewTransition` saca una foto de la
 * pantalla ANTES del cambio, deja que React actualice el DOM, saca otra foto
 * DESPUÉS, y cruza las dos con una animación — funciona igual sin importar
 * qué disparó la navegación. El cross-fade nativo YA hace "el color cambia
 * mientras el portal anterior se desvanece"; acá solo se afina el timing
 * (ver `::view-transition-*` en barbara.css) para que se sienta con un
 * asentamiento suave en vez del fundido lineal por defecto.
 *
 * `flushSync` es necesario: sin él, `navigate()` actualiza el estado de forma
 * asíncrona y la API saca la "foto después" antes de que React haya pintado
 * la ruta nueva, capturando la pantalla vieja dos veces.
 *
 * Sin soporte del navegador o con "reducir movimiento" activado: navegación
 * instantánea de siempre, sin animación — nunca un fallback roto ni una
 * versión degradada rara.
 */
/**
 * `entra` = del portal hacia Bárbara. `vuelve` = de Bárbara hacia el portal.
 *
 * El sentido existe porque la animación tiene DIRECCIÓN (ver `barbara.css`):
 * el telón negro con sus filos lima barre de izquierda a derecha al entrar y
 * al revés al salir. Sin esto, volver se sentiría como entrar de nuevo — que
 * es exactamente la desorientación que la continuidad espacial evita: el
 * usuario tiene que poder sentir que DESHIZO el movimiento, no que hizo otro.
 */
export type Sentido = "entra" | "vuelve";

export function navegarConTransicion(
  navigate: NavigateFunction,
  to: string,
  sentido: Sentido = "entra",
) {
  if (prefiereMenosMovimiento() || !document.startViewTransition) {
    navigate(to);
    return;
  }
  // El atributo va en <html> porque los pseudo-elementos ::view-transition-*
  // cuelgan del documento, no del árbol de React: es el único lugar desde
  // donde el CSS de la animación puede leer el sentido.
  const raiz = document.documentElement;
  raiz.dataset.barbaraSentido = sentido;
  const transicion = document.startViewTransition(() => {
    flushSync(() => navigate(to));
  });
  // Se limpia con `finished` y no con un temporizador: si el navegador
  // interrumpe la transición (otra navegación encima), `finished` igual
  // resuelve y el atributo no queda pegado hasta la próxima.
  transicion.finished.finally(() => {
    delete raiz.dataset.barbaraSentido;
  });
}
