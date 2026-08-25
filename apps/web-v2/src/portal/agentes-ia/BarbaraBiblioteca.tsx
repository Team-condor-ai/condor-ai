import { useEffect, useMemo, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Media = {
  id: string; storage_path: string; tipo: "imagen" | "video" | "portada" | "documento";
  mime_type: string; bytes: number | null; sha256: string | null; url?: string;
};
type Decision = {
  pilar: string | null;
  memoria_privada: { id?: string; clase?: string }[];
  patrones_globales: { evidencia_clave?: string }[];
  decision_angulo: { modo?: string; descartes?: unknown[] };
  decision_horario: { razon?: string; modo?: string } | null;
};
type Fila = {
  id: string; fecha: string; tipo: string; angulo: string | null; creado_en: string;
  contenido: { caption?: string } | null; barbara_media: Media[] | null;
  barbara_decisiones: Decision | Decision[] | null;
};

const ETIQUETA_TIPO: Record<string, string> = {
  carrusel: "🖼️ Carrusel", historia: "📱 Historia", ugc: "🎬 UGC",
};

/** Biblioteca real: metadata en barbara_media y URLs firmadas de un bucket
 * privado. Las URLs expiran; nunca se vuelve público el material del cliente. */
export function BarbaraBiblioteca({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await sb.from("barbara_memoria")
        .select("id,fecha,tipo,angulo,contenido,creado_en,barbara_media(id,storage_path,tipo,mime_type,bytes,sha256),barbara_decisiones(pilar,memoria_privada,patrones_globales,decision_angulo,decision_horario)")
        .eq("barbara_cliente_id", barbaraClienteId)
        .order("creado_en", { ascending: false }).limit(200);
      if (!vivo) return;
      if (r.error) { setError(r.error.message); setCargando(false); return; }
      const piezas = (r.data ?? []) as unknown as Fila[];
      const paths = piezas.flatMap((p) => p.barbara_media ?? []).map((m) => m.storage_path);
      const urls = new Map<string, string>();
      if (paths.length) {
        const firmadas = await sb.storage.from("barbara-media").createSignedUrls(paths, 60 * 60);
        if (firmadas.error) {
          setError("No se pudieron abrir los archivos privados: " + firmadas.error.message);
        } else {
          for (const item of firmadas.data ?? []) {
            if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
          }
        }
      }
      if (!vivo) return;
      setFilas(piezas.map((p) => ({
        ...p,
        barbara_media: (p.barbara_media ?? []).map((m) => ({ ...m, url: urls.get(m.storage_path) })),
      })));
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => [f.angulo, f.tipo, f.contenido?.caption]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [filas, busqueda]);

  return (
    <div>
      <input className="campo" placeholder="Buscar por ángulo, tipo o caption…"
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: 14, maxWidth: 380 }} />

      {error && <p className="error">{error}</p>}
      {cargando && <p className="vacio">Cargando biblioteca privada…</p>}
      {!cargando && filtradas.length === 0 && <p className="vacio">Sin piezas todavía.</p>}

      {!cargando && filtradas.length > 0 && (
        <div className="barbara-biblioteca-grid">
          {filtradas.map((f) => {
            const media = f.barbara_media ?? [];
            const portada = media.find((m) => m.tipo === "portada") || media[0];
            const decision = Array.isArray(f.barbara_decisiones) ? f.barbara_decisiones[0] : f.barbara_decisiones;
            return (
              <article className="barbara-biblioteca-pieza" key={f.id}>
                <div className="barbara-biblioteca-preview">
                  {portada?.url && portada.mime_type.startsWith("image/") &&
                    <img src={portada.url} alt={f.angulo || f.tipo} loading="lazy" />}
                  {portada?.url && portada.mime_type.startsWith("video/") &&
                    <video src={portada.url} controls preload="metadata" />}
                  {!portada?.url && <span>{ETIQUETA_TIPO[f.tipo]?.split(" ")[0] || "📄"}</span>}
                </div>
                <div className="barbara-biblioteca-info">
                  <small>{fecha(f.creado_en)} · {ETIQUETA_TIPO[f.tipo] || f.tipo}</small>
                  <strong>{f.angulo || "Pieza sin ángulo registrado"}</strong>
                  {f.contenido?.caption && <p>{f.contenido.caption}</p>}
                  <span>{media.length ? `${media.length} archivo${media.length === 1 ? "" : "s"} privado${media.length === 1 ? "" : "s"}` : "Pieza histórica: archivo sólo en Telegram"}</span>
                  {decision && (
                    <details className="barbara-biblioteca-razon">
                      <summary>Por qué Bárbara eligió esto</summary>
                      <span>Pilar: {decision.pilar || "sin registrar"}</span>
                      <span>{decision.memoria_privada?.length || 0} recuerdos privados y {decision.patrones_globales?.length || 0} patrones globales evaluados.</span>
                      <span>Ángulo: {decision.decision_angulo?.modo || "director creativo"}{decision.decision_angulo?.descartes?.length ? ` · descartó ${decision.decision_angulo.descartes.length} repetición(es)` : ""}.</span>
                      {decision.decision_horario && <span>Horario: {decision.decision_horario.razon || decision.decision_horario.modo || "propuesto por disponibilidad"}.</span>}
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="tenue" style={{ marginTop: 14 }}>
        Los nuevos archivos quedan guardados en una biblioteca privada y verificable. Las piezas anteriores a esta función pueden seguir viviendo sólo en Telegram.
      </p>
    </div>
  );
}
