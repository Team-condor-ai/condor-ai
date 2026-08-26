import { useState } from "react";
import { sb } from "../../lib/supabase";

type Plataforma = "instagram" | "tiktok" | "facebook" | "linkedin";
const PLATAFORMAS: { valor: Plataforma; nombre: string }[] = [
  { valor: "instagram", nombre: "Instagram" },
  { valor: "facebook", nombre: "Facebook" },
  { valor: "tiktok", nombre: "TikTok" },
  { valor: "linkedin", nombre: "LinkedIn" },
];

type Props = {
  barbaraClienteId: string;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Único camino hoy para poblar `barbara_canales`: antes sólo se podía por
 * SQL a mano (ver auditoría de Fase 3). Llama a la RPC `barbara_crear_canal`
 * (solo staff) en vez de un insert directo, porque la tabla no tiene policy
 * de INSERT para nadie más que es_admin().
 *
 * El RPC hace `on conflict ... do update`, así que reconectar la misma
 * plataforma no debería lanzar 23505 — el manejo de duplicado queda igual
 * como defensa, por si el conflicto compuesto cambia en el futuro.
 */
export function ConectarCanalBarbara({ barbaraClienteId, cerrar, guardado }: Props) {
  const [plataforma, setPlataforma] = useState<Plataforma>("instagram");
  const [accountRef, setAccountRef] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function esErrorDuplicado(msg: string, code?: string) {
    return code === "23505" || /duplicate key|unique constraint/i.test(msg);
  }

  async function conectar(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!accountRef.trim()) { setError("Falta la referencia de la cuenta en Blotato."); return; }
    setGuardando(true);
    const { error } = await sb.rpc("barbara_crear_canal", {
      p_barbara_cliente_id: barbaraClienteId,
      p_plataforma: plataforma,
      p_account_ref: accountRef.trim(),
    });
    setGuardando(false);
    if (error) {
      setError(esErrorDuplicado(error.message, (error as { code?: string }).code)
        ? "Esta plataforma ya tiene un canal conectado para este cliente."
        : error.message);
      return;
    }
    guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Conectar canal</h2>
        </header>
        <div className="contenido">
          <form onSubmit={conectar} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="campo-lbl">
              Plataforma
              <select className="campo" value={plataforma} onChange={(e) => setPlataforma(e.target.value as Plataforma)}>
                {PLATAFORMAS.map((p) => <option key={p.valor} value={p.valor}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="campo-lbl">
              Referencia de la cuenta
              <input
                className="campo"
                value={accountRef}
                onChange={(e) => setAccountRef(e.target.value)}
                placeholder="account_ref de Blotato"
                autoFocus
              />
              <small>Cópiala desde el panel de Blotato — no se valida automáticamente contra el proveedor.</small>
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn solido ancho" disabled={guardando}>
              {guardando ? "Conectando…" : "Conectar canal"}
            </button>
          </form>
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
