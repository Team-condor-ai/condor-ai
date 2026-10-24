import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";

type Carpeta = { id: string; nombre: string; padre_id: string | null; orden: number };
type Clave = { id: string; carpeta_id: string | null; titulo: string; usuario: string | null; url: string | null; notas: string | null; tipo: "cuenta" | "api" | "nota" | "archivo"; actualizado_en: string; actualizado_por: string | null; archivo_url: string | null; archivo_nombre: string | null; peso_bytes: number | null; mime: string | null; cliente_id: string | null };
type ClienteMini = { id: string; negocio: string | null; nombre: string | null };
type Acceso = { quien: string; creado_en: string };

const COLS = "id,carpeta_id,titulo,usuario,url,notas,tipo,actualizado_en,actualizado_por,archivo_url,archivo_nombre,peso_bytes,mime,cliente_id";
const tamano = (n: number | null) => (!n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SEGUNDOS_VISIBLE = 20;

function generar(largo = 20) {
  const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#$%&*+-?";
  const b = new Uint32Array(largo); crypto.getRandomValues(b);
  return Array.from(b, (n) => a[n % a.length]).join("");
}

const iniciales = (t: string) => (t.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("") || "?").toUpperCase();
const COLORES = ["#014CFD", "#7A3CFF", "#0A8FE0", "#E5602B", "#147A42", "#C77A00", "#D6336C", "#0F766E"];
const color = (s: string) => COLORES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];

/**
 * Bóveda del equipo (24-oct-2026): passwords y archivos juntos (reemplaza a Biblioteca).
 * Carpetas a la izquierda, claves a la derecha. La contraseña NUNCA viaja en el listado: la base solo la entrega
 * por `revelar_clave(id)`, que deja anotado quién la pidió (se ve en la ficha de cada clave). Al revelarla se
 * oculta sola a los 20 segundos. «Old Condor Passwords» guarda lo que había en el Centro operativo y en Claves/API.
 */
export function Claves({ modo, embebido }: { modo?: "passwords" | "archivos"; embebido?: boolean } = {}) {
  const yo = useSesion().email;
  const confirmar = useConfirmacion();
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [claves, setClaves] = useState<Clave[]>([]);
  const [sel, setSel] = useState<string | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<Clave | "nueva" | null>(null);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [params] = useSearchParams();
  const clienteFiltro = params.get("cliente");
  useEffect(() => { const q = params.get("q"); if (q) setBusca(q); }, [params]);

  async function cargar() {
    const [c, k] = await Promise.all([
      sb.from("claves_carpetas").select("*").order("orden").order("nombre"),
      sb.from("claves").select(COLS).order("titulo"),
    ]);
    if (c.error || k.error) setError("No se pudo cargar: " + (c.error ?? k.error)!.message);
    else setError("");
    setCarpetas((c.data ?? []) as Carpeta[]);
    setClaves((k.data ?? []) as Clave[]);
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, []);

  const hijos = (p: string | null) => carpetas.filter((c) => c.padre_id === p);
  const idsDe = (id: string): string[] => [id, ...hijos(id).flatMap((h) => idsDe(h.id))];
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = claves;
    if (modo === "archivos") l = l.filter((k) => k.tipo === "archivo");
    if (modo === "passwords") l = l.filter((k) => k.tipo !== "archivo");
    if (clienteFiltro) l = l.filter((k) => k.cliente_id === clienteFiltro);
    if (sel !== "todas") { const ids = new Set(idsDe(sel)); l = l.filter((k) => k.carpeta_id && ids.has(k.carpeta_id)); }
    if (q) l = claves.filter((k) => [k.titulo, k.usuario, k.url, k.notas].some((v) => (v ?? "").toLowerCase().includes(q)));
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claves, carpetas, sel, busca, clienteFiltro, modo]);

  const cuenta = (id: string) => claves.filter((k) => idsDe(id).includes(k.carpeta_id ?? "")).length;
  const nombreCarpeta = (id: string | null) => carpetas.find((c) => c.id === id)?.nombre ?? "Sin carpeta";

  async function nuevaCarpeta(padre: string | null) {
    const nombre = window.prompt(padre ? "Nombre de la subcarpeta" : "Nombre de la carpeta");
    if (!nombre?.trim()) return;
    const { error: e } = await sb.from("claves_carpetas").insert({ nombre: nombre.trim(), padre_id: padre });
    if (e) setError("No se pudo crear la carpeta: " + e.message); else void cargar();
  }
  async function borrarCarpeta(c: Carpeta) {
    if (!(await confirmar(`Borrar la carpeta «${c.nombre}»`, "Se borran también sus subcarpetas. Las claves que contenga quedan sin carpeta (no se pierden).", "Borrar"))) return;
    const { error: e } = await sb.from("claves_carpetas").delete().eq("id", c.id);
    if (e) setError("No se pudo borrar: " + e.message); else { if (sel === c.id) setSel("todas"); void cargar(); }
  }

  const arbol = (padre: string | null, nivel = 0): React.ReactNode =>
    hijos(padre).map((c) => (
      <div key={c.id}>
        <div className={`cl-carpeta${sel === c.id ? " on" : ""}`} style={{ paddingLeft: 10 + nivel * 16 }}>
          <button className="cl-carpeta-btn" onClick={() => { setSel(c.id); setAbiertas((a) => ({ ...a, [c.id]: true })); }}>
            <span className="cl-ico" aria-hidden="true">{hijos(c.id).length ? (abiertas[c.id] ? "▾" : "▸") : "·"}</span>
            <span className="cl-nom">{c.nombre}</span><small>{cuenta(c.id)}</small>
          </button>
          <span className="cl-carpeta-acc">
            <button title="Subcarpeta" onClick={() => nuevaCarpeta(c.id)}>＋</button>
            <button title="Borrar carpeta" onClick={() => borrarCarpeta(c)}>×</button>
          </span>
        </div>
        {abiertas[c.id] && arbol(c.id, nivel + 1)}
      </div>
    ));

  return (
    <>
      {embebido ? (
        <div className="cur-barra"><button className="btn solido" onClick={() => setEditando("nueva")}>{Ico.mas({ t: 15 })} {modo === "archivos" ? "Subir archivo" : "Nueva clave"}</button></div>
      ) : (
        <div className="barra">
          <h1>Bóveda</h1>
          <button className="btn solido" onClick={() => setEditando("nueva")}>{Ico.mas({ t: 15 })} Agregar</button>
        </div>
      )}
      <div className={embebido ? undefined : "cuerpo"}>
        {error && <p className="aviso-error" role="alert">{error}</p>}
        <div className="cl-layout">
          <nav className="cl-lateral" aria-label="Carpetas">
            <button className={`cl-carpeta-btn todas${sel === "todas" ? " on" : ""}`} onClick={() => setSel("todas")}>
              <span className="cl-ico">{Ico.candado({ t: 14 })}</span><span className="cl-nom">Todo</span><small>{claves.length}</small>
            </button>
            <div className="cl-arbol">{arbol(null)}</div>
            <button className="btn chico cl-nueva-carpeta" onClick={() => nuevaCarpeta(null)}>＋ Carpeta</button>
          </nav>

          <section className="cl-principal">
            <label className="lead-busca">{Ico.buscar({ t: 15 })}<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar en todas las carpetas" /></label>
            {clienteFiltro && <p className="aviso-filtro">Mostrando solo lo de un cliente · <a href="/acceso/claves">ver todo</a></p>}
            <p className="rotulo-mini" style={{ margin: "14px 4px 10px" }}>{busca ? "Resultados" : sel === "todas" ? "Todo" : nombreCarpeta(sel)} · {visibles.length}</p>
            {cargando ? <p className="vacio">Cargando…</p> : visibles.length === 0 ? (
              <div className="cl-vacio"><b>Aquí no hay claves todavía</b><span>Guarda la primera clave o sube un archivo con «Agregar».</span></div>
            ) : (
              <ul className="cl-lista">
                {visibles.map((k) => <FilaClave key={k.id} k={k} carpeta={nombreCarpeta(k.carpeta_id)} mostrarCarpeta={sel === "todas" || !!busca} onEditar={() => setEditando(k)} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
      {editando && (
        <FormClave clave={editando === "nueva" ? null : editando} tipoInicial={modo === "archivos" ? "archivo" : "cuenta"} carpetas={carpetas} carpetaInicial={sel === "todas" ? null : sel} yo={yo} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); void cargar(); }} onBorrado={() => { setEditando(null); void cargar(); }} />
      )}
    </>
  );
}

function FilaClave({ k, carpeta, mostrarCarpeta, onEditar }: { k: Clave; carpeta: string; mostrarCarpeta: boolean; onEditar: () => void }) {
  const [valor, setValor] = useState<string | null>(null);
  const [resto, setResto] = useState(0);
  const [aviso, setAviso] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  async function obtener(): Promise<string | null> {
    const { data, error } = await sb.rpc("revelar_clave", { p_id: k.id });
    if (error) { setAviso("No se pudo revelar"); return null; }
    return (data as string | null) ?? "";
  }
  async function alternar() {
    if (valor !== null) { setValor(null); if (timer.current) window.clearInterval(timer.current); return; }
    const v = await obtener(); if (v === null) return;
    setValor(v); setResto(SEGUNDOS_VISIBLE);
    timer.current = window.setInterval(() => setResto((r) => { if (r <= 1) { setValor(null); if (timer.current) window.clearInterval(timer.current); return 0; } return r - 1; }), 1000);
  }
  async function descargar() {
    if (!k.archivo_url) return;
    const { data, error } = await sb.storage.from("boveda").createSignedUrl(k.archivo_url, 90, { download: k.archivo_nombre ?? true });
    if (error || !data) { setAviso("No se pudo descargar"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function copiar(que: "clave" | "usuario") {
    const texto = que === "usuario" ? k.usuario ?? "" : valor ?? (await obtener()) ?? "";
    if (!texto) { setAviso(que === "usuario" ? "Sin usuario" : "Sin clave"); return; }
    try { await navigator.clipboard.writeText(texto); setAviso(que === "usuario" ? "Usuario copiado" : "Clave copiada · se borra del portapapeles en 30 s"); } catch { setAviso("No se pudo copiar"); }
    if (que === "clave") window.setTimeout(() => navigator.clipboard.writeText(" ").catch(() => undefined), 30000);
    window.setTimeout(() => setAviso(""), 2600);
  }

  return (
    <li className="cl-fila">
      <span className="cl-av" style={{ background: color(k.titulo) }} aria-hidden="true">{iniciales(k.titulo)}</span>
      <div className="cl-info">
        <b>{k.titulo}</b>
        <small>{k.tipo === "archivo" ? "Archivo" : k.usuario || "Sin usuario"}{mostrarCarpeta ? ` · ${carpeta}` : ""}{k.tipo === "api" ? " · API" : ""}</small>
      </div>
      {k.tipo === "archivo" ? <code className="cl-valor archivo">{k.archivo_nombre ?? "archivo"} · {tamano(k.peso_bytes)}</code> : <code className={`cl-valor${valor !== null ? " visible" : ""}`}>{valor !== null ? (valor || "—") : "••••••••••"}{valor !== null && <i style={{ width: `${(resto / SEGUNDOS_VISIBLE) * 100}%` }} />}</code>}
      <div className="cl-acc">
        {aviso && <span className="cl-aviso">{aviso}</span>}
        {k.tipo === "archivo" && <button className="icono-btn" title="Descargar" onClick={descargar}>{Ico.descargar({ t: 15 })}</button>}
        {k.tipo !== "archivo" && k.usuario && <button className="icono-btn" title="Copiar usuario" onClick={() => copiar("usuario")}>{Ico.clientes({ t: 15 })}</button>}
        {k.tipo !== "archivo" && <button className="icono-btn" title={valor !== null ? "Ocultar" : "Mostrar clave"} onClick={alternar}>{Ico.candado({ t: 15 })}</button>}
        {k.tipo !== "archivo" && <button className="icono-btn" title="Copiar clave" onClick={() => copiar("clave")}>{Ico.documentos({ t: 15 })}</button>}
        {k.url && <a className="icono-btn" title="Abrir sitio" href={k.url.startsWith("http") ? k.url : `https://${k.url}`} target="_blank" rel="noreferrer">{Ico.abrirWeb({ t: 15 })}</a>}
        <button className="icono-btn" title="Editar" onClick={onEditar}>{Ico.editar({ t: 15 })}</button>
      </div>
    </li>
  );
}

function FormClave({ clave, tipoInicial, carpetas, carpetaInicial, yo, onCerrar, onGuardado, onBorrado }: { clave: Clave | null; tipoInicial: Clave["tipo"]; carpetas: Carpeta[]; carpetaInicial: string | null; yo: string | null; onCerrar: () => void; onGuardado: () => void; onBorrado: () => void }) {
  const confirmar = useConfirmacion();
  const [f, setF] = useState({ titulo: clave?.titulo ?? "", usuario: clave?.usuario ?? "", clave: "", url: clave?.url ?? "", notas: clave?.notas ?? "", carpeta_id: clave?.carpeta_id ?? carpetaInicial ?? "", tipo: clave?.tipo ?? tipoInicial, cliente_id: clave?.cliente_id ?? "" });
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  useEffect(() => { void sb.from("clientes").select("id,negocio,nombre").eq("archivado", false).order("negocio").then(({ data }) => setClientes((data ?? []) as ClienteMini[])); }, []);

  useEffect(() => {
    if (!clave) return;
    void sb.from("claves_accesos").select("quien,creado_en").eq("clave_id", clave.id).order("creado_en", { ascending: false }).limit(5).then(({ data }) => setAccesos((data ?? []) as Acceso[]));
  }, [clave]);
  useEffect(() => { const t = (e: KeyboardEvent) => e.key === "Escape" && onCerrar(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onCerrar]);

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.titulo.trim()) { setError("Ponle un nombre."); return; }
    setGuardando(true);
    const base = { titulo: f.titulo.trim(), usuario: f.usuario.trim() || null, url: f.url.trim() || null, notas: f.notas.trim() || null, carpeta_id: f.carpeta_id || null, tipo: f.tipo, actualizado_por: yo };
    const cambios: Record<string, unknown> = { ...base, cliente_id: f.cliente_id || null };
    if (f.clave && f.tipo !== "archivo") cambios.clave = f.clave;
    if (f.tipo === "archivo" && archivo) {
      const ruta = `${crypto.randomUUID()}/${archivo.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: eSubir } = await sb.storage.from("boveda").upload(ruta, archivo, { contentType: archivo.type || undefined });
      if (eSubir) { setGuardando(false); setError("No se pudo subir el archivo: " + eSubir.message); return; }
      Object.assign(cambios, { archivo_url: ruta, archivo_nombre: archivo.name, peso_bytes: archivo.size, mime: archivo.type || null });
    } else if (f.tipo === "archivo" && !clave?.archivo_url) { setGuardando(false); setError("Elige el archivo que quieres guardar."); return; }
    const r = clave
      ? await sb.from("claves").update({ ...cambios, actualizado_en: new Date().toISOString() }).eq("id", clave.id)
      : await sb.from("claves").insert({ ...cambios, creado_por: yo });
    setGuardando(false);
    if (r.error) setError("No se pudo guardar: " + r.error.message); else onGuardado();
  }
  async function borrar() {
    if (!clave || !(await confirmar(`Borrar «${clave.titulo}»`, "Se elimina para siempre.", "Borrar"))) return;
    const { error: e } = await sb.from("claves").delete().eq("id", clave.id);
    if (e) setError("No se pudo borrar: " + e.message); else onBorrado();
  }
  const raices = (p: string | null, n = 0): { id: string; texto: string }[] =>
    carpetas.filter((c) => c.padre_id === p).flatMap((c) => [{ id: c.id, texto: "— ".repeat(n) + c.nombre }, ...raices(c.id, n + 1)]);

  return (
    <div className="ficha-lead-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="ficha-lead" onSubmit={guardar} role="dialog" aria-modal="true" aria-label={clave ? "Editar clave" : "Nueva clave"}>
        <header className="ficha-lead-cab">
          <div><p className="rotulo-mini">{clave ? "Editar clave" : "Nueva clave"}</p><h2>{f.titulo || "Sin nombre"}</h2></div>
          <button type="button" className="icono-btn" onClick={onCerrar} aria-label="Cerrar">{Ico.cerrar({ t: 16 })}</button>
        </header>
        <div className="ficha-lead-cuerpo">
          <div className="ficha-rejilla">
            <label style={{ gridColumn: "1 / -1" }}>Nombre<input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej.: Hostinger, cuenta de Meta…" autoFocus /></label>
            <label>Usuario o correo<input value={f.usuario} onChange={(e) => set("usuario", e.target.value)} autoComplete="off" /></label>
            <label>Carpeta<select value={f.carpeta_id} onChange={(e) => set("carpeta_id", e.target.value)}><option value="">Sin carpeta</option>{raices(null).map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}</select></label>
            {f.tipo === "archivo" ? (
              <label style={{ gridColumn: "1 / -1" }}>Archivo{clave?.archivo_nombre ? ` (actual: ${clave.archivo_nombre})` : ""}
                <input type="file" onChange={(e) => { const a = e.target.files?.[0] ?? null; setArchivo(a); if (a && !f.titulo) set("titulo", a.name); }} />
              </label>
            ) : (
            <label style={{ gridColumn: "1 / -1" }}>{clave ? "Nueva clave (déjala vacía para no cambiarla)" : "Clave"}
              <div className="cl-clave-campo">
                <input type={ver ? "text" : "password"} value={f.clave} onChange={(e) => set("clave", e.target.value)} autoComplete="new-password" placeholder={clave ? "••••••••••" : ""} />
                <button type="button" className="btn chico" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar" : "Ver"}</button>
                <button type="button" className="btn chico" onClick={() => { set("clave", generar()); setVer(true); }}>Generar</button>
              </div>
            </label>)}
            <label>Sitio<input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></label>
            <label>Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="cuenta">Cuenta</option><option value="api">API key</option><option value="nota">Nota segura</option><option value="archivo">Archivo</option></select></label>
            <label>Cliente<select value={f.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}><option value="">Ninguno</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.negocio || c.nombre}</option>)}</select></label>
            <label style={{ gridColumn: "1 / -1" }}>Notas<textarea rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Titular, plan, a quién pertenece…" /></label>
          </div>
          {clave && (
            <section className="ficha-grupo">
              <h3>Últimos accesos a la clave</h3>
              {accesos.length === 0 ? <p className="vacio-linea">Nadie la ha revelado todavía.</p> : (
                <ul className="cl-accesos">{accesos.map((a, i) => <li key={i}><b>{a.quien}</b><small>{new Date(a.creado_en).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></li>)}</ul>
              )}
            </section>
          )}
        </div>
        <footer className="ficha-lead-pie">
          {error && <p className="aviso-error" role="alert">{error}</p>}
          {clave && <button type="button" className="btn" onClick={borrar} style={{ marginRight: "auto" }}>Borrar</button>}
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn solido" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </footer>
      </form>
    </div>
  );
}
