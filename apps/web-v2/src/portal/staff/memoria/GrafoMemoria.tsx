import { useEffect, useMemo, useState } from "react";
import { sb, fecha } from "../../lib/supabase";
import { TIPO_NODO_MEMORIA, type BarbaraMemoriaNodo } from "../../agentes-ia/tipos";

/**
 * El grafo de memoria de un cliente, estilo Obsidian.
 *
 * POR QUÉ UN LAYOUT RADIAL A MANO Y NO UNA LIBRERÍA DE FÍSICA
 * ---------------------------------------------------------------------------
 * Obsidian usa un grafo de fuerzas (los nodos se repelen y los links los
 * acercan). Para esto no hace falta esa simulación: con 5 categorías fijas
 * alrededor de un centro y sus hojas en abanico, la trigonometría a mano da
 * un resultado igual de legible, sin la inestabilidad de una física corriendo
 * en el navegador ni una dependencia nueva que mantener.
 *
 * DE DÓNDE SALE CADA NODO
 * ---------------------------------------------------------------------------
 * Tres fuentes reales, no una tabla sola:
 * - `barbara_reglas` → nodos "corrección" (lo que YA existía y funciona).
 * - `barbara_memoria_nodos` → "gusto" / "dato" / "perfil" (nuevo).
 * - `barbara_patrones` con `activo=true` → "patrón global" (de TODOS los
 *   clientes, filtrado a los que de verdad influyen en la generación —
 *   mostrar los apagados sería mostrar algo que no está pasando).
 */
type Regla = { id: string; regla: string; categoria: string | null; veces_reforzada: number; activa: boolean };
type Patron = { id: string; patron: string; tipo: string | null; muestras: number };
type Propuesta = {
  id: string; accion: "crear" | "actualizar" | "conflicto"; tipo: "gusto" | "dato" | "perfil";
  titulo: string; contenido: string; confianza: number; evidencia: string | null;
  razon: string | null; estado: "pendiente" | "aprobada" | "rechazada" | "expirada"; creado_en: string;
};

type Nodo = {
  id: string;
  tipo: keyof typeof TIPO_NODO_MEMORIA;
  titulo: string;
  contenido: string;
  peso: number;
  activo: boolean;
  meta?: string;
};

const CATEGORIAS: { tipo: keyof typeof TIPO_NODO_MEMORIA; angulo: number }[] = [
  { tipo: "correccion", angulo: -90 },
  { tipo: "gusto", angulo: -18 },
  { tipo: "dato", angulo: 54 },
  { tipo: "perfil", angulo: 126 },
  { tipo: "patron", angulo: 198 },
];

const CX = 460, CY = 300, R_HUB = 175, R_HOJA = 105;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function GrafoMemoria({ barbaraClienteId, negocio }: { barbaraClienteId: string; negocio: string }) {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [nodos, setNodos] = useState<BarbaraMemoriaNodo[]>([]);
  const [patrones, setPatrones] = useState<Patron[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState<Nodo | null>(null);
  const [creando, setCreando] = useState<"gusto" | "dato" | null>(null);
  const [editando, setEditando] = useState<Nodo | null>(null);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [sintetizando, setSintetizando] = useState(false);

  async function cargar() {
    setCargando(true);
    const [r1, r2, r3, r4] = await Promise.all([
      sb.from("barbara_reglas").select("id, regla, categoria, veces_reforzada, activa")
        .eq("barbara_cliente_id", barbaraClienteId),
      sb.from("barbara_memoria_nodos").select("*").eq("barbara_cliente_id", barbaraClienteId),
      sb.from("barbara_patrones").select("id, patron, tipo, muestras").eq("activo", true),
      sb.from("barbara_memoria_propuestas")
        .select("id,accion,tipo,titulo,contenido,confianza,evidencia,razon,estado,creado_en")
        .eq("barbara_cliente_id", barbaraClienteId).eq("estado", "pendiente")
        .order("creado_en", { ascending: false }),
    ]);
    const err = r1.error || r2.error || r3.error || r4.error;
    if (err) setError(err.message);
    else {
      setReglas((r1.data ?? []) as Regla[]);
      setNodos((r2.data ?? []) as BarbaraMemoriaNodo[]);
      setPatrones((r3.data ?? []) as Patron[]);
      setPropuestas((r4.data ?? []) as Propuesta[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    setSeleccionado(null);
    cargar();
  }, [barbaraClienteId]);

  // Las 3 fuentes se funden en una sola lista de nodos por categoría — el
  // grafo no sabe ni le importa de qué tabla vino cada uno.
  const porTipo = useMemo(() => {
    const m: Record<string, Nodo[]> = { correccion: [], gusto: [], dato: [], perfil: [], patron: [] };
    for (const r of reglas) {
      m.correccion.push({
        id: r.id, tipo: "correccion", titulo: r.regla.slice(0, 40), contenido: r.regla,
        peso: r.veces_reforzada, activo: r.activa,
        meta: r.categoria ? `categoría: ${r.categoria}` : undefined,
      });
    }
    for (const n of nodos) {
      m[n.tipo].push({
        id: n.id, tipo: n.tipo, titulo: n.titulo, contenido: n.contenido,
        peso: n.peso, activo: n.activo, meta: n.origen || undefined,
      });
    }
    for (const p of patrones) {
      m.patron.push({
        id: p.id, tipo: "patron", titulo: p.patron.slice(0, 40), contenido: p.patron,
        peso: p.muestras, activo: true, meta: p.tipo ? `tipo: ${p.tipo}` : undefined,
      });
    }
    return m;
  }, [reglas, nodos, patrones]);

  const totalNodos = reglas.length + nodos.length + patrones.length;
  const perfilNodo = nodos.find((n) => n.tipo === "perfil");

  async function alternarActivo(n: Nodo) {
    const { error } = n.tipo === "correccion"
      ? await sb.rpc("barbara_establecer_regla_activa", { p_regla_id: n.id, p_activa: !n.activo })
      : await sb.rpc("barbara_establecer_nodo_activo", { p_nodo_id: n.id, p_activo: !n.activo });
    if (error) { setError(error.message); return; }
    setSeleccionado(null);
    cargar();
  }

  async function crearNodo(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    const contenido = String(form.get("contenido") || "").trim();
    const tipo = editando?.tipo === "gusto" || editando?.tipo === "dato" ? editando.tipo : creando;
    if (!titulo || !contenido || !tipo) return;
    const { error } = await sb.rpc("barbara_guardar_nodo", {
      p_barbara_cliente_id: barbaraClienteId,
      p_tipo: tipo,
      p_titulo: titulo,
      p_contenido: contenido,
      p_nodo_id: editando?.id || null,
    });
    if (error) { setError(error.message); return; }
    setCreando(null);
    setEditando(null);
    setSeleccionado(null);
    cargar();
  }

  async function resolverPropuesta(id: string, aprobar: boolean) {
    setResolviendo(id);
    setError("");
    const { error } = await sb.rpc("barbara_resolver_propuesta", {
      p_propuesta_id: id, p_aprobar: aprobar,
    });
    setResolviendo(null);
    if (error) { setError(error.message); return; }
    cargar();
  }

  async function sintetizarPerfil() {
    setSintetizando(true);
    setError("");
    const { data, error } = await sb.functions.invoke("barbara-sintetizar-perfil", {
      body: { barbara_cliente_id: barbaraClienteId },
    });
    setSintetizando(false);
    if (error) {
      const msg = (data as { error?: string } | null)?.error || error.message;
      setError(msg);
      return;
    }
    cargar();
  }

  if (cargando) return <p className="tenue">Cargando memoria…</p>;

  return (
    <div className="grafo-envoltorio">
      <div className="grafo-caja">
        <svg viewBox="0 0 920 600" className="grafo-svg">
          {/* Líneas del centro a cada categoría */}
          {CATEGORIAS.map(({ tipo, angulo }) => {
            const hx = CX + R_HUB * Math.cos(rad(angulo));
            const hy = CY + R_HUB * Math.sin(rad(angulo));
            return <line key={"l-" + tipo} x1={CX} y1={CY} x2={hx} y2={hy} className="grafo-linea-hub" />;
          })}

          {/* Hojas: una por nodo, en abanico alrededor de su categoría */}
          {CATEGORIAS.map(({ tipo, angulo }) => {
            const items = porTipo[tipo];
            const hx = CX + R_HUB * Math.cos(rad(angulo));
            const hy = CY + R_HUB * Math.sin(rad(angulo));
            const info = TIPO_NODO_MEMORIA[tipo];
            const arco = Math.min(70, 16 * Math.max(items.length - 1, 1));
            return items.map((n, i) => {
              const off = items.length > 1 ? -arco / 2 + (arco * i) / (items.length - 1) : 0;
              const a = angulo + off;
              const lx = hx + R_HOJA * Math.cos(rad(a));
              const ly = hy + R_HOJA * Math.sin(rad(a));
              const radio = Math.min(22, 8 + n.peso * 2.5);
              const activo = seleccionado?.id === n.id;
              return (
                <g key={n.id}>
                  <line x1={hx} y1={hy} x2={lx} y2={ly}
                    className={"grafo-linea-hoja" + (activo ? " on" : "")} />
                  <circle cx={lx} cy={ly} r={radio}
                    fill={info.color} opacity={n.activo ? (activo ? 1 : 0.82) : 0.28}
                    className="grafo-nodo" stroke={activo ? "var(--panel)" : "none"} strokeWidth={2.5}
                    onClick={() => setSeleccionado(n)} />
                </g>
              );
            });
          })}

          {/* Los 5 hubs de categoría */}
          {CATEGORIAS.map(({ tipo, angulo }) => {
            const hx = CX + R_HUB * Math.cos(rad(angulo));
            const hy = CY + R_HUB * Math.sin(rad(angulo));
            const info = TIPO_NODO_MEMORIA[tipo];
            const n = porTipo[tipo].length;
            return (
              <g key={"h-" + tipo}>
                <circle cx={hx} cy={hy} r={26} fill="none" stroke={info.color} strokeWidth={2} opacity={0.9} />
                <text x={hx} y={hy - 34} textAnchor="middle" className="grafo-etiqueta-hub" fill={info.color}>
                  {info.nombre}{n ? ` (${n})` : ""}
                </text>
              </g>
            );
          })}

          {/* El centro: el cliente */}
          <circle cx={CX} cy={CY} r={40} className="grafo-nodo-centro" />
          <text x={CX} y={CY + 5} textAnchor="middle" className="grafo-etiqueta-centro">
            {negocio.length > 16 ? negocio.slice(0, 15) + "…" : negocio}
          </text>
        </svg>

        {!totalNodos && (
          <p className="vacio grafo-vacio">
            Sin memoria todavía — se llena sola con las correcciones que lleguen
            por Telegram, o agrégala a mano abajo.
          </p>
        )}
      </div>

      <aside className="grafo-panel">
        {error && <p className="error">{error}</p>}

        {propuestas.length > 0 && (
          <div className="grafo-propuestas">
            <b>{propuestas.length} recuerdo{propuestas.length === 1 ? "" : "s"} por confirmar</b>
            <p className="tenue">Bárbara los detectó en el chat, pero todavía no influyen en tus piezas.</p>
            {propuestas.slice(0, 5).map((p) => (
              <div className="grafo-propuesta" key={p.id}>
                <small>{TIPO_NODO_MEMORIA[p.tipo].nombre} · {Math.round(p.confianza * 100)}% confianza</small>
                <strong>{p.titulo}</strong>
                <span>{p.contenido}</span>
                {p.evidencia && <em>“{p.evidencia}”</em>}
                <div>
                  <button className="btn solido chico" disabled={resolviendo === p.id}
                    onClick={() => resolverPropuesta(p.id, true)}>Confirmar</button>
                  <button className="btn chico" disabled={resolviendo === p.id}
                    onClick={() => resolverPropuesta(p.id, false)}>Descartar</button>
                </div>
              </div>
            ))}
            <hr className="grafo-sep" />
          </div>
        )}

        {seleccionado ? (
          <div className="grafo-detalle">
            <span className="pill" style={{
              background: TIPO_NODO_MEMORIA[seleccionado.tipo].color + "22",
              color: TIPO_NODO_MEMORIA[seleccionado.tipo].color,
              borderColor: TIPO_NODO_MEMORIA[seleccionado.tipo].color + "55",
            }}>
              {TIPO_NODO_MEMORIA[seleccionado.tipo].nombre}
            </span>
            <p className="grafo-detalle-texto">{seleccionado.contenido}</p>
            {seleccionado.meta && <p className="tenue">{seleccionado.meta}</p>}
            {seleccionado.peso > 1 && (
              <p className="tenue">Reforzado {seleccionado.peso} veces.</p>
            )}
            {seleccionado.tipo !== "patron" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn chico" onClick={() => alternarActivo(seleccionado)}>
                  {seleccionado.activo ? "Apagar" : "Encender"}
                </button>
                {(seleccionado.tipo === "gusto" || seleccionado.tipo === "dato") && (
                  <button className="btn chico" onClick={() => { setEditando(seleccionado); setCreando(null); }}>
                    Editar
                  </button>
                )}
              </div>
            )}
            {seleccionado.tipo === "patron" && (
              <p className="tenue">Patrón global — se gobierna desde Agentes IA → Memoria global.</p>
            )}
          </div>
        ) : (
          <p className="tenue">Toca un nodo para ver el detalle.</p>
        )}

        <hr className="grafo-sep" />

        <div className="grafo-acciones">
          <button className="btn chico" onClick={() => setCreando("gusto")}>+ Gusto</button>
          <button className="btn chico" onClick={() => setCreando("dato")}>+ Dato</button>
          <button className="btn chico" onClick={sintetizarPerfil} disabled={sintetizando}>
            {sintetizando ? "Sintetizando…" : perfilNodo ? "Actualizar perfil" : "Sintetizar perfil"}
          </button>
        </div>
        {perfilNodo && (
          <p className="tenue" style={{ marginTop: 6 }}>
            Perfil actualizado {fecha(perfilNodo.actualizado_en)}.
          </p>
        )}

        {(creando || editando) && (
          <form className="grafo-form" onSubmit={crearNodo} key={editando?.id || creando || "form"}>
            <label className="campo-lbl">
              {(editando?.tipo || creando) === "gusto" ? "Gusto" : "Dato"}
              <input className="campo" name="titulo" placeholder="Título corto" required autoFocus
                defaultValue={editando?.titulo || ""} />
            </label>
            <label className="campo-lbl">
              Detalle
              <textarea className="campo" name="contenido" rows={3} required defaultValue={editando?.contenido || ""} />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn solido chico" type="submit">{editando ? "Guardar cambios" : "Guardar"}</button>
              <button className="btn chico" type="button" onClick={() => { setCreando(null); setEditando(null); }}>Cancelar</button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
