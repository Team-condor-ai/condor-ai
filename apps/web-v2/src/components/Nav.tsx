import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Enlaces del sitio.
 *  - "hash"  → sección del home (#id). Navega a "/" y baja a la sección.
 *  - "route" → sub-página reconstruida en v2 (react-router).
 *  - "ext"   → app/página aún en el sitio antiguo (.html) — enlace normal.
 */
type NavItem = { label: string; href: string; type: "hash" | "route" | "ext" };
const LINKS: NavItem[] = [
  { label: "Servicios", href: "/productos/", type: "ext" },
  { label: "Portafolio", href: "/clientes/", type: "ext" },
  { label: "Blog", href: "/blog/", type: "ext" },
  { label: "Nosotros", href: "/inicio/", type: "ext" },
  { label: "Acceso clientes", href: "/portal.html", type: "ext" },
];

/** Renderiza un enlace según su tipo, con cierre opcional del drawer. */
function NavLink({ l, onClick, className }: { l: NavItem; onClick?: () => void; className?: string }) {
  if (l.type === "ext") {
    return (
      <a href={l.href} className={className} onClick={onClick}>
        {l.label}
      </a>
    );
  }
  // hash → "/#id" para que funcione desde cualquier ruta; route → tal cual
  const to = l.type === "hash" ? `/${l.href}` : l.href;
  return (
    <Link to={to} className={className} onClick={onClick}>
      {l.label}
    </Link>
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
            {LINKS.map((l) => (
              <NavLink key={l.href} l={l} />
            ))}
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
        {LINKS.map((l) => (
          <NavLink key={l.href} l={l} onClick={() => setOpen(false)} />
        ))}
        <a href="/contacto/" onClick={() => setOpen(false)}>Contacto</a>
        <a className="btn-cta" href="/agendar/" onClick={() => setOpen(false)}>
          Agendar reunión <span aria-hidden="true">→</span>
        </a>
      </aside>
    </>
  );
}
