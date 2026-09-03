import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Navegación pública de condor.ai (reorganizada 3-sept-2026, pedido de
 * Joaquín): Inicio, Productos (desplegable con las 4 líneas reales:
 * Sites/Ecommerce/Media/Track), Equipo, Agentes IA, Contacto. Portal
 * clientes y Agendar reunión se mantienen como siempre — el primero como
 * enlace, el segundo como botón de acción.
 *
 * "Agentes IA" apunta al hub `/productos/agentes/` (Cóndor Agents), NO
 * directo a la landing de Bárbara: a futuro esa familia sumará más
 * agentes (hoy mostrados ahí como "próximamente"), así que Bárbara pasa a
 * ser una subpágina del hub en vez de ser la página de la categoría
 * entera. Su landing (`/productos/barbara/`) sigue intacta, con su propia
 * identidad (negro/lima) a propósito.
 *
 * Equipo volvió a la barra el mismo día (estuvo fuera un rato, corregido
 * de inmediato): Compañía, Clientes/Portafolio, Proceso y Blog sí se
 * retiraron del sitio completo, no solo del menú.
 */
type Producto = { label: string; href: string; logo: string };
const PRODUCTOS: Producto[] = [
  { label: "Cóndor Sites", href: "/productos/sites/", logo: "/assets/productos/condor-sites.png" },
  { label: "Cóndor Ecommerce", href: "/productos/ecommerce/", logo: "/assets/productos/condor-ecommerce.png" },
  { label: "Cóndor Media", href: "/productos/media/", logo: "/assets/productos/condor-media.png" },
  { label: "Cóndor Track", href: "/productos/track/", logo: "/assets/productos/condor-track.png" },
];

/** Todo lo que no es "/" o "/acceso" vive en las páginas estáticas
 *  generadas por `gen-sitio.mjs` (fuera del router de React) — de ahí que
 *  todo use `<a>` normal, no `<Link>`. */
function MenuProductos() {
  const [abierto, setAbierto] = useState(false);
  const cerrarRef = useRef<number | null>(null);

  const abrir = () => {
    if (cerrarRef.current) window.clearTimeout(cerrarRef.current);
    setAbierto(true);
  };
  const cerrarConDemora = () => {
    cerrarRef.current = window.setTimeout(() => setAbierto(false), 120);
  };

  return (
    <div
      className="nav-drop"
      onMouseEnter={abrir}
      onMouseLeave={cerrarConDemora}
    >
      <button
        className="nav-drop-boton"
        aria-expanded={abierto}
        aria-haspopup="true"
        onClick={() => setAbierto((v) => !v)}
      >
        Productos
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <div className="nav-drop-panel" role="menu">
          {PRODUCTOS.map((p) => (
            <a key={p.href} href={p.href} className="nav-drop-item" role="menuitem">
              <img src={p.logo} alt="" width={22} height={22} />
              {p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <nav className={solid ? "nav solid" : "nav"}>
        <div className="nav-in">
          <Link className="brand" to="/" aria-label="condor.ai — inicio">
            <img className="brand-logo" src="/assets/logo.png" alt="condor.ai" />
          </Link>

          <div className="nav-links">
            <Link to="/">Inicio</Link>
            <MenuProductos />
            <a href="/equipo/">Equipo</a>
            <a href="/productos/agentes/">Agentes IA</a>
            <a href="/contacto/">Contacto</a>
            <a href="/acceso">Portal clientes</a>
            <a className="cta-sm" href="/agendar/">
              Agendar reunión <span aria-hidden="true">→</span>
            </a>
          </div>

          <button
            className={open ? "hamb x" : "hamb"}
            aria-label="Menú"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div className={open ? "drawer-ov on" : "drawer-ov"} onClick={() => setOpen(false)} />
      <aside className={open ? "drawer open" : "drawer"}>
        <Link to="/" onClick={() => setOpen(false)}>Inicio</Link>
        <span className="drawer-grupo">Productos</span>
        {PRODUCTOS.map((p) => (
          <a key={p.href} href={p.href} className="drawer-sub" onClick={() => setOpen(false)}>
            <img src={p.logo} alt="" width={18} height={18} />
            {p.label}
          </a>
        ))}
        <a href="/equipo/" onClick={() => setOpen(false)}>Equipo</a>
        <a href="/productos/agentes/" onClick={() => setOpen(false)}>Agentes IA</a>
        <a href="/contacto/" onClick={() => setOpen(false)}>Contacto</a>
        <a href="/acceso" onClick={() => setOpen(false)}>Portal clientes</a>
        <a className="btn-cta" href="/agendar/" onClick={() => setOpen(false)}>
          Agendar reunión <span aria-hidden="true">→</span>
        </a>
      </aside>
    </>
  );
}
