import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useConfirmacion } from "../disenio/Confirmacion";
import { IconoArchivo, IconoCarpeta, familiaDe } from "../disenio/iconosArchivo";
import type { ArchivoBiblioteca, CarpetaBiblioteca } from "./tipos";

/**
 * Biblioteca del equipo, al estilo del Finder de macOS.
 *
 * CARPETAS DE VERDAD, NO CATEGORÍAS
 * ---------------------------------------------------------------------------
 * Antes era una lista plana con cuatro categorías fijas. Eso alcanza para
 * veinte archivos; a los cien no hay forma de agrupar por cliente o por año
 * sin inventar prefijos en el nombre. Ahora hay carpetas anidables.
 *
 * DOS VISTAS, COMO EN EL FINDER
 * ---------------------------------------------------------------------------
 * Iconos (para reconocer de un vistazo, que es para lo que sirve una
 * biblioteca de plantillas) y lista (para comparar fechas y pesos). Se
 * recuerda la elección en `localStorage` porque es una preferencia de la
 * persona, no del contenido.
 *
 * La selección, el doble clic para entrar y la barra de ruta imitan al Finder
 * a propósito: es un patrón que todo el mundo ya sabe usar y no hay que
 * explicar.
 */

const CLAVE_VISTA = "condor.biblioteca.vista";

type Vista = "iconos" | "lista";
type Sel = { tipo: "carpeta" | "archivo"; id: string } | null;

function pesar(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function Biblioteca() {
  const confirmar = useConfirmacion();
  const [carpetas, setCarpetas] = useState<CarpetaBiblioteca[]>([]);
  const [archivos, setArchivos] = useState<ArchivoBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // `null` es la raíz. La ruta guarda los ancestros para la barra de arriba.
  const [aqui, setAqui] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Sel>(null);
  const [vista, setVista] = useState<Vista>(
    () => (localStorage.getItem(CLAVE_VISTA) as Vista) || "iconos",
  );
  const [subiendo, setSubiendo] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [renombrando, setRenombrando] = useState<Sel>(null);
  const [nombreTmp, setNombreTmp] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(CLAVE_VISTA, vista);
  }, [vista]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rc, ra] = await Promise.all([
      sb.from("biblioteca_carpetas").select("*").order("nombre"),
      sb.from("biblioteca").select("*").order("nombre"),
    ]);
    if (rc.error || ra.error) setError(rc.error?.message ?? ra.error?.message ?? "");
    else {
      setCarpetas((rc.data ?? []) as CarpetaBiblioteca[]);
      setArchivos((ra.data ?? []) as ArchivoBiblioteca[]);
      setError("");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Ruta desde la raíz hasta donde estamos, para la barra de navegación.
  const ruta = useMemo(() => {
    const r: CarpetaBiblioteca[] = [];
    let id = aqui;
    // El tope evita un cuelgue si alguna vez quedara un ciclo en `padre_id`.
    for (let i = 0; id && i < 40; i++) {
      const c = carpetas.find((x) => x.id === id);
      if (!c) break;
      r.unshift(c);
      id = c.padre_id;
    }
    return r;
  }, [aqui, carpetas]);

  const buscando = busca.trim().length > 0;

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    // Buscar mira TODA la biblioteca, no solo la carpeta actual — es lo que
    // hace el Finder y es lo que uno espera al escribir en el buscador.
    if (q) {
      return {
        carpetas: carpetas.filter((c) => c.nombre.toLowerCase().includes(q)),
        archivos: archivos.filter(
          (a) =>
            a.nombre.toLowerCase().includes(q) ||
            (a.archivo_nombre ?? "").toLowerCase().includes(q),
        ),
      };
    }
    return {
      carpetas: carpetas.filter((c) => (c.padre_id ?? null) === aqui),
      archivos: archivos.filter((a) => (a.carpeta_id ?? null) === aqui),
    };
  }, [carpetas, archivos, aqui, busca]);

  function entrar(id: string) {
    setAqui(id);
    setSel(null);
    setBusca("");
  }

  async function nuevaCarpeta() {
    const nombre = window.prompt("Nombre de la carpeta nueva:", "Carpeta sin título");
    if (!nombre?.trim()) return;
    const { error } = await sb
      .from("biblioteca_carpetas")
      .insert({ nombre: nombre.trim(), padre_id: aqui });
    if (error) setError(error.message);
    else cargar();
  }

  async function subir(lista: FileList | File[]) {
    const files = Array.from(lista);
    if (!files.length) return;
    setError("");
    setSubiendo(files.length);

    for (const archivo of files) {
      // Storage rechaza rutas con acentos y espacios, pero el nombre original
      // se guarda aparte para mostrarlo tal cual lo subió la persona.
      const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpio}`;

      const { error: errSubir } = await sb.storage
        .from("biblioteca")
        .upload(ruta, archivo, { upsert: false, contentType: archivo.type || undefined });
      if (errSubir) {
        setError(
          /bucket not found/i.test(errSubir.message)
            ? "Falta crear el bucket `biblioteca` en Supabase Storage."
            : `${archivo.name}: ${errSubir.message}`,
        );
        continue;
      }

      const { data } = sb.storage.from("biblioteca").getPublicUrl(ruta);
      const { error: errFila } = await sb.from("biblioteca").insert({
        nombre: archivo.name.replace(/\.[^.]+$/, ""),
        archivo_url: data.publicUrl,
        archivo_nombre: archivo.name,
        peso_bytes: archivo.size,
        mime: archivo.type || null,
        carpeta_id: aqui,
      });
      if (errFila) setError(`${archivo.name}: ${errFila.message}`);
      setSubiendo((n) => n - 1);
    }

    setSubiendo(0);
    if (archivoRef.current) archivoRef.current.value = "";
    cargar();
  }

  async function borrar() {
    if (!sel) return;
    if (sel.tipo === "carpeta") {
      const c = carpetas.find((x) => x.id === sel.id);
      const dentro =
        carpetas.filter((x) => x.padre_id === sel.id).length +
        archivos.filter((x) => x.carpeta_id === sel.id).length;
      const ok = await confirmar(
        `¿Eliminar la carpeta "${c?.nombre}"?`,
        (dentro ? `Se eliminarán también ${dentro} elemento${dentro === 1 ? "" : "s"} dentro de ella.` : "") + "\n\nEsto no se puede deshacer.",
        "Eliminar",
      );
      if (!ok) return;
      const { error } = await sb.from("biblioteca_carpetas").delete().eq("id", sel.id);
      if (error) setError(error.message);
    } else {
      const a = archivos.find((x) => x.id === sel.id);
      if (!await confirmar(`¿Eliminar "${a?.nombre}"?`, undefined, "Eliminar")) return;
      const { error } = await sb.from("biblioteca").delete().eq("id", sel.id);
      if (error) setError(error.message);
    }
    setSel(null);
    cargar();
  }

  async function confirmarNombre() {
    if (!renombrando || !nombreTmp.trim()) {
      setRenombrando(null);
      return;
    }
    const tabla = renombrando.tipo === "carpeta" ? "biblioteca_carpetas" : "biblioteca";
    const { error } = await sb
      .from(tabla)
      .update({ nombre: nombreTmp.trim() })
      .eq("id", renombrando.id);
    if (error) setError(error.message);
    setRenombrando(null);
    cargar();
  }

  const archivoSel = sel?.tipo === "archivo" ? archivos.find((a) => a.id === sel.id) : null;

  // ── piezas de interfaz ───────────────────────────────────────────────────

  function Nombre({ item, tipo }: { item: { id: string; nombre: string }; tipo: "carpeta" | "archivo" }) {
    if (renombrando?.id === item.id && renombrando.tipo === tipo) {
      return (
        <input
          className="fnd-renombrar"
          autoFocus
          value={nombreTmp}
          onChange={(e) => setNombreTmp(e.target.value)}
          onBlur={confirmarNombre}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmarNombre();
            if (e.key === "Escape") setRenombrando(null);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return <span className="fnd-nombre">{item.nombre}</span>;
  }

  return (
    <>
      <div className="barra">
        <h1>Biblioteca</h1>
        <button className="btn" onClick={nuevaCarpeta}>
          {Ico.carpetaMas({ t: 15 })} Nueva carpeta
        </button>
        <button
          className="btn solido"
          disabled={subiendo > 0}
          onClick={() => archivoRef.current?.click()}
        >
          {Ico.subir({ t: 15 })} {subiendo > 0 ? `Subiendo ${subiendo}…` : "Subir"}
        </button>
        <input
          ref={archivoRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && subir(e.target.files)}
        />
      </div>

      <div className="cuerpo">
        {/* Barra de ruta + buscador + vista, como la del Finder */}
        <div className="fnd-barra">
          <button
            className="icono-btn"
            disabled={!aqui}
            title="Atrás"
            onClick={() => {
              setAqui(ruta.length > 1 ? ruta[ruta.length - 2].id : null);
              setSel(null);
            }}
          >
            {Ico.volver({ t: 15 })}
          </button>

          <nav className="fnd-ruta">
            <button className={"fnd-migaja" + (aqui ? "" : " on")} onClick={() => { setAqui(null); setSel(null); }}>
              Biblioteca
            </button>
            {ruta.map((c, i) => (
              <span key={c.id} className="fnd-sep-migaja">
                <span aria-hidden="true">›</span>
                <button
                  className={"fnd-migaja" + (i === ruta.length - 1 ? " on" : "")}
                  onClick={() => entrar(c.id)}
                >
                  {c.nombre}
                </button>
              </span>
            ))}
          </nav>

          <div className="mini-busca" style={{ maxWidth: 220 }}>
            {Ico.buscar({ t: 14 })}
            <input
              placeholder="Buscar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="fnd-vistas">
            <button
              className={"icono-btn" + (vista === "iconos" ? " on" : "")}
              title="Ver como iconos"
              onClick={() => setVista("iconos")}
            >
              {Ico.panel({ t: 15 })}
            </button>
            <button
              className={"icono-btn" + (vista === "lista" ? " on" : "")}
              title="Ver como lista"
              onClick={() => setVista("lista")}
            >
              {Ico.menu({ t: 15 })}
            </button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {/* Zona de archivos. Soltar archivos encima los sube a la carpeta actual. */}
        <div
          className={"fnd-lienzo" + (arrastrando ? " soltando" : "")}
          onClick={() => setSel(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            if (e.dataTransfer.files?.length) subir(e.dataTransfer.files);
          }}
        >
          {cargando && <p className="vacio">Cargando…</p>}

          {!cargando && visibles.carpetas.length === 0 && visibles.archivos.length === 0 && (
            <p className="vacio">
              {buscando
                ? "Nada calza con esa búsqueda."
                : aqui
                  ? "Esta carpeta está vacía. Arrastra archivos acá para subirlos."
                  : "La biblioteca está vacía. Crea una carpeta o arrastra archivos acá."}
            </p>
          )}

          {!cargando && vista === "iconos" && (
            <div className="fnd-grilla">
              {visibles.carpetas.map((c) => (
                <button
                  key={c.id}
                  className={"fnd-item" + (sel?.id === c.id ? " sel" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSel({ tipo: "carpeta", id: c.id });
                  }}
                  onDoubleClick={() => entrar(c.id)}
                >
                  <IconoCarpeta t={62} />
                  <Nombre item={c} tipo="carpeta" />
                </button>
              ))}
              {visibles.archivos.map((a) => (
                <button
                  key={a.id}
                  className={"fnd-item" + (sel?.id === a.id ? " sel" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSel({ tipo: "archivo", id: a.id });
                  }}
                  onDoubleClick={() => a.archivo_url && window.open(a.archivo_url, "_blank", "noreferrer")}
                >
                  {/* Las imágenes se muestran a sí mismas: en una biblioteca de
                      plantillas, reconocer la miniatura ahorra abrir el archivo. */}
                  {familiaDe(a.archivo_nombre ?? a.nombre, a.mime) === "imagen" && a.archivo_url ? (
                    <span className="fnd-miniatura">
                      <img src={a.archivo_url} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <IconoArchivo t={62} nombre={a.archivo_nombre ?? a.nombre} mime={a.mime} />
                  )}
                  <Nombre item={a} tipo="archivo" />
                </button>
              ))}
            </div>
          )}

          {!cargando && vista === "lista" && (visibles.carpetas.length > 0 || visibles.archivos.length > 0) && (
            <div className="tabla-caja">
              <table className="fnd-tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="num">Tamaño</th>
                    <th>Agregado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.carpetas.map((c) => (
                    <tr
                      key={c.id}
                      className={sel?.id === c.id ? "sel" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSel({ tipo: "carpeta", id: c.id });
                      }}
                      onDoubleClick={() => entrar(c.id)}
                    >
                      <td>
                        <span className="fnd-fila-nombre">
                          <IconoCarpeta t={20} />
                          <Nombre item={c} tipo="carpeta" />
                        </span>
                      </td>
                      <td className="num">—</td>
                      <td>{fecha(c.creado_en)}</td>
                    </tr>
                  ))}
                  {visibles.archivos.map((a) => (
                    <tr
                      key={a.id}
                      className={sel?.id === a.id ? "sel" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSel({ tipo: "archivo", id: a.id });
                      }}
                      onDoubleClick={() => a.archivo_url && window.open(a.archivo_url, "_blank", "noreferrer")}
                    >
                      <td>
                        <span className="fnd-fila-nombre">
                          <IconoArchivo t={20} nombre={a.archivo_nombre ?? a.nombre} mime={a.mime} />
                          <Nombre item={a} tipo="archivo" />
                        </span>
                      </td>
                      <td className="num">{pesar(a.peso_bytes)}</td>
                      <td>{fecha(a.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Barra de estado: cuenta y acciones sobre lo seleccionado. */}
        <div className="fnd-estado">
          <span>
            {visibles.carpetas.length} carpeta{visibles.carpetas.length === 1 ? "" : "s"} ·{" "}
            {visibles.archivos.length} archivo{visibles.archivos.length === 1 ? "" : "s"}
            {buscando ? " encontrados" : ""}
          </span>
          {sel && (
            <span className="fnd-acciones">
              {archivoSel?.archivo_url && (
                <a
                  className="btn chico"
                  href={archivoSel.archivo_url}
                  target="_blank"
                  rel="noreferrer"
                  download={archivoSel.archivo_nombre ?? undefined}
                >
                  {Ico.descargar({ t: 14 })} Descargar
                </a>
              )}
              <button
                className="btn chico"
                onClick={() => {
                  const it =
                    sel.tipo === "carpeta"
                      ? carpetas.find((c) => c.id === sel.id)
                      : archivos.find((a) => a.id === sel.id);
                  setNombreTmp(it?.nombre ?? "");
                  setRenombrando(sel);
                }}
              >
                Renombrar
              </button>
              <button className="btn chico peligro" onClick={borrar}>
                Eliminar
              </button>
            </span>
          )}
        </div>

        {/* La autogeneración vuelve cuando esté lista; se anuncia para que
            nadie la busque en Herramientas creyendo que desapareció. */}
        <section className="bloque" style={{ marginTop: 22 }}>
          <h3>Plantillas que se generan solas</h3>
          <div className="fnd-pronto">
            <div>
              <b>Cotización, contrato y términos, rellenados con los datos del cliente</b>
              <span>
                Por ahora se generan desde Herramientas. La versión que vive acá, con
                más plantillas, viene en camino.
              </span>
            </div>
            <span className="pill gris">Próximamente</span>
          </div>
        </section>
      </div>
    </>
  );
}
