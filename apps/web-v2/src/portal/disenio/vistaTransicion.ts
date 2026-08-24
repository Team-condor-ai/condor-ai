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
export function navegarConTransicion(navigate: NavigateFunction, to: string) {
  if (prefiereMenosMovimiento() || !document.startViewTransition) {
    navigate(to);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => navigate(to));
  });
}
