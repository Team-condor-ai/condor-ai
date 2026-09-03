import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { Ico, type NombreIcono } from "./iconos";
import { navegarConTransicion } from "./vistaTransicion";

export type Entrada = {
  a: string;
  texto: string;
  icono: NombreIcono;
  /** Logo real de marca (2-sept-2026: Sites/Ecommerce/Track/Agents/Media
   *  tienen isotipo propio). Cuando viene, se dibuja este `<img>` en vez
   *  de `Ico[icono]` — `icono` igual queda seteado como respaldo por si
   *  la imagen no carga y para no romper el tipo en otras entradas. */
  imagen?: string;
  pronto?: boolean;
  /** Esta entrada cambia de "mundo" visual (hoy: Bárbara) — navega con la
   * transición Slide direccional en vez del salto instantáneo normal. Ver
   * `vistaTransicion.ts`. */
  transicion?: boolean;
  /** Se dibuja como tarjeta de agente en vez de fila de menú. El valor elige
   *  la identidad: cada agente tiene la suya, no un estilo compartido. */
  agente?: "barbara" | "memoria";
  /** Bajada de una línea para las tarjetas de agente. */
  oficio?: string;
};

/** Una categoría del menú: su nombre, su icono y las pestañas que agrupa. */
export type Grupo = {
  titulo: string;
  icono: NombreIcono;
  entradas: Entrada[];
  /** Identidad visual del bloque: color y textura de fondo viven en el CSS
   *  colgando de `[data-cat]`. Sin clave, la categoría queda neutra. */
  clave?: string;
  /** Las entradas se disponen en fila y no apiladas. Hoy solo los agentes,
   *  que son tarjetas y no filas de menú. */
  fila?: boolean;
};

type Props = {
  grupos: Grupo[];
  nombre: string;
  detalle: string;
  /** Foto real de quien está usando el portal, si es del equipo (ver
   *  `EQUIPO_CONDOR` en staff/tipos.ts). Sin foto, cae a las iniciales. */
  foto?: string;
  onSalir: () => void;
  abierto: boolean;
  cerrar: () => void;
};

/**
 * La tarjeta de un agente.
 *
 * POR QUE NO ES UN `nav-item` MAS
 * ---------------------------------------------------------------------------
 * El resto del menú lleva a pantallas del ERP. Bárbara es el PRODUCTO: la que
 * el equipo le vende a un cliente y usa a diario. Cuando se veía igual que
 * "Créditos API" se perdía entre catorce filas idénticas.
 *
 * Lleva su cara real, su lima y la semilla que muta — la misma firma de
 * movimiento que vive dentro de su módulo. Es la ÚNICA animación con vida
 * propia del menú; todo lo demás (los colores de categoría, las texturas) se
 * disciplina para que esta resalte.
 *
 * Memoria va al lado y no debajo porque no es otra sección: es lo que Bárbara
 * recuerda. Puestas una junto a la otra se leen como una sola cosa con dos
 * puertas, que es lo que son.
 */
function TarjetaAgente({ entrada, activa }: { entrada: Entrada; activa: boolean }) {
  if (entrada.agente === "barbara") {
    return (
      <>
        <span className="agente-halo" aria-hidden="true" />
        <img className="agente-cara" src="/assets/barbara/avatar-mini.webp"
          alt="" width="64" height="64" decoding="async" />
        <span className="agente-texto">
          <b>{entrada.texto}</b>
          {entrada.oficio && <small>{entrada.oficio}</small>}
        </span>
        {/* La semilla: tensión superficial, no una secuencia de polígonos. */}
        <span className={"agente-semilla" + (activa ? " despierta" : "")} aria-hidden="true">
          <i />
        </span>
      </>
    );
  }
  return (
    <>
      <span className="agente-constelacion" aria-hidden="true" />
      <span className="agente-icono" aria-hidden="true">{Ico[entrada.icono]({ t: 17 })}</span>
      <span className="agente-texto">
        <b>{entrada.texto}</b>
        {entrada.oficio && <small>{entrada.oficio}</small>}
      </span>
    </>
  );
}

/** El logo real de marca si la entrada trae `imagen`, si no el ícono SVG
 *  monocromo de siempre. */
function IconoEntrada({ entrada }: { entrada: Entrada }) {
  if (entrada.imagen) {
    return (
      <img src={entrada.imagen} alt="" width={17} height={17}
        style={{ width: 17, height: 17, borderRadius: 4, objectFit: "cover", flex: "none" }} />
    );
  }
  return <>{Ico[entrada.icono]()}</>;
}

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
export function Lateral({ grupos, nombre, detalle, foto, onSalir, abierto, cerrar }: Props) {
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
    /* Se acumula la cadena de `offsetParent` en vez de usar rects, y son dos
       razones distintas:
       · `offsetTop` a secas cuenta desde el ancestro POSICIONADO más cercano,
         y desde que cada categoría es `position:relative` (lo necesita para su
         textura) ese ancestro dejó de ser el menú.
       · Los rects sí dan coordenadas absolutas, pero incluyen los transforms
         — y la entrada escalonada de arriba deja cada fila corrida -6px
         mientras corre. El indicador se medía en pleno vuelo y aterrizaba
         seis píxeles a la izquierda.
       `offsetLeft/Top` son coordenadas de LAYOUT: ignoran el transform. */
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = activo; n && n !== menu; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
      // `offsetLeft` se cuenta desde el borde INTERIOR del padre, así que su
      // borde de 1 px hay que sumarlo a mano o el indicador queda corrido.
      const padre = n.offsetParent as HTMLElement | null;
      if (padre && padre !== menu) {
        x += padre.clientLeft;
        y += padre.clientTop;
      }
    }
    const destino = {
      opacity: 1,
      left: x,
      y,
      width: activo.offsetWidth,
      height: activo.offsetHeight,
    };
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
            <div key={g.titulo} className="nav-grupo" data-cat={g.clave}>
              <button
                className={"nav-grupo-tit" + (cerrado ? " cerrado" : "")}
                onClick={() => plegar(g.titulo)}
                aria-expanded={!cerrado}
              >
                {Ico[g.icono]({ t: 13 })}
                <span>{g.titulo}</span>
                {Ico.galon({ t: 12 })}
              </button>

              {!cerrado && (
                <div className={g.fila ? "nav-agentes" : "nav-lista"}>
                {g.entradas.map((e) =>
                  e.pronto ? (
                    <button
                      key={e.a}
                      className="nav-item"
                      disabled
                      style={{ opacity: 0.5, cursor: "default" }}
                      title="Todavía no está disponible"
                    >
                      <IconoEntrada entrada={e} />
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
                      className={({ isActive }) =>
                        (e.agente ? `agente agente-${e.agente}` : "nav-item") +
                        (isActive ? " on" : "")}
                    >
                      {({ isActive }) => e.agente
                        ? <TarjetaAgente entrada={e} activa={isActive} />
                        : <><IconoEntrada entrada={e} /><span>{e.texto}</span></>}
                    </NavLink>
                  ),
                )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button className="tarjeta-user" onClick={onSalir} title="Cerrar sesión">
        {foto ? (
          <img src={foto} alt="" width={32} height={32}
            style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover", flex: "none" }} />
        ) : (
          <span className="ini">{iniciales(nombre)}</span>
        )}
        <div>
          <b>{nombre}</b>
          <small>{detalle}</small>
        </div>
        <span style={{ color: "var(--texto-3)" }}>{Ico.salir({ t: 15 })}</span>
      </button>
    </aside>
  );
}
