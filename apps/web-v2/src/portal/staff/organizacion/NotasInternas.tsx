import { useEffect, useMemo, useRef, useState } from "react";
import { sb, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import type { ArchivoInterno, Cliente, DatosCuentaInterna, NotaInterna } from "../tipos";

type TipoInfo = "nota" | "cuenta" | "archivo";
const SIN_CLIENTE = "— sin cliente asignado —";

function pesar(bytes: number | null | undefined) { if (!bytes) return ""; const mb = bytes / 1024 / 1024; return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function nombreCliente(c: Cliente) { return c.negocio || c.nombre || c.email || "Cliente sin nombre"; }
function esImagen(archivo: ArchivoInterno) { return archivo.tipo?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(archivo.nombre); }
function archivosDe(item: NotaInterna): ArchivoInterno[] { if (item.archivos?.length) return item.archivos.filter((archivo) => archivo?.url && archivo?.nombre); return item.archivo_url ? [{ url: item.archivo_url, nombre: item.archivo_nombre || "Archivo", peso_bytes: item.archivo_peso_bytes }] : []; }
const ETIQUETA: Record<TipoInfo, string> = { nota: "Nota", cuenta: "Cuenta", archivo: "Archivo" };

/** Notas, cuentas y archivos internos vinculables a clientes. */
export function NotasInternas() {
  const confirmar = useConfirmacion();
  const [items, setItems] = useState<NotaInterna[]>([]); const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true); const [error, setError] = useState(""); const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | TipoInfo>("todos"); const [editando, setEditando] = useState<NotaInterna | TipoInfo | null>(null);

  async function cargar() {
    setCargando(true);
    const [info, cartera] = await Promise.all([sb.from("notas_internas").select("*").order("actualizado_en", { ascending: false }), sb.from("clientes").select("id,nombre,negocio,email").order("negocio")]);
    if (info.error) setError("Falta aplicar la migración de Información interna: " + info.error.message); else setError("");
    setItems((info.data ?? []) as NotaInterna[]); setClientes((cartera.data ?? []) as Cliente[]); setCargando(false);
  }
  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);
  const clientesPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const visibles = items.filter((item) => {
    if (filtro !== "todos" && item.tipo !== filtro) return false;
    const q = busca.trim().toLowerCase(); if (!q) return true;
    const cuenta = item.datos_cuenta; const cliente = item.cliente_id ? clientesPorId.get(item.cliente_id) : null;
    return [item.titulo, item.contenido, item.categoria, cuenta?.entidad, cuenta?.titular, cuenta?.usuario, cuenta?.url, cliente && nombreCliente(cliente), ...archivosDe(item).map((archivo) => archivo.nombre)].some((valor) => valor?.toLowerCase().includes(q));
  });
  const conteos: Record<TipoInfo, number> = { nota: items.filter((item) => item.tipo === "nota").length, cuenta: items.filter((item) => item.tipo === "cuenta").length, archivo: items.filter((item) => item.tipo === "archivo").length };
  async function borrar(item: NotaInterna) {
    if (!await confirmar(`¿Borrar "${item.titulo}"?`, "Se eliminará la ficha de la plataforma. Los adjuntos del bucket se conservan.", "Borrar")) return;
    const { error: fallo } = await sb.from("notas_internas").delete().eq("id", item.id);
    if (fallo) setError(fallo.message); else setItems((previos) => previos.filter((x) => x.id !== item.id));
  }

  return <>
    <section className="bloque info-interna-cabecera">
      <div className="info-interna-titulo"><h3>Información interna</h3><p className="conteo">Todo lo que el equipo debe encontrar rápido: cuentas, notas, PDFs, fotos y contexto de clientes.</p></div>
      <div className="info-interna-acciones"><button className="btn" onClick={() => setEditando("nota")}>{Ico.mas({ t: 14 })} Nueva nota</button><button className="btn" onClick={() => setEditando("archivo")}>{Ico.mas({ t: 14 })} Subir PDF o foto</button><button className="btn solido" onClick={() => setEditando("cuenta")}>{Ico.mas({ t: 14 })} Guardar cuenta</button></div>
      <div className="info-interna-filtros"><div className="info-interna-pestanas" role="tablist" aria-label="Categorías de información interna">{([ ["todos", "Todo", items.length], ["cuenta", "Cuentas", conteos.cuenta], ["nota", "Notas", conteos.nota], ["archivo", "PDFs y fotos", conteos.archivo] ] as const).map(([id, texto, cantidad]) => <button key={id} type="button" role="tab" aria-selected={filtro === id} className={"info-interna-pestana" + (filtro === id ? " on" : "")} onClick={() => setFiltro(id)}>{texto}<small>{cantidad}</small></button>)}</div><input className="campo info-interna-buscador" placeholder="Buscar información o cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
    </section>
    {error && <p className="error">{error}</p>}
    {cargando ? <p className="vacio">Cargando…</p> : visibles.length === 0 ? <p className="vacio">{items.length === 0 ? "Todavía no hay información guardada. Parte por una nota, cuenta o archivo." : "Nada calza con la búsqueda."}</p> : <div className="info-interna-grid">{visibles.map((item) => {
      const cuenta = item.datos_cuenta; const cliente = item.cliente_id ? clientesPorId.get(item.cliente_id) : null; const archivos = archivosDe(item);
      return <article key={item.id} className="info-interna-tarjeta" onClick={() => setEditando(item)}>
        <div className="info-interna-tarjeta-cabecera"><div className="info-interna-meta"><span className={"pill " + (item.tipo === "cuenta" ? "info" : item.tipo === "archivo" ? "ok" : "gris")}>{ETIQUETA[item.tipo]}</span>{cliente && <span className="pill gris">{nombreCliente(cliente)}</span>}</div><button className="icono-btn peligro" title="Borrar" onClick={(e) => { e.stopPropagation(); void borrar(item); }}>{Ico.eliminar({ t: 14 })}</button></div>
        <h3>{item.titulo}</h3>{item.tipo === "cuenta" && (cuenta?.entidad || cuenta?.usuario) && <p className="conteo">{[cuenta?.entidad, cuenta?.usuario].filter(Boolean).join(" · ")}</p>}{item.contenido && <p className="info-interna-resumen">{item.contenido}</p>}
        {archivos.length > 0 && <div className="info-interna-adjuntos">{archivos.map((archivo) => esImagen(archivo) ? <a key={archivo.url} className="info-interna-imagen" href={archivo.url} target="_blank" rel="noreferrer" title={archivo.nombre} onClick={(e) => e.stopPropagation()}><img src={archivo.url} alt={archivo.nombre} /></a> : <a key={archivo.url} href={archivo.url} target="_blank" rel="noreferrer" className="info-interna-archivo" onClick={(e) => e.stopPropagation()}>{Ico.documentos({ t: 17 })}<span>{archivo.nombre}<small>{pesar(archivo.peso_bytes)}</small></span></a>)}</div>}
        <p className="conteo info-interna-fecha">Actualizado {fecha(item.actualizado_en)}</p>
      </article>;
    })}</div>}
    {editando && <EditorInformacion nota={typeof editando === "object" ? editando : null} tipoInicial={typeof editando === "string" ? editando : editando.tipo} clientes={clientes} cerrar={() => setEditando(null)} guardado={() => { setEditando(null); void cargar(); }} />}
  </>;
}

function EditorInformacion({ nota, tipoInicial, clientes, cerrar, guardado }: { nota: NotaInterna | null; tipoInicial: TipoInfo; clientes: Cliente[]; cerrar: () => void; guardado: () => void }) {
  const [tipo, setTipo] = useState<TipoInfo>(nota?.tipo ?? tipoInicial); const [titulo, setTitulo] = useState(nota?.titulo ?? ""); const [clienteId, setClienteId] = useState(nota?.cliente_id ?? ""); const [contenido, setContenido] = useState(nota?.contenido ?? ""); const [datosCuenta, setDatosCuenta] = useState<DatosCuentaInterna>(nota?.datos_cuenta ?? {}); const [archivos, setArchivos] = useState<ArchivoInterno[]>(nota ? archivosDe(nota) : []);
  const [mostrarClave, setMostrarClave] = useState(false); const [subiendo, setSubiendo] = useState(false); const [guardando, setGuardando] = useState(false); const [error, setError] = useState(""); const archivoRef = useRef<HTMLInputElement>(null);
  const cambiarDato = (campo: keyof DatosCuentaInterna, valor: string) => setDatosCuenta((actual) => ({ ...actual, [campo]: valor }));
  async function subirArchivos(lista: FileList | null) {
    const seleccion = Array.from(lista ?? []); if (!seleccion.length) return; setSubiendo(true); setError(""); const nuevos: ArchivoInterno[] = [];
    for (const archivo of seleccion) { const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const ruta = `informacion-interna/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpio}`; const { error: fallo } = await sb.storage.from("biblioteca").upload(ruta, archivo, { upsert: false, contentType: archivo.type || undefined }); if (fallo) { setError(/bucket not found/i.test(fallo.message) ? "Falta crear el bucket `biblioteca` en Supabase Storage." : fallo.message); continue; } const { data } = sb.storage.from("biblioteca").getPublicUrl(ruta); nuevos.push({ url: data.publicUrl, nombre: archivo.name, peso_bytes: archivo.size, tipo: archivo.type || null }); }
    if (nuevos.length) { setArchivos((actuales) => [...actuales, ...nuevos]); if (tipo === "archivo" && !titulo.trim()) setTitulo(nuevos[0].nombre.replace(/\.[^.]+$/, "")); } if (archivoRef.current) archivoRef.current.value = ""; setSubiendo(false);
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (!titulo.trim()) { setError(tipo === "cuenta" ? "Identifica la cuenta o servicio." : "Ponle un título."); return; } setGuardando(true); setError(""); const primero = archivos[0] ?? null;
    const campos = { titulo: titulo.trim(), tipo, categoria: tipo === "cuenta" ? "Cuenta" : tipo === "archivo" ? "Archivo" : "Nota", cliente_id: clienteId || null, contenido: contenido.trim() || null, datos_cuenta: tipo === "cuenta" ? datosCuenta : null, archivos, archivo_url: primero?.url ?? null, archivo_nombre: primero?.nombre ?? null, archivo_peso_bytes: primero?.peso_bytes ?? null, actualizado_en: new Date().toISOString() };
    const { error: fallo } = nota ? await sb.from("notas_internas").update(campos).eq("id", nota.id) : await sb.from("notas_internas").insert(campos); setGuardando(false); if (fallo) setError(fallo.message); else guardado();
  }
  const etiquetaArchivo = tipo === "nota" ? "Fotos y archivos adjuntos" : tipo === "archivo" ? "PDFs, fotos o documentos" : "Archivos de referencia";
  return <div className="velo" onClick={cerrar}><form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}><header><h2>{nota ? "Editar información" : tipo === "cuenta" ? "Guardar cuenta" : tipo === "archivo" ? "Subir archivo" : "Nueva nota"}</h2><small>{tipo === "cuenta" ? "Datos de acceso y contexto operativo" : tipo === "archivo" ? "Un documento o imagen que el equipo necesita ver rápido" : "Contexto que el equipo necesita encontrar rápido"}</small></header><div className="contenido">
    <label className="campo-lbl">Tipo<select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInfo)}><option value="nota">Nota</option><option value="cuenta">Cuenta o acceso</option><option value="archivo">PDF, foto o archivo</option></select></label>
    <label className="campo-lbl">Cliente <span style={{ fontWeight: 400, opacity: .7 }}>· opcional</span><select className="campo" value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">{SIN_CLIENTE}</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{nombreCliente(cliente)}</option>)}</select></label>
    <label className="campo-lbl">{tipo === "cuenta" ? "Nombre de la cuenta o servicio" : "Título"}<input className="campo" autoFocus required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "cuenta" ? "Ej: Meta Business · Colombia" : tipo === "archivo" ? "Ej: Contrato agosto" : "Ej: Preferencias de campaña de agosto"} /></label>
    {tipo === "cuenta" && <><div className="dos"><label className="campo-lbl">Entidad o plataforma<input className="campo" value={datosCuenta.entidad ?? ""} onChange={(e) => cambiarDato("entidad", e.target.value)} placeholder="Ej: Meta, banco, hosting…" /></label><label className="campo-lbl">Titular<input className="campo" value={datosCuenta.titular ?? ""} onChange={(e) => cambiarDato("titular", e.target.value)} placeholder="Empresa o persona" /></label></div><div className="dos"><label className="campo-lbl">Usuario o correo<input className="campo" value={datosCuenta.usuario ?? ""} onChange={(e) => cambiarDato("usuario", e.target.value)} /></label><label className="campo-lbl">Clave<div style={{ display: "flex", gap: 6 }}><input className="campo" type={mostrarClave ? "text" : "password"} autoComplete="new-password" value={datosCuenta.clave ?? ""} onChange={(e) => cambiarDato("clave", e.target.value)} /><button type="button" className="btn chico" onClick={() => setMostrarClave((visible) => !visible)}>{mostrarClave ? "Ocultar" : "Ver"}</button></div></label></div><label className="campo-lbl">URL de acceso<input className="campo" type="url" value={datosCuenta.url ?? ""} onChange={(e) => cambiarDato("url", e.target.value)} placeholder="https://…" /></label></>}
    <label className="campo-lbl">{tipo === "cuenta" ? "Notas de uso" : "Contenido"}<textarea className="campo" rows={tipo === "cuenta" ? 4 : 5} value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Detalles, instrucciones o contexto relevante." /></label>
    <label className="campo-lbl">{etiquetaArchivo} <span style={{ fontWeight: 400, opacity: .7 }}>· opcional, puedes elegir varios</span><input ref={archivoRef} className="campo" type="file" multiple accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={(e) => void subirArchivos(e.target.files)} disabled={subiendo} />{subiendo && <small>Subiendo…</small>}</label>
    {archivos.length > 0 && <div className="info-interna-adjuntos editor">{archivos.map((archivo) => esImagen(archivo) ? <div key={archivo.url} className="info-interna-imagen"><img src={archivo.url} alt={archivo.nombre} /><button type="button" onClick={() => setArchivos((actuales) => actuales.filter((x) => x.url !== archivo.url))}>Quitar</button></div> : <div key={archivo.url} className="info-interna-archivo">{Ico.documentos({ t: 17 })}<span>{archivo.nombre}<small>{pesar(archivo.peso_bytes)}</small></span><button type="button" className="btn chico" onClick={() => setArchivos((actuales) => actuales.filter((x) => x.url !== archivo.url))}>Quitar</button></div>)}</div>}
    {error && <p className="error">{error}</p>}</div><footer><button type="button" className="btn" onClick={cerrar}>Cancelar</button><button className="btn solido" disabled={guardando || subiendo}>{guardando ? "Guardando…" : "Guardar"}</button></footer></form></div>;
}
