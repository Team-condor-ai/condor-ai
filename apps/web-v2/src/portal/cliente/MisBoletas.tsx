import { useEffect, useState } from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { Cabecera, EMPRESA, P, Pie, T, hoja, plataPdf } from "../documentos/marca";
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
 *
 * PARA QUIÉN ESTÁ DISEÑADO (22-ago-2026)
 * ---------------------------------------------------------------------------
 * No para el cliente: para el CONTADOR del cliente. Este PDF se archiva, se
 * imprime en blanco y negro y se adjunta a una rendición. De ahí salen las
 * tres reglas del diseño:
 *
 *   1. Lo primero que se ve es cuánto y si está pagado, no el membrete.
 *   2. Todo lo verificable —medio, número de operación, fechas— va junto, en
 *      monoespaciada, para poder cotejarlo contra la cartola sin buscarlo.
 *   3. Nada depende del color para entenderse. Impreso en gris sigue completo.
 */

/** Fila etiqueta/valor del bloque de verificación. El valor va monoespaciado
 *  porque son datos que alguien va a comparar carácter por carácter. */
function Verif({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ width: "38%", color: T.suave, fontSize: P.etiqueta }}>{etiqueta}</Text>
      <Text style={{ width: "62%", fontFamily: "SpaceMono", fontSize: P.etiqueta, color: T.tinta }}>
        {valor}
      </Text>
    </View>
  );
}

/** Nombre real de lo que se pagó. `detalle` trae el título del cobro; el
 *  respaldo por tipo es para las filas viejas, de cuando un pago solo podía
 *  ser "setup" o "mensual". Sin esto un pago de "Campaña de lanzamiento"
 *  salía impreso como "Mensualidad". */
export function conceptoDe(p: Pago) {
  const d = p.detalle?.trim();
  if (d) return d;
  if (p.tipo === "setup") return "Puesta en marcha";
  if (p.tipo === "mensual") return "Mensualidad";
  return "Servicios condor.ai";
}

/** Folio estable: el mismo pago siempre da el mismo folio, se descargue las
 *  veces que se descargue. NO se usa `folio()` de marca.tsx acá, que es
 *  aleatorio — dos descargas del mismo comprobante con folios distintos son
 *  dos documentos distintos para un contador. */
const folioDe = (p: Pago) => `CO-${p.id.slice(0, 8).toUpperCase()}`;

function Comprobante({ c, p }: { c: Cliente; p: Pago }) {
  const moneda = c.moneda ?? "CLP";
  const monto = p.monto ?? 0;
  const reembolso = Number(p.mp_refunded_amount ?? 0);
  const anulado = p.estado === "anulado";
  const parcial = reembolso > 0 && reembolso < monto;
  const estado = anulado
    ? "Anulado"
    : reembolso >= monto && reembolso > 0
      ? "Reembolsado"
      : parcial
        ? "Reembolso parcial"
        : "Pagado";
  // El rojo de la marca está reservado justo para esto.
  const alerta = anulado || reembolso > 0;
  const acento = alerta ? T.rojo : T.azul;
  const fechaPago = p.fecha ?? p.creado_en;

  return (
    <Document
      title={`Comprobante ${folioDe(p)}`}
      author={EMPRESA.nombre}
      subject={`${conceptoDe(p)} · ${plataPdf(monto, moneda)}`}
      creator={EMPRESA.web}
    >
      <Page size="A4" style={hoja.pagina}>
        <Cabecera tipo="COMPROBANTE DE PAGO" folio={folioDe(p)} />

        {/* Titular y cifra. La cifra pesa más que el membrete: es lo que
            alguien busca cuando abre este archivo entre otros veinte. */}
        <View style={[hoja.fila, { alignItems: "flex-start", marginBottom: 20 }]}>
          <View style={{ width: "52%" }}>
            <Text style={hoja.h1}>Comprobante de pago</Text>
            <Text style={{ color: T.suave }}>Emitido el {fecha(fechaPago)}</Text>
          </View>
          <View
            style={{
              width: "42%",
              borderWidth: 1,
              borderColor: alerta ? T.rojo : T.selloBd,
              backgroundColor: alerta ? "#FDF2F2" : T.selloBg,
              borderRadius: 4,
              paddingVertical: 11,
              paddingHorizontal: 13,
            }}
          >
            <Text style={[hoja.etiqueta, { color: acento }]}>
              {alerta ? "Monto del pago" : "Total pagado"}
            </Text>
            <Text
              style={{
                fontFamily: "ClashDisplay",
                fontWeight: 600,
                fontSize: P.cifra,
                color: acento,
                lineHeight: 1.2,
                marginTop: 3,
                marginBottom: 2,
              }}
            >
              {plataPdf(monto, moneda)}
            </Text>
            <Text style={{ fontSize: P.etiqueta, color: acento }}>
              {estado}
              {parcial ? ` · ${plataPdf(reembolso, moneda)} devueltos` : ""}
            </Text>
          </View>
        </View>

        {/* Quién a quién */}
        <View style={hoja.caja}>
          <View style={hoja.fila}>
            <View style={{ width: "48%" }}>
              <Text style={hoja.etiqueta}>Emisor</Text>
              <Text style={hoja.dato}>{EMPRESA.legal}</Text>
              {EMPRESA.rut ? <Text>RUT {EMPRESA.rut}</Text> : null}
              <Text>{EMPRESA.correo}</Text>
            </View>
            <View style={{ width: "48%" }}>
              <Text style={hoja.etiqueta}>Cliente</Text>
              <Text style={hoja.dato}>{c.negocio || c.nombre || "—"}</Text>
              <Text>{c.email}</Text>
            </View>
          </View>
        </View>

        {/* Detalle */}
        <Text style={hoja.h2}>Detalle</Text>
        <View style={hoja.th}>
          <Text style={[hoja.thTxt, { width: "70%" }]}>CONCEPTO</Text>
          <Text style={[hoja.thTxt, hoja.num, { width: "30%" }]}>MONTO</Text>
        </View>
        <View style={hoja.tr}>
          <View style={{ width: "70%" }}>
            <Text>{conceptoDe(p)}</Text>
            <Text style={{ fontSize: P.legal, color: T.suave }}>
              {p.tipo === "mensual" ? "Cobro mensual" : "Pago único"}
              {p.periodo ? ` · período ${fecha(p.periodo)}` : ""}
              {c.plan ? ` · plan ${c.plan}` : ""}
            </Text>
          </View>
          <Text style={[hoja.num, { width: "30%" }]}>{plataPdf(monto, moneda)}</Text>
        </View>

        <View style={hoja.total}>
          <Text style={{ marginRight: 14, color: T.suave }}>
            {alerta ? "Monto del pago" : "Total pagado"}
          </Text>
          <Text
            style={{
              fontFamily: "SpaceMono",
              fontWeight: 700,
              fontSize: P.h2,
              color: T.navy,
            }}
          >
            {plataPdf(monto, moneda)}
          </Text>
        </View>
        {parcial ? (
          <View style={[hoja.fila, { justifyContent: "flex-end", marginTop: 4 }]}>
            <Text style={{ marginRight: 14, color: T.suave, fontSize: P.legal }}>Reembolsado</Text>
            <Text style={{ fontFamily: "SpaceMono", fontSize: P.legal, color: T.rojo }}>
              −{plataPdf(reembolso, moneda)}
            </Text>
          </View>
        ) : null}

        {/* La firma del documento: todo lo cotejable, junto y monoespaciado. */}
        <Text style={hoja.h2}>Verificación</Text>
        <View style={[hoja.caja, { marginBottom: 0 }]}>
          <Verif etiqueta="Folio" valor={folioDe(p)} />
          <Verif etiqueta="Medio de pago" valor={p.metodo || "Mercado Pago"} />
          {p.mp_id ? <Verif etiqueta="N.° de operación" valor={String(p.mp_id)} /> : null}
          <Verif etiqueta="Fecha de pago" valor={fecha(fechaPago)} />
          <Verif etiqueta="Estado" valor={estado.toUpperCase()} />
        </View>

        <Text style={[hoja.legal, { marginTop: 18 }]}>
          Documento de respaldo emitido por {EMPRESA.nombre} para fines de
          rendición y control interno. No constituye boleta ni factura
          electrónica ante el Servicio de Impuestos Internos, y no reemplaza al
          documento tributario correspondiente.
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
  const [bajando, setBajando] = useState<string | null>(null);

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
    // Generar el PDF descarga e incrusta cinco fuentes: en un teléfono lento
    // toma un segundo largo. Sin este estado el botón se ve muerto y el
    // cliente lo aprieta tres veces.
    setBajando(p.id);
    try {
      const blob = await pdf(<Comprobante c={c} p={p} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante-${folioDe(p)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBajando(null);
    }
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
                    <td>{fecha(p.fecha ?? p.creado_en)}</td>
                    <td>
                      {conceptoDe(p)}
                      {p.periodo && <span className="conteo"> · {fecha(p.periodo)}</span>}
                    </td>
                    <td className="num">{plata(p.monto, c?.moneda)}</td>
                    <td className="acciones">
                      <button
                        className="icono-btn"
                        title="Descargar comprobante"
                        disabled={bajando === p.id}
                        onClick={() => void bajar(p)}
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
