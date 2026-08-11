import { useEffect, useState } from "react";

type Miembro = {
  foto: string | null;
  ini?: string;
  nombre: string;
  rol: string;
  bio: string;
};

const EQUIPO: Miembro[] = [
  {
    foto: "/assets/joaquin.jpg",
    nombre: "Joaquín Muñoz",
    rol: "Cofundador & CEO",
    bio: "Lidera la estrategia y la relación con los clientes. Define hacia dónde va condor.ai y se asegura de que cada proyecto entregue resultados reales para el negocio.",
  },
  {
    foto: "/assets/alejandro.jpg",
    nombre: "Alejandro Tobar",
    rol: "Cofundador & Backend",
    bio: "Construye el motor invisible de todo: APIs, bases de datos e integraciones. Hace que la plataforma funcione rápido, segura y sin caídas.",
  },
  {
    foto: "/assets/maximiliano.jpg",
    nombre: "Maximiliano Pino",
    rol: "Cofundador · Ing. Comercial y Desarrollo",
    bio: "Ingeniero comercial presente en todas las áreas de la empresa. Lidera el desarrollo front-end de las webs, es el técnico detrás del CRM y supervisa la calidad de cada entrega con ojo exigente: nada sale si no cumple el estándar. Combina la mirada comercial con la ejecución técnica que la hace realidad.",
  },
  {
    foto: null,
    ini: "S",
    nombre: "Samuel Ospitia",
    rol: "Arquitecto de Software",
    bio: "Diseña la arquitectura de los sistemas: define cómo se estructura todo para que escale sin romperse a medida que crecemos.",
  },
];

export default function Equipo() {
  const [sel, setSel] = useState<number | null>(null);
  const activo = sel !== null ? EQUIPO[sel] : null;

  useEffect(() => {
    document.body.style.overflow = activo ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [activo]);

  return (
    <section className="section equipo" id="nosotros">
      <div className="wrap">
        <div className="glass sec-head">
          <p className="mono-label eyebrow reveal">Nosotros</p>
          <h2 className="reveal">
            Personas reales <span className="grad-tx">detrás de la IA</span>.
          </h2>
          <p className="equipo-lead reveal" style={{ marginBottom: 0 }}>
            Un equipo cercano que habla tu idioma — sin call centers ni vueltas.
            <br />
            <span className="mono-label" style={{ opacity: 0.7 }}>
              Toca a cada uno para ver qué hace
            </span>
          </p>
        </div>
        <div className="equipo-grid">
          {EQUIPO.map((m, i) => (
            <button
              type="button"
              className="miembro reveal"
              key={m.nombre}
              style={{ transitionDelay: `${i * 0.07}s` }}
              onClick={() => setSel(i)}
              aria-haspopup="dialog"
            >
              {m.foto ? (
                <img className="miembro-foto" src={m.foto} alt={m.nombre} loading="lazy" />
              ) : (
                <span className="miembro-foto miembro-ini" aria-hidden="true">{m.ini}</span>
              )}
              <h3>{m.nombre}</h3>
              <p className="mono-label">{m.rol}</p>
              <span className="miembro-mas">Ver más +</span>
            </button>
          ))}
        </div>
        <div className="equipo-cta reveal">
          <a className="btn-ghost" href="/inicio/">Conoce al equipo →</a>
        </div>
      </div>

      {/* Modal de bio */}
      <div
        className={activo ? "bio-ov on" : "bio-ov"}
        onClick={() => setSel(null)}
      />
      {activo && (
        <div className="bio-modal glass" role="dialog" aria-modal="true" aria-label={activo.nombre}>
          <button className="bio-close" aria-label="Cerrar" onClick={() => setSel(null)}>
            ×
          </button>
          {activo.foto ? (
            <img className="bio-foto" src={activo.foto} alt={activo.nombre} />
          ) : (
            <span className="bio-foto miembro-ini" aria-hidden="true">{activo.ini}</span>
          )}
          <h3 className="bio-nombre">{activo.nombre}</h3>
          <p className="mono-label bio-rol">{activo.rol}</p>
          <p className="bio-texto">{activo.bio}</p>
        </div>
      )}
    </section>
  );
}
