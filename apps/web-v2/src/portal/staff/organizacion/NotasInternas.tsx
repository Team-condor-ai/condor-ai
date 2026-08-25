import { useEffect, useMemo, useRef, useState } from "react";
import { sb, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useConfirmacion } from "../../disenio/Confirmacion";
import type { NotaInterna } from "../tipos";

const CATEGORIAS_SUGERIDAS = ["Nota", "Cuenta", "Acceso", "Proveedor"];

function pesar(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Notas internas: datos de cuentas, accesos y cualquier nota rápida del
 * equipo que hoy vive dispersa en chats. Puede llevar un archivo adjunto
 * (ej. un PDF) — sube al bucket `biblioteca` (el mismo que ya usa la
 * Biblioteca de archivos) bajo el prefijo `notas/`, sin crear infraestructura
 * de Storage nueva.
 */
export function NotasInternas() {
  const confirmar = useConfirmacion();
  const [notas, setNotas] = useState<NotaInterna[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");
  const [editando, setEditando] = useState<NotaInterna | "nueva" | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("notas_internas")
      .select("*")
      .order("actualizado_en", { ascending: false });
    if (error) setError("Falta aplicar la migración de notas internas: " + error.message);
    else setError("");
    setNotas((data ?? []) as NotaInterna[]);
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const categorias = useMemo(
    () => Array.from(new Set(notas.map((n) => n.categoria))).sort(),
    [notas],
  );

  const visibles = notas.filter((n) => {
    if (categoria !== "todas" && n.categoria !== categoria) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (
      n.titulo.toLowerCase().includes(q) ||
      (n.contenido ?? "").toLowerCase().includes(q)
    );
  });

  async function borrar(n: NotaInterna) {
    if (!await confirmar(`¿Borrar "${n.titulo}"?`, "Esto no se puede deshacer.", "Borrar")) return;
    const { error } = await sb.from("notas_internas").delete().eq("id", n.id);
    if (error) setError(error.message);
    else setNotas((p) => p.filter((x) => x.id !== n.id));
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          className="campo"
          style={{ maxWidth: 260 }}
          placeholder="Buscar…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="chips">
          <button
            className={"chip" + (categoria === "todas" ? " on" : "")}
            onClick={() => setCategoria("todas")}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              className={"chip" + (categoria === c ? " on" : "")}
              onClick={() => setCategoria(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          className="btn solido"
          style={{ marginLeft: "auto" }}
          onClick={() => setEditando("nueva")}
        >
          {Ico.mas({ t: 14 })} Nueva nota
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="vacio">
          {notas.length === 0
            ? "Sin notas todavía. Guarda acá datos de cuentas, accesos y cualquier cosa que el equipo necesite encontrar rápido."
            : "Nada calza con la búsqueda."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {visibles.map((n) => (
            <article
              key={n.id}
              className="bloque"
              style={{ margin: 0, cursor: "pointer" }}
              onClick={() => setEditando(n)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span className="pill gris">{n.categoria}</span>
                <button
                  className="icono-btn peligro"
                  title="Borrar"
                  onClick={(e) => { e.stopPropagation(); borrar(n); }}
                >
                  {Ico.eliminar({ t: 14 })}
                </button>
              </div>
              <h3 style={{ margin: "8px 0 4px" }}>{n.titulo}</h3>
              {n.contenido && (
                <p
                  className="tenue"
                  style={{
                    margin: 0, whiteSpace: "pre-wrap", overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
                  }}
                >
                  {n.contenido}
                </p>
              )}
              {n.archivo_url && (
                <a
                  href={n.archivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="conteo"
                  style={{ display: "inline-flex", gap: 4, marginTop: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Ico.documentos({ t: 13 })} {n.archivo_nombre || "Archivo"}
                  {n.archivo_peso_bytes ? ` · ${pesar(n.archivo_peso_bytes)}` : ""}
                </a>
              )}
              <p className="conteo" style={{ marginTop: 8 }}>
                Actualizado {fecha(n.actualizado_en)}
              </p>
            </article>
          ))}
        </div>
      )}

      {editando && (
        <EditorNota
          nota={editando === "nueva" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => { setEditando(null); cargar(); }}
        />
      )}
    </>
  );
}

function EditorNota({
  nota,
  cerrar,
  guardado,
}: {
  nota: NotaInterna | null;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [categoria, setCategoria] = useState(nota?.categoria ?? "Nota");
  const [contenido, setContenido] = useState(nota?.contenido ?? "");
  const [archivoUrl, setArchivoUrl] = useState(nota?.archivo_url ?? "");
  const [archivoNombre, setArchivoNombre] = useState(nota?.archivo_nombre ?? "");
  const [archivoPeso, setArchivoPeso] = useState(nota?.archivo_peso_bytes ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);

  async function subirArchivo(files: FileList | null) {
    const archivo = files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError("");
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `notas/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpio}`;
    const { error: errSubir } = await sb.storage
      .from("biblioteca")
      .upload(ruta, archivo, { upsert: false, contentType: archivo.type || undefined });
    if (errSubir) {
      setError(
        /bucket not found/i.test(errSubir.message)
          ? "Falta crear el bucket `biblioteca` en Supabase Storage."
          : errSubir.message,
      );
      setSubiendo(false);
      return;
    }
    const { data } = sb.storage.from("biblioteca").getPublicUrl(ruta);
    setArchivoUrl(data.publicUrl);
    setArchivoNombre(archivo.name);
    setArchivoPeso(archivo.size);
    setSubiendo(false);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError("Ponle un título."); return; }
    setGuardando(true);
    setError("");
    const campos = {
      titulo: titulo.trim(),
      categoria: categoria.trim() || "Nota",
      contenido: contenido.trim() || null,
      archivo_url: archivoUrl || null,
      archivo_nombre: archivoNombre || null,
      archivo_peso_bytes: archivoPeso,
      actualizado_en: new Date().toISOString(),
    };
    const { error } = nota
      ? await sb.from("notas_internas").update(campos).eq("id", nota.id)
      : await sb.from("notas_internas").insert(campos);
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>{nota ? "Editar nota" : "Nueva nota"}</h2>
        </header>
        <div className="contenido">
          <label className="campo-lbl">
            Título
            <input
              className="campo" autoFocus required
              value={titulo} onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <label className="campo-lbl">
            Categoría
            <input
              className="campo" list="categorias-nota"
              value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Nota, Cuenta, Acceso…"
            />
            <datalist id="categorias-nota">
              {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="campo-lbl">
            Contenido
            <textarea
              className="campo" rows={6}
              value={contenido} onChange={(e) => setContenido(e.target.value)}
              placeholder="Usuario, clave, URL, o cualquier detalle que el equipo necesite encontrar rápido."
            />
          </label>
          <label className="campo-lbl">
            Archivo adjunto <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional, ej. un PDF</span>
            <input
              ref={archivoRef}
              className="campo" type="file"
              onChange={(e) => subirArchivo(e.target.files)}
              disabled={subiendo}
            />
            {subiendo && <small>Subiendo…</small>}
            {archivoUrl && !subiendo && (
              <small>
                {archivoNombre} · <a href={archivoUrl} target="_blank" rel="noreferrer">ver</a>{" "}
                ·{" "}
                <button
                  type="button"
                  className="btn chico"
                  onClick={() => { setArchivoUrl(""); setArchivoNombre(""); setArchivoPeso(null); if (archivoRef.current) archivoRef.current.value = ""; }}
                >
                  quitar
                </button>
              </small>
            )}
          </label>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando || subiendo}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
