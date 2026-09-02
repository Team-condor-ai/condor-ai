/* eslint-disable react-refresh/only-export-components -- catálogo estático de SVG, no módulo de pantalla */
/**
 * Iconos del portal. SVG inline, uno por concepto.
 *
 * POR QUÉ NO SF SYMBOLS
 * ---------------------------------------------------------------------------
 * Se pidieron "símbolos de iPhone, no emojis". Los SF Symbols de Apple no se
 * pueden redistribuir en una web: la licencia lo prohíbe expresamente, y
 * empaquetar el font en un sitio público es incumplirla.
 *
 * El ERP de Planeta ya resolvió esto y acá se sigue el mismo camino: SVG
 * inline con trazo de 1.7 px y puntas redondeadas, sobre viewBox 24×24. Es el
 * mismo lenguaje visual —de hecho SF Symbols usa esa misma construcción—, se
 * ve idéntico y no depende de ninguna licencia.
 *
 * Viven todos acá y no sueltos por los componentes: así un cambio de grosor o
 * de tamaño se hace en un lugar, y nadie pega un SVG con otro estilo sin
 * darse cuenta.
 */
type Props = { t?: number; g?: number };

function Svg({
  t = 17,
  g = 1.7,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={t}
      height={t}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={g}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Ico = {
  /** El ave real de Cóndor.AI, recortada desde el isotipo oficial. A 20 px la
   * versión raster conserva mejor las plumas y el degradado que simplificarla
   * a una mancha monocroma. */
  condor: (p: Props = {}) => (
    <img
      src="/assets/favicon.png"
      width={p.t ?? 21}
      height={p.t ?? 21}
      alt=""
      aria-hidden="true"
      style={{ display: "block", objectFit: "contain", flex: "none" }}
    />
  ),
  clientes: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
      <circle cx="9.5" cy="7.5" r="3.3" />
      <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M15.6 4.3a3.4 3.4 0 0 1 0 6.4" />
    </Svg>
  ),
  panel: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="3" y="4" width="7" height="7" rx="1.6" />
      <rect x="14" y="4" width="7" height="7" rx="1.6" />
      <rect x="3" y="13" width="7" height="7" rx="1.6" />
      <rect x="14" y="13" width="7" height="7" rx="1.6" />
    </Svg>
  ),
  cobros: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.4" />
      <path d="M2.5 10h19" />
      <path d="M6.5 14.5h3" />
    </Svg>
  ),
  creditos: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5" />
      <circle cx="12" cy="12" r="5.2" />
      <path d="m13.4 8.8-3.2 3.7h2.5l-2.1 2.7" />
    </Svg>
  ),
  documentos: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M14 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  ),
  /* Lápiz sobre una hoja: el gesto universal de "editar esto". Faltaba y las
     acciones de fila estaban usando el engranaje de ajustes, que significa
     otra cosa (configurar el módulo, no modificar el registro). */
  editar: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 20h8" />
      <path d="M16.5 3.6a2.1 2.1 0 0 1 3 3L7.4 18.7l-4 1 1-4Z" />
    </Svg>
  ),
  correos: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
      <path d="m3.5 7 7.3 5.1a2 2 0 0 0 2.4 0L20.5 7" />
    </Svg>
  ),
  grafo: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5" cy="18" r="2.4" />
      <circle cx="19" cy="18" r="2.4" />
      <path d="m10.6 7 -4.2 8.8M13.4 7l4.2 8.8M7.4 18h9.2" />
    </Svg>
  ),
  plan: (p: Props = {}) => (
    <Svg {...p}>
      <path d="m12 2.5 2.9 5.9 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.3l6.6-.9z" />
    </Svg>
  ),
  boletas: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M6 2.5h12v19l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 21.5z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </Svg>
  ),
  ajustes: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2.6a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-3l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V2.6a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  contacto: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M21 16.4v2.6a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.3 17.3 0 0 1-5.3-5.3A17.6 17.6 0 0 1 3.2 5a1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.6c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1 1a14 14 0 0 0 5.3 5.3l1-1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6A1.8 1.8 0 0 1 21 16.4z" />
    </Svg>
  ),
  buscar: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m20 20-3.4-3.4" />
    </Svg>
  ),
  mas: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  enviar: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </Svg>
  ),
  expandir: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M8.5 3.5h-5v5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5" />
    </Svg>
  ),
  contraer: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M8.5 3.5v5h-5M15.5 3.5v5h5M20.5 15.5h-5v5M3.5 15.5h5v5" />
    </Svg>
  ),
  /** Columnas de un tablero: por hacer, en curso, hecho. */
  tablero: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="3" y="4" width="5.2" height="16" rx="1.6" />
      <rect x="9.4" y="4" width="5.2" height="11" rx="1.6" />
      <rect x="15.8" y="4" width="5.2" height="7" rx="1.6" />
    </Svg>
  ),
  /** Diana: una meta con su centro. */
  meta: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
    </Svg>
  ),
  /** Libro mayor: contabilidad. */
  libro: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M4 5.6A2.6 2.6 0 0 1 6.6 3H19v15.4H6.6A2.6 2.6 0 0 0 4 21z" />
      <path d="M8 7.6h7M8 11h7M8 14.4h4" />
    </Svg>
  ),
  /** Bárbara: pelo largo y un destello. Es una persona, no un engranaje —
   *  el agente tiene cara en el material de marca y acá también. */
  barbara: (p: Props = {}) => (
    <Svg {...p} g={1.55}>
      <path d="M6.1 13.2C5.2 8 7.1 3.7 11.8 3.7c4.8 0 7 4.2 6.1 9.5-.2 1.3-.8 2.3-1.7 3v3.4M7.8 16.2v3.4" />
      <path d="M6.2 11.7c-.9 2.7-1.2 6.1-.4 9.1M17.7 11.7c.9 2.7 1.2 6.1.4 9.1" />
      <path d="M8.1 8.7c2.1-.4 3.4-1.7 3.9-3.5.6 1.7 1.8 2.8 3.8 3.4" />
      <path d="M8.8 10.3c.45-.45 1.15-.45 1.6 0M13.8 10.3c.6-.55 1.4-.35 1.65.15" />
      <path d="M13.8 10.55l1.7-.1" />
      <path d="M10.3 13.1c1.1.9 2.3.9 3.4 0" />
      <path d="M5.2 21c.5-2.5 2.8-4.1 6.8-4.1s6.3 1.6 6.8 4.1" />
      <path d="M20 3.2l.45 1.15 1.15.45-1.15.45L20 6.4l-.45-1.15-1.15-.45 1.15-.45z" />
    </Svg>
  ),
  /** Rat.IA: silueta angular basada en el isotipo real — hocico, oreja y
   *  cola quebrada. Se mantiene monocroma para funcionar en ambos temas. */
  ratia: (p: Props = {}) => (
    <Svg {...p} t={p.t ?? 21} g={1.45}>
      <path
        fill="currentColor"
        stroke="none"
        d="M2.2 15.3 7.2 11.7 6.5 7.5l4.4-.8-2.2 4.2 3.9-1.8 3.2 2.2-3.1 4.2 4.8-.7 2.3-4.4-3.8-2 1.2-1.2 4.8 2.5-3.1 6.9-10.3 1.2 2.8-3.3-6.1 1.1 3.2-2.6-4.1.8z"
      />
      <circle cx="7.25" cy="12.3" r="1.05" fill="var(--panel)" stroke="none" />
      <path d="m16.1 8.4 5.3-4.2" />
    </Svg>
  ),
  /** Los tres puntitos: "hay más acciones acá". Verticales, que es como se
   *  lee dentro de una fila de tabla. */
  puntos: (p: Props = {}) => (
    <Svg {...p} g={2.2}>
      <circle cx="12" cy="5" r=".6" />
      <circle cx="12" cy="12" r=".6" />
      <circle cx="12" cy="19" r=".6" />
    </Svg>
  ),
  /** Burbuja de conversación. Para Telegram y WhatsApp: un teléfono ahí
   *  promete una llamada, que no es lo que pasa al tocarlo. */
  chat: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5z" />
    </Svg>
  ),
  /** Galón hacia abajo: pliega y despliega. Apunta al lado en el que va a
   *  moverse el contenido, no al estado actual. */
  galon: (p: Props = {}) => (
    <Svg {...p} g={2}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  volver: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  ),
  menu: (p: Props = {}) => (
    <Svg {...p} g={1.8}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  cerrar: (p: Props = {}) => (
    <Svg {...p} g={1.8}>
      <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
    </Svg>
  ),
  salir: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </Svg>
  ),
  archivar: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="2.5" y="4" width="19" height="4.6" rx="1.4" />
      <path d="M4.5 8.6V19a1.6 1.6 0 0 0 1.6 1.6h11.8A1.6 1.6 0 0 0 19.5 19V8.6" />
      <path d="M10 12.5h4" />
    </Svg>
  ),
  abrirWeb: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M18 13v6a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19V7.6A1.6 1.6 0 0 1 5.6 6H11" />
      <path d="M15 4h5v5M20 4l-9.5 9.5" />
    </Svg>
  ),
  repetir: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M3 11.5A7.5 7.5 0 0 1 16.8 7.4L21 11" />
      <path d="M21 5.5V11h-5.5" />
      <path d="M21 12.5A7.5 7.5 0 0 1 7.2 16.6L3 13" />
      <path d="M3 18.5V13h5.5" />
    </Svg>
  ),
  /** Traspaso interno: la plata cambia de cuenta, no sale de la empresa. */
  traspaso: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M4 8h14M15 5l3 3-3 3" />
      <path d="M20 16H6M9 13l-3 3 3 3" />
    </Svg>
  ),
  carpetaMas: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M21 12.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.5.7l1.1 1.3H19a2 2 0 0 1 2 2v.5" />
      <path d="M18 14.5h5M20.5 12v5" />
    </Svg>
  ),
  biblioteca: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H5.5A1.5 1.5 0 0 1 4 15.9z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h3.9a1.5 1.5 0 0 0 1.5-1.5z" />
    </Svg>
  ),
  reuniones: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2.2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M8.5 14h7" />
    </Svg>
  ),
  video: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.2" />
      <path d="m15.5 10.5 6-3v9l-6-3z" />
    </Svg>
  ),
  github: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.6m12 5.1v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.3 3.1 5.3 3.4 5.3 3.4a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 9.9c0 4.6 2.8 5.6 5.5 6a3 3 0 0 0-.8 2.3V21.6" />
    </Svg>
  ),
  descargar: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M21 15.5v3.4A2.1 2.1 0 0 1 18.9 21H5.1A2.1 2.1 0 0 1 3 18.9v-3.4" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5M12 15V3" />
    </Svg>
  ),
  subir: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M21 15.5v3.4A2.1 2.1 0 0 1 18.9 21H5.1A2.1 2.1 0 0 1 3 18.9v-3.4" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5M12 3v12" />
    </Svg>
  ),
  eliminar: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12.5" />
      <path d="M10.3 10.5v6M13.7 10.5v6" />
    </Svg>
  ),
  cheque: (p: Props = {}) => (
    <Svg {...p} g={2}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  ),
  agentesia: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 8V4.5" />
      <circle cx="12" cy="3" r="1.3" />
      <circle cx="9" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
      <path d="M3 12h2M19 12h2" />
    </Svg>
  ),
  candado: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Svg>
  ),
  paleta: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 3a9 8.2 0 1 0 0 16.4c1.4 0 1.9-1 1.9-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7h1.7c2 0 3.6-1.6 3.6-3.6C20 6.6 16.4 3 12 3z" />
      <circle cx="8" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  mcp: (p: Props = {}) => (
    <Svg {...p}>
      <path d="m8 9-3 3 3 3" />
      <path d="m16 9 3 3-3 3" />
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </Svg>
  ),
  memoria: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="19.5" cy="8.5" r="1.6" />
      <circle cx="19.5" cy="16.5" r="1.6" />
      <circle cx="12" cy="20.5" r="1.6" />
      <circle cx="4.5" cy="16.5" r="1.6" />
      <circle cx="4.5" cy="8.5" r="1.6" />
      <path d="M12 6.3V9.8M17.9 9.6l-3.4 2M17.9 15.2l-3.4-2M12 18v-3.6M6.1 15.2l3.4-2M6.1 9.6l3.4 2" />
    </Svg>
  ),

  /* Canales de prospección (Cóndor Ecommerce, 2-sept-2026). Mismo trazo
     monocromo que el resto del set — no se usan los logos de marca a color:
     rompería el lenguaje visual único de todo el portal (ver comentario de
     arriba, "por qué no SF Symbols"). El color de marca de cada canal se
     aplica aparte, como fondo de la píldora, no en el trazo del ícono. */
  instagram: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  ),
  facebook: (p: Props = {}) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14 8.4h-1.6a1.8 1.8 0 0 0-1.8 1.8V12m0 0H9m1.6 0V19M9 12h3.6" />
    </Svg>
  ),
  maps: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Svg>
  ),
  linkedin: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.4" cy="8.6" r="0.6" fill="currentColor" stroke="none" />
      <path d="M8.4 11.4V17M12.4 17v-3.6a1.9 1.9 0 0 1 3.8 0V17" />
    </Svg>
  ),

  /* Líneas de producto en "Productos" (reorganización del portal,
     2-sept-2026). Genéricos y monocromos a propósito: todavía no hay un
     logo real por línea cargado en el repo (el branding llegó por
     WhatsApp) — reemplazar por el logo real de cada línea cuando esté
     disponible como archivo. */
  sitesProducto: (p: Props = {}) => (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <path d="M3.5 9h17" />
      <circle cx="6.3" cy="7" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="8.1" cy="7" r="0.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  ecommerceProducto: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M5 8h14l-1.3 10.2a1.6 1.6 0 0 1-1.6 1.4H7.9a1.6 1.6 0 0 1-1.6-1.4L5 8Z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </Svg>
  ),
  trackProducto: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15 15.2 10" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  ),
};

export type NombreIcono = keyof typeof Ico;
