import { useEffect, useState } from "react";
import { Ico } from "../../disenio/iconos";
import { type Item, tamano, tipoArchivo, urlFirmada } from "./tipos";

const ETIQUETA: Record<string, string> = { imagen: "IMG", pdf: "PDF", video: "VID", planilla: "XLS", documento: "DOC", comprimido: "ZIP", otro: "ARCH" };

/** Un archivo como tarjeta: vista previa si es imagen, ícono por tipo si no. Clic abre; el lápiz edita. */
export function TarjetaArchivo({ k, ruta, onAbrir }: { k: Item; ruta: string; onAbrir: () => void }) {
  const tipo = tipoArchivo(k.mime, k.archivo_nombre);
  const [miniatura, setMiniatura] = useState<string | null>(null);
  useEffect(() => { if (tipo === "imagen" && k.archivo_url) urlFirmada(k.archivo_url).then(setMiniatura).catch(() => undefined); }, [tipo, k.archivo_url]);
  async function abrir() { if (k.archivo_url) window.open(await urlFirmada(k.archivo_url), "_blank", "noopener"); }
  async function descargar() { if (k.archivo_url) window.location.href = await urlFirmada(k.archivo_url, k.archivo_nombre ?? "archivo"); }
  return (
    <article className="bv-archivo" draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-boveda", `item:${k.id}`); e.dataTransfer.effectAllowed = "move"; }}>
      <button className={`bv-prev t-${tipo}`} onClick={abrir} title="Abrir">
        {miniatura ? <img src={miniatura} alt="" loading="lazy" /> : <span>{ETIQUETA[tipo]}</span>}
      </button>
      <div className="bv-archivo-txt">
        <b title={k.titulo}>{k.titulo}</b>
        <small>{tamano(k.peso_bytes)}{ruta ? ` · ${ruta}` : ""}</small>
      </div>
      <div className="bv-archivo-acc">
        <button className="icono-btn" title="Descargar" onClick={descargar}>{Ico.descargar({ t: 14 })}</button>
        <button className="icono-btn" title="Editar" onClick={onAbrir}>{Ico.editar({ t: 14 })}</button>
      </div>
    </article>
  );
}
