import { useEffect, useMemo, useRef } from "react";

/**
 * El titular del inicio de Bárbara, con la MISMA entrada que el de su landing.
 *
 * DE DÓNDE SALE (no es una animación inventada)
 * ---------------------------------------------------------------------------
 * `public/productos/barbara/index.html` arma la palabra "BÁRBARA" letra por
 * letra: cada una en su `span`, desde `opacity:0` + `translateY(.34em)`, con
 * `cubic-bezier(.32,.72,0,1)` de 620 ms y 55 ms de retardo entre letras. Ese
 * escalonado es la firma de movimiento de la marca, y el módulo no la tenía.
 * Pedido de Joaquín (25-ago-2026): mismo diseño y mismas animaciones.
 *
 * LO QUE HUBO QUE ADAPTAR, Y POR QUÉ
 * ---------------------------------------------------------------------------
 * La landing anima UNA palabra de 7 letras: 7 × 55 ms = 385 ms de escalonado.
 * Acá el titular es un saludo entero ("Hola Joaquín, ¿cómo está tu tarde?",
 * 33 caracteres). Con el mismo paso fijo tardaría 1,8 s en terminar de
 * aparecer — la última letra llegaría cuando la persona ya dejó de mirar.
 *
 * Por eso el paso se COMPRIME para que el escalonado completo dure siempre lo
 * mismo (~430 ms) sin importar el largo: `paso = min(55ms, 430ms / n)`. Una
 * palabra corta conserva el ritmo exacto de la landing; una frase larga
 * mantiene la sensación de "barrido" sin arrastrarse.
 *
 * Los espacios no se animan por separado —viajan con la palabra que siguen—
 * para que la frase se lea como palabras entrando, no como letras sueltas.
 */

const DURACION = 0.62; // s, igual que la landing
const CURVA = "cubic-bezier(.32,.72,0,1)"; // la misma de toda la marca
const PASO_MAXIMO = 0.055; // s entre letras, el de la landing
const ESCALONADO_TOTAL = 0.43; // s, el techo del barrido completo

export function TituloAnimado({ texto, className }: { texto: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  const palabras = useMemo(() => {
    const lista = texto.trim().split(/\s+/).filter(Boolean);
    return lista.map((palabra, indice) => ({
      palabra,
      inicio: lista.slice(0, indice).reduce(
        (total, anterior) => total + Array.from(anterior).length,
        0,
      ),
    }));
  }, [texto]);
  const cantidadLetras = useMemo(
    () => palabras.reduce((total, segmento) => total + Array.from(segmento.palabra).length, 0),
    [palabras],
  );
  const paso = useMemo(
    () => Math.min(PASO_MAXIMO, ESCALONADO_TOTAL / Math.max(1, cantidadLetras)),
    [cantidadLetras],
  );

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Doble rAF: el primero deja que el navegador PINTE el estado inicial
    // (opacidad 0, desplazado). Sin esa pintura intermedia no hay dos estados
    // que interpolar y el navegador salta directo al final — la animación
    // simplemente no ocurre. Es el mismo motivo por el que la landing usa
    // requestAnimationFrame en vez de aplicar los estilos de corrido.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nodo.querySelectorAll<HTMLElement>(".barbara-letra").forEach((s) => {
          s.style.opacity = "1";
          s.style.transform = "none";
        });
      });
    });
    return () => cancelAnimationFrame(id);
    // `texto` en las dependencias: si cambia el saludo (cambió la franja
    // horaria con la pestaña abierta), la entrada se vuelve a correr.
  }, [texto]);

  const quieto =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <h1 ref={ref} className={className}>
      {/* El texto completo va en un nodo accesible: un lector de pantalla que
          encuentre 33 spans sueltos puede deletrear la frase. */}
      <span className="visualmente-oculto">{texto}</span>
      <span aria-hidden="true">
        {palabras.map(({ palabra, inicio }, indicePalabra) => (
          <span className="barbara-palabra" key={`${palabra}-${inicio}`}>
            {Array.from(palabra).map((ch, indiceLetra) => {
              const indice = inicio + indiceLetra;
              return (
                <span
                  key={indice}
                  className="barbara-letra"
                  style={
                    quieto
                      ? undefined
                      : {
                          opacity: 0,
                          transform: "translateY(.34em)",
                          transition:
                            `opacity ${DURACION}s ${CURVA} ${(indice * paso).toFixed(3)}s, ` +
                            `transform ${DURACION}s ${CURVA} ${(indice * paso).toFixed(3)}s`,
                        }
                  }
                >
                  {ch}
                </span>
              );
            })}
            {indicePalabra < palabras.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </h1>
  );
}
