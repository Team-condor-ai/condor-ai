import { useEffect, useState } from "react";
import { sb } from "../../lib/supabase";
import { Cajon } from "../../disenio/Dialogos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import { type Carpeta, type Item, type Seccion, tamano, subirArchivo, urlFirmada } from "./tipos";

type ClienteMini = { id: string; negocio: string | null; nombre: string | null };
type Acceso = { quien: string; creado_en: string };

function generar(largo = 20) {
  const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#$%&*+-?";
  const b = new Uint32Array(largo); crypto.getRandomValues(b);
  return Array.from(b, (n) => a[n % a.length]).join("");
}

/** La ficha de una clave o de un archivo, en el cajón de la derecha. */
export function FichaItem({ seccion, item, carpetas, carpetaInicial, yo, onCerrar, onCambio }: {
  seccion: Seccion; item: Item | null; carpetas: Carpeta[]; carpetaInicial: string | null; yo: string | null; onCerrar: () => void; onCambio: () => void;
}) {
  const confirmar = useConfirmacion();
  const esArchivo = seccion === "archivos";
  const [f, setF] = useState({ titulo: item?.titulo ?? "", usuario: item?.usuario ?? "", clave: "", url: item?.url ?? "", notas: item?.notas ?? "", carpeta_id: item?.carpeta_id ?? carpetaInicial ?? "", tipo: item?.tipo ?? (esArchivo ? "archivo" : "cuenta"), cliente_id: item?.cliente_id ?? "" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ver, setVer] = useState(false);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { void sb.from("clientes").select("id,negocio,nombre").eq("archivado", false).order("negocio").then(({ data }) => setClientes((data ?? []) as ClienteMini[])); }, []);
  useEffect(() => {
    if (!item || esArchivo) return;
    void sb.from("claves_accesos").select("quien,creado_en").eq("clave_id", item.id).order("creado_en", { ascending: false }).limit(6).then(({ data }) => setAccesos((data ?? []) as Acceso[]));
  }, [item, esArchivo]);

  const opciones = (p: string | null, n = 0): { id: string; texto: string }[] =>
    carpetas.filter((c) => c.padre_id === p).flatMap((c) => [{ id: c.id, texto: `${" ".repeat(n)}${c.nombre}` }, ...opciones(c.id, n + 1)]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim() && !archivo) { setError("Ponle un nombre."); return; }
    setGuardando(true); setError("");
    try {
      const base: Record<string, unknown> = { titulo: f.titulo.trim() || archivo?.name, usuario: f.usuario.trim() || null, url: f.url.trim() || null, notas: f.notas.trim() || null, carpeta_id: f.carpeta_id || null, cliente_id: f.cliente_id || null, actualizado_por: yo, actualizado_en: new Date().toISOString() };
      if (esArchivo) {
        if (!item) { if (!archivo) throw new Error("Elige el archivo."); await subirArchivo(archivo, { carpeta_id: f.carpeta_id || null, cliente_id: f.cliente_id || null, creado_por: yo, titulo: f.titulo.trim() || archivo.name }); }
        else {
          if (archivo) {
            const ruta = `${crypto.randomUUID()}/${archivo.name.replace(/[^\w.-]+/g, "_")}`;
            const { error: es } = await sb.storage.from("boveda").upload(ruta, archivo, { contentType: archivo.type || undefined });
            if (es) throw new Error(es.message);
            if (item.archivo_url) await sb.storage.from("boveda").remove([item.archivo_url]);
            Object.assign(base, { archivo_url: ruta, archivo_nombre: archivo.name, peso_bytes: archivo.size, mime: archivo.type || null });
          }
          const { error: eu } = await sb.from("claves").update(base).eq("id", item.id); if (eu) throw new Error(eu.message);
        }
      } else {
        base.tipo = f.tipo;
        if (f.clave) base.clave = f.clave;
        const r = item ? await sb.from("claves").update(base).eq("id", item.id) : await sb.from("claves").insert({ ...base, creado_por: yo });
        if (r.error) throw new Error(r.error.message);
      }
      onCambio();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    setGuardando(false);
  }

  async function borrar() {
    if (!item || !(await confirmar(`Borrar «${item.titulo}»`, esArchivo ? "El archivo se elimina para siempre." : "La clave se elimina para siempre.", "Borrar"))) return;
    if (item.archivo_url) await sb.storage.from("boveda").remove([item.archivo_url]);
    const { error: e } = await sb.from("claves").delete().eq("id", item.id);
    if (e) setError(e.message); else onCambio();
  }

  return (
    <Cajon
      titulo={item ? item.titulo : esArchivo ? "Subir archivo" : "Nueva clave"}
      subtitulo={item?.actualizado_en ? `Actualizado el ${new Date(item.actualizado_en).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}${item.actualizado_por ? ` por ${item.actualizado_por.split("@")[0]}` : ""}` : undefined}
      onCerrar={onCerrar}
      pie={<>
        {item && <button type="button" className="btn izq" onClick={borrar}>Borrar</button>}
        {item?.archivo_url && <button type="button" className="btn" onClick={async () => window.open(await urlFirmada(item.archivo_url!), "_blank", "noopener")}>Abrir</button>}
        <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <button type="submit" form="ficha-item" className="btn solido" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
      </>}
    >
      <form id="ficha-item" onSubmit={guardar} className="dlg-rejilla">
        <label className="ancho">Nombre<input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder={esArchivo ? "Si lo dejas vacío, usa el nombre del archivo" : "Ej.: Hostinger, cuenta de Meta…"} autoFocus={!item} /></label>
        {esArchivo ? (
          <label className="ancho">{item ? `Reemplazar archivo (actual: ${item.archivo_nombre ?? "—"}, ${tamano(item.peso_bytes)})` : "Archivo"}
            <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <>
            <label>Usuario o correo<input value={f.usuario} onChange={(e) => set("usuario", e.target.value)} autoComplete="off" /></label>
            <label>Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="cuenta">Cuenta</option><option value="api">API key</option><option value="nota">Nota segura</option></select></label>
            <label className="ancho">{item ? "Nueva clave (vacía = no se cambia)" : "Clave"}
              <span className="bv-clave-campo">
                <input type={ver ? "text" : "password"} value={f.clave} onChange={(e) => set("clave", e.target.value)} autoComplete="new-password" placeholder={item ? "••••••••••" : ""} />
                <button type="button" className="btn chico" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar" : "Ver"}</button>
                <button type="button" className="btn chico" onClick={() => { set("clave", generar()); setVer(true); }}>Generar</button>
              </span>
            </label>
            <label className="ancho">Sitio<input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></label>
          </>
        )}
        <label>Carpeta<select value={f.carpeta_id} onChange={(e) => set("carpeta_id", e.target.value)}><option value="">Sin carpeta</option>{opciones(null).map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}</select></label>
        <label>Cliente<select value={f.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}><option value="">Ninguno</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.negocio || c.nombre}</option>)}</select></label>
        <label className="ancho">Notas<textarea rows={4} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Titular, plan, a quién pertenece…" /></label>
        {error && <p className="aviso-error ancho" role="alert">{error}</p>}
        {item && !esArchivo && (
          <div className="ancho bv-accesos">
            <p className="rotulo-mini">Quién la ha visto</p>
            {accesos.length === 0 ? <p className="vacio-linea">Nadie la ha revelado todavía.</p> : <ul>{accesos.map((a, i) => <li key={i}><b>{a.quien.split("@")[0]}</b><small>{new Date(a.creado_en).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></li>)}</ul>}
          </div>
        )}
      </form>
    </Cajon>
  );
}
