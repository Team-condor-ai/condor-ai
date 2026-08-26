type Props = {
  activo?: boolean;
};

/**
 * Firma de movimiento de Bárbara: una semilla orgánica que vive dentro del
 * compositor. Su ritmo aumenta mientras la agente está procesando.
 */
export function BarbaraIndicador({ activo = false }: Props) {
  return (
    <span
      className={`barbara-senal-organica${activo ? " activa" : ""}`}
      aria-hidden="true"
    >
      <span className="barbara-senal-halo" />
      <span className="barbara-senal-forma"><i /></span>
      <i className="barbara-senal-destello uno" />
      <i className="barbara-senal-destello dos" />
    </span>
  );
}
