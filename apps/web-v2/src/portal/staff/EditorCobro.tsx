import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { MONEDAS, type Cobro } from "./tipos";

type Props = {
  clienteId: string;
  monedaCliente?: string | null;
  /** null = crear uno nuevo. */
  cobro: Cobro | null;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Crea o edita un COBRO: qué se le cobra a un cliente y cuánto.
 *
 * OJO — ESTO NO ES UN PAGO
 * ---------------------------------------------------------------------------
 * Un cobro es el acuerdo ("la landing de septiembre", "$50.000 al mes"). Los
 * pagos son lo que efectivamente entró, y cuelgan de él. Antes este archivo
 * anotaba pagos sueltos; eso se mudó a `AnotarPago.tsx` cuando los cobros
 * pasaron a ser una tabla propia (21-ago-2026).
 *
 * EL TÍTULO ES LIBRE Y PUEDE IR VACÍO
 * ---------------------------------------------------------------------------
 * Sin título el cobro se muestra como "Cobro 3". Se prefirió eso a una lista
 * de planes fijos: los tres de siempre (Esencial/Pro/Premium) nunca calzaron
 * con lo que de verdad se vende.
 */
export function EditorCobro({ clienteId, monedaCliente, cobro, cerrar, guardado }: Props) {
  const [tipo, setTipo] = useState<"unico" | "mensual">(cobro?.tipo ?? "unico");
  const [titulo, setTitulo] = useState(cobro?.titulo ?? "");
  const [monto, setMonto] = useState(cobro?.monto ?? 0);
  const [moneda, setMoneda] = useState(cobro?.moneda ?? monedaCliente ?? "CLP");
  const [proximo, setProximo] = useState(cobro?.proximo_cobro ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [tasaClp, setTasaClp] = useState<number | null>(null);

  // Mercado Pago Chile solo cobra en CLP: si la moneda del cobro es otra, se
  // muestra el equivalente que de verdad se le va a cobrar al cliente. El
  // cálculo real (con la tasa del momento del checkout) lo hace `crear-pago`.
  useEffect(() => {
    let vivo = true;
    const timer = window.setTimeout(() => {
      if (moneda === "CLP") { setTasaClp(null); return; }
      sb.from("tipos_cambio").select("a_clp").eq("moneda", moneda).maybeSingle()
        .then(({ data }) => { if (vivo) setTasaClp(Number(data?.a_clp) || null); });
    }, 0);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [moneda]);

  // Una suscripción viva en Mercado Pago no se puede reescribir desde acá: el
  // monto que se cobra todos los meses lo tiene MP, no nosotros. Cambiarlo en
  // la base solo haría que el portal muestre una cifra distinta de la que se
  // cobra de verdad, que es peor que no poder editarlo.
  const enMercadoPago = !!cobro?.mp_preapproval_id && cobro.estado === "activa";

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!monto || monto <= 0) { setError("Ponle un monto al cobro."); return; }
    setGuardando(true);
    setError("");

    const campos = {
      tipo,
      titulo: titulo.trim() || null,
      monto: Math.round(Number(monto) || 0),
      moneda,
      // Una fecha vacía viaja como null, no como "": Postgres rechaza la
      // cadena vacía en una columna `date` y el error no dice cuál campo fue.
      proximo_cobro: tipo === "mensual" ? proximo || null : null,
    };

    if (cobro) {
      const { error } = await sb.from("cobros").update(campos).eq("id", cobro.id);
      setGuardando(false);
      if (error) { setError(error.message); return; }
      guardado();
      return;
    }

    // El número es por cliente y no se reusa. Se toma del último y se suma uno
    // en vez de contar filas: si alguna se anula, contar repetiría un número.
    const { data: ultimo } = await sb.from("cobros")
      .select("numero").eq("cliente_id", clienteId)
      .order("numero", { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb.from("cobros").insert({
      ...campos,
      cliente_id: clienteId,
      numero: (Number(ultimo?.numero) || 0) + 1,
      estado: "pendiente",
    });
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>{cobro ? "Editar cobro" : "Nuevo cobro"}</h2>
        </header>

        <div className="contenido">
          {!cobro && (
            <div className="chips" style={{ marginBottom: 4 }}>
              <button
                type="button"
                className={"chip" + (tipo === "unico" ? " on" : "")}
                onClick={() => setTipo("unico")}
              >
                Pago único
              </button>
              <button
                type="button"
                className={"chip" + (tipo === "mensual" ? " on" : "")}
                onClick={() => setTipo("mensual")}
              >
                Mensual
              </button>
            </div>
          )}

          <p className="tenue" style={{ marginTop: 0 }}>
            {tipo === "mensual"
              ? "El cliente autoriza una vez y Mercado Pago le cobra solo cada mes. No hay que reenviarle el link."
              : "Se cobra una sola vez. Puede pagarse en varias partes: cada abono queda como un pago del mismo cobro."}
          </p>

          <label className="campo-lbl">
            Título <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <input
              className="campo"
              placeholder={tipo === "mensual" ? "Ej: Mantención mensual" : "Ej: Landing de septiembre"}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <p className="tenue" style={{ marginTop: -6 }}>
            Si lo dejas vacío se muestra como “Cobro {cobro?.numero ?? "N"}”.
          </p>

          <div className="dos">
            <label className="campo-lbl">
              Monto
              <input
                className="campo"
                type="number"
                min={0}
                required
                disabled={enMercadoPago}
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
              />
            </label>
            <label className="campo-lbl">
              Moneda
              <select
                className="campo"
                value={moneda}
                disabled={enMercadoPago}
                onChange={(e) => setMoneda(e.target.value)}
              >
                {MONEDAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>

          {enMercadoPago && (
            <p className="tenue">
              El monto no se puede cambiar: esta suscripción está viva en Mercado
              Pago y es MP quien la cobra. Para cambiarla, cancélala y crea un
              cobro nuevo.
            </p>
          )}

          {moneda !== "CLP" && monto > 0 && (
            <p className="tenue" style={{ marginTop: -6 }}>
              {tasaClp
                ? <>Mercado Pago le va a cobrar al cliente el equivalente en pesos: <b>≈ CLP {Math.round(monto * tasaClp).toLocaleString("es-CL")}</b> al tipo de cambio de hoy. La cuenta chilena de Mercado Pago no puede cobrar en {moneda} directo.</>
                : <>Aún no hay tipo de cambio guardado para {moneda}. Mercado Pago igual va a cobrar en pesos chilenos al convertirlo — esta pantalla no puede mostrar el equivalente todavía.</>}
            </p>
          )}

          {tipo === "mensual" && (
            <label className="campo-lbl">
              Próximo cobro <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                type="date"
                value={proximo}
                onChange={(e) => setProximo(e.target.value)}
              />
            </label>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : cobro ? "Guardar" : "Crear cobro"}
          </button>
        </footer>
      </form>
    </div>
  );
}
