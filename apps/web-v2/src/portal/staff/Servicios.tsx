import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";

type Estado = "activa" | "revisar" | "desactivar" | "cancelada";
type Servicio = { id: string; nombre: string; proveedor: string | null; categoria: string; uso: string | null; costo: number | null; moneda: string; ciclo: "mensual" | "anual" | "uso" | "gratis"; renovacion: string | null; estado: Estado; necesario: "si" | "quizas" | "no"; responsable: string | null; url: string | null; notas: string | null };

const ESTADOS: { id: Estado; texto: string }[] = [
  { id: "activa", texto: "Activa" }, { id: "revisar", texto: "Revisar" }, { id: "desactivar", texto: "Desactivar" }, { id: "cancelada", texto: "Cancelada" },
];
const CATEGORIAS: Record<string, string> = { infraestructura: "Infraestructura", dominios: "Dominios y DNS", comunicacion: "Comunicación", pagos: "Pagos", crm: "CRM", ia: "Inteligencia artificial", marketing: "Marketing", reuniones: "Reuniones", clientes: "De clientes", otros: "Otros" };
const COLORES = ["#014CFD", "#7A3CFF", "#0A8FE0", "#E5602B", "#147A42", "#C77A00", "#D6336C", "#0F766E"];
const color = (s: string) => COLORES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
const mensual = (s: Servicio) => (s.costo == null || s.ciclo === "gratis" || s.ciclo === "uso" ? 0 : s.ciclo === "anual" ? s.costo / 12 : s.costo);
const plata = (n: number, m: string) => (m === "CLP" ? "$" + Math.round(n).toLocaleString("es-CL") : `US$${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })}`);

/**
 * Todo lo que Cóndor paga o usa, en un solo lugar (24-oct-2026), para ir apagando lo que ya no sirve.
 * Lo cargué desde lo que hay en la configuración del portal, SIN costos: se completan a mano. «Estado» dice qué hacer con cada uno.
 */
export function Servicios() {
  const confirmar = useConfirmacion();
  const [filas, setFilas] = useState<Servicio[]>([]);
  const [filtro, setFiltro] = useState<Estado | "todas">("todas");
  const [editando, setEditando] = useState<Servicio | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    const { data, error: e } = await sb.from("servicios_condor").select("*").order("nombre");
    if (e) setError("No se pudo cargar: " + e.message); else setError("");
    setFilas((data ?? []) as Servicio[]); setCargando(false);
  }
  useEffect(() => { void cargar(); }, []);

  const visibles = filas.filter((s) => filtro === "todas" || s.estado === filtro);
  const resumen = useMemo(() => {
    const vivos = filas.filter((s) => s.estado === "activa" || s.estado === "revisar" || s.estado === "desactivar");
    const usd = vivos.filter((s) => s.moneda === "USD").reduce((a, s) => a + mensual(s), 0);
    const clp = vivos.filter((s) => s.moneda === "CLP").reduce((a, s) => a + mensual(s), 0);
    const ahorro = filas.filter((s) => s.estado === "desactivar");
    return { usd, clp, sinCosto: vivos.filter((s) => s.costo == null && s.ciclo !== "gratis").length, apagar: ahorro.length, ahorroUsd: ahorro.filter((s) => s.moneda === "USD").reduce((a, s) => a + mensual(s), 0), ahorroClp: ahorro.filter((s) => s.moneda === "CLP").reduce((a, s) => a + mensual(s), 0) };
  }, [filas]);
  const grupos = Object.keys(CATEGORIAS).map((c) => ({ id: c, items: visibles.filter((s) => s.categoria === c) })).filter((g) => g.items.length);

  async function cambiarEstado(s: Servicio, estado: Estado) {
    setFilas((l) => l.map((x) => (x.id === s.id ? { ...x, estado } : x)));
    const { error: e } = await sb.from("servicios_condor").update({ estado, actualizado_en: new Date().toISOString() }).eq("id", s.id);
    if (e) { setError(e.message); void cargar(); }
  }
  async function borrar(s: Servicio) {
    if (!(await confirmar(`Quitar «${s.nombre}» de la lista`, "Solo se borra el registro; no cancela nada en el proveedor.", "Quitar"))) return;
    const { error: e } = await sb.from("servicios_condor").delete().eq("id", s.id);
    if (e) setError(e.message); else { setEditando(null); void cargar(); }
  }

  if (cargando) return <p className="vacio">Cargando…</p>;
  return (
    <div>
      <div className="srv-resumen">
        <div><span>Gasto mensual conocido</span><b>{resumen.usd || resumen.clp ? [resumen.usd ? plata(resumen.usd, "USD") : "", resumen.clp ? plata(resumen.clp, "CLP") : ""].filter(Boolean).join(" + ") : "Sin costos aún"}</b><small>{resumen.sinCosto} servicio{resumen.sinCosto === 1 ? "" : "s"} sin costo cargado</small></div>
        <div className={resumen.apagar ? "alerta" : ""}><span>Para desactivar</span><b>{resumen.apagar}</b><small>{resumen.ahorroUsd || resumen.ahorroClp ? `Ahorro ≈ ${[resumen.ahorroUsd ? plata(resumen.ahorroUsd, "USD") : "", resumen.ahorroClp ? plata(resumen.ahorroClp, "CLP") : ""].filter(Boolean).join(" + ")} al mes` : "Carga sus costos para ver el ahorro"}</small></div>
        <div><span>Por revisar</span><b>{filas.filter((s) => s.estado === "revisar").length}</b><small>Decidir si Cóndor los necesita</small></div>
        <div><span>Activas</span><b>{filas.filter((s) => s.estado === "activa").length}</b><small>Las que sostienen el servicio</small></div>
      </div>

      <div className="srv-barra">
        <div className="lead-chips">
          <button className={filtro === "todas" ? "on" : ""} onClick={() => setFiltro("todas")}>Todas · {filas.length}</button>
          {ESTADOS.map((e) => <button key={e.id} className={filtro === e.id ? "on" : ""} onClick={() => setFiltro(e.id)}>{e.texto} · {filas.filter((s) => s.estado === e.id).length}</button>)}
        </div>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>{Ico.mas({ t: 15 })} Agregar servicio</button>
      </div>
      {error && <p className="aviso-error" role="alert">{error}</p>}

      {grupos.map((g) => (
        <section key={g.id} className="srv-grupo">
          <h3>{CATEGORIAS[g.id]}</h3>
          <ul>
            {g.items.map((s) => (
              <li key={s.id} className={`srv-fila e-${s.estado}`}>
                <span className="srv-av" style={{ background: color(s.nombre) }} aria-hidden="true">{s.nombre.slice(0, 2).toUpperCase()}</span>
                <div className="srv-info"><b>{s.nombre}</b><small>{s.uso}</small>{s.notas && <em>{s.notas}</em>}</div>
                <div className="srv-costo">{s.ciclo === "gratis" ? "Gratis" : s.costo != null ? <>{plata(s.costo, s.moneda)}<small>/{s.ciclo === "anual" ? "año" : s.ciclo === "uso" ? "uso" : "mes"}</small></> : <span className="srv-sin">Sin costo</span>}</div>
                <select className={`srv-estado e-${s.estado}`} value={s.estado} onChange={(e) => cambiarEstado(s, e.target.value as Estado)} aria-label={`Estado de ${s.nombre}`}>{ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}</select>
                <div className="srv-acc">
                  {s.url && <a className="icono-btn" href={s.url} target="_blank" rel="noreferrer" title="Abrir el panel del proveedor">{Ico.abrirWeb({ t: 15 })}</a>}
                  <button className="icono-btn" onClick={() => setEditando(s)} title="Editar">{Ico.editar({ t: 15 })}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editando && <FormServicio s={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); void cargar(); }} onBorrar={editando !== "nuevo" ? () => borrar(editando) : undefined} />}
    </div>
  );
}

function FormServicio({ s, onCerrar, onListo, onBorrar }: { s: Servicio | null; onCerrar: () => void; onListo: () => void; onBorrar?: () => void }) {
  const [f, setF] = useState({ nombre: s?.nombre ?? "", proveedor: s?.proveedor ?? "", categoria: s?.categoria ?? "otros", uso: s?.uso ?? "", costo: s?.costo?.toString() ?? "", moneda: s?.moneda ?? "USD", ciclo: s?.ciclo ?? "mensual", renovacion: s?.renovacion ?? "", estado: s?.estado ?? "revisar", necesario: s?.necesario ?? "quizas", responsable: s?.responsable ?? "", url: s?.url ?? "", notas: s?.notas ?? "" });
  const [error, setError] = useState("");
  useEffect(() => { const t = (e: KeyboardEvent) => e.key === "Escape" && onCerrar(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onCerrar]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) { setError("Ponle un nombre."); return; }
    const datos = { nombre: f.nombre.trim(), proveedor: f.proveedor.trim() || null, categoria: f.categoria, uso: f.uso.trim() || null, costo: f.costo ? Number(f.costo.replace(",", ".")) : null, moneda: f.moneda, ciclo: f.ciclo, renovacion: f.renovacion || null, estado: f.estado, necesario: f.necesario, responsable: f.responsable.trim() || null, url: f.url.trim() || null, notas: f.notas.trim() || null, actualizado_en: new Date().toISOString() };
    const r = s ? await sb.from("servicios_condor").update(datos).eq("id", s.id) : await sb.from("servicios_condor").insert(datos);
    if (r.error) setError(r.error.message); else onListo();
  }
  return (
    <div className="bg-fondo" style={{ alignItems: "center", paddingTop: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="bg-caja cur-modal" style={{ maxWidth: 600, overflowY: "auto" }} onSubmit={guardar} role="dialog" aria-modal="true">
        <h3>{s ? "Editar servicio" : "Agregar servicio"}</h3>
        <div className="ficha-rejilla">
          <label style={{ gridColumn: "1 / -1" }}>Nombre<input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus /></label>
          <label>Proveedor<input value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} /></label>
          <label>Categoría<select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label style={{ gridColumn: "1 / -1" }}>Para qué sirve<input value={f.uso} onChange={(e) => set("uso", e.target.value)} /></label>
          <label>Costo<input inputMode="decimal" value={f.costo} onChange={(e) => set("costo", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" /></label>
          <label>Moneda<select value={f.moneda} onChange={(e) => set("moneda", e.target.value)}><option>USD</option><option>CLP</option></select></label>
          <label>Se paga<select value={f.ciclo} onChange={(e) => set("ciclo", e.target.value)}><option value="mensual">Cada mes</option><option value="anual">Cada año</option><option value="uso">Por uso</option><option value="gratis">Es gratis</option></select></label>
          <label>Renueva el<input type="date" value={f.renovacion} onChange={(e) => set("renovacion", e.target.value)} /></label>
          <label>Qué hacer<select value={f.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></label>
          <label>¿Lo necesita Cóndor?<select value={f.necesario} onChange={(e) => set("necesario", e.target.value)}><option value="si">Sí</option><option value="quizas">Quizás</option><option value="no">No</option></select></label>
          <label>Quién lo lleva<input value={f.responsable} onChange={(e) => set("responsable", e.target.value)} /></label>
          <label>Enlace al panel<input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></label>
          <label style={{ gridColumn: "1 / -1" }}>Notas<textarea rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></label>
        </div>
        {error && <p className="aviso-error">{error}</p>}
        <div className="cur-form-pie" style={{ marginTop: 14 }}>{onBorrar && <button type="button" className="btn" style={{ marginRight: "auto" }} onClick={onBorrar}>Quitar</button>}<button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button className="btn solido">Guardar</button></div>
      </form>
    </div>
  );
}
