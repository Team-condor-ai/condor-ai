import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  Cabecera,
  EMPRESA,
  Pie,
  hoja,
  hoy,
  plataPdf,
} from "./marca";

export type Item = { detalle: string; cantidad: number; precio: number };

export type DatosDoc = {
  folio: string;
  cliente: string;
  correo: string;
  rutCliente?: string;
  moneda: string;
  items: Item[];
  validez?: number;
  notas?: string;
  mensual?: number;
  meses?: number;
};

const suma = (it: Item[]) =>
  it.reduce((t, i) => t + (Number(i.cantidad) || 0) * (Number(i.precio) || 0), 0);

function Partes({ d }: { d: DatosDoc }) {
  return (
    <View style={hoja.caja}>
      <View style={hoja.fila}>
        <View style={{ width: "48%" }}>
          <Text style={hoja.etiqueta}>Prestador</Text>
          <Text style={hoja.dato}>{EMPRESA.legal}</Text>
          <Text>{EMPRESA.correo}</Text>
          <Text>{EMPRESA.telefono}</Text>
        </View>
        <View style={{ width: "48%" }}>
          <Text style={hoja.etiqueta}>Cliente</Text>
          <Text style={hoja.dato}>{d.cliente || "—"}</Text>
          <Text>{d.correo}</Text>
          {d.rutCliente ? <Text>RUT {d.rutCliente}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function Tabla({ d }: { d: DatosDoc }) {
  const total = suma(d.items);
  return (
    <>
      <View style={hoja.th}>
        <Text style={[hoja.thTxt, { width: "56%" }]}>DETALLE</Text>
        <Text style={[hoja.thTxt, hoja.num, { width: "12%" }]}>CANT.</Text>
        <Text style={[hoja.thTxt, hoja.num, { width: "16%" }]}>PRECIO</Text>
        <Text style={[hoja.thTxt, hoja.num, { width: "16%" }]}>TOTAL</Text>
      </View>
      {d.items.map((i, k) => (
        <View style={hoja.tr} key={k}>
          <Text style={{ width: "56%" }}>{i.detalle}</Text>
          <Text style={[hoja.num, { width: "12%" }]}>{i.cantidad}</Text>
          <Text style={[hoja.num, { width: "16%" }]}>
            {plataPdf(i.precio, d.moneda)}
          </Text>
          <Text style={[hoja.num, { width: "16%" }]}>
            {plataPdf(i.cantidad * i.precio, d.moneda)}
          </Text>
        </View>
      ))}
      <View style={hoja.total}>
        <Text style={{ marginRight: 14, color: "#6B7472" }}>Total</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>
          {plataPdf(total, d.moneda)}
        </Text>
      </View>
      {d.mensual ? (
        <View style={[hoja.fila, { justifyContent: "flex-end", marginTop: 4 }]}>
          <Text style={{ color: "#6B7472" }}>
            Luego {plataPdf(d.mensual, d.moneda)} mensuales
          </Text>
        </View>
      ) : null}
    </>
  );
}

export function Cotizacion({ d }: { d: DatosDoc }) {
  return (
    <Document title={`Cotización ${d.folio}`} author={EMPRESA.nombre}>
      <Page size="A4" style={hoja.pagina}>
        <Cabecera tipo="COTIZACIÓN" folio={d.folio} />
        <Text style={hoja.h1}>Propuesta de servicios</Text>
        <Text style={{ color: "#6B7472", marginBottom: 14 }}>{hoy()}</Text>
        <Partes d={d} />
        <Text style={hoja.h2}>Servicios</Text>
        <Tabla d={d} />
        {d.notas ? (
          <>
            <Text style={hoja.h2}>Notas</Text>
            <Text style={hoja.p}>{d.notas}</Text>
          </>
        ) : null}
        <Text style={hoja.h2}>Condiciones</Text>
        <Text style={hoja.p}>
          Esta cotización tiene una validez de {d.validez ?? 15} días corridos
          desde su emisión. Los valores están expresados en {d.moneda} y no
          incluyen impuestos, salvo que se indique lo contrario. La puesta en
          marcha comienza una vez aceptada la propuesta y recibido el pago
          inicial.
        </Text>
        <Pie />
      </Page>
    </Document>
  );
}

export function Contrato({ d }: { d: DatosDoc }) {
  const total = suma(d.items);
  return (
    <Document title={`Contrato ${d.folio}`} author={EMPRESA.nombre}>
      <Page size="A4" style={hoja.pagina}>
        <Cabecera tipo="CONTRATO DE SERVICIOS" folio={d.folio} />
        <Text style={hoja.h1}>Contrato de prestación de servicios</Text>
        <Text style={{ color: "#6B7472", marginBottom: 14 }}>{hoy()}</Text>
        <Partes d={d} />

        <Text style={hoja.h2}>Primero · Objeto</Text>
        <Text style={hoja.p}>
          {EMPRESA.legal} prestará a {d.cliente || "el cliente"} los servicios
          detallados en este contrato, en los términos y plazos que aquí se
          establecen.
        </Text>

        <Text style={hoja.h2}>Segundo · Servicios</Text>
        <Tabla d={d} />

        <Text style={hoja.h2}>Tercero · Precio y forma de pago</Text>
        <Text style={hoja.p}>
          El cliente pagará {plataPdf(total, d.moneda)} por la puesta en marcha
          {d.mensual
            ? `, y ${plataPdf(d.mensual, d.moneda)} mensuales por el servicio continuo`
            : ""}
          . Los pagos se realizarán por los medios que {EMPRESA.nombre} indique.
          El atraso superior a 10 días corridos faculta a suspender el servicio
          hasta regularizar la deuda.
        </Text>

        <Text style={hoja.h2}>Cuarto · Vigencia</Text>
        <Text style={hoja.p}>
          Este contrato rige desde su firma
          {d.meses ? ` por ${d.meses} meses` : " de forma indefinida"} y se
          renueva automáticamente por periodos iguales, salvo aviso escrito de
          cualquiera de las partes con al menos 30 días de anticipación.
        </Text>

        <Text style={hoja.h2}>Quinto · Propiedad y confidencialidad</Text>
        <Text style={hoja.p}>
          Los entregables desarrollados para el cliente son de su propiedad una
          vez pagados en su totalidad. {EMPRESA.nombre} conserva la propiedad
          de sus herramientas, componentes y metodologías previas. Ambas partes
          se obligan a mantener reserva de la información que reciban con
          ocasión de este contrato.
        </Text>

        <Text style={hoja.h2}>Sexto · Término</Text>
        <Text style={hoja.p}>
          Cualquiera de las partes puede poner término a este contrato dando
          aviso escrito con 30 días de anticipación. Los montos pagados por
          periodos ya iniciados no son reembolsables.
        </Text>

        <View style={hoja.firmas}>
          <View style={hoja.firma}>
            <Text style={hoja.dato}>{EMPRESA.legal}</Text>
            <Text style={hoja.etiqueta}>Prestador</Text>
          </View>
          <View style={hoja.firma}>
            <Text style={hoja.dato}>{d.cliente || "Cliente"}</Text>
            <Text style={hoja.etiqueta}>Cliente</Text>
          </View>
        </View>
        <Pie />
      </Page>
    </Document>
  );
}

export function Terminos({ d }: { d: DatosDoc }) {
  const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <>
      <Text style={hoja.h2}>{t}</Text>
      <Text style={hoja.p}>{children}</Text>
    </>
  );
  return (
    <Document title={`Términos y condiciones ${d.folio}`} author={EMPRESA.nombre}>
      <Page size="A4" style={hoja.pagina}>
        <Cabecera tipo="TÉRMINOS Y CONDICIONES" folio={d.folio} />
        <Text style={hoja.h1}>Términos y condiciones del servicio</Text>
        <Text style={{ color: "#6B7472", marginBottom: 10 }}>
          Vigentes desde {hoy()}
        </Text>

        <S t="1 · Quiénes somos">
          {EMPRESA.legal}, {EMPRESA.giro}, con domicilio en{" "}
          {EMPRESA.direccion || EMPRESA.ciudad}. Contacto: {EMPRESA.correo}.
        </S>
        <S t="2 · Alcance">
          Estos términos regulan la contratación y el uso de los servicios de{" "}
          {EMPRESA.nombre}. Al contratar, el cliente declara conocerlos y
          aceptarlos.
        </S>
        <S t="3 · Servicios">
          Los servicios contratados se detallan en la cotización o contrato
          correspondiente. Cualquier trabajo fuera de ese alcance se cotiza por
          separado.
        </S>
        <S t="4 · Precios y pagos">
          Los precios se expresan en la moneda indicada y no incluyen impuestos,
          salvo mención expresa. Las mensualidades se cobran por adelantado. El
          atraso superior a 10 días corridos faculta a suspender el servicio.
        </S>
        <S t="5 · Plazos">
          Los plazos comprometidos suponen que el cliente entregue a tiempo la
          información, accesos y aprobaciones necesarias. Las demoras
          atribuibles al cliente extienden los plazos en igual medida.
        </S>
        <S t="6 · Propiedad intelectual">
          Los entregables son propiedad del cliente una vez pagados en su
          totalidad. {EMPRESA.nombre} conserva la propiedad de sus herramientas,
          componentes reutilizables y metodologías previas.
        </S>
        <S t="7 · Confidencialidad y datos">
          {EMPRESA.nombre} trata los datos del cliente solo para prestar el
          servicio, conforme a la Ley 19.628 sobre protección de la vida
          privada. No se comparten con terceros salvo obligación legal o
          proveedores necesarios para operar el servicio.
        </S>
        <S t="8 · Responsabilidad">
          {EMPRESA.nombre} responde por el correcto desempeño de los servicios
          contratados. No responde por perjuicios indirectos ni por fallas de
          servicios de terceros ajenos a su control.
        </S>
        <S t="9 · Término">
          Cualquiera de las partes puede terminar la relación avisando por
          escrito con 30 días de anticipación. Los periodos ya iniciados no se
          reembolsan.
        </S>
        <S t="10 · Modificaciones">
          {EMPRESA.nombre} puede actualizar estos términos avisando al cliente
          con 30 días de anticipación al correo registrado.
        </S>
        <S t="11 · Ley aplicable">
          Estos términos se rigen por la ley chilena. Cualquier controversia se
          somete a los tribunales de {EMPRESA.ciudad}.
        </S>
        <Pie />
      </Page>
    </Document>
  );
}
