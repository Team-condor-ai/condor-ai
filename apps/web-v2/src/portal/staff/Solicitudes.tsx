import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useEquipo } from "./personas";

type Estado = "nueva" | "en_curso" | "lista";
export type Solicitud = {
  id: string; cliente_id: string; titulo: string; detalle: string | null; estado: Estado;
  respuesta: string | null; responsable: string | null;
  creado_en: string; en_curso_en: string | null; lista_en: string | null;
};

const COLUMNAS: { id: Estado; texto: string; ayuda: string }[] = [
  { id: "nueva", texto: "Nuevas", ayuda: "El cliente la pidió y nadie la ha tomado" },
  { id: "en_curso", texto: "En curso", ayuda: "Alguien del equipo la está haciendo" },
  { id: "lista", texto: "Listas", ayuda: "Hechas en los últimos 30 días" },
];

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
const dias = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86400000);

/**
 * Pedidos de los clientes («Pedir un cambio»), con estado de verdad (24-oct-2026, pedido de Max).
 * Tres columnas: nuevas → en curso → listas. Cada pedido tiene responsable y una respuesta que el cliente
 * lee en su portal. Las fechas de cada cambio de estado las pone la base (trigger `solicitudes_fechas`).
 * Con `clienteId` muestra solo las de ese cliente (pestaña «Solicitudes» de su ficha).
 */
export function TableroSolicitudes({ clienteId, compacto }: { clienteId?: string; compacto?: boolean }) {
  const equipo = useEquipo();
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
    let q = sb.from("solicitudes").select("*").or(`estado.neq.lista,lista_en.gte.${hace30}`).order("creado_en", { ascending: false });
    if (clienteId) q = sb.from("solicitudes").select("*").eq("cliente_id", clienteId).order("creado_en", { ascending: false });
    const [{ data, error: e }, { data: cl }] = await Promise.all([q, sb.from("clientes").select("id,negocio,nombre")]);
    setError(e ? "No se pudieron cargar: " + e.message : "");
    setLista((data ?? []) as Solicitud[]);
    setClientes(Object.fromEntries((cl ?? []).map((c: { id: string; negocio: string | null; nombre: string | null }) => [c.id, c.negocio || c.nombre || "Cliente"])));
  }, [clienteId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiar(s: Solicitud, cambios: Partial<Solicitud>) {
    setLista((l) => l?.map((x) => (x.id === s.id ? { ...x, ...cambios } : x)) ?? null);
    const { error: e } = await sb.from("solicitudes").update(cambios).eq("id", s.id);
    if (e) { setError("No se pudo guardar: " + e.message); void cargar(); }
    else if ("estado" in cambios) void cargar();
  }

  const porColumna = useMemo(() => Object.fromEntries(COLUMNAS.map((c) => [c.id, (lista ?? []).filter((s) => s.estado === c.id)])) as Record<Estado, Solicitud[]>, [lista]);

  if (lista === null) return <p className="vacio">Cargando…</p>;
  if (clienteId && lista.length === 0) return <p className="vacio-linea">Este cliente todavía no ha pedido cambios.</p>;

  return (
    <>
      {error && <p className="aviso-error">{error}</p>}
      <div className={`sol-tablero${compacto ? " compacto" : ""}`}>
        {COLUMNAS.map((col) => (
          <section key={col.id} className={`sol-col ${col.id}`}>
            <header><b>{col.texto}</b><span>{porColumna[col.id].length}</span></header>
            <p className="sol-ayuda">{col.ayuda}</p>
            {porColumna[col.id].length === 0 && <p className="sol-vacia">Nada por acá.</p>}
            {porColumna[col.id].map((s) => {
              const abierto = abierta === s.id;
              const espera = s.estado === "nueva" ? dias(s.creado_en) : 0;
              return (
                <article key={s.id} className={`sol-tarjeta${abierto ? " abierta" : ""}${espera >= 2 ? " atrasada" : ""}`}>
                  <button className="sol-cab" onClick={() => setAbierta(abierto ? null : s.id)} aria-expanded={abierto}>
                    <b>{s.titulo}</b>
                    <small>
                      {!clienteId && <>{clientes[s.cliente_id] ?? "Cliente"} · </>}
                      {s.estado === "lista" && s.lista_en ? `lista el ${fecha(s.lista_en)}` : `pedida el ${fecha(s.creado_en)}`}
                      {espera >= 2 && <em> · {espera} días esperando</em>}
                    </small>
                    {s.responsable && <span className="sol-resp">{s.responsable}</span>}
                  </button>
                  {abierto && (
                    <div className="sol-cuerpo">
                      {s.detalle && <p className="sol-detalle">{s.detalle}</p>}
                      <label className="campo-lbl">Quién la toma
                        <select className="campo" value={s.responsable ?? ""} onChange={(e) => void cambiar(s, { responsable: e.target.value || null })}>
                          <option value="">Nadie todavía</option>
                          {equipo.map((p) => <option key={p.email} value={p.nombre}>{p.nombre}</option>)}
                        </select>
                      </label>
                      <label className="campo-lbl">Respuesta al cliente <small>(la lee en su portal)</small>
                        <textarea className="campo" rows={3} defaultValue={s.respuesta ?? ""} placeholder="Ej.: Listo, ya cambiamos el horario en tu sitio."
                          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== s.respuesta) void cambiar(s, { respuesta: v }); }} />
                      </label>
                      <div className="sol-acciones">
                        {s.estado !== "nueva" && <button className="btn chico" onClick={() => void cambiar(s, { estado: s.estado === "lista" ? "en_curso" : "nueva" })}>← {s.estado === "lista" ? "Volver a en curso" : "Volver a nueva"}</button>}
                        {s.estado !== "lista" && <button className="btn chico solido" onClick={() => void cambiar(s, { estado: s.estado === "nueva" ? "en_curso" : "lista" })}>{s.estado === "nueva" ? "Empezar" : "Marcar lista"} →</button>}
                        {!clienteId && <Link className="btn chico" to={`/acceso/clientes?ver=${s.cliente_id}`}>{Ico.clientes({ t: 13 })} Ver cliente</Link>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

export function PaginaSolicitudes() {
  return (
    <>
      <div className="barra"><h1>Solicitudes de clientes</h1></div>
      <div className="cuerpo"><TableroSolicitudes /></div>
    </>
  );
}
