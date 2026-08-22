import { useState } from "react";
import { sb } from "../../lib/supabase";
import { PLANES_RATIA, type SuscriptorRatia } from "../tipos";

type Props = {
  suscriptor: SuscriptorRatia | null;
  cerrar: () => void;
  guardado: () => void;
};

const ESTADOS = ["activa", "pausada", "cancelada"];

/**
 * Alta y edición de un suscriptor de Rat.IA.
 *
 * PIDE POCO A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Un suscriptor de Rat.IA no es un cliente de la agencia: no tiene setup, ni
 * reuniones, ni notas de proyecto. Paga $2.990 o $4.990 al mes por un bot de
 * Telegram. El formulario pide lo que de verdad se usa —cómo contactarlo y qué
 * plan tiene— y una nota libre para lo demás.
 *
 * Nombre es lo único obligatorio: a veces solo se sabe el Telegram, y exigir
 * correo obligaría a inventarlo.
 */
export function EditorSuscriptor({ suscriptor, cerrar, guardado }: Props) {
  const [f, setF] = useState({
    nombre: suscriptor?.nombre ?? "",
    email: suscriptor?.email ?? "",
    telegram: suscriptor?.telegram ?? "",
    telefono: suscriptor?.telefono ?? "",
    plan: suscriptor?.plan ?? PLANES_RATIA[0].id,
    monto: suscriptor?.monto ?? PLANES_RATIA[0].monto,
    estado: suscriptor?.estado ?? "activa",
    inicio: suscriptor?.inicio ?? new Date().toISOString().slice(0, 10),
    proximo_cobro: suscriptor?.proximo_cobro ?? "",
    notas: suscriptor?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  /** Al cambiar de plan se propone su precio, pero queda editable: hay
   *  suscriptores con precio heredado que no calza con la lista. */
  function elegirPlan(id: string) {
    const p = PLANES_RATIA.find((x) => x.id === id);
    setF((prev) => ({ ...prev, plan: id, monto: p ? p.monto : prev.monto }));
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.nombre.trim()) { setError("Ponle un nombre."); return; }
    setGuardando(true);
    setError("");

    const fila = {
      ...f,
      nombre: f.nombre.trim(),
      email: f.email.trim().toLowerCase() || null,
      telegram: f.telegram.trim().replace(/^@/, "") || null,
      telefono: f.telefono.trim() || null,
      notas: f.notas.trim() || null,
      monto: Math.round(Number(f.monto) || 0),
      // Una fecha vacía viaja como null, no como "": Postgres rechaza la cadena
      // vacía en una columna `date` y el error no dice cuál campo fue.
      inicio: f.inicio || null,
      proximo_cobro: f.proximo_cobro || null,
    };

    const q = suscriptor
      ? sb.from("suscriptores_ratia").update(fila).eq("id", suscriptor.id)
      : sb.from("suscriptores_ratia").insert(fila);
    const { error } = await q;
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>{suscriptor ? "Editar suscriptor" : "Nuevo suscriptor de Rat.IA"}</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Nombre
            <input
              className="campo"
              required
              autoFocus
              value={f.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Telegram <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                placeholder="@usuario"
                value={f.telegram}
                onChange={(e) => set("telegram", e.target.value)}
              />
              <small>Es por donde recibe los avisos del vigía.</small>
            </label>
            <label className="campo-lbl">
              Correo <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                type="email"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              Plan
              <select className="campo" value={f.plan} onChange={(e) => elegirPlan(e.target.value)}>
                {PLANES_RATIA.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · ${p.monto.toLocaleString("es-CL")}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Monto al mes
              <input
                className="campo"
                type="number"
                min={0}
                value={f.monto || ""}
                onChange={(e) => set("monto", Number(e.target.value))}
              />
              <small>Se propone el del plan; se puede cambiar.</small>
            </label>
          </div>

          <div className="dos">
            <label className="campo-lbl">
              Estado
              <select className="campo" value={f.estado} onChange={(e) => set("estado", e.target.value)}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="campo-lbl">
              Próximo cobro <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                type="date"
                value={f.proximo_cobro}
                onChange={(e) => set("proximo_cobro", e.target.value)}
              />
            </label>
          </div>

          <label className="campo-lbl">
            Nota <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
            <textarea
              className="campo"
              rows={3}
              placeholder="Lo que convenga recordar."
              value={f.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : suscriptor ? "Guardar" : "Agregar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
