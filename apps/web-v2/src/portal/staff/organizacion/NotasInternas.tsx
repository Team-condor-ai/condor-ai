import { useEffect, useMemo, useRef, useState } from "react";
import { sb, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import type { Cliente, DatosCuentaInterna, NotaInterna } from "../tipos";

type TipoInfo = "nota" | "cuenta";
const SIN_CLIENTE = "— sin cliente asignado —";

function pesar(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function nombreCliente(c: Cliente) { return c.negocio || c.nombre || c.email || "Cliente sin nombre"; }

/** Información operativa: notas, cuentas y archivos vinculables a un cliente. */
export function NotasInternas() {
  const confirmar = useConfirmacion();
  const [items, setItems] = useState<NotaInterna[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | TipoInfo>("todos");
  const [editando, setEditando] = useState<NotaInterna | "nota" | "cuenta" | null>(null);

  async function cargar() {
    setCargando(true);
    const [info, cartera] = await Promise.all([
      sb.from("notas_internas").select("*").order("actualizado_en", { ascending: false }),
      sb.from("clientes").select("id,nombre,negocio,email").order("negocio"),
    ]);
    if (info.error) setError("Falta aplicar la migración de Información interna: " + info.error.message);
    else setError("");
    setItems((info.data ?? []) as NotaInterna[]);
    setClientes((cartera.data ?? []) as Cliente[]);
    setCargando(false);
  }
  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);

  const clientesPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const visibles = items.filter((item) => {
    if (filtro !== "todos" && item.tipo !== filtro) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const cuenta = item.datos_cuenta;
    const cliente = item.cliente_id ? clientesPorId.get(item.cliente_id) : null;
    return [item.titulo, item.contenido, item.categoria, cuenta?.entidad, cuenta?.titular, cuenta?.usuario, cuenta?.url, cliente && nombreCliente(cliente)]
      .some((valor) => valor?.toLowerCase().includes(q));
  });

  async function borrar(item: NotaInterna) {
    if (!await confirmar(`¿Borrar "${item.titulo}"?`, "Esta información y su vínculo al cliente se eliminarán. El archivo subido se conserva en el repositorio.", "Borrar")) return;
    const { error: fallo } = await sb.from("notas_internas").delete().eq("id", item.id);
    if (fallo) setError(fallo.message); else setItems((previos) => previos.filter((x) => x.id !== item.id));
  }

  return <>
    <section className="bloque" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}><h3 style={{ margin: 0 }}>Información interna</h3><p className="conteo" style={{ margin: "3px 0 0" }}>Notas, cuentas, accesos y archivos del equipo; opcionalmente vinculados a un cliente.</p></div>
        <button className="btn" onClick={() => setEditando("nota")}>{Ico.mas({ t: 14 })} Nueva nota</button>
        <button className="btn solido" onClick={() => setEditando("cuenta")}>{Ico.mas({ t: 14 })} Guardar cuenta</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <input className="campo" style={{ maxWidth: 300 }} placeholder="Buscar información o cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="chips">{([ ["todos", "Todo"], ["nota", "Notas"], ["cuenta", "Cuentas"] ] as const).map(([id, texto]) => <button key={id} className={"chip" + (filtro === id ? " on" : "")} onClick={() => setFiltro(id)}>{texto}</button>)}</div>
      </div>
    </section>
    {error && <p className="error">{error}</p>}
    {cargando ? <p className="vacio">Cargando…</p> : visibles.length === 0 ? <p className="vacio">{items.length === 0 ? "Todavía no hay información guardada. Parte por una nota o una cuenta." : "Nada calza con la búsqueda."}</p> : (
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {visibles.map((item) => {
          const cuenta = item.datos_cuenta; const cliente = item.cliente_id ? clientesPorId.get(item.cliente_id) : null; const esCuenta = item.tipo === "cuenta";
          return <article key={item.id} className="bloque" style={{ margin: 0, cursor: "pointer" }} onClick={() => setEditando(item)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className={"pill " + (esCuenta ? "info" : "gris")}>{esCuenta ? "Cuenta" : "Nota"}</span>{cliente && <span className="pill gris">{nombreCliente(cliente)}</span>}</div><button className="icono-btn peligro" title="Borrar" onClick={(e) => { e.stopPropagation(); void borrar(item); }}>{Ico.eliminar({ t: 14 })}</button></div>
            <h3 style={{ margin: "10px 0 4px" }}>{item.titulo}</h3>
            {esCuenta && (cuenta?.entidad || cuenta?.usuario) && <p className="conteo" style={{ margin: 0 }}>{[cuenta?.entidad, cuenta?.usuario].filter(Boolean).join(" · ")}</p>}
            {item.contenido && <p className="tenue" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{item.contenido}</p>}
            {item.archivo_url && <a href={item.archivo_url} target="_blank" rel="noreferrer" className="conteo" style={{ display: "inline-flex", gap: 4, marginTop: 9 }} onClick={(e) => e.stopPropagation()}>{Ico.documentos({ t: 13 })} {item.archivo_nombre || "Archivo"}{item.archivo_peso_bytes ? ` · ${pesar(item.archivo_peso_bytes)}` : ""}</a>}
            <p className="conteo" style={{ margin: "9px 0 0" }}>Actualizado {fecha(item.actualizado_en)}</p>
          </article>;
        })}
      </div>
    )}
    {editando && <EditorInformacion nota={typeof editando === "object" ? editando : null} tipoInicial={editando === "cuenta" ? "cuenta" : "nota"} clientes={clientes} cerrar={() => setEditando(null)} guardado={() => { setEditando(null); void cargar(); }} />}
  </>;
}

function EditorInformacion({ nota, tipoInicial, clientes, cerrar, guardado }: { nota: NotaInterna | null; tipoInicial: TipoInfo; clientes: Cliente[]; cerrar: () => void; guardado: () => void }) {
  const [tipo, setTipo] = useState<TipoInfo>(nota?.tipo ?? tipoInicial);
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [clienteId, setClienteId] = useState(nota?.cliente_id ?? "");
  const [contenido, setContenido] = useState(nota?.contenido ?? "");
  const [datosCuenta, setDatosCuenta] = useState<DatosCuentaInterna>(nota?.datos_cuenta ?? {});
  const [archivoUrl, setArchivoUrl] = useState(nota?.archivo_url ?? "");
  const [archivoNombre, setArchivoNombre] = useState(nota?.archivo_nombre ?? "");
  const [archivoPeso, setArchivoPeso] = useState(nota?.archivo_peso_bytes ?? null);
  const [mostrarClave, setMostrarClave] = useState(false);
  const [subiendo, setSubiendo] = useState(false); const [guardando, setGuardando] = useState(false); const [error, setError] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);
  const cambiarDato = (campo: keyof DatosCuentaInterna, valor: string) => setDatosCuenta((actual) => ({ ...actual, [campo]: valor }));

  async function subirArchivo(files: FileList | null) {
    const archivo = files?.[0]; if (!archivo) return;
    setSubiendo(true); setError("");
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const ruta = `informacion-interna/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpio}`;
    const { error: fallo } = await sb.storage.from("biblioteca").upload(ruta, archivo, { upsert: false, contentType: archivo.type || undefined });
    if (fallo) { setError(/bucket not found/i.test(fallo.message) ? "Falta crear el bucket `biblioteca` en Supabase Storage." : fallo.message); setSubiendo(false); return; }
    const { data } = sb.storage.from("biblioteca").getPublicUrl(ruta); setArchivoUrl(data.publicUrl); setArchivoNombre(archivo.name); setArchivoPeso(archivo.size); setSubiendo(false);
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (!titulo.trim()) { setError(tipo === "cuenta" ? "Identifica la cuenta o servicio." : "Ponle un título."); return; }
    setGuardando(true); setError("");
    const campos = { titulo: titulo.trim(), tipo, categoria: tipo === "cuenta" ? "Cuenta" : "Nota", cliente_id: clienteId || null, contenido: contenido.trim() || null, datos_cuenta: tipo === "cuenta" ? datosCuenta : null, archivo_url: archivoUrl || null, archivo_nombre: archivoNombre || null, archivo_peso_bytes: archivoPeso, actualizado_en: new Date().toISOString() };
    const { error: fallo } = nota ? await sb.from("notas_internas").update(campos).eq("id", nota.id) : await sb.from("notas_internas").insert(campos);
    setGuardando(false); if (fallo) setError(fallo.message); else guardado();
  }
  return <div className="velo" onClick={cerrar}><form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
    <header><h2>{nota ? "Editar información" : tipo === "cuenta" ? "Guardar cuenta" : "Nueva nota"}</h2><small>{tipo === "cuenta" ? "Datos de acceso y contexto operativo" : "Contexto que el equipo necesita encontrar rápido"}</small></header>
    <div className="contenido">
      <label className="campo-lbl">Tipo<select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInfo)}><option value="nota">Nota</option><option value="cuenta">Cuenta o acceso</option></select></label>
      <label className="campo-lbl">Cliente <span style={{ fontWeight: 400, opacity: .7 }}>· opcional</span><select className="campo" value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">{SIN_CLIENTE}</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{nombreCliente(cliente)}</option>)}</select></label>
      <label className="campo-lbl">{tipo === "cuenta" ? "Nombre de la cuenta o servicio" : "Título"}<input className="campo" autoFocus required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "cuenta" ? "Ej: Meta Business · Colombia" : "Ej: Preferencias de campaña de agosto"} /></label>
      {tipo === "cuenta" && <><div className="dos"><label className="campo-lbl">Entidad o plataforma<input className="campo" value={datosCuenta.entidad ?? ""} onChange={(e) => cambiarDato("entidad", e.target.value)} placeholder="Ej: Meta, banco, hosting…" /></label><label className="campo-lbl">Titular<input className="campo" value={datosCuenta.titular ?? ""} onChange={(e) => cambiarDato("titular", e.target.value)} placeholder="Empresa o persona" /></label></div><div className="dos"><label className="campo-lbl">Usuario o correo<input className="campo" value={datosCuenta.usuario ?? ""} onChange={(e) => cambiarDato("usuario", e.target.value)} /></label><label className="campo-lbl">Clave<div style={{ display: "flex", gap: 6 }}><input className="campo" type={mostrarClave ? "text" : "password"} autoComplete="new-password" value={datosCuenta.clave ?? ""} onChange={(e) => cambiarDato("clave", e.target.value)} /><button type="button" className="btn chico" onClick={() => setMostrarClave((visible) => !visible)}>{mostrarClave ? "Ocultar" : "Ver"}</button></div></label></div><label className="campo-lbl">URL de acceso<input className="campo" type="url" value={datosCuenta.url ?? ""} onChange={(e) => cambiarDato("url", e.target.value)} placeholder="https://…" /></label></>}
      <label className="campo-lbl">{tipo === "cuenta" ? "Notas de uso" : "Contenido"}<textarea className="campo" rows={tipo === "cuenta" ? 4 : 6} value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Detalles, instrucciones o contexto relevante." /></label>
      <label className="campo-lbl">Archivo adjunto <span style={{ fontWeight: 400, opacity: .7 }}>· opcional, PDF o documento</span><input ref={archivoRef} className="campo" type="file" accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => void subirArchivo(e.target.files)} disabled={subiendo} />{subiendo && <small>Subiendo…</small>}{archivoUrl && !subiendo && <small>{archivoNombre} · <a href={archivoUrl} target="_blank" rel="noreferrer">ver</a> · <button type="button" className="btn chico" onClick={() => { setArchivoUrl(""); setArchivoNombre(""); setArchivoPeso(null); if (archivoRef.current) archivoRef.current.value = ""; }}>quitar</button></small>}</label>
      {error && <p className="error">{error}</p>}
    </div>
    <footer><button type="button" className="btn" onClick={cerrar}>Cancelar</button><button className="btn solido" disabled={guardando || subiendo}>{guardando ? "Guardando…" : "Guardar"}</button></footer>
  </form></div>;
}
