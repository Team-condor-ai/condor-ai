import { useEffect, useRef, useState } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";

/**
 * Reproductor de las lecciones (24-oct-2026). Los videos viven en el bucket privado `cursos` como HLS
 * (segmentos de ~6 s en dos calidades: 1080p y 540p); hls.js va pidiendo solo lo que se está viendo y baja
 * de calidad sola si la conexión no da. Cada pedido lleva la sesión, así que solo lo ve quien tiene permiso.
 * hls.js se carga recién al abrir una lección: no pesa en el resto del portal.
 */
export function VideoHls({ ruta, poster, inicio = 0, onTiempo, onFin }: { ruta: string; poster?: string; inicio?: number; onTiempo?: (t: number, total: number) => void; onFin?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let hls: { destroy: () => void } | null = null;
    let vivo = true;
    (async () => {
      const v = video.current; if (!v) return;
      if (ruta.toLowerCase().endsWith(".mp4")) {
        // Video corto subido directo (≤ 50 MB): se reproduce con un enlace firmado, sin HLS.
        const { data: f } = await sb.storage.from("cursos").createSignedUrl(ruta, 4 * 3600);
        if (!vivo) return;
        if (f?.signedUrl) { v.src = f.signedUrl; if (inicio > 5) v.currentTime = inicio; } else setError("No se pudo cargar el video.");
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      const url = `${SUPABASE_URL}/storage/v1/object/authenticated/cursos/${ruta}`;
      const { default: Hls } = await import("hls.js");
      if (!vivo) return;
      if (Hls.isSupported()) {
        const h = new Hls({
          capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 30,
          xhrSetup: (xhr) => { xhr.setRequestHeader("apikey", SUPABASE_ANON); if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`); },
        });
        h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setError(d.type === "networkError" ? "No se pudo cargar el video. Revisa tu conexión." : "El video no se pudo reproducir."); });
        h.loadSource(url); h.attachMedia(v); hls = h;
      } else {
        setError("Este navegador no puede reproducir el video. Prueba con Chrome, Safari o Firefox actualizados.");
      }
      if (inicio > 5) v.currentTime = inicio;
    })();
    return () => { vivo = false; hls?.destroy(); };
  }, [ruta, inicio]);

  return (
    <div className="cur-video">
      <video ref={video} controls playsInline poster={poster} preload="metadata"
        onTimeUpdate={(e) => onTiempo?.(e.currentTarget.currentTime, e.currentTarget.duration || 0)}
        onEnded={() => onFin?.()} />
      {error && <p className="cur-video-error">{error}</p>}
    </div>
  );
}
