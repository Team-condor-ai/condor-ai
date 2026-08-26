import { useEffect, useMemo, useState } from "react";
import { mensajesEstadoBarbara } from "./mensajesEstadoBarbara";

const MENSAJE_VISIBLE_MS = 10_000;
const PRIMERA_ESPERA_MS = 8_000;
const PAUSA_BASE_MS = 18_000;
const PAUSA_VARIACION_MS = 18_000;

export function BarbaraEstadoVivo() {
  const [instante, setInstante] = useState(() => new Date());
  const [indice, setIndice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [yaAparecio, setYaAparecio] = useState(false);
  const mensajes = useMemo(() => mensajesEstadoBarbara(instante), [instante]);
  const mensaje = mensajes[indice % mensajes.length];

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
    <div className="barbara-presencia-estado" data-mensaje-visible={visible ? "true" : "false"}>
      <aside
        className="barbara-estado-vivo"
        aria-live="polite"
        aria-label="En qué está Bárbara"
        aria-hidden={!visible}
      >
        <span><i /> Ahora</span>
        <p key={`${mensaje}-${indice}`}>{mensaje}</p>
      </aside>
    </div>
  );
}
