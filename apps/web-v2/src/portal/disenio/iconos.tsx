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
  documentos: (p: Props = {}) => (
    <Svg {...p}>
      <path d="M14 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
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
};

export type NombreIcono = keyof typeof Ico;
