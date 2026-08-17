import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sb, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { CATEGORIAS_BIBLIOTECA, type ArchivoBiblioteca } from "./tipos";

/**
 * Biblioteca del equipo: dos cosas distintas bajo un mismo techo.
 *
 * 1. PLANTILLAS QUE SE GENERAN SOLAS — cotización, contrato y términos. No son
 *    archivos: se arman al vuelo con los datos reales del cliente desde
 *    `Herramientas`. Se listan acá para que la biblioteca sea el lugar donde
 *    uno busca "un documento", sin tener que saber de antemano si es un
 *    archivo guardado o algo que se genera.
 * 2. ARCHIVOS SUBIDOS — PPTX, PDF, lo que sea. Viven en el bucket
 *    `biblioteca` de Supabase Storage y se descargan tal cual.
 */

const PLANTILLAS_VIVAS = [
  {
    nombre: "Cotización",
    detalle: "Se rellena con el plan, montos y moneda del cliente elegido.",
  },
  {
    nombre: "Contrato de servicios",
    detalle: "Prestación de servicios, listo para firmar.",
  },
  {
    nombre: "Términos y condiciones",
    detalle: "Documento estándar del servicio.",
  },
];

const ETIQUETA: Record<string, string> = {
  presentacion: "Presentación",
  propuesta: "Propuesta",
  marca: "Marca",
  otro: "Otro",
};

function pesar(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function Biblioteca() {
  const [filas, setFilas] = useState<ArchivoBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("biblioteca")
      .select("*")
      .order("creado_en", { ascending: false });
    if (error) setError(error.message);
    else {
      setFilas((data ?? []) as ArchivoBiblioteca[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro !== "todos" && f.categoria !== filtro) return false;
      if (!q) return true;
      return [f.nombre, f.descripcion]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q));
    });
  }, [filas, busca, filtro]);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError("");
    // El nombre se limpia porque Storage rechaza rutas con acentos y espacios,
    // pero el original se guarda aparte para poder mostrarlo tal cual.
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `${Date.now()}-${limpio}`;

    const { error: errSubir } = await sb.storage
      .from("biblioteca")
      .upload(ruta, archivo, { upsert: false });
    if (errSubir) {
      setSubiendo(false);
      setError(
        /bucket not found/i.test(errSubir.message)
          ? "Falta crear el bucket `biblioteca` en Supabase Storage."
          : errSubir.message,
      );
      return;
    }

    const { data } = sb.storage.from("biblioteca").getPublicUrl(ruta);
    const { error: errFila } = await sb.from("biblioteca").insert({
      nombre: archivo.name.replace(/\.[^.]+$/, ""),
      categoria: "presentacion",
      archivo_url: data.publicUrl,
      archivo_nombre: archivo.name,
      peso_bytes: archivo.size,
    });

    setSubiendo(false);
    if (errFila) setError(errFila.message);
    else cargar();
    if (archivoRef.current) archivoRef.current.value = "";
  }

  async function eliminar(f: ArchivoBiblioteca) {
    if (!window.confirm(`¿Eliminar "${f.nombre}" de la biblioteca?`)) return;
    const { error } = await sb.from("biblioteca").delete().eq("id", f.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <h1>Biblioteca</h1>
        <button
          className="btn solido"
          disabled={subiendo}
          onClick={() => archivoRef.current?.click()}
        >
          {Ico.subir({ t: 15 })} {subiendo ? "Subiendo…" : "Subir archivo"}
        </button>
        <input
          ref={archivoRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const a = e.target.files?.[0];
            if (a) subir(a);
          }}
        />
      </div>

      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        <section className="bloque">
          <h3>Plantillas que se generan solas</h3>
          <p className="parrafo">
            No son archivos: eliges el cliente y el documento sale relleno con sus
            datos reales, listo para descargar.
          </p>
          <div className="tarjetas-lib">
            {PLANTILLAS_VIVAS.map((p) => (
              <Link key={p.nombre} to="/acceso/herramientas" className="tarjeta-lib">
                <span className="tag-lib">Se autogenera</span>
                <b>{p.nombre}</b>
                <span>{p.detalle}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bloque">
          <h3>Archivos</h3>

          <div className="fila-busca" style={{ padding: 0, marginBottom: 12 }}>
            <div className="mini-busca">
              {Ico.buscar({ t: 15 })}
              <input
                placeholder="Buscar en la biblioteca…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="chips">
            <button
              className={"chip" + (filtro === "todos" ? " on" : "")}
              onClick={() => setFiltro("todos")}
            >
              Todos <span>{filas.length}</span>
            </button>
            {CATEGORIAS_BIBLIOTECA.map((c) => (
              <button
                key={c}
                className={"chip" + (filtro === c ? " on" : "")}
                onClick={() => setFiltro(c)}
              >
                {ETIQUETA[c]} <span>{filas.filter((f) => f.categoria === c).length}</span>
              </button>
            ))}
          </div>

          {cargando && <p className="vacio">Cargando…</p>}

          {!cargando && visibles.length === 0 && (
            <p className="vacio">
              {filas.length === 0
                ? "La biblioteca está vacía. Sube la primera presentación."
                : "Ningún archivo calza con ese filtro."}
            </p>
          )}

          {!cargando && visibles.length > 0 && (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Categoría</th>
                    <th className="num">Peso</th>
                    <th>Subido</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <b>{f.nombre}</b>
                        {f.archivo_nombre && <small>{f.archivo_nombre}</small>}
                      </td>
                      <td>{ETIQUETA[f.categoria ?? "otro"] ?? f.categoria}</td>
                      <td className="num">{pesar(f.peso_bytes)}</td>
                      <td>{fecha(f.creado_en)}</td>
                      <td className="acciones">
                        {f.archivo_url && (
                          <a
                            className="icono-btn"
                            title="Descargar"
                            href={f.archivo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {Ico.descargar({ t: 15 })}
                          </a>
                        )}
                        <button
                          className="icono-btn peligro"
                          title="Eliminar"
                          onClick={() => eliminar(f)}
                        >
                          {Ico.eliminar({ t: 15 })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
