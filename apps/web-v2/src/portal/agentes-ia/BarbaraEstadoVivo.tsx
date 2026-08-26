import { useEffect, useMemo, useState } from "react";
import { mensajesEstadoBarbara } from "./mensajesEstadoBarbara";

const MENSAJE_VISIBLE_MS = 10_000;
const PRIMERA_ESPERA_MS = 8_000;
const PAUSA_BASE_MS = 18_000;
const PAUSA_VARIACION_MS = 18_000;
const FORMAS = ["estrella", "orbita", "pulso", "nucleo"] as const;

export function BarbaraEstadoVivo() {
  const [instante, setInstante] = useState(() => new Date());
  const [indice, setIndice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [yaAparecio, setYaAparecio] = useState(false);
  const [forma, setForma] = useState(0);
  const mensajes = useMemo(() => mensajesEstadoBarbara(instante), [instante]);
  const mensaje = mensajes[indice % mensajes.length];

  useEffect(() => {
    const intervalo = window.setInterval(
      () => setForma((actual) => (actual + 1) % FORMAS.length),
      1_650,
    );
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const duracion = visible
      ? MENSAJE_VISIBLE_MS
      : yaAparecio
        ? PAUSA_BASE_MS + Math.floor(Math.random() * PAUSA_VARIACION_MS)
        : PRIMERA_ESPERA_MS;
    const temporizador = window.setTimeout(() => {
      if (!visible) {
        setYaAparecio(true);
        setInstante(new Date());
        setIndice((actual) => {
          if (mensajes.length < 2) return 0;
          return (actual + 1 + Math.floor(Math.random() * (mensajes.length - 1))) % mensajes.length;
        });
      }
      setVisible((actual) => !actual);
    }, duracion);
    return () => window.clearTimeout(temporizador);
  }, [mensajes.length, visible, yaAparecio]);

  return (
    <>
      <span
        className="barbara-trabajando"
        data-forma={FORMAS[forma]}
        role="img"
        aria-label="Bárbara está trabajando"
        title="Bárbara está trabajando"
      >
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g className="barbara-trabajando-forma forma-estrella">
            <path d="M20 5v7M20 28v7M5 20h7M28 20h7M9.4 9.4l5 5M25.6 25.6l5 5M30.6 9.4l-5 5M14.4 25.6l-5 5" />
            <path className="relleno" d="m20 14 2.2 3.8L26 20l-3.8 2.2L20 26l-2.2-3.8L14 20l3.8-2.2Z" />
          </g>
          <g className="barbara-trabajando-forma forma-orbita">
            <circle cx="20" cy="20" r="11" />
            <circle className="relleno" cx="20" cy="9" r="2.7" />
            <circle className="nucleo" cx="20" cy="20" r="3" />
          </g>
          <g className="barbara-trabajando-forma forma-pulso">
            <path d="M5 21h8l3-8 5 15 4-11 3 4h7" />
          </g>
          <g className="barbara-trabajando-forma forma-nucleo">
            <ellipse cx="20" cy="20" rx="13" ry="6" />
            <ellipse cx="20" cy="20" rx="13" ry="6" transform="rotate(60 20 20)" />
            <ellipse cx="20" cy="20" rx="13" ry="6" transform="rotate(120 20 20)" />
            <circle className="relleno" cx="20" cy="20" r="3" />
          </g>
        </svg>
      </span>
      {visible && (
        <aside className="barbara-estado-vivo" aria-live="polite" aria-label="En qué está Bárbara">
          <span><i /> Ahora</span>
          <p key={`${mensaje}-${indice}`}>{mensaje}</p>
        </aside>
      )}
    </>
  );
}
