const SERVICIOS = [
  {
    n: "01",
    alt: "+1200m",
    titulo: "Páginas web profesionales",
    desc: "Un sitio veloz y claro que convierte visitas en clientes: agenda, vende y atiende por WhatsApp 24/7. Tu negocio se ve serio y trabaja incluso mientras duermes.",
    href: "/productos/",
  },
  {
    n: "02",
    alt: "+2400m",
    titulo: "Videos con IA profesionales",
    desc: "Videos 4K de tus productos y anuncios con presentadores realistas, sin grabar ni contratar producción. Más alcance y más ventas a una fracción del costo y el tiempo.",
    href: "/productos/",
  },
  {
    n: "03",
    alt: "+3600m",
    titulo: "Automatizaciones y Agentes IA",
    desc: "Empleados digitales que responden, hacen seguimiento y crean contenido solos. Eliminas tareas repetitivas y dejas de perder clientes por no contestar a tiempo.",
    href: "/productos/",
  },
];

export default function Servicios() {
  return (
    <section className="section servicios" id="servicios">
      <div className="wrap">
        <div className="glass sec-head">
          <p className="mono-label eyebrow reveal">Cómo te ponemos adelante</p>
          <h2 className="reveal">
            Un solo equipo, <span className="grad-tx">potenciado por IA</span>.
          </h2>
        </div>
        <div className="serv-grid">
          {SERVICIOS.map((s, i) => (
            <a
              className="serv-card glass reveal"
              key={s.titulo}
              href={s.href}
              style={{ transitionDelay: `${i * 0.07}s`, textDecoration: "none" }}
            >
              <div className="serv-top">
                <span className="serv-step">{s.n}</span>
                <span className="mono-label serv-alt">{s.alt}</span>
              </div>
              <h3>{s.titulo}</h3>
              <p>{s.desc}</p>
              <span className="serv-go">Ver más →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
