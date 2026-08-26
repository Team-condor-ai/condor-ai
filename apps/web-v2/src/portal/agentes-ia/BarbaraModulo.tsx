import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Ico } from "../disenio/iconos";
import { navegarConTransicion } from "../disenio/vistaTransicion";
import { useNombreUsuario } from "../auth/nombreUsuario";
import { saludoHora, subtituloSaludo } from "./saludo";
import { TituloAnimado } from "./TituloAnimado";
import { infoPlan, type BarbaraBrandBook, type BarbaraFormulario } from "./tipos";
import { BarbaraChat } from "./BarbaraChat";
import { BarbaraCalendario } from "./BarbaraCalendario";
import { BarbaraBiblioteca } from "./BarbaraBiblioteca";
import { BarbaraAnalisis } from "./BarbaraAnalisis";
import { BarbaraConfiguracion } from "./BarbaraConfiguracion";
import { BarbaraFondoCosmico } from "./BarbaraFondoCosmico";
import { BarbaraEstadoVivo } from "./BarbaraEstadoVivo";
import { BarbaraAvatar } from "./BarbaraAvatar";
import { GrafoMemoria } from "../staff/memoria/GrafoMemoria";
import { Mcp } from "../staff/Mcp";

type Seccion = "chat" | "analisis" | "calendario" | "biblioteca" | "memoria" | "mcp" | "configuracion";

const NAV: { grupo: string; icono: keyof typeof Ico; items: { id: Seccion; texto: string; icono: keyof typeof Ico }[] }[] = [
  { grupo: "Inicio", icono: "panel", items: [
    { id: "chat", texto: "Bárbara IA", icono: "chat" },
    { id: "analisis", texto: "Análisis y reportes", icono: "grafo" },
  ] },
  { grupo: "Contenido", icono: "reuniones", items: [
    { id: "calendario", texto: "Calendario", icono: "reuniones" },
    { id: "biblioteca", texto: "Entregas", icono: "biblioteca" },
  ] },
  { grupo: "Inteligencia", icono: "memoria", items: [
    { id: "memoria", texto: "Memoria", icono: "memoria" },
  ] },
  { grupo: "Ajustes", icono: "ajustes", items: [
    { id: "mcp", texto: "MCP", icono: "mcp" },
    { id: "configuracion", texto: "Configuración", icono: "ajustes" },
  ] },
];

/** Orden plano de las secciones: escalona la entrada del riel sin depender
 *  de la posición dentro de cada grupo. */
const ORDEN_NAV: Record<Seccion, number> = Object.fromEntries(
  NAV.flatMap((grupo) => grupo.items).map((item, indice) => [item.id, indice]),
) as Record<Seccion, number>;

const NOMBRE_SECCION: Record<Seccion, string> = {
  chat: "Bárbara IA",
  analisis: "Análisis y reportes",
  calendario: "Calendario",
  biblioteca: "Entregas y revisión",
  memoria: "Memoria",
  mcp: "MCP",
  configuracion: "Configuración",
};

const POSES_BARBARA = Array.from(
  { length: 50 },
  (_, indice) => `/assets/barbara/personaje/barbara-${String(indice + 1).padStart(2, "0")}.png`,
);

const INTERVALO_POSE_BARBARA_MS = 4200;

/** (codex) Una pose se conserva mientras el usuario está dentro de Bárbara,
 * pero al volver a entrar toma la siguiente. `sessionStorage` evita repetir
 * siempre la primera sin perfilar al usuario ni necesitar una llamada a BD. */
function siguienteIndiceBarbara() {
  try {
    const clave = "barbara:pose:cursor";
    const actual = Number(sessionStorage.getItem(clave) || "-1");
    const indice = (Number.isInteger(actual) ? actual + 1 : 0) % POSES_BARBARA.length;
    sessionStorage.setItem(clave, String(indice));
    return indice;
  } catch {
    return Math.floor(Date.now() / 1000) % POSES_BARBARA.length;
  }
}

type Props = {
  barbaraClienteId: string;
  negocio: string;
  plan: string;
  rubro: string | null;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  onCambio: () => void;
  /** Staff ve secciones extra. Las reglas aprendidas se revisan desde la
   *  ficha del cliente (`FichaBarbaraCliente`), ya no desde el inicio. */
  esStaff?: boolean;
  activo?: boolean | null;
  telegramListo?: boolean;
  /** A dónde vuelve el botón de la esquina superior izquierda. */
  volverA: string;
  volverTexto: string;
};

/**
 * El módulo "Agentes IA > Bárbara" completo — mismo componente para un
 * cliente externo viendo SU Bárbara y para staff viendo la de cualquier
 * cliente (incluida la de Cóndor mismo). Pedido explícito de Joaquín
 * (24-ago-2026): que se sienta como entrar a OTRA app dentro del portal,
 * fiel a las 5 capturas de referencia que mandó — riel oscuro propio,
 * acento lima, tipografía serif para los saludos grandes. `Portal.tsx`
 * saca este módulo por completo del chrome de Cóndor (sin `Marco`, sin el
 * menú lateral del portal) antes de llegar acá — por eso existe el botón
 * de volver propio, es la única salida.
 */
export function BarbaraModulo({
  barbaraClienteId, negocio, plan, rubro, brandBook, formulario, onCambio, esStaff, activo, telegramListo, volverA, volverTexto,
}: Props) {
  const [seccion, setSeccion] = useState<Seccion>("chat");
  const [poseBarbara, setPoseBarbara] = useState(siguienteIndiceBarbara);
  const [poseBarbaraAnterior, setPoseBarbaraAnterior] = useState<number | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  /* La coreografía de apertura corre UNA sola vez por visita. Si viviera en
     CSS sin bandera, cada cambio de sección la volvería a disparar (la
     sección se remonta por `key`) y el módulo se sentiría inestable. */
  const [entradaInicial, setEntradaInicial] = useState(true);
  const [esMovil, setEsMovil] = useState(() => typeof window !== "undefined" && window.innerWidth <= 900);
  const poseActual = useRef(poseBarbara);
  const navegar = useNavigate();
  const nombreUsuario = useNombreUsuario();

  /* Confirmaciones y formularios pueden montarse junto a la app, fuera de
     `.barbara-modulo`. La marca en body permite que esos planos flotantes
     conserven el lenguaje visual de Bárbara mientras esta vista está activa. */
  useEffect(() => {
    document.body.classList.add("barbara-activa");
    return () => document.body.classList.remove("barbara-activa");
  }, []);

  useEffect(() => {
    const fin = window.setTimeout(() => setEntradaInicial(false), 2600);
    return () => window.clearTimeout(fin);
  }, []);

  /* Cambiar de sección desde el cajón dejaba la página donde estaba: en móvil
     el título de la sección nueva aparecía tapado por la barra fija. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [seccion]);

  useEffect(() => {
    document.body.classList.toggle("barbara-menu-movil-abierto", menuMovilAbierto);
    const cerrarMenu = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuMovilAbierto(false);
    };
    const cerrarEnDesktop = () => {
      const movil = window.innerWidth <= 900;
      setEsMovil(movil);
      if (!movil) setMenuMovilAbierto(false);
    };
    window.addEventListener("keydown", cerrarMenu);
    window.addEventListener("resize", cerrarEnDesktop);
    return () => {
      document.body.classList.remove("barbara-menu-movil-abierto");
      window.removeEventListener("keydown", cerrarMenu);
      window.removeEventListener("resize", cerrarEnDesktop);
    };
  }, [menuMovilAbierto]);

  /* Las poses no son un sprite sheet: cambiar un src de golpe se leia como
     un salto. Conservamos la pose anterior mientras entra la siguiente. */
  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const anterior = poseActual.current;
      const siguiente = (anterior + 1) % POSES_BARBARA.length;
      poseActual.current = siguiente;
      setPoseBarbaraAnterior(anterior);
      setPoseBarbara(siguiente);
    }, INTERVALO_POSE_BARBARA_MS);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    // Precarga una sola pose por adelantado: evita destellos sin descargar
    // los 50 assets apenas se abre el portal.
    const imagen = new Image();
    imagen.src = POSES_BARBARA[(poseBarbara + 1) % POSES_BARBARA.length];
  }, [poseBarbara]);

  useEffect(() => {
    if (poseBarbaraAnterior === null) return;
    const fin = window.setTimeout(() => setPoseBarbaraAnterior(null), 1400);
    return () => window.clearTimeout(fin);
  }, [poseBarbaraAnterior]);

  return (
    <div className={"barbara-modulo" + (entradaInicial ? " barbara-entrada-inicial" : "")}>
      <BarbaraFondoCosmico />
      <header className="barbara-mobile-bar">
        <button
          type="button"
          className="barbara-mobile-menu-btn"
          aria-label="Abrir navegación de Bárbara"
          aria-controls="barbara-navegacion"
          aria-expanded={menuMovilAbierto}
          onClick={() => setMenuMovilAbierto(true)}
        >
          {Ico.menu({ t: 20 })}
        </button>
        <div className="barbara-mobile-identidad">
          <BarbaraAvatar />
          <span><b>Bárbara</b><small>{NOMBRE_SECCION[seccion]}</small></span>
        </div>
      </header>
      <button
        type="button"
        className={`barbara-mobile-backdrop${menuMovilAbierto ? " visible" : ""}`}
        aria-label="Cerrar navegación"
        tabIndex={menuMovilAbierto ? 0 : -1}
        onClick={() => setMenuMovilAbierto(false)}
      />
      <aside
        id="barbara-navegacion"
        className={`barbara-modulo-rail${menuMovilAbierto ? " abierto" : ""}`}
        aria-label="Navegación de Bárbara"
        aria-hidden={esMovil && !menuMovilAbierto ? true : undefined}
        inert={esMovil && !menuMovilAbierto ? true : undefined}
      >
        <div className="barbara-modulo-rail-cabecera">
          <button
            type="button"
            className="barbara-mobile-cerrar"
            aria-label="Cerrar navegación"
            onClick={() => setMenuMovilAbierto(false)}
          >
            {Ico.cerrar({ t: 19 })}
          </button>
          <button
            className="barbara-modulo-volver"
            onClick={() => navegarConTransicion(navegar, volverA, "vuelve")}
          >
            {Ico.volver({ t: 15 })} {volverTexto}
          </button>
          <div className="barbara-modulo-marca">
            <span className="barbara-modulo-avatar">
              <BarbaraAvatar />
            </span>
            <div>
              <b>Bárbara</b>
              <span className="barbara-modulo-badge-ia">IA</span>
            </div>
          </div>
        </div>

        <nav>
          {NAV.map((g, indiceGrupo) => (
            <div
              key={g.grupo}
              className="barbara-modulo-grupo"
              style={{ "--barbara-grupo-indice": indiceGrupo } as CSSProperties}
            >
              <small>{Ico[g.icono]({ t: 12 })} {g.grupo}</small>
              {g.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  style={{ "--barbara-item-indice": ORDEN_NAV[item.id] } as CSSProperties}
                  className={"barbara-modulo-item" + (seccion === item.id ? " on" : "")}
                  onClick={() => {
                    setSeccion(item.id);
                    setMenuMovilAbierto(false);
                  }}
                  aria-current={seccion === item.id ? "page" : undefined}
                >
                  <span className="barbara-modulo-item-dot" />
                  {Ico[item.icono]({ t: 16 })}
                  <span>{item.texto}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="barbara-modulo-contenido">
        {/* (codex) `key` vuelve a montar únicamente el lienzo al cambiar de
            sección. Así el crecimiento se reproduce una vez por navegación,
            sin reiniciar el riel ni los estados internos del módulo. Es el
            equivalente liviano de Grow de MUI: escala + opacidad, con un solo
            hijo DOM, pero sin sumar toda la librería al bundle del portal. */}
        <section
          key={seccion}
          className="barbara-seccion-crecer"
          aria-label={NOMBRE_SECCION[seccion]}
        >
        {seccion === "chat" && (
          <div className="barbara-inicio">
            <div className="barbara-inicio-principal">
              <div className="barbara-hero" aria-label="Bárbara, tu agente de contenido">
                <BarbaraEstadoVivo />
                <div className="barbara-hero-avatar">
                  <img className="barbara-hero-anillo" src="/assets/barbara/fondo/anillo.webp" alt="" aria-hidden="true" />
                  <div className="barbara-hero-personaje">
                    {poseBarbaraAnterior !== null && (
                      <img
                        key={poseBarbaraAnterior}
                        src={POSES_BARBARA[poseBarbaraAnterior]}
                        alt=""
                        aria-hidden="true"
                        className="barbara-hero-img barbara-hero-img-animada saliendo"
                      />
                    )}
                    <img
                      key={poseBarbara}
                      src={POSES_BARBARA[poseBarbara]}
                      alt="Bárbara"
                      className="barbara-hero-img barbara-hero-img-animada entrando"
                      onError={(evento) => {
                        evento.currentTarget.onerror = null;
                        evento.currentTarget.src = POSES_BARBARA[0];
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="barbara-inicio-interaccion">
                <div className="barbara-hero-cuerpo">
                  <span className="barbara-rotulo">Bárbara · tu agente de contenido</span>
                  <TituloAnimado texto={saludoHora(nombreUsuario, negocio)} className="barbara-titular" />
                  <p>{subtituloSaludo(negocio)}</p>
                </div>
                <BarbaraChat barbaraClienteId={barbaraClienteId} />
              </div>
            </div>

            <div className="barbara-tarjeta barbara-semana-resumen">
              <div className="barbara-semana-titulo">
                <span className="barbara-rotulo">En curso</span>
                <h3>{Ico.reuniones({ t: 17 })} Tu semana de contenido</h3>
              </div>
              <BarbaraCalendario barbaraClienteId={barbaraClienteId} vistaInicial="semana"
                nombreCliente={nombreUsuario || negocio} plan={plan} resumen />
            </div>
          </div>
        )}

        {seccion === "analisis" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.grafo({ t: 22 })} Análisis y reportes</h1>
            <p className="barbara-subtitulo">Cómo le está yendo a tu cuenta en cada red.</p>
            <BarbaraAnalisis barbaraClienteId={barbaraClienteId} />
          </div>
        )}

        {seccion === "calendario" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.reuniones({ t: 22 })} Calendario</h1>
            <BarbaraCalendario barbaraClienteId={barbaraClienteId} vistaInicial="mes"
              nombreCliente={nombreUsuario || negocio} plan={plan} />
          </div>
        )}

        {seccion === "biblioteca" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.biblioteca({ t: 22 })} Entregas y revisión</h1>
            <BarbaraBiblioteca barbaraClienteId={barbaraClienteId} esStaff={Boolean(esStaff)} />
          </div>
        )}

        {seccion === "memoria" && (
          <div className="barbara-tarjeta barbara-tarjeta-memoria">
            <h1>{Ico.memoria({ t: 22 })} Memoria</h1>
            <p className="barbara-subtitulo">La memoria de Bárbara. Conecta ideas, contenidos e insights.</p>
            <GrafoMemoria barbaraClienteId={barbaraClienteId} negocio={negocio} puedeEditar={Boolean(esStaff)} />
          </div>
        )}

        {seccion === "mcp" && (
          <div className="barbara-tarjeta">
            <Mcp />
          </div>
        )}

        {seccion === "configuracion" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.ajustes({ t: 22 })} Configuración</h1>
            <BarbaraConfiguracion
              barbaraClienteId={barbaraClienteId}
              negocio={negocio}
              rubro={rubro}
              brandBook={brandBook}
              formulario={formulario}
              plan={plan}
              onCambio={onCambio}
              esStaff={esStaff}
              activo={activo}
              telegramListo={telegramListo}
            />
            <div className="barbara-config-plan">
              <small>Plan</small>
              <span className={"pill " + infoPlan(plan).pill}>{infoPlan(plan).nombre}</span>
            </div>
            {esStaff && (
              <div style={{ marginTop: 18 }}>
                <button className="btn" onClick={() => navegarConTransicion(navegar, "/acceso/agentes-ia", "vuelve")}>
                  Administrar todos los clientes de Bárbara →
                </button>
              </div>
            )}
          </div>
        )}
        </section>
      </main>
    </div>
  );
}
