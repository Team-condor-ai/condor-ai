/**
 * Iconos de carpeta y archivo al estilo del Finder de macOS.
 *
 * POR QUÉ NO SE USAN LOS ICONOS REALES DE APPLE
 * ---------------------------------------------------------------------------
 * Los iconos del sistema de macOS son propiedad de Apple y su licencia no
 * permite redistribuirlos en una web — el mismo motivo por el que en
 * `iconos.tsx` no se usan SF Symbols. Estos son SVG propios que siguen la
 * misma construcción: carpeta de dos piezas con la pestaña atrás y degradado
 * azul, y documento con la esquina superior derecha doblada.
 *
 * El degradado lleva un `id` único por instancia: dos SVG con el mismo id de
 * degradado en la página hacen que el segundo herede el del primero, y en una
 * grilla de archivos eso se ve como iconos de colores cambiados.
 */
let n = 0;
const nuevoId = () => `g${++n}`;

export function IconoCarpeta({ t = 64 }: { t?: number }) {
  const a = nuevoId();
  const b = nuevoId();
  return (
    <svg width={t} height={t} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={a} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8CC5F8" />
          <stop offset="1" stopColor="#5CA8F0" />
        </linearGradient>
        <linearGradient id={b} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6DB6F7" />
          <stop offset="1" stopColor="#2C82DF" />
        </linearGradient>
      </defs>
      {/* Pestaña de atrás. Sobresale 6 px por arriba del cuerpo y es más
          angosta: sin esas dos diferencias el icono se lee como un rectángulo
          redondeado cualquiera y deja de parecer una carpeta. */}
      <path
        d="M4 15.5A4.5 4.5 0 0 1 8.5 11h13.8a4.5 4.5 0 0 1 3.18 1.32l3.7 3.68H55.5A4.5 4.5 0 0 1 60 20.5V26H4z"
        fill={`url(#${a})`}
      />
      {/* Cuerpo del frente */}
      <path
        d="M4 24.5A4.5 4.5 0 0 1 8.5 20h47A4.5 4.5 0 0 1 60 24.5v24A4.5 4.5 0 0 1 55.5 53h-47A4.5 4.5 0 0 1 4 48.5z"
        fill={`url(#${b})`}
      />
      {/* Brillo superior del frente: es lo que le da el volumen del icono de
          macOS, que si no queda plano. */}
      <path
        d="M8.5 20h47A4.5 4.5 0 0 1 60 24.5v1.2H4v-1.2A4.5 4.5 0 0 1 8.5 20z"
        fill="#fff"
        opacity=".28"
      />
    </svg>
  );
}

/** Familias de archivo, cada una con su color de etiqueta. */
type Familia = "imagen" | "pdf" | "hoja" | "texto" | "otro";

const COLOR: Record<Familia, string> = {
  imagen: "#B36BE8",
  pdf: "#E2564C",
  hoja: "#3FA45E",
  texto: "#5B8DEF",
  otro: "#8A8F98",
};

const ETIQUETA: Record<Familia, string> = {
  imagen: "IMG",
  pdf: "PDF",
  hoja: "XLS",
  texto: "DOC",
  otro: "FILE",
};

export function familiaDe(nombre: string, mime?: string | null): Familia {
  const ext = (nombre.split(".").pop() ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic"].includes(ext))
    return "imagen";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "numbers", "ods"].includes(ext) || m.includes("spreadsheet"))
    return "hoja";
  if (["doc", "docx", "txt", "md", "rtf", "pages", "odt", "ppt", "pptx", "key"].includes(ext))
    return "texto";
  return "otro";
}

/** La extensión real, para escribirla en la etiqueta cuando es poco común. */
function extension(nombre: string) {
  const ext = (nombre.split(".").pop() ?? "").toUpperCase();
  return ext.length >= 2 && ext.length <= 4 ? ext : "";
}

export function IconoArchivo({
  t = 64,
  nombre,
  mime,
}: {
  t?: number;
  nombre: string;
  mime?: string | null;
}) {
  const fam = familiaDe(nombre, mime);
  const s = nuevoId();
  const ext = extension(nombre) || ETIQUETA[fam];
  return (
    <svg width={t} height={t} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={s} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1F2F5" />
        </linearGradient>
      </defs>
      {/* hoja con la esquina doblada */}
      <path
        d="M13 8.5A3.5 3.5 0 0 1 16.5 5h20.4L51 19.4V55.5A3.5 3.5 0 0 1 47.5 59h-31A3.5 3.5 0 0 1 13 55.5z"
        fill={`url(#${s})`}
        stroke="#D3D6DC"
        strokeWidth="1.1"
      />
      <path d="M36.6 5.4v10.6a3.4 3.4 0 0 0 3.4 3.4h10.6" fill="#E4E7EC" stroke="#D3D6DC" strokeWidth="1.1" />
      {/* etiqueta del tipo */}
      <rect x="13" y="37" width="30" height="14" rx="3" fill={COLOR[fam]} />
      <text
        x="28"
        y="47.2"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#fff"
        fontFamily="-apple-system,system-ui,sans-serif"
        letterSpacing=".3"
      >
        {ext.slice(0, 4)}
      </text>
    </svg>
  );
}
