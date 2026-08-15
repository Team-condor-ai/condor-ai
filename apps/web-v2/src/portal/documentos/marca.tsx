import { StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * La identidad de Cóndor para todos los PDF.
 *
 * UN SOLO LUGAR, CUATRO DOCUMENTOS
 * ---------------------------------------------------------------------------
 * Cotización, contrato, términos y boleta comparten membrete, pie, tipografía
 * y colores. Si mañana cambia el correo, el teléfono o el RUT, se toca este
 * archivo y salen corregidos los cuatro. Duplicar el encabezado en cada
 * documento es cómo se termina mandando un contrato con el teléfono viejo.
 */

/** ⚠️ Completar antes de emitir el primer documento formal. */
export const EMPRESA = {
  nombre: "Cóndor AI",
  legal: "Cóndor AI SpA",
  rut: "", // ← falta: sin esto el pie no muestra RUT
  giro: "Desarrollo de software y consultoría en inteligencia artificial",
  direccion: "", // ← falta
  ciudad: "Santiago, Chile",
  correo: "contacto@teamcondorcl.com",
  telefono: "+56 9 8898 9824",
  web: "condorai.cl",
};

export const T = {
  tinta: "#16191A",
  suave: "#6B7472",
  tenue: "#98A19E",
  linea: "#E8EBE8",
  fondo: "#FAFBFA",
};

export const hoja = StyleSheet.create({
  pagina: {
    paddingTop: 42,
    paddingBottom: 62,
    paddingHorizontal: 46,
    fontSize: 9.5,
    lineHeight: 1.55,
    color: T.tinta,
    fontFamily: "Helvetica",
  },
  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: T.linea,
    paddingBottom: 14,
    marginBottom: 22,
  },
  marca: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  marcaSub: { fontSize: 7, color: T.tenue, letterSpacing: 1.4, marginTop: 2 },
  tipoDoc: { fontSize: 9, color: T.suave, textAlign: "right" },
  folio: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    color: T.suave,
    marginTop: 18,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  p: { marginBottom: 7, textAlign: "justify" },
  caja: {
    backgroundColor: T.fondo,
    borderWidth: 1,
    borderColor: T.linea,
    borderRadius: 5,
    padding: 11,
    marginBottom: 12,
  },
  fila: { flexDirection: "row", justifyContent: "space-between" },
  etiqueta: { color: T.suave, fontSize: 8 },
  dato: { fontFamily: "Helvetica-Bold" },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: T.tinta,
    paddingBottom: 5,
    marginBottom: 3,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: T.linea,
    paddingVertical: 6,
  },
  thTxt: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: T.suave },
  num: { textAlign: "right" },
  total: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.tinta,
  },
  pie: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    borderTopWidth: 1,
    borderTopColor: T.linea,
    paddingTop: 8,
    fontSize: 7,
    color: T.tenue,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  firmas: { flexDirection: "row", justifyContent: "space-between", marginTop: 42 },
  firma: { width: "42%", borderTopWidth: 1, borderTopColor: T.tinta, paddingTop: 6 },
});

export function Cabecera({ tipo, folio }: { tipo: string; folio?: string }) {
  return (
    <View style={hoja.cabecera}>
      <View>
        <Text style={hoja.marca}>{EMPRESA.nombre.toUpperCase()}</Text>
        <Text style={hoja.marcaSub}>{EMPRESA.web.toUpperCase()}</Text>
      </View>
      <View>
        <Text style={hoja.tipoDoc}>{tipo}</Text>
        {folio ? <Text style={hoja.folio}>{folio}</Text> : null}
      </View>
    </View>
  );
}

export function Pie() {
  const partes = [EMPRESA.legal, EMPRESA.rut && `RUT ${EMPRESA.rut}`, EMPRESA.direccion]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={hoja.pie} fixed>
      <Text>{partes}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
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
