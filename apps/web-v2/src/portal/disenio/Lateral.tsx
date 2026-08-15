import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import gsap from "gsap";
import { Ico, type NombreIcono } from "./iconos";

export type Entrada = {
  a: string;
  texto: string;
  icono: NombreIcono;
  pronto?: boolean;
};

type Props = {
  entradas: Entrada[];
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
 * El menú lateral de 220 px, con las animaciones que se pidieron.
 *
 * TRES CAPAS DE MOVIMIENTO, Y UNA REGLA QUE LAS APAGA
 * ---------------------------------------------------------------------------
 *  1. Entrada escalonada de los items (30 ms entre uno y otro).
 *  2. Hover: lo resuelve el CSS del ERP, no JS — es más fluido y no compite
 *     con GSAP por el mismo estilo.
 *  3. El indicador de activo se DESLIZA entre items en vez de saltar. Es lo
 *     que da la sensación de continuidad de iOS, y es la única de las tres
 *     que justifica GSAP.
 *
 * `prefers-reduced-motion` no es opcional: quien lo activó en su sistema pidió
 * menos movimiento en serio (mareo, vestibular). Cuando está activo no se
 * anima nada — el indicador se posiciona de una y los items aparecen sin
 * transición.
 */
export function Lateral({
  entradas,
  nombre,
  detalle,
  onSalir,
  abierto,
  cerrar,
}: Props) {
  const menuRef = useRef<HTMLElement>(null);
  const marcaRef = useRef<HTMLSpanElement>(null);
  const sitio = useLocation();

  const quieto =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1) Entrada escalonada, una sola vez al montar.
  useEffect(() => {
    if (quieto || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll(".nav-item");
    gsap.fromTo(
      items,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.32, stagger: 0.03, ease: "power2.out" },
    );
  }, [quieto]);

  // 3) El indicador sigue al item activo.
  useEffect(() => {
    const menu = menuRef.current;
    const marca = marcaRef.current;
    if (!menu || !marca) return;
    const activo = menu.querySelector<HTMLElement>(".nav-item.on");
    if (!activo) {
      gsap.set(marca, { opacity: 0 });
      return;
    }
    const destino = {
      opacity: 1,
      y: activo.offsetTop,
      height: activo.offsetHeight,
    };
    if (quieto) gsap.set(marca, destino);
    else gsap.to(marca, { ...destino, duration: 0.34, ease: "power3.out" });
  }, [sitio.pathname, entradas.length, quieto]);

  return (
    <aside className={abierto ? "abierto" : ""}>
      <div className="logo">
        <div>
          <b>CÓNDOR AI</b>
          <small>PORTAL</small>
        </div>
      </div>

      <nav className="menu" ref={menuRef} style={{ position: "relative" }}>
        <span
          ref={marcaRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            borderRadius: 9,
            background: "var(--activo)",
            opacity: 0,
            pointerEvents: "none",
          }}
        />
        {entradas.map((e) =>
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
              <em
                style={{
                  fontStyle: "normal",
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: ".04em",
                  color: "var(--texto-3)",
                  border: "1px solid var(--borde)",
                  borderRadius: 999,
                  padding: "1px 7px",
                }}
              >
                PRONTO
              </em>
            </button>
          ) : (
            <NavLink
              key={e.a}
              to={e.a}
              onClick={cerrar}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " on" : "")
              }
              style={{ position: "relative", textDecoration: "none", color: "inherit" }}
            >
              {Ico[e.icono]()}
              <span>{e.texto}</span>
            </NavLink>
          ),
        )}
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
