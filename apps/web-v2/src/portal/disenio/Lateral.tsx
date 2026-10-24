import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Ico, type NombreIcono } from "./iconos";

export type Entrada = {
  a: string;
  texto: string;
  icono: NombreIcono;
  /** Ícono de marca (Sites, Ecommerce, CRM): se dibuja esta imagen en vez de `Ico[icono]`. */
  imagen?: string;
};

/** Una categoría del menú: su nombre y las páginas que agrupa. */
export type Grupo = {
  titulo: string;
  icono: NombreIcono;
  entradas: Entrada[];
  clave?: string;
};

type Props = {
  grupos: Grupo[];
  nombre: string;
  detalle: string;
  /** Foto de quien usa el portal, si es del equipo. Sin foto, iniciales. */
  foto?: string;
  /** Página de «Mi cuenta» (la tarjeta de abajo lleva ahí). */
  cuenta: string;
  onSalir: () => void;
  buscador?: boolean;
  abierto: boolean;
  cerrar: () => void;
};

const iniciales = (t: string) => { const p = t.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "C"; };

/**
 * El menú lateral (rehecho el 24-oct-2026): logo, buscador, grupos plegables (se recuerda por persona)
 * y la tarjeta de quien usa el portal. La tarjeta lleva a «Mi cuenta»; salir es su propio botón
 * (antes la tarjeta entera cerraba la sesión al tocarla). En celular es un cajón que se abre con ☰.
 */
export function Lateral({ grupos, nombre, detalle, foto, cuenta, onSalir, buscador, abierto, cerrar }: Props) {
  const [plegados, setPlegados] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("portal:menu:plegados") || "[]"); } catch { return []; }
  });
  const plegar = (t: string) => setPlegados((p) => {
    const n = p.includes(t) ? p.filter((x) => x !== t) : [...p, t];
    try { localStorage.setItem("portal:menu:plegados", JSON.stringify(n)); } catch { /* modo privado */ }
    return n;
  });

  return (
    <>
      {abierto && <div className="lateral-velo" onClick={cerrar} aria-hidden="true" />}
      <aside className={abierto ? "abierto" : ""}>
        <div className="logo">
          <img className="logo-claro" src="/condor/marca/condor-logo-horizontal.svg" alt="condor.ai" width="124" height="26" />
          <small>PORTAL</small>
        </div>

        {buscador && (
          <button className="buscar-global" onClick={() => { cerrar(); window.dispatchEvent(new Event("portal:buscar")); }}>
            {Ico.buscar({ t: 15 })}<span>Buscar</span><kbd>⌘K</kbd>
          </button>
        )}

        <nav className="menu" aria-label="Menú del portal">
          {grupos.map((g) => {
            const cerrado = plegados.includes(g.titulo);
            return (
              <div key={g.titulo} className="nav-grupo" data-cat={g.clave}>
                <button className={"nav-grupo-tit" + (cerrado ? " cerrado" : "")} onClick={() => plegar(g.titulo)} aria-expanded={!cerrado}>
                  {Ico[g.icono]({ t: 13 })}<span>{g.titulo}</span>{Ico.galon({ t: 12 })}
                </button>
                {!cerrado && (
                  <div className="nav-lista">
                    {g.entradas.map((e) => (
                      <NavLink key={e.a} to={e.a} onClick={cerrar} className={({ isActive }) => "nav-item" + (isActive ? " on" : "")}>
                        {e.imagen ? <img src={e.imagen} alt="" width={18} height={18} /> : Ico[e.icono]()}
                        <span>{e.texto}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="tarjeta-user">
          <NavLink to={cuenta} onClick={cerrar} className="tarjeta-user-yo" title="Mi cuenta">
            {foto ? <img src={foto} alt="" width={34} height={34} /> : <span className="ini">{iniciales(nombre)}</span>}
            <div><b>{nombre}</b><small>{detalle}</small></div>
          </NavLink>
          <button className="tarjeta-user-salir" onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión">{Ico.salir({ t: 16 })}</button>
        </div>
      </aside>
    </>
  );
}
