import { useState } from "react";
import { sb } from "../lib/supabase";
import {
  ESTADOS_MENSUAL,
  ESTADOS_SETUP,
  MONEDAS,
  PLANES,
  type Cliente,
} from "./tipos";

type Props = {
  cliente: Cliente | null;
  cerrar: () => void;
  guardado: () => void;
};

/** Alta y edición de cliente. `cliente === null` significa "nuevo". */
export function EditorCliente({ cliente, cerrar, guardado }: Props) {
  const [f, setF] = useState({
    email: cliente?.email ?? "",
    negocio: cliente?.negocio ?? "",
    plan: cliente?.plan ?? PLANES[0],
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
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

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
      setup_monto: Number(f.setup_monto) || 0,
      mensual_monto: Number(f.mensual_monto) || 0,
      // Una fecha vacía tiene que viajar como null, no como "": Postgres
      // rechaza la cadena vacía en una columna `date` y el error que devuelve
      // ("invalid input syntax for type date") no dice cuál campo fue.
      proximo_cobro: f.proximo_cobro || null,
    };

    const q = cliente
      ? sb.from("clientes").update(fila).eq("id", cliente.id)
      : sb.from("clientes").insert(fila);
    const { error } = await q;
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

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
              Plan
              <select
                className="campo"
                value={f.plan}
                onChange={(e) => set("plan", e.target.value)}
              >
                {PLANES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
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
              Mensualidad
              <input
                className="campo"
                type="number"
                min={0}
                value={f.mensual_monto}
                onChange={(e) => set("mensual_monto", Number(e.target.value))}
              />
            </label>
          </div>

          <div className="dos">
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

          <label className="campo-lbl">
            Link de pago · setup
            <input
              className="campo"
              value={f.link_setup}
              onChange={(e) => set("link_setup", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Link de pago · mensual
            <input
              className="campo"
              value={f.link_mensual}
              onChange={(e) => set("link_mensual", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Link PayPal
            <input
              className="campo"
              value={f.link_paypal}
              onChange={(e) => set("link_paypal", e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Web entregada
            <input
              className="campo"
              value={f.web_url}
              onChange={(e) => set("web_url", e.target.value)}
            />
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
