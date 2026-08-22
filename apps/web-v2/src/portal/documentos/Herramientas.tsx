import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import type { Cliente } from "../staff/tipos";
import { EMPRESA, folio } from "./marca";
import { Contrato, Cotizacion, Terminos, type DatosDoc, type Item } from "./plantillas";

type Tipo = "cotizacion" | "contrato" | "terminos";

const TIPOS: { id: Tipo; titulo: string; bajada: string }[] = [
  { id: "cotizacion", titulo: "Cotización", bajada: "Propuesta con detalle y total." },
  { id: "contrato", titulo: "Contrato", bajada: "Prestación de servicios, listo para firmar." },
  { id: "terminos", titulo: "Términos y condiciones", bajada: "Documento estándar del servicio." },
];

const PREFIJO: Record<Tipo, string> = {
  cotizacion: "COT",
  contrato: "CON",
  terminos: "TYC",
};

export function Herramientas() {
  const [tipo, setTipo] = useState<Tipo>("cotizacion");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [id, setId] = useState("");
  const [items, setItems] = useState<Item[]>([
    { detalle: "", cantidad: 1, precio: 0 },
  ]);
  const [notas, setNotas] = useState("");
  const [mensual, setMensual] = useState(0);
  const [moneda, setMoneda] = useState("CLP");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    sb.from("clientes")
      .select("*")
      .order("negocio")
      .then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, []);

  // Al elegir un cliente se prellena con lo que ya está en su ficha. Escribir
  // otra vez el plan y los montos es donde se cuelan las cotizaciones que no
  // calzan con lo que después se cobra.
  function elegir(nuevo: string) {
    setId(nuevo);
    const c = clientes.find((x) => x.id === nuevo);
    if (!c) return;
    setMoneda(c.moneda ?? "CLP");
    setMensual(c.mensual_monto ?? 0);
    setItems([
      {
        detalle: c.concepto || `Plan ${c.plan ?? ""}`.trim(),
        cantidad: 1,
        precio: c.setup_monto ?? 0,
      },
    ]);
  }

  const cliente = clientes.find((c) => c.id === id);
  const total = items.reduce((t, i) => t + i.cantidad * i.precio, 0);

  async function generar() {
    setError("");
    if (tipo !== "terminos" && !cliente) {
      setError("Elige un cliente antes de generar el documento.");
      return;
    }
    setGenerando(true);
    try {
      const d: DatosDoc = {
        folio: folio(PREFIJO[tipo]),
        cliente: cliente?.negocio ?? "",
        correo: cliente?.email ?? "",
        moneda,
        items: items.filter((i) => i.detalle.trim()),
        notas,
        mensual,
      };
      const doc =
        tipo === "cotizacion" ? <Cotizacion d={d} />
        : tipo === "contrato" ? <Contrato d={d} />
        : <Terminos d={d} />;

      const blob = await pdf(doc).toBlob();
      // Se descarga como archivo y no se abre en una pestaña: el documento va
      // a un cliente, y "guardar como PDF" desde el visor del navegador
      // depende de que la persona sepa hacerlo y sale distinto en cada uno.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${d.folio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  }

  const faltaMembrete = !EMPRESA.rut || !EMPRESA.direccion;

  return (
    <>
      <div className="barra">
        <h1>Herramientas</h1>
      </div>

      <div className="cuerpo">
        {faltaMembrete && (
          <p className="aviso">
            El membrete está incompleto: falta el RUT y la dirección de la
            empresa. Los documentos salen igual, pero sin esos datos no sirven
            como respaldo formal. Se completan en{" "}
            <code>portal/documentos/marca.tsx</code>.
          </p>
        )}

        <div className="chips">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              className={"chip" + (tipo === t.id ? " on" : "")}
              onClick={() => setTipo(t.id)}
            >
              {t.titulo}
            </button>
          ))}
          <button className="chip" disabled title="Todavía no está disponible">
            Presentaciones
            <span>PRONTO</span>
          </button>
        </div>

        <p className="parrafo" style={{ color: "var(--texto-2)" }}>
          {TIPOS.find((t) => t.id === tipo)?.bajada}
        </p>

        {tipo !== "terminos" && (
          <>
            <label className="campo-lbl" style={{ maxWidth: 420 }}>
              Cliente
              <select
                className="campo"
                value={id}
                onChange={(e) => elegir(e.target.value)}
              >
                <option value="">Elegir…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.negocio || c.nombre || c.email || "Sin nombre"}
                  </option>
                ))}
              </select>
            </label>

            <section className="bloque" style={{ marginTop: 18 }}>
              <h3>Detalle</h3>
              {items.map((it, k) => (
                <div className="fila-item" key={k}>
                  <input
                    className="campo"
                    placeholder="Servicio o producto"
                    value={it.detalle}
                    onChange={(e) => {
                      const n = [...items];
                      n[k] = { ...it, detalle: e.target.value };
                      setItems(n);
                    }}
                  />
                  <input
                    className="campo corto"
                    type="number"
                    min={1}
                    value={it.cantidad || ""}
                    onChange={(e) => {
                      const n = [...items];
                      n[k] = { ...it, cantidad: Number(e.target.value) };
                      setItems(n);
                    }}
                  />
                  <input
                    className="campo medio"
                    type="number"
                    min={0}
                    value={it.precio || ""}
                    onChange={(e) => {
                      const n = [...items];
                      n[k] = { ...it, precio: Number(e.target.value) };
                      setItems(n);
                    }}
                  />
                  <button
                    className="icono-btn"
                    title="Quitar"
                    onClick={() => setItems(items.filter((_, j) => j !== k))}
                    disabled={items.length === 1}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn"
                onClick={() =>
                  setItems([...items, { detalle: "", cantidad: 1, precio: 0 }])
                }
              >
                {Ico.mas({ t: 14 })} Agregar línea
              </button>

              <div className="total-linea">
                <span>Total</span>
                <b>{plata(total, moneda)}</b>
              </div>
            </section>

            <div className="dos" style={{ maxWidth: 420 }}>
              <label className="campo-lbl">
                Mensualidad (opcional)
                <input
                  className="campo"
                  type="number"
                  min={0}
                  value={mensual || ""}
                  onChange={(e) => setMensual(Number(e.target.value))}
                />
              </label>
              <label className="campo-lbl">
                Moneda
                <select
                  className="campo"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                >
                  {["CLP", "COP", "PEN", "USD"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="campo-lbl" style={{ maxWidth: 560, marginTop: 12 }}>
              Notas
              <textarea
                className="campo"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 20 }}>
          <button className="btn solido" onClick={generar} disabled={generando}>
            {Ico.documentos({ t: 15 })}
            {generando ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>
    </>
  );
}
