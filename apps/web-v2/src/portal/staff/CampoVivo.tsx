import { useEffect, useState } from "react";

type Base = {
  etiqueta: string;
  valor: string | null | undefined;
  guardar: (v: string | null) => Promise<string | null>;
  ayuda?: React.ReactNode;
};

/**
 * Un dato que se edita donde se lee.
 *
 * POR QUÉ NO HAY BOTÓN DE "EDITAR"
 * ---------------------------------------------------------------------------
 * Cambiar el teléfono de alguien costaba tres pasos: abrir la ficha, apretar
 * Configurar, buscar el campo entre otros ocho. Acá el dato ES el campo. Se
 * escribe encima y se guarda solo al salir.
 *
 * SE GUARDA AL SALIR, NO EN CADA TECLA
 * ---------------------------------------------------------------------------
 * Guardar por cada letra manda una petición por pulsación y deja la base con
 * versiones a medio escribir. Se guarda cuando el campo pierde el foco y solo
 * si de verdad cambió; Enter también cierra, y Escape descarta.
 *
 * El estado se dice en el mismo lugar donde se escribió: un "guardado" arriba
 * de la pantalla no lo mira nadie.
 */
export function CampoVivo({
  etiqueta,
  valor,
  guardar,
  ayuda,
  tipo = "text",
  multilinea,
  opciones,
  extra,
  ancho,
}: Base & {
  tipo?: string;
  multilinea?: boolean;
  /** Si viene, se muestra un desplegable en vez de un campo libre. */
  opciones?: string[];
  /** Algo al costado del campo — por ejemplo el selector de planes. */
  extra?: React.ReactNode;
  /** Ocupa dos celdas de la rejilla: para lo que no cabe en una. */
  ancho?: boolean;
}) {
  const [v, setV] = useState(valor ?? "");
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | "error">("");
  const [mensaje, setMensaje] = useState("");

  // Si el dato cambia por fuera (se recargó la ficha), el campo lo sigue —
  // salvo que la persona esté escribiendo justo ahora.
  useEffect(() => {
    // Sincronización deliberada de un borrador local con una fuente externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV(valor ?? "");
  }, [valor]);

  async function guardarValor(bruto: string) {
    const limpio = bruto.trim();
    if (limpio === (valor ?? "").trim()) return;
    setEstado("guardando");
    const err = await guardar(limpio || null);
    if (err) { setEstado("error"); setMensaje(err); return; }
    setEstado("ok");
    setMensaje("");
    setTimeout(() => setEstado((e) => (e === "ok" ? "" : e)), 1600);
  }
  const alSalir = () => guardarValor(v);

  const comun = {
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV(e.target.value),
    onBlur: alSalir,
    className: "campo-vivo",
  };

  return (
    <div className="dato dato-vivo" style={ancho ? { gridColumn: "span 2" } : undefined}>
      <small>
        {etiqueta}
        {estado === "guardando" && <span className="conteo"> · guardando…</span>}
        {estado === "ok" && <span style={{ color: "var(--ok-tx)" }}> · guardado</span>}
        {estado === "error" && <span style={{ color: "var(--mal-tx)" }}> · {mensaje}</span>}
      </small>

      <span style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        {opciones ? (
          <select
            {...comun}
            onChange={(e) => { setV(e.target.value); guardarValor(e.target.value); }}
            style={{ flex: 1 }}
          >
            {opciones.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : multilinea ? (
          <textarea
            {...comun}
            rows={2}
            style={{ flex: 1, resize: "vertical" }}
            placeholder="—"
          />
        ) : (
          <input
            {...comun}
            type={tipo}
            style={{ flex: 1, minWidth: 0 }}
            placeholder="—"
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setV(valor ?? ""); (e.target as HTMLInputElement).blur(); }
            }}
          />
        )}
        {extra}
      </span>

      {ayuda && <span className="conteo">{ayuda}</span>}
    </div>
  );
}
