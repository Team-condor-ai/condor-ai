import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import type { Cliente } from "../tipos";

type Paso = "elegir" | "vincular" | "crear";

type Props = {
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Flujo ESTRICTO para agregar un cliente a Bárbara: staff elige uno de dos
 * caminos, no hay una tercera opción ni se puede saltar la elección.
 *
 * `barbara_clientes.cliente_id` es `unique` en la base — si el cliente ya
 * está en Bárbara, el insert falla con un error de constraint. Ese error se
 * captura EXPLÍCITAMENTE (no como un error genérico): se busca la ficha
 * existente y se ofrece un link directo, en vez de un mensaje rojo sin
 * salida.
 */
export function AgregarBarbaraCliente({ cerrar, guardado }: Props) {
  const navega = useNavigate();
  const [paso, setPaso] = useState<Paso>("elegir");

  // --- Vincular cliente existente ---
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  // --- Crear desde cero ---
  const [negocio, setNegocio] = useState("");
  const [correo, setCorreo] = useState("");
  const [creando, setCreando] = useState(false);

  const [error, setError] = useState("");
  const [yaExiste, setYaExiste] = useState<{ id: string; negocio: string } | null>(null);

  async function irAVincular() {
    setPaso("vincular");
    setError("");
    setCargandoLista(true);
    const { data, error } = await sb
      .from("clientes")
      .select("*")
      .order("negocio")
      .limit(400);
    if (error) setError(error.message);
    else setClientes((data ?? []) as Cliente[]);
    setCargandoLista(false);
  }

  // Error de constraint único: Postgres lo manda con code 23505, o el texto
  // menciona "duplicate key" / "unique" según el driver. Se cubren ambos.
  function esErrorDuplicado(msg: string, code?: string) {
    return code === "23505" || /duplicate key|unique constraint/i.test(msg);
  }

  async function verFichaExistente(clienteId: string, negocioNombre: string) {
    const { data } = await sb
      .from("barbara_clientes")
      .select("id")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (data?.id) setYaExiste({ id: data.id, negocio: negocioNombre });
    else
      setError(
        "Este cliente ya está en Bárbara, pero no se pudo encontrar su ficha. Revisa la lista.",
      );
  }

  // El cliente solo puede EDITAR su fila de `barbara_formulario` (la policy
  // `cliente_actualiza_su_formulario` no incluye insert) — así que la fila
  // vacía se crea acá, con privilegio de staff, apenas nace el cliente en
  // Bárbara. Si falla, no se corta el alta: se loguea y sigue (staff puede
  // crearla a mano después; no es motivo para perder el cliente recién
  // agregado).
  async function crearFormularioVacio(barbaraClienteId: string) {
    await sb.from("barbara_formulario").insert({ barbara_cliente_id: barbaraClienteId });
  }

  async function vincular(c: Cliente) {
    setError("");
    setYaExiste(null);
    setVinculando(true);
    const { data, error, status } = await sb
      .from("barbara_clientes")
      .insert({ cliente_id: c.id })
      .select("id")
      .single();
    setVinculando(false);
    if (!error) {
      if (data?.id) await crearFormularioVacio(data.id);
      guardado();
      return;
    }
    if (esErrorDuplicado(error.message, (error as { code?: string }).code) || status === 409) {
      await verFichaExistente(c.id, c.negocio || c.nombre || c.email || "Sin nombre");
    } else {
      setError(error.message);
    }
  }

  async function crearDesdeCero(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setYaExiste(null);
    if (!correo.trim()) return setError("Falta el correo del cliente.");
    setCreando(true);

    const { data: nuevo, error: errCliente } = await sb
      .from("clientes")
      .insert({ email: correo.trim().toLowerCase(), negocio: negocio.trim() || null })
      .select("id,negocio,email")
      .single();

    if (errCliente || !nuevo) {
      setCreando(false);
      setError(errCliente?.message || "No se pudo crear el cliente.");
      return;
    }

    const { data: nuevaFicha, error: errBarbara, status } = await sb
      .from("barbara_clientes")
      .insert({ cliente_id: nuevo.id })
      .select("id")
      .single();
    setCreando(false);

    if (!errBarbara) {
      if (nuevaFicha?.id) await crearFormularioVacio(nuevaFicha.id);
      guardado();
      return;
    }
    // Muy raro en este camino (el cliente es nuevo), pero se cubre igual.
    if (esErrorDuplicado(errBarbara.message, (errBarbara as { code?: string }).code) || status === 409) {
      await verFichaExistente(nuevo.id, nuevo.negocio || nuevo.email);
    } else {
      setError(errBarbara.message);
    }
  }

  const visibles = clientes.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [c.negocio, c.email].filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
  });

  return (
    <div className="velo" onClick={cerrar}>
      <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Agregar cliente a Bárbara</h2>
        </header>

        <div className="contenido">
          {yaExiste ? (
            <>
              <p className="aviso">
                Este cliente ya está en Bárbara, aquí está su ficha.
              </p>
              <button
                className="btn solido ancho"
                onClick={() => navega(`/acceso/agentes-ia/${yaExiste.id}`)}
              >
                Ver ficha de {yaExiste.negocio}
              </button>
            </>
          ) : paso === "elegir" ? (
            <>
              <p className="parrafo" style={{ color: "var(--texto-2)" }}>
                Elige cómo agregar al cliente. No se puede seguir sin elegir
                una de las dos.
              </p>
              <button className="btn ancho" onClick={irAVincular} style={{ justifyContent: "flex-start", padding: "14px 16px" }}>
                {Ico.buscar({ t: 16 })}
                <div style={{ textAlign: "left", marginLeft: 4 }}>
                  <b style={{ display: "block" }}>Vincular cliente existente</b>
                  <small style={{ color: "var(--texto-3)" }}>
                    Busca en la cartera de clientes del CRM.
                  </small>
                </div>
              </button>
              <button
                className="btn ancho"
                onClick={() => setPaso("crear")}
                style={{ justifyContent: "flex-start", padding: "14px 16px" }}
              >
                {Ico.mas({ t: 16 })}
                <div style={{ textAlign: "left", marginLeft: 4 }}>
                  <b style={{ display: "block" }}>Crear cliente desde cero</b>
                  <small style={{ color: "var(--texto-3)" }}>
                    Crea el cliente y su ficha de Bárbara juntos.
                  </small>
                </div>
              </button>
            </>
          ) : paso === "vincular" ? (
            <>
              <div className="mini-busca">
                {Ico.buscar({ t: 15 })}
                <input
                  autoFocus
                  placeholder="Buscar negocio o correo…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              {cargandoLista ? (
                <p className="vacio">Cargando clientes…</p>
              ) : (
                <div className="lista-sel" style={{ maxHeight: 320 }}>
                  {visibles.length === 0 && (
                    <p className="vacio">Ningún cliente calza con esa búsqueda.</p>
                  )}
                  {visibles.map((c) => (
                    <button
                      key={c.id}
                      className="fila-sel"
                      style={{ width: "100%", border: 0, background: "none", textAlign: "left" }}
                      onClick={() => vincular(c)}
                      disabled={vinculando}
                    >
                      <span>
                        <b>{c.negocio || "—"}</b>
                        <small>{c.email}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={crearDesdeCero} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <label className="campo-lbl">
                Negocio
                <input
                  className="campo"
                  value={negocio}
                  onChange={(e) => setNegocio(e.target.value)}
                  placeholder="Nombre del negocio"
                />
              </label>
              <label className="campo-lbl">
                Correo
                <input
                  className="campo"
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                <small>Con este correo el cliente inicia sesión en el portal.</small>
              </label>
              <button className="btn solido ancho" disabled={creando}>
                {creando ? "Creando…" : "Crear y agregar a Bárbara"}
              </button>
            </form>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          {(paso === "vincular" || paso === "crear") && !yaExiste && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPaso("elegir");
                setError("");
              }}
            >
              {Ico.volver({ t: 14 })} Volver
            </button>
          )}
          <button type="button" className="btn" onClick={cerrar}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
