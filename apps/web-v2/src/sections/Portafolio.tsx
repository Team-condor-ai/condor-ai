import { useEffect, useRef } from "react";

const TILES = [
  { v: "/assets/svc/web.mp4", tag: "Páginas web" },
  { v: "/assets/svc/videos.mp4", tag: "Videos con IA" },
  { v: "/assets/svc/automatizacion.mp4", tag: "Automatización" },
];

// Demos en vivo, multipágina y con asistente IA, por industria.
const DEMOS = [
  { img: "/demos/ecommerce/hero.jpg", marca: "CUMBRE", rubro: "E-commerce · Café de origen", url: "/demos/ecommerce/" },
  { img: "/demos/inmobiliario/hero.jpg", marca: "HÁBITAT", rubro: "Inmobiliaria · Bienes raíces", url: "/demos/inmobiliario/" },
  { img: "/demos/servicios/hero.jpg", marca: "VÉRTICE", rubro: "Servicios · Clínica", url: "/demos/servicios/" },
];

/**
 * Autoplay robusto: React NO setea la propiedad DOM `muted` desde el atributo
 * JSX, y sin `muted` el navegador bloquea el autoplay. Lo forzamos por ref y
 * llamamos play() (silenciando el rechazo si el navegador lo difiere).
 */
function AutoVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    const tryPlay = () => el.play().catch(() => {});
    tryPlay();
    el.addEventListener("canplay", tryPlay, { once: true });
    return () => el.removeEventListener("canplay", tryPlay);
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  );
}

export default function Portafolio() {
  return (
    <section className="section portafolio" id="portafolio">
      <div className="wrap">
        <div className="port-head glass head-bar">
          <div>
            <p className="mono-label eyebrow reveal">Portafolio</p>
            <h2 className="reveal">
              Trabajo real, <span className="grad-tx">resultados reales</span>.
            </h2>
          </div>
          <a className="btn-ghost reveal" href="/clientes/">
            Ver todo el portafolio →
          </a>
        </div>
        <div className="port-grid">
          {TILES.map((t, i) => (
            <a
              className="port-tile reveal"
              key={t.tag}
              href="/clientes/"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <AutoVideo src={t.v} />
              <span className="port-tag mono-label">{t.tag}</span>
            </a>
          ))}
        </div>

        {/* Demos en vivo por industria */}
        <div className="reveal" style={{ marginTop: "3.5rem" }}>
          <p className="mono-label eyebrow" style={{ marginBottom: ".4rem" }}>Ejemplos en vivo</p>
          <h3 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", margin: "0 0 1.4rem", letterSpacing: "-.02em" }}>
            Sitios reales que diseñamos por industria
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.1rem" }}>
            {DEMOS.map((d, i) => (
              <a
                key={d.marca}
                href={d.url}
                target="_blank"
                rel="noopener"
                className="reveal"
                style={{
                  position: "relative", display: "block", borderRadius: "20px", overflow: "hidden",
                  aspectRatio: "4/3", textDecoration: "none", transitionDelay: `${i * 0.08}s`,
                  boxShadow: "0 18px 50px -24px rgba(0,0,0,.5)",
                }}
              >
                <img src={d.img} alt={d.marca} loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                <span style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(8,10,20,.9),rgba(8,10,20,.15) 55%,transparent)" }} />
                <span style={{ position: "absolute", left: "1.1rem", right: "1.1rem", bottom: "1.1rem", color: "#fff" }}>
                  <span style={{ display: "block", fontSize: ".72rem", letterSpacing: ".08em", textTransform: "uppercase", opacity: .8 }}>{d.rubro}</span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", marginTop: ".25rem" }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.02em" }}>{d.marca}</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 600, background: "rgba(255,255,255,.16)", backdropFilter: "blur(6px)", padding: ".4rem .8rem", borderRadius: "999px", whiteSpace: "nowrap" }}>Ver demo →</span>
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
