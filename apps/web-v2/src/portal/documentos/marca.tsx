import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * La identidad de Cóndor para todos los PDF.
 *
 * UN SOLO LUGAR, CUATRO DOCUMENTOS
 * ---------------------------------------------------------------------------
 * Cotización, contrato, términos y comprobante comparten membrete, pie,
 * tipografía y colores. Si mañana cambia el correo, el teléfono o el RUT, se
 * toca este archivo y salen corregidos los cuatro. Duplicar el encabezado en
 * cada documento es cómo se termina mandando un contrato con el teléfono
 * viejo.
 *
 * POR QUÉ SE REGISTRAN FUENTES (22-ago-2026)
 * ---------------------------------------------------------------------------
 * react-pdf trae Helvetica y nada más. Un documento en Helvetica no se ve
 * "sobrio": se ve como el default de una librería, que es exactamente lo que
 * era. Estas son las tres fuentes del sitio, así que el PDF que descarga el
 * cliente y la página de la que lo descargó por fin hablan el mismo idioma.
 *
 * Los .ttf viven en `public/assets/fuentes/` (344 KB las cinco). Tienen que
 * ser .ttf u .otf: react-pdf NO lee woff2, que es lo que sirve el CDN por
 * defecto. Se descargan una vez y quedan versionados; no se piden a Fontshare
 * ni a Google en tiempo de ejecución, porque un PDF que depende de una CDN
 * ajena es un PDF que algún día sale en Helvetica sin avisar.
 */

Font.register({
  family: "GeneralSans",
  fonts: [
    { src: "/assets/fuentes/GeneralSans-Regular.ttf", fontWeight: 400 },
    { src: "/assets/fuentes/GeneralSans-Semibold.ttf", fontWeight: 600 },
  ],
});

Font.register({
  family: "ClashDisplay",
  fonts: [{ src: "/assets/fuentes/ClashDisplay-Semibold.ttf", fontWeight: 600 }],
});

Font.register({
  family: "SpaceMono",
  fonts: [
    { src: "/assets/fuentes/SpaceMono-Regular.ttf", fontWeight: 400 },
    { src: "/assets/fuentes/SpaceMono-Bold.ttf", fontWeight: 700 },
  ],
});

// react-pdf corta palabras en cualquier parte cuando no cabe una línea, sin
// saber español: deja cosas como "Merca-do". Devolver la palabra entera apaga
// el guionado; el texto prefiere desbordar al renglón siguiente, que es lo
// correcto en un documento formal.
Font.registerHyphenationCallback((palabra) => [palabra]);

/** ⚠️ Completar antes de emitir el primer documento formal. */
export const EMPRESA = {
  nombre: "Cóndor AI",
  legal: "Cóndor AI SpA",
  rut: "", // ← falta: sin esto el pie y el comprobante no muestran RUT
  giro: "Desarrollo de software y consultoría en inteligencia artificial",
  direccion: "", // ← falta
  ciudad: "Santiago, Chile",
  correo: "contacto@teamcondorcl.com",
  telefono: "+56 9 8898 9824",
  web: "condorai.cl",
};

/**
 * Paleta cerrada. Los tres primeros salen del isotipo real (muestreados del
 * PNG, no elegidos a ojo); los neutros son los mismos tokens del portal, para
 * que el PDF se sienta parte de la misma aplicación.
 *
 * `rojo` está reservado a propósito: solo aparece en un comprobante anulado o
 * reembolsado. Si se usa de adorno deja de significar "algo pasó acá".
 */
export const T = {
  tinta: "#101418",
  navy: "#0A1F5C",
  azul: "#0C44D6",
  rojo: "#9F2936",
  suave: "#6B7472",
  /** Solo decorativo. A 7,5 pt sobre blanco da 2,65:1 y NO pasa AA, así que
   *  nada que haya que leer —descargos, pie, datos— puede usarlo. */
  tenue: "#98A19E",
  linea: "#E4E8EC",
  fondo: "#F7F9FB",
  selloBg: "#EAF0FF",
  selloBd: "#C7D8FF",
};

/** Escala modular 1.25 sobre 9.5pt. Ningún tamaño va "al ojo". */
export const P = { micro: 7, legal: 7.5, etiqueta: 8, base: 9.5, dato: 11, h2: 12, h1: 15, titulo: 21, cifra: 24 };

export const hoja = StyleSheet.create({
  pagina: {
    paddingTop: 40,
    paddingBottom: 64,
    paddingHorizontal: 46,
    fontSize: P.base,
    lineHeight: 1.55,
    color: T.tinta,
    fontFamily: "GeneralSans",
  },

  // ── Membrete ────────────────────────────────────────────────────────────
  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: T.navy,
    paddingBottom: 10,
    marginBottom: 20,
  },
  logo: { width: 92, height: 25, objectFit: "contain" },
  marca: { fontSize: P.h1, fontFamily: "ClashDisplay", fontWeight: 600, color: T.navy },
  marcaSub: { fontSize: P.micro, color: T.tenue, letterSpacing: 1.4, marginTop: 3 },
  tipoDoc: {
    fontSize: P.micro,
    fontFamily: "GeneralSans",
    fontWeight: 600,
    letterSpacing: 1.5,
    color: T.suave,
    textAlign: "right",
  },
  folio: {
    fontSize: P.dato,
    fontFamily: "SpaceMono",
    fontWeight: 700,
    color: T.navy,
    textAlign: "right",
    marginTop: 2,
  },

  // ── Texto ───────────────────────────────────────────────────────────────
  // `lineHeight` explícito: Clash Display es una display con ascendentes
  // largas, y con el 1.55 heredado de la página el bloque de línea le queda
  // corto — el título terminaba pisando la fecha de abajo.
  h1: {
    fontSize: P.titulo,
    fontFamily: "ClashDisplay",
    fontWeight: 600,
    color: T.navy,
    lineHeight: 1.25,
    marginBottom: 6,
  },
  h2: {
    fontSize: P.etiqueta,
    fontFamily: "GeneralSans",
    fontWeight: 600,
    letterSpacing: 1.1,
    color: T.suave,
    marginTop: 18,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  p: { marginBottom: 7, textAlign: "justify" },
  // El descargo de "esto no es una boleta del SII" es lo último que puede
  // quedar ilegible: va en `suave` (4,81:1), no en `tenue`.
  legal: { fontSize: P.legal, color: T.suave, lineHeight: 1.5 },

  // ── Bloques ─────────────────────────────────────────────────────────────
  caja: {
    backgroundColor: T.fondo,
    borderWidth: 1,
    borderColor: T.linea,
    borderRadius: 4,
    padding: 11,
    marginBottom: 12,
  },
  fila: { flexDirection: "row", justifyContent: "space-between" },
  etiqueta: { color: T.suave, fontSize: P.etiqueta, letterSpacing: 0.6, textTransform: "uppercase" },
  dato: { fontFamily: "GeneralSans", fontWeight: 600, color: T.tinta },

  // ── Tabla ───────────────────────────────────────────────────────────────
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: T.navy,
    paddingBottom: 5,
    marginBottom: 3,
  },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: T.linea, paddingVertical: 7 },
  thTxt: {
    fontSize: P.micro,
    fontFamily: "GeneralSans",
    fontWeight: 600,
    letterSpacing: 1,
    color: T.suave,
  },
  num: { textAlign: "right", fontFamily: "SpaceMono" },
  total: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.navy,
  },

  // ── Pie ─────────────────────────────────────────────────────────────────
  pie: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    borderTopWidth: 1,
    borderTopColor: T.linea,
    paddingTop: 8,
    fontSize: P.micro,
    color: T.suave,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  firmas: { flexDirection: "row", justifyContent: "space-between", marginTop: 42 },
  firma: { width: "42%", borderTopWidth: 1, borderTopColor: T.tinta, paddingTop: 6 },
});

/**
 * Membrete. El isotipo va como imagen y no como texto a propósito: el ave
 * tiene un degradado azul→rojo que ninguna fuente puede reproducir, y es la
 * mitad del reconocimiento de la marca.
 */
export function Cabecera({ tipo, folio }: { tipo: string; folio?: string }) {
  return (
    <View style={hoja.cabecera}>
      <Image style={hoja.logo} src="/assets/logo.png" />
      <View>
        <Text style={hoja.tipoDoc}>{tipo}</Text>
        {folio ? <Text style={hoja.folio}>{folio}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Pie de página, repetido en todas las hojas.
 *
 * ACÁ NO SE USA EL PROP `render`, Y NO ES UN OLVIDO (22-ago-2026)
 * ---------------------------------------------------------------------------
 * Este pie llevaba un `<Text render={({pageNumber}) => …} />` para numerar las
 * páginas. En react-pdf 4.6.1 ese prop **no funciona en el navegador**: no se
 * cae con un error, se lleva en silencio TODO el bloque `fixed` que lo
 * contiene. O sea que el pie completo llevaba meses sin salir en ningún PDF
 * emitido — se descubrió recién al mirar un comprobante generado de verdad.
 *
 * Comprobado: en Node (`renderToFile`) el mismo código sí numera; en
 * `pdf().toBlob()` desaparece el pie entero. Da igual si el `fixed` va en el
 * View o en el Text, y da igual si el `render` va en un Text o en un View.
 *
 * Como la identidad legal en cada hoja importa más que el numerito, el pie se
 * queda sin numeración. Si algún día se necesita paginar un contrato largo,
 * hay que generarlo en el servidor o subir de versión y volver a verificar el
 * PDF de salida — no basta con que compile.
 */
export function Pie() {
  const partes = [
    EMPRESA.legal,
    EMPRESA.rut && `RUT ${EMPRESA.rut}`,
    EMPRESA.direccion || EMPRESA.ciudad,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <View style={hoja.pie} fixed>
      <Text>{partes}</Text>
      <Text style={{ fontFamily: "SpaceMono" }}>{EMPRESA.web}</Text>
    </View>
  );
}

export function hoy() {
  return new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function plataPdf(n: number, moneda = "CLP") {
  return `$${Number(n || 0).toLocaleString("es-CL")}${moneda !== "CLP" ? " " + moneda : ""}`;
}

/** Folio legible y ordenable: COT-260814-3F2A. */
export function folio(prefijo: string) {
  const d = new Date();
  const f = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("");
  const az = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefijo}-${f}-${az}`;
}
