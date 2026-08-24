import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { Ico, type NombreIcono } from "./iconos";
import { navegarConTransicion } from "./vistaTransicion";

export type Entrada = {
  a: string;
  texto: string;
  icono: NombreIcono;
  pronto?: boolean;
  /** Esta entrada cambia de "mundo" visual (hoy: Bárbara) — navega con la
   * transición de cross-fade en vez del salto instantáneo normal. Ver
   * `vistaTransicion.ts`. */
  transicion?: boolean;
};

/** Una categoría del menú: su nombre, su icono y las pestañas que agrupa. */
export type Grupo = {
  titulo: string;
  icono: NombreIcono;
  entradas: Entrada[];
};

type Props = {
  grupos: Grupo[];
  nombre: string;
  detalle: string;
  onSalir: () => void;
  abierto: boolean;
  cerrar: () => void;
};

function iniciales(t: string) {
  const p = t.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "CA";
}

/**
 * El menú: categorías con nombre, y dentro sus pestañas.
 *
 * UNA SOLA COLUMNA, Y ES DELIBERADO
 * ---------------------------------------------------------------------------
 * Se probó con dos columnas (secciones a un lado, páginas al otro). Se ve
 * ordenado y se usa peor: obliga a un clic extra para ver qué hay en otra
 * categoría, y esconde doce de las catorce páginas todo el tiempo. Con una
 * columna se ve el mapa completo del portal de una mirada, que es lo que hace
 * un menú lateral.
 *
 * Cada categoría se pliega si estorba, y esa elección se recuerda por persona.
 */
export function Lateral({ grupos, nombre, detalle, onSalir, abierto, cerrar }: Props) {
  const menuRef = useRef<HTMLElement>(null);
  const marcaRef = useRef<HTMLSpanElement>(null);
  const sitio = useLocation();
  const navegar = useNavigate();

  const quieto =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [plegados, setPlegados] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("portal:menu:plegados") || "[]"); }
    catch { return []; }
  });
  const plegar = (t: string) =>
    setPlegados((p) => {
      const n = p.includes(t) ? p.filter((x) => x !== t) : [...p, t];
      try { localStorage.setItem("portal:menu:plegados", JSON.stringify(n)); } catch { /* modo privado */ }
      return n;
    });

  // Entrada escalonada, una sola vez al montar.
  useEffect(() => {
    if (quieto || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll(".nav-item");
    gsap.fromTo(
      items,
      { opacity: 0, x: -6 },
      { opacity: 1, x: 0, duration: 0.28, stagger: 0.022, ease: "power2.out" },
    );
  }, [quieto]);

  // El indicador se DESLIZA entre pestañas en vez de saltar. Es lo único acá
  // que justifica GSAP. `prefers-reduced-motion` no es opcional: quien lo
  // activó pidió menos movimiento en serio.
  useEffect(() => {
    const menu = menuRef.current;
    const marca = marcaRef.current;
    if (!menu || !marca) return;
    const activo = menu.querySelector<HTMLElement>(".nav-item.on");
    if (!activo) {
      gsap.set(marca, { opacity: 0 });
      return;
    }
    const destino = { opacity: 1, y: activo.offsetTop, height: activo.offsetHeight };
    if (quieto) gsap.set(marca, destino);
    else gsap.to(marca, { ...destino, duration: 0.3, ease: "power3.out" });
  }, [sitio.pathname, plegados, quieto]);

  return (
    <aside className={abierto ? "abierto" : ""}>
      <div className="logo">
        {/* El ave se recorta del asset original y queda sin filtros. El texto se
            compone aparte para adaptarse al tema sin lavar los azules y rojos. */}
        <span className="logo-lockup" aria-label="condor.ai">
          <span className="logo-ave" aria-hidden="true">
            <img src="/assets/logo.png" alt="" />
          </span>
          <b>condor.ai</b>
        </span>
        <small>PORTAL</small>
      </div>

      <nav className="menu" ref={menuRef} style={{ position: "relative" }}>
        <span ref={marcaRef} aria-hidden="true" className="pill-glass" />

        {grupos.map((g) => {
          const cerrado = plegados.includes(g.titulo);
          return (
            <div key={g.titulo} className="nav-grupo">
              <button
                className={"nav-grupo-tit" + (cerrado ? " cerrado" : "")}
                onClick={() => plegar(g.titulo)}
                aria-expanded={!cerrado}
              >
                {Ico[g.icono]({ t: 13 })}
                <span>{g.titulo}</span>
                {Ico.galon({ t: 12 })}
              </button>

              {!cerrado &&
                g.entradas.map((e) =>
                  e.pronto ? (
                    <button
                      key={e.a}
                      className="nav-item"
                      disabled
                      style={{ position: "relative", opacity: 0.5, cursor: "default" }}
                      title="Todavía no está disponible"
                    >
                      {Ico[e.icono]()}
                      <span>{e.texto}</span>
                    </button>
                  ) : (
                    <NavLink
                      key={e.a}
                      to={e.a}
                      onClick={(ev) => {
                        cerrar();
                        if (e.transicion) {
                          ev.preventDefault();
                          navegarConTransicion(navegar, e.a);
                        }
                      }}
                      className={({ isActive }) => "nav-item" + (isActive ? " on" : "")}
                      style={{ position: "relative", textDecoration: "none", color: "inherit" }}
                    >
                      {Ico[e.icono]()}
                      <span>{e.texto}</span>
                    </NavLink>
                  ),
                )}
            </div>
          );
        })}
      </nav>

      <button className="tarjeta-user" onClick={onSalir} title="Cerrar sesión">
        <span className="ini">{iniciales(nombre)}</span>
        <div>
          <b>{nombre}</b>
          <small>{detalle}</small>
        </div>
        <span style={{ color: "var(--texto-3)" }}>{Ico.salir({ t: 15 })}</span>
      </button>
    </aside>
  );
}
