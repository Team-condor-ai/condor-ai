import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { useSesion } from "../../auth/sesion";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion, usePedirTexto } from "../../disenio/Confirmacion";
import { FichaItem } from "./FichaItem";
import { FilaClave } from "./FilaClave";
import { TarjetaArchivo } from "./TarjetaArchivo";
import { type Carpeta, type Item, type Seccion, COLS_ITEM, guardarPref, leerPref, subirArchivo } from "./tipos";

/**
 * Explorador de la Bóveda (24-oct-2026): passwords y archivos, cada uno con SUS carpetas.
 * Funciona como el Finder: árbol a la izquierda (se agranda arrastrando el borde, se oculta y se abre),
 * migas de pan arriba, subcarpetas como tarjetas y el contenido abajo. Se arrastra una clave o un archivo
 * sobre una carpeta (del árbol, de las tarjetas o de las migas) para moverlo; en Archivos se sueltan
 * archivos del computador directo en la ventana para subirlos a la carpeta abierta.
 */
export function Explorador({ seccion }: { seccion: Seccion }) {
  const yo = useSesion().email;
  const confirmar = useConfirmacion();
  const pedirTexto = usePedirTexto();
  const [params, setParams] = useSearchParams();
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState(params.get("q") ?? "");
  const [editando, setEditando] = useState<Item | "nuevo" | null>(null);
  const [arbol, setArbol] = useState(() => leerPref(`boveda:arbol:${seccion}`, true));
  const [ancho, setAncho] = useState(() => leerPref(`boveda:ancho:${seccion}`, 264));
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>(() => leerPref(`boveda:abiertas:${seccion}`, {}));
  const [sobre, setSobre] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ nombre: string; listo: boolean; error?: string }[]>([]);
  const [soltandoArchivos, setSoltandoArchivos] = useState(false);
  const entradaArchivos = useRef<HTMLInputElement>(null);

  const actual = params.get("carpeta");
  const clienteFiltro = params.get("cliente");
  const ir = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("carpeta", id); else p.delete("carpeta"); p.delete("q"); setParams(p, { replace: false }); setBusca(""); };

  const cargar = useCallback(async () => {
    const tipos = seccion === "archivos" ? ["archivo"] : ["cuenta", "api", "nota"];
    const [c, k] = await Promise.all([
      sb.from("claves_carpetas").select("*").eq("seccion", seccion).order("orden").order("nombre"),
      sb.from("claves").select(COLS_ITEM).in("tipo", tipos).order("titulo"),
    ]);
    if (c.error || k.error) setError("No se pudo cargar la Bóveda: " + (c.error ?? k.error)!.message); else setError("");
    setCarpetas((c.data ?? []) as Carpeta[]);
    setItems((k.data ?? []) as Item[]);
    setCargando(false);
  }, [seccion]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => guardarPref(`boveda:arbol:${seccion}`, arbol), [arbol, seccion]);
  useEffect(() => guardarPref(`boveda:ancho:${seccion}`, ancho), [ancho, seccion]);
  useEffect(() => guardarPref(`boveda:abiertas:${seccion}`, abiertas), [abiertas, seccion]);

  /* ── Estructura ── */
  const hijas = useCallback((p: string | null) => carpetas.filter((c) => c.padre_id === p), [carpetas]);
  const ruta = useMemo(() => {
    const out: Carpeta[] = []; let c = carpetas.find((x) => x.id === actual);
    while (c) { out.unshift(c); c = carpetas.find((x) => x.id === c!.padre_id); }
    return out;
  }, [carpetas, actual]);
  useEffect(() => { if (ruta.length) setAbiertas((a) => ({ ...a, ...Object.fromEntries(ruta.map((r) => [r.id, true])) })); }, [ruta]);
  const descendientes = useCallback((id: string): string[] => [id, ...hijas(id).flatMap((h) => descendientes(h.id))], [hijas]);
  const cuenta = (id: string) => { const ids = new Set(descendientes(id)); return items.filter((k) => k.carpeta_id && ids.has(k.carpeta_id)).length; };

  const q = busca.trim().toLowerCase();
  const enVista = useMemo(() => {
    let l = items;
    if (clienteFiltro) l = l.filter((k) => k.cliente_id === clienteFiltro);
    if (q) return l.filter((k) => [k.titulo, k.usuario, k.url, k.notas, k.archivo_nombre].some((v) => (v ?? "").toLowerCase().includes(q)));
    if (clienteFiltro) return l;
    return l.filter((k) => (k.carpeta_id ?? null) === actual);
  }, [items, q, actual, clienteFiltro]);
  const subcarpetas = q || clienteFiltro ? [] : hijas(actual);
  const rutaDe = (id: string | null) => { const n: string[] = []; let c = carpetas.find((x) => x.id === id); while (c) { n.unshift(c.nombre); c = carpetas.find((x) => x.id === c!.padre_id); } return n.join(" › ") || "Sin carpeta"; };

  /* ── Acciones de carpetas ── */
  async function nuevaCarpeta(padre: string | null) {
    const nombre = await pedirTexto({ titulo: padre ? "Nueva subcarpeta" : "Nueva carpeta", detalle: padre ? `Dentro de «${rutaDe(padre)}».` : undefined, etiqueta: "Nombre", placeholder: seccion === "archivos" ? "Ej.: Contratos" : "Ej.: Hosting y dominios", accion: "Crear" });
    if (!nombre) return;
    const { error: e } = await sb.from("claves_carpetas").insert({ nombre, padre_id: padre, seccion });
    if (e) setError("No se pudo crear la carpeta: " + e.message); else { if (padre) setAbiertas((a) => ({ ...a, [padre]: true })); void cargar(); }
  }
  async function renombrar(c: Carpeta) {
    const nombre = await pedirTexto({ titulo: "Renombrar carpeta", etiqueta: "Nombre", valor: c.nombre, accion: "Guardar" });
    if (!nombre || nombre === c.nombre) return;
    const { error: e } = await sb.from("claves_carpetas").update({ nombre }).eq("id", c.id);
    if (e) setError(e.message); else void cargar();
  }
  async function borrarCarpeta(c: Carpeta) {
    const n = cuenta(c.id);
    if (!(await confirmar(`Borrar la carpeta «${c.nombre}»`, `Se borran también sus subcarpetas.${n ? ` Lo que tiene adentro (${n}) no se pierde: queda en «${c.padre_id ? rutaDe(c.padre_id) : "Todo"}».` : ""}`, "Borrar carpeta"))) return;
    if (n) await sb.from("claves").update({ carpeta_id: c.padre_id }).in("carpeta_id", descendientes(c.id));
    const { error: e } = await sb.from("claves_carpetas").delete().eq("id", c.id);
    if (e) setError(e.message); else { if (actual && descendientes(c.id).includes(actual)) ir(c.padre_id); void cargar(); }
  }

  /* ── Mover arrastrando ── */
  async function soltarEn(destino: string | null, ev: React.DragEvent) {
    ev.preventDefault(); setSobre(null);
    const dato = ev.dataTransfer.getData("text/x-boveda");
    if (!dato) return;
    const [tipo, id] = dato.split(":");
    if (tipo === "item") {
      setItems((l) => l.map((k) => (k.id === id ? { ...k, carpeta_id: destino } : k)));
      const { error: e } = await sb.from("claves").update({ carpeta_id: destino }).eq("id", id);
      if (e) { setError(e.message); void cargar(); }
    } else if (tipo === "carpeta" && id !== destino && !(destino && descendientes(id).includes(destino))) {
      setCarpetas((l) => l.map((c) => (c.id === id ? { ...c, padre_id: destino } : c)));
      const { error: e } = await sb.from("claves_carpetas").update({ padre_id: destino }).eq("id", id);
      if (e) { setError(e.message); void cargar(); }
    }
  }
  const zona = (destino: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("text/x-boveda")) { e.preventDefault(); setSobre(destino ?? "raiz"); } },
    onDragLeave: () => setSobre((s) => (s === (destino ?? "raiz") ? null : s)),
    onDrop: (e: React.DragEvent) => void soltarEn(destino, e),
  });

  /* ── Subir archivos ── */
  async function subir(lista: FileList | File[]) {
    const archivos = Array.from(lista); if (!archivos.length) return;
    setSubiendo(archivos.map((a) => ({ nombre: a.name, listo: false })));
    for (const [i, a] of archivos.entries()) {
      try { await subirArchivo(a, { carpeta_id: actual, creado_por: yo }); setSubiendo((s) => s.map((x, j) => (j === i ? { ...x, listo: true } : x))); }
      catch (e) { setSubiendo((s) => s.map((x, j) => (j === i ? { ...x, listo: true, error: e instanceof Error ? e.message : "falló" } : x))); }
    }
    void cargar();
    window.setTimeout(() => setSubiendo((s) => (s.every((x) => x.listo) ? [] : s)), 3500);
  }

  /* ── Redimensionar el árbol ── */
  function arrastrarBorde(e: React.PointerEvent) {
    const x0 = e.clientX, a0 = ancho;
    const mover = (ev: PointerEvent) => setAncho(Math.min(440, Math.max(190, a0 + ev.clientX - x0)));
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); document.body.style.cursor = ""; };
    window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar); document.body.style.cursor = "col-resize";
  }

  const nodo = (c: Carpeta, nivel: number): React.ReactNode => {
    const tiene = hijas(c.id).length > 0, abierta = !!abiertas[c.id];
    return (
      <li key={c.id}>
        <div className={`bv-nodo${actual === c.id ? " on" : ""}${sobre === c.id ? " sobre" : ""}`} style={{ paddingLeft: 6 + nivel * 14 }} {...zona(c.id)}
          draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-boveda", `carpeta:${c.id}`); e.dataTransfer.effectAllowed = "move"; }}>
          <button className={`bv-chev${abierta ? " abierta" : ""}`} style={{ visibility: tiene ? "visible" : "hidden" }} onClick={() => setAbiertas((a) => ({ ...a, [c.id]: !abierta }))} aria-label={abierta ? "Cerrar" : "Abrir"}>{Ico.galon({ t: 12 })}</button>
          <button className="bv-nom" onClick={() => ir(c.id)} title={c.nombre}><span className="bv-ico-carpeta" aria-hidden="true" />{c.nombre}<small>{cuenta(c.id) || ""}</small></button>
          <span className="bv-acc">
            <button title="Nueva subcarpeta" onClick={() => nuevaCarpeta(c.id)}>{Ico.mas({ t: 12 })}</button>
            <button title="Renombrar" onClick={() => renombrar(c)}>{Ico.editar({ t: 12 })}</button>
            <button title="Borrar" onClick={() => borrarCarpeta(c)}>{Ico.eliminar({ t: 12 })}</button>
          </span>
        </div>
        {tiene && abierta && <ul>{hijas(c.id).map((h) => nodo(h, nivel + 1))}</ul>}
      </li>
    );
  };

  const esArchivos = seccion === "archivos";
  return (
    <div className={`bv${arbol ? "" : " sin-arbol"}`} style={{ ["--bv-ancho" as string]: `${ancho}px` }}
      onDragOver={(e) => { if (esArchivos && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setSoltandoArchivos(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setSoltandoArchivos(false); }}
      onDrop={(e) => { if (esArchivos && e.dataTransfer.files.length) { e.preventDefault(); setSoltandoArchivos(false); void subir(e.dataTransfer.files); } }}>

      <div className="bv-barra">
        <button className="bv-toggle" onClick={() => setArbol(!arbol)} title={arbol ? "Ocultar carpetas" : "Mostrar carpetas"} aria-pressed={arbol}>{Ico.menu({ t: 16 })}</button>
        <nav className="bv-migas" aria-label="Ubicación">
          <button className={`${!actual ? "on" : ""}${sobre === "raiz" ? " sobre" : ""}`} onClick={() => ir(null)} {...zona(null)}>{esArchivos ? "Archivos" : "Passwords"}</button>
          {ruta.map((c) => <span key={c.id}><i aria-hidden="true">›</i><button className={`${actual === c.id ? "on" : ""}${sobre === c.id ? " sobre" : ""}`} onClick={() => ir(c.id)} {...zona(c.id)}>{c.nombre}</button></span>)}
        </nav>
        <label className="bv-busca">{Ico.buscar({ t: 15 })}<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={esArchivos ? "Buscar archivos" : "Buscar claves"} />{busca && <button onClick={() => setBusca("")} aria-label="Limpiar">{Ico.cerrar({ t: 12 })}</button>}</label>
        <button className="btn" onClick={() => nuevaCarpeta(actual)}>{Ico.carpetaMas({ t: 15 })} Carpeta</button>
        {esArchivos
          ? <><button className="btn solido" onClick={() => entradaArchivos.current?.click()}>{Ico.subir({ t: 15 })} Subir</button><input ref={entradaArchivos} type="file" multiple hidden onChange={(e) => { if (e.target.files) void subir(e.target.files); e.target.value = ""; }} /></>
          : <button className="btn solido" onClick={() => setEditando("nuevo")}>{Ico.mas({ t: 15 })} Nueva clave</button>}
      </div>

      {error && <p className="aviso-error" role="alert">{error}</p>}
      {clienteFiltro && <p className="aviso-filtro">Mostrando solo lo de un cliente · <button className="enlace-btn" onClick={() => { const p = new URLSearchParams(params); p.delete("cliente"); setParams(p); }}>ver todo</button></p>}

      <div className="bv-cuerpo">
        {arbol && (
          <div className="bv-arbol" role="navigation" aria-label="Carpetas">
            <div className={`bv-nodo raiz${!actual ? " on" : ""}${sobre === "raiz" ? " sobre" : ""}`} {...zona(null)}>
              <button className="bv-nom" onClick={() => ir(null)}>{Ico.candado({ t: 14 })}{esArchivos ? "Todos los archivos" : "Todas las claves"}<small>{items.length}</small></button>
            </div>
            <ul>{hijas(null).map((c) => nodo(c, 0))}</ul>
            <button className="bv-agregar" onClick={() => nuevaCarpeta(null)}>{Ico.mas({ t: 13 })} Nueva carpeta</button>
            <span className="bv-borde" onPointerDown={arrastrarBorde} role="separator" aria-orientation="vertical" aria-label="Cambiar ancho" title="Arrastra para cambiar el ancho" />
          </div>
        )}

        <section className="bv-principal">
          {cargando ? <p className="vacio">Cargando…</p> : (
            <>
              {subcarpetas.length > 0 && (
                <div className="bv-carpetas">
                  {subcarpetas.map((c) => (
                    <button key={c.id} className={`bv-carpeta${sobre === c.id ? " sobre" : ""}`} onClick={() => ir(c.id)} {...zona(c.id)}
                      draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-boveda", `carpeta:${c.id}`); }}>
                      <span className="bv-ico-carpeta grande" aria-hidden="true" />
                      <b>{c.nombre}</b><small>{(() => { const n = cuenta(c.id), h = hijas(c.id).length; return `${n} ${esArchivos ? (n === 1 ? "archivo" : "archivos") : n === 1 ? "clave" : "claves"}${h ? ` · ${h} carpeta${h === 1 ? "" : "s"}` : ""}`; })()}</small>
                    </button>
                  ))}
                </div>
              )}
              {(q || clienteFiltro) && <p className="rotulo-mini bv-rotulo">{enVista.length} resultado{enVista.length === 1 ? "" : "s"}</p>}
              {enVista.length === 0 && subcarpetas.length === 0 ? (
                <div className="bv-vacio">
                  <span className="bv-ico-carpeta grande" aria-hidden="true" />
                  <b>{q ? `Nada con «${busca}»` : "Esta carpeta está vacía"}</b>
                  <span>{q ? "Prueba con otra palabra." : esArchivos ? "Arrastra archivos aquí o usa «Subir»." : "Guarda una clave con «Nueva clave» o arrastra una desde otra carpeta."}</span>
                </div>
              ) : esArchivos ? (
                <div className="bv-archivos">{enVista.map((k) => <TarjetaArchivo key={k.id} k={k} ruta={q || clienteFiltro ? rutaDe(k.carpeta_id) : ""} onAbrir={() => setEditando(k)} />)}</div>
              ) : (
                <ul className="bv-claves">{enVista.map((k) => <FilaClave key={k.id} k={k} ruta={q || clienteFiltro ? rutaDe(k.carpeta_id) : ""} onEditar={() => setEditando(k)} />)}</ul>
              )}
            </>
          )}
        </section>
      </div>

      {soltandoArchivos && <div className="bv-soltar"><div>{Ico.subir({ t: 28 })}<b>Suelta para subir</b><span>a «{actual ? rutaDe(actual) : "Archivos"}»</span></div></div>}
      {subiendo.length > 0 && (
        <div className="bv-subidas" role="status">
          {subiendo.map((s, i) => <p key={i}><span className={s.error ? "mal" : s.listo ? "ok" : "va"} />{s.nombre}{s.error ? ` · ${s.error}` : ""}</p>)}
        </div>
      )}

      {editando && (
        <FichaItem seccion={seccion} item={editando === "nuevo" ? null : editando} carpetas={carpetas} carpetaInicial={actual} yo={yo}
          onCerrar={() => setEditando(null)} onCambio={() => { setEditando(null); void cargar(); }} />
      )}
    </div>
  );
}
