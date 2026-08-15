import { useEffect, useState } from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { Cabecera, EMPRESA, Pie, hoja, plataPdf } from "../documentos/marca";
import type { Cliente, Pago } from "../staff/tipos";

/**
 * El comprobante que se descarga.
 *
 * SE LLAMA COMPROBANTE Y NO BOLETA, A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Una boleta electrónica la emite el SII y lleva folio timbrado. Esto es un
 * comprobante de pago: sirve para respaldo y rendición, pero llamarlo boleta
 * haría creer al cliente que ya tiene su documento tributario. Cuando el SII
 * esté integrado, este componente se reemplaza por el DTE real.
 */
function Comprobante({ c, p }: { c: Cliente; p: Pago }) {
  return (
    <Document title={`Comprobante ${p.id.slice(0, 8)}`} author={EMPRESA.nombre}>
      <Page size="A4" style={hoja.pagina}>
        <Cabecera tipo="COMPROBANTE DE PAGO" folio={p.id.slice(0, 8).toUpperCase()} />
        <Text style={hoja.h1}>Comprobante de pago</Text>
        <Text style={{ color: "#6B7472", marginBottom: 14 }}>
          {fecha(p.creado_en)}
        </Text>

        <View style={hoja.caja}>
          <View style={hoja.fila}>
            <View style={{ width: "48%" }}>
              <Text style={hoja.etiqueta}>Emisor</Text>
              <Text style={hoja.dato}>{EMPRESA.legal}</Text>
              <Text>{EMPRESA.correo}</Text>
            </View>
            <View style={{ width: "48%" }}>
              <Text style={hoja.etiqueta}>Cliente</Text>
              <Text style={hoja.dato}>{c.negocio || "—"}</Text>
              <Text>{c.email}</Text>
            </View>
          </View>
        </View>

        <View style={hoja.th}>
          <Text style={[hoja.thTxt, { width: "70%" }]}>CONCEPTO</Text>
          <Text style={[hoja.thTxt, hoja.num, { width: "30%" }]}>MONTO</Text>
        </View>
        <View style={hoja.tr}>
          <Text style={{ width: "70%" }}>
            {p.tipo === "setup" ? "Puesta en marcha" : "Mensualidad"}
            {c.plan ? ` · Plan ${c.plan}` : ""}
          </Text>
          <Text style={[hoja.num, { width: "30%" }]}>
            {plataPdf(p.monto ?? 0, c.moneda ?? "CLP")}
          </Text>
        </View>

        <View style={hoja.total}>
          <Text style={{ marginRight: 14, color: "#6B7472" }}>Total pagado</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>
            {plataPdf(p.monto ?? 0, c.moneda ?? "CLP")}
          </Text>
        </View>

        <Text style={[hoja.p, { marginTop: 22, color: "#98A19E", fontSize: 8 }]}>
          Documento de respaldo emitido por {EMPRESA.nombre}. No constituye
          boleta ni factura electrónica ante el Servicio de Impuestos Internos.
        </Text>
        <Pie />
      </Page>
    </Document>
  );
}

export function MisBoletas() {
  const [c, setC] = useState<Cliente | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("clientes").select("*").limit(1).maybeSingle();
      setC(data as Cliente | null);
      const { data: p } = await sb
        .from("pagos")
        .select("*")
        .order("creado_en", { ascending: false });
      setPagos((p ?? []) as Pago[]);
      setCargando(false);
    })();
  }, []);

  async function bajar(p: Pago) {
    if (!c) return;
    const blob = await pdf(<Comprobante c={c} p={p} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprobante-${p.id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cargando)
    return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  const pagados = pagos.filter((p) => p.estado === "pagado");

  return (
    <>
      <div className="barra">
        <h1>Comprobantes</h1>
      </div>
      <div className="cuerpo">
        {pagados.length === 0 ? (
          <p className="vacio">
            Todavía no hay pagos confirmados. Cuando se registre uno, acá vas a
            poder descargar su comprobante.
          </p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagados.map((p) => (
                  <tr key={p.id}>
                    <td>{fecha(p.creado_en)}</td>
                    <td>{p.tipo === "setup" ? "Puesta en marcha" : "Mensualidad"}</td>
                    <td className="num">{plata(p.monto, c?.moneda)}</td>
                    <td className="acciones">
                      <button
                        className="icono-btn"
                        title="Descargar comprobante"
                        onClick={() => bajar(p)}
                      >
                        {Ico.documentos({ t: 15 })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
