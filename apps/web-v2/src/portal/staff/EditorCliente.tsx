import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import {
  ESTADOS_MENSUAL,
  ESTADOS_SETUP,
  MONEDAS,
  PLANES,
  type Cliente,
  type Producto,
} from "./tipos";

type Props = {
  cliente: Cliente | null;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Alta y edición de cliente. `cliente === null` significa "nuevo".
 *
 * LA FICHA CONFIGURA EL TRATO, NO LO ASUME
 * ---------------------------------------------------------------------------
 * Antes todo cliente mostraba setup Y mensualidad, con sus montos, estados y
 * links de pago — aunque no cobrara ninguno de los dos. Eso obligaba a dejar
 * ceros y campos vacíos que igual ocupaban pantalla, y no distinguía "paga 0"
 * de "no paga esto".
 *
 * Ahora se declara primero QUÉ cobra el cliente, y solo entonces aparece lo
 * que corresponda. Un cliente de encargos sueltos (los trabajos que Howden
 * pide cada tanto, por ejemplo) se guarda sin setup ni mensualidad, y sus
 * cobros se anotan uno a uno desde su ficha.
 */
export function EditorCliente({ cliente, cerrar, guardado }: Props) {
  const [f, setF] = useState({
    email: cliente?.email ?? "",
    negocio: cliente?.negocio ?? "",
    plan: cliente?.plan ?? "",
    concepto: cliente?.concepto ?? "",
    setup_monto: cliente?.setup_monto ?? 0,
    mensual_monto: cliente?.mensual_monto ?? 0,
    moneda: cliente?.moneda ?? "CLP",
    setup_estado: cliente?.setup_estado ?? "pendiente",
    mensual_estado: cliente?.mensual_estado ?? "pendiente",
    proximo_cobro: cliente?.proximo_cobro ?? "",
    link_setup: cliente?.link_setup ?? "",
    link_mensual: cliente?.link_mensual ?? "",
    link_paypal: cliente?.link_paypal ?? "",
    web_url: cliente?.web_url ?? "",
    notas: cliente?.notas ?? "",
  });
  // Un cliente nuevo parte cobrando ambos porque es el caso más común, pero
  // uno existente respeta lo que ya tenía guardado.
  const [cobraSetup, setCobraSetup] = useState(cliente?.cobra_setup ?? true);
  const [cobraMensual, setCobraMensual] = useState(cliente?.cobra_mensual ?? true);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // El catálogo de productos alimenta las sugerencias del plan: si ya vendiste
  // "Bárbara" antes, aparece; si este cliente lleva algo nuevo, se escribe y
  // ya está. El campo es libre, la lista es solo un atajo.
  useEffect(() => {
    sb.from("productos")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setProductos((data ?? []) as Producto[]));
  }, []);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setError("");

    const fila = {
      ...f,
      email: f.email.trim().toLowerCase(),
      plan: f.plan.trim() || null,
      cobra_setup: cobraSetup,
      cobra_mensual: cobraMensual,
      // Lo que no se cobra se guarda en cero y sin link, para que no quede un
      // monto viejo escondido si mañana alguien vuelve a activar la casilla.
      setup_monto: cobraSetup ? Number(f.setup_monto) || 0 : 0,
      mensual_monto: cobraMensual ? Number(f.mensual_monto) || 0 : 0,
      link_setup: cobraSetup ? f.link_setup : "",
      link_mensual: cobraMensual ? f.link_mensual : "",
      notas: f.notas.trim() || null,
      // Una fecha vacía tiene que viajar como null, no como "": Postgres
      // rechaza la cadena vacía en una columna `date` y el error que devuelve
      // ("invalid input syntax for type date") no dice cuál campo fue.
      proximo_cobro: (cobraMensual && f.proximo_cobro) || null,
    };

    const q = cliente
      ? sb.from("clientes").update(fila).eq("id", cliente.id)
      : sb.from("clientes").insert(fila);
    const { error } = await q;
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  const sinCobroFijo = !cobraSetup && !cobraMensual;

  return (
    <div className="velo" onClick={cerrar}>
      <form
        className="panel-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <header>
          <h2>{cliente ? "Editar cliente" : "Nuevo cliente"}</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Correo del cliente
            <input
              className="campo"
              type="email"
              required
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <small>Con este correo inicia sesión en el portal.</small>
          </label>

          <label className="campo-lbl">
            Negocio
            <input
              className="campo"
              value={f.negocio}
              onChange={(e) => set("negocio", e.target.value)}
            />
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Plan o servicio
              <input
                className="campo"
                list="lista-planes"
                placeholder="Escribe uno nuevo o elige del catálogo"
                value={f.plan}
                onChange={(e) => set("plan", e.target.value)}
              />
              <datalist id="lista-planes">
                {productos.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
                {PLANES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="campo-lbl">
              Moneda
              <select
                className="campo"
                value={f.moneda}
                onChange={(e) => set("moneda", e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="campo-lbl">
            Servicio ofrecido
            <textarea
              className="campo"
              rows={2}
              placeholder="Landing + Videos IA + Campañas Meta"
              value={f.concepto}
              onChange={(e) => set("concepto", e.target.value)}
            />
            <small>Esto es lo que el cliente ve como "qué incluye".</small>
          </label>

          <section className="bloque" style={{ marginBottom: 8 }}>
            <h3>Cómo se le cobra</h3>
            <div className="chips" style={{ marginBottom: 4 }}>
              <button
                type="button"
                className={"chip" + (cobraSetup ? " on" : "")}
                onClick={() => setCobraSetup((v) => !v)}
              >
                Cobra setup
              </button>
              <button
                type="button"
                className={"chip" + (cobraMensual ? " on" : "")}
                onClick={() => setCobraMensual((v) => !v)}
              >
                Cobra mensualidad
              </button>
            </div>
            {sinCobroFijo && (
              <p className="conteo">
                Sin cobro fijo: los trabajos se anotan uno a uno desde la ficha del
                cliente, con su monto y forma de pago.
              </p>
            )}
          </section>

          {cobraSetup && (
            <div className="dos">
              <label className="campo-lbl">
                Setup
                <input
                  className="campo"
                  type="number"
                  min={0}
                  value={f.setup_monto}
                  onChange={(e) => set("setup_monto", Number(e.target.value))}
                />
              </label>
              <label className="campo-lbl">
                Estado del setup
                <select
                  className="campo"
                  value={f.setup_estado}
                  onChange={(e) => set("setup_estado", e.target.value)}
                >
                  {ESTADOS_SETUP.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {cobraMensual && (
            <>
              <div className="dos">
                <label className="campo-lbl">
                  Mensualidad
                  <input
                    className="campo"
                    type="number"
                    min={0}
                    value={f.mensual_monto}
                    onChange={(e) => set("mensual_monto", Number(e.target.value))}
                  />
                </label>
                <label className="campo-lbl">
                  Estado mensual
                  <select
                    className="campo"
                    value={f.mensual_estado}
                    onChange={(e) => set("mensual_estado", e.target.value)}
                  >
                    {ESTADOS_MENSUAL.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="campo-lbl">
                Próximo cobro
                <input
                  className="campo"
                  type="date"
                  value={f.proximo_cobro ?? ""}
                  onChange={(e) => set("proximo_cobro", e.target.value)}
                />
              </label>
            </>
          )}

          {(cobraSetup || cobraMensual) && (
            <section className="bloque" style={{ marginBottom: 8 }}>
              <h3>Links de pago (opcionales)</h3>
              {cobraSetup && (
                <label className="campo-lbl">
                  Link de pago · setup
                  <input
                    className="campo"
                    value={f.link_setup}
                    onChange={(e) => set("link_setup", e.target.value)}
                  />
                </label>
              )}
              {cobraMensual && (
                <label className="campo-lbl">
                  Link de pago · mensual
                  <input
                    className="campo"
                    value={f.link_mensual}
                    onChange={(e) => set("link_mensual", e.target.value)}
                  />
                </label>
              )}
              <label className="campo-lbl">
                Link PayPal
                <input
                  className="campo"
                  value={f.link_paypal}
                  onChange={(e) => set("link_paypal", e.target.value)}
                />
              </label>
            </section>
          )}

          <label className="campo-lbl">
            Web entregada
            <input
              className="campo"
              value={f.web_url}
              onChange={(e) => set("web_url", e.target.value)}
            />
          </label>

          <label className="campo-lbl">
            Notas internas
            <textarea
              className="campo"
              rows={2}
              placeholder="Cómo se factura, con quién se coordina, acuerdos…"
              value={f.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
            <small>Solo las ve el equipo, nunca el cliente.</small>
          </label>

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
