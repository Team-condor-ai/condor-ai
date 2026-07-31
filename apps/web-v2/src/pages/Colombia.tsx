import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReveal } from "../lib/useReveal";
import ave from "../assets/colombia/ave.webp";
import laptop from "../assets/colombia/laptop.webp";
import fotoEquipo from "../assets/colombia/equipo.webp";
import fotoOficina from "../assets/colombia/oficina.webp";
import sitioInmobiliario from "../assets/colombia/sitios/inmobiliario.webp";
import sitioEcommerce from "../assets/colombia/sitios/ecommerce.webp";
import sitioRestaurante from "../assets/colombia/sitios/restaurante.webp";
import "./Colombia.css";

/* =============================================================================
   Landing de campaña — Cóndor.ai × Colombia  (ruta /colombia)
   Un solo objetivo: agendar reunión o pedir contacto.

   REESCRITURA 2026-07-31 — "La página honesta"
   ---------------------------------------------------------------------------
   La versión anterior era oscura, con video atado al scroll, cristal, precios,
   planes, FAQ y nueve secciones. Se cambió por decisión de negocio: el anuncio
   trae a alguien que no nos conoce, y una página que promete mucho antes de
   habernos visto la cara genera desconfianza, no deseo.

   Lo que esta página NO dice, a propósito:
     · precios — se hablan en la reunión, con el proyecto sobre la mesa
     · que usamos IA — es cómo trabajamos, no lo que el cliente compra
     · plazos de entrega — prometer días sin conocer el proyecto es mentir
   Nada de eso sobrevive al primer "depende", y prometerlo en la landing
   convierte peor y quema la reunión.

   Lo que SÍ dice: quiénes somos, con nuestras caras y nuestra oficina de
   verdad (fotos reales, no stock ni render), qué hemos hecho (sitios en vivo,
   no maquetas) y dos formas de hablar con nosotros.

   Estructura completa: hero → quiénes somos → trabajo → cierre. Cuatro
   secciones. Cada scroll extra en tráfico pagado es gente que se va.

   Contrato del formulario (NO romper — coordinado con Samuel):
     POST {VITE_LEADS_API}          (la URL /exec del Apps Script, SIN sufijo)
     {
       tipo: "reunion" | "contacto",
       nombre: string, whatsapp: string, correo: string,
       fecha_hora?: string,
       origen: { utm_source, utm_medium, utm_campaign, utm_content, fbclid, url },
       creativo?: string
     }
   Sin VITE_LEADS_API: en DEV simula éxito; en producción falla a propósito
   (un "¡Listo!" sin backend = lead pagado perdido en silencio).

   OJO CORS: el fetch va con Content-Type "text/plain" a propósito. Con
   "application/json" se dispara un preflight OPTIONS que los Web Apps de Apps
   Script no responden (falla en silencio). El string sigue siendo JSON válido.

   TRACKING: Meta Pixel + CAPI (ALEJANDRO-ENTREGA.md §Tracking). Solo en esta
   ruta. Eventos: PageView, ViewContent (abre un formulario), Schedule (agenda),
   Lead (pide contacto). Sin VITE_META_PIXEL_ID no se carga nada.
   ============================================================================= */

type Tipo = "reunion" | "contacto";
type Status = "idle" | "sending" | "ok" | "error";

type DatosTrack = {
  email?: string;
  telefono?: string;
  nombre?: string;
  pais?: string;
  extra?: Record<string, unknown>;
};

declare global {
  interface Window {
    CONDOR_PIXEL_ID?: string;
    condorTrack?: (evento: string, datos?: DatosTrack) => string;
    condorAtribucion?: () => Record<string, string>;
  }
}

const LEADS_API = (import.meta.env.VITE_LEADS_API as string | undefined)?.replace(/\/$/, "") ?? "";
const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ?? "";

/* El Pixel nunca debe romper la página ni el envío del lead. */
function track(evento: string, datos?: DatosTrack) {
  try {
    window.condorTrack?.(evento, datos);
  } catch {
    /* el tracking no es parte del camino crítico */
  }
}

const WSP = "+56 9 8898 9824";
const WSP_LINK = `https://wa.me/${WSP.replace(/\D/g, "")}`;

/* Sitios reales, en vivo. Sin adjetivos de venta: la prueba es que se puede
   entrar. Descripciones de una línea — quien quiera saber más, entra. */
const SITIOS = [
  {
    img: sitioInmobiliario,
    marca: "Hábitat",
    rubro: "Inmobiliaria",
    href: "/demos/inmobiliario/",
  },
  {
    img: sitioEcommerce,
    marca: "Cumbre",
    rubro: "Tienda de café",
    href: "/demos/ecommerce/",
  },
  {
    img: sitioRestaurante,
    marca: "Don Lucho",
    rubro: "Restaurante",
    href: "https://joaquinmunozs.github.io/condorweb-demo-restaurante/",
  },
];

/* ══════════════════════ PRUEBA SOCIAL — OJO, LEER ═══════════════════════════
   Estas resenas son de MAQUETA: sirven para ver como se ve y como se mueve el
   riel, nada mas. No son de clientes reales.

   Por eso la lista real arranca VACIA en produccion y la seccion no se
   renderiza sin datos. No es exceso de celo: publicar testimonios inventados en
   una pagina cuya unica propuesta es "somos reales, estas son nuestras caras"
   es lo que mas rapido destruye esa propuesta — y ademas enganaria a gente que
   esta a punto de dejar sus datos.

   PARA PONERLAS EN VIVO: reemplazar el contenido de RESENAS con testimonios
   reales (con permiso del cliente) y cambiar la constante de abajo. Mientras
   tanto, en localhost se ven las de maqueta y en produccion no aparece nada.
   ============================================================================ */
/* PERSONAS Y NEGOCIOS INVENTADOS. Cada rubro se eligió para que pegue con lo
   que dice el testimonio (una clínica valora los cambios rápidos, un
   restaurante valora que le lleguen pedidos por WhatsApp, un estudio jurídico
   valora hablar siempre con la misma persona). Coherencia = se puede juzgar la
   maqueta; realidad = no, ninguna de estas personas existe.

   SIN CIUDAD, a propósito: nombre + rubro + ubicación identifica a un negocio
   concreto, y con testimonios inventados eso puede caerle encima a alguien que
   existe de verdad. El rubro solo da el contexto que hace creíble la frase, que
   es para lo único que está. Mantenerlo así también cuando sean reales, salvo
   que el cliente pida aparecer con su ciudad. */
const RESENAS_MAQUETA = [
  {
    texto:
      "Nos entendieron el negocio desde la primera reunión. La página quedó justo como la queríamos y los cambios que pedimos los hicieron el mismo día.",
    quien: "Mariana Restrepo",
    negocio: "Clínica dental",
  },
  {
    texto:
      "Llevábamos años con una página que no servía para nada. Ahora la gente nos escribe directo por WhatsApp desde el sitio.",
    quien: "Andrés Gutiérrez",
    negocio: "Restaurante",
  },
  {
    texto: "Lo que más valoro es que siempre supe con quién estaba hablando. Nada de intermediarios ni de tickets.",
    quien: "Catalina Ospina",
    negocio: "Estudio jurídico",
  },
  {
    texto:
      "Nos hicieron preguntas que ni nosotros nos habíamos hecho sobre el negocio. Se nota que no es una plantilla rellenada.",
    quien: "Julián Mesa",
    negocio: "Marca de ropa",
  },
  {
    texto: "Quedó lista antes de lo que esperábamos y nos explicaron cómo administrarla nosotros mismos.",
    quien: "Daniela Cárdenas",
    negocio: "Jardín infantil",
  },
];

/* En produccion la lista va vacia a proposito -> la seccion no se renderiza.
   Cuando existan resenas reales, reemplazar esta linea por la lista de verdad. */
const RESENAS = import.meta.env.DEV ? RESENAS_MAQUETA : [];

/* -------------------------------------------------------------------------- */

export default function Colombia() {
  useReveal(useLocation().pathname);
  const [open, setOpen] = useState<Tipo | null>(null);

  /* La página es standalone y el sitio global es claro, pero con su propio
     fondo. Se pinta la raíz con el crema de esta landing para que el
     overscroll y la barra del navegador no muestren otro color. */
  useEffect(() => {
    document.documentElement.classList.add("co-root");
    return () => document.documentElement.classList.remove("co-root");
  }, []);

  useMeta();
  useTracking();
  useSerif();
  const laptopRef = useParallax();

  /* Abrir un formulario es la microconversión que Meta puede optimizar antes
     de tener volumen de Lead/Schedule: se reporta como ViewContent. */
  const abrir = (tipo: Tipo) => {
    track("ViewContent", { pais: "CO", extra: { formulario: tipo } });
    setOpen(tipo);
  };

  return (
    <main className="co">
      {/* Tres capas de fondo con comportamiento distinto (ver "EL FONDO" en el
          CSS): las manchas de color viven en la PÁGINA y scrollean contigo; el
          grano y la trama grabada se quedan fijos a la pantalla.
          Las manchas son elementos reales y no gradientes del contenedor porque
          cada una necesita su propia silueta irregular y su propio giro: un
          radial-gradient sólo sabe hacer elipses. */}
      <div className="co-luz" aria-hidden>
        {/* El envoltorio existe por rendimiento, no por layout: se dibuja a un
            tercio del tamaño y se escala ×3, así el blur trabaja sobre nueve
            veces menos píxeles. Ver .co-luz-in en el CSS. */}
        <div className="co-luz-in">
          <span className="co-mancha co-m1" />
          <span className="co-mancha co-m2" />
          <span className="co-mancha co-m3" />
          <span className="co-mancha co-m4" />
          <span className="co-mancha co-m5" />
          <span className="co-mancha co-m6" />
        </div>
      </div>
      <div className="co-trama" aria-hidden />

      <header className="co-top">
        <div className="co-brand">
          <img className="co-mark" src={ave} alt="" width="30" height="22" />
          <b>
            cóndor<i>.ai</i>
          </b>
        </div>
        <span className="co-tag">Colombia</span>
      </header>

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      {/* La entrada va ESCALONADA (--d) y no toda junta: el orden en que
          aparecen las cosas es el orden en que hay que leerlas. Titular, luego
          la promesa, luego la accion. Todo entra en menos de un segundo — es
          trafico pagado, no una intro. */}
      <section className="co-hero">
        <h1 className="co-h1 reveal" style={{ "--d": "0.05s" } as React.CSSProperties}>
          Creamos tu página web
          <em>de principio a fin</em>
        </h1>
        <p className="co-lead reveal" style={{ "--d": "0.16s" } as React.CSSProperties}>
          Somos un equipo pequeño. Nos sentamos contigo, entendemos tu negocio y la construimos nosotros mismos.
        </p>

        <div className="co-ctas reveal" style={{ "--d": "0.26s" } as React.CSSProperties}>
          <button className="co-btn co-btn-primary" onClick={() => abrir("reunion")}>
            <IcoCalendario />
            Quiero agendar una reunión
            <IcoFlecha />
          </button>
          <button className="co-btn co-btn-glass" onClick={() => abrir("contacto")}>
            <IcoChat />
            Prefiero que me contacten
          </button>
        </div>

        {/* Mockup real con fondo transparente: el portátil se apoya sobre el
            lavado de color de la página en vez de traer su propio recuadro
            blanco, que es lo que delata a los mockups pegados.
            Es ademas el objeto de la FIRMA de movimiento: deriva con el scroll
            (ver useParallax) para que el hero tenga profundidad. */}
        {/* El parallax va en la IMG y el revelado en la FIGURE: los dos escriben
            `transform`, y en el mismo elemento uno pisaría al otro. */}
        <figure className="co-laptop reveal" style={{ "--d": "0.36s" } as React.CSSProperties}>
          <img
            ref={laptopRef}
            src={laptop}
            alt="Un sitio web hecho por Cóndor.ai, abierto en un computador"
            width="1600"
            height="973"
          />
        </figure>
      </section>

      {/* ═══════════════════════ QUIÉNES SOMOS ═══════════════════════ */}
      <section className="co-sec" id="equipo">
        <div className="co-nosotros co-glass-panel co-glint reveal">
          <div className="co-nosotros-copy co-sub" style={{ "--d": "0.12s" } as React.CSSProperties}>
            <p className="co-kicker">Quiénes somos</p>
            <h2 className="co-h2">Cuatro personas y una oficina.</h2>
            <p className="co-p">
              No somos una agencia grande ni un formulario de contacto. A la reunión entra quien va a construir tu
              página, y es con quien vas a hablar después.
            </p>
            <p className="co-p">Estas somos nosotros trabajando, un martes cualquiera.</p>
          </div>
          <div className="co-fotos">
            <figure className="co-sub" style={{ "--d": "0.2s" } as React.CSSProperties}>
              <img src={fotoEquipo} alt="El equipo de Cóndor.ai trabajando en la oficina" loading="lazy" />
            </figure>
            <figure className="co-sub" style={{ "--d": "0.3s" } as React.CSSProperties}>
              <img src={fotoOficina} alt="La oficina de Cóndor.ai" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      {/* ═════════════════════════ TRABAJO ═════════════════════════ */}
      <section className="co-sec" id="trabajo">
        <div className="co-sec-head reveal">
          <p className="co-kicker">Nuestro trabajo</p>
          <h2 className="co-h2">Algunos sitios que hicimos.</h2>
          <p className="co-p co-p-sub">Están publicados. Entra y navégalos como lo haría tu cliente.</p>
        </div>
        <ul className="co-sitios">
          {SITIOS.map((s, i) => (
            <li
              className="reveal"
              key={s.marca}
              style={{ transitionDelay: `${i * 80}ms`, "--i": i } as React.CSSProperties}
            >
              <a className="co-glass co-glint" href={s.href} target="_blank" rel="noopener">
                <span className="co-sitio-img">
                  <img src={s.img} alt={`Sitio web de ${s.marca}`} loading="lazy" />
                </span>
                <span className="co-sitio-pie">
                  <b>{s.marca}</b>
                  <span>{s.rubro}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ═════════════════════ PRUEBA SOCIAL ═════════════════════════
          Va JUSTO ANTES del CTA final: es el ultimo argumento antes de pedir
          los datos. Ponerla arriba la desperdicia, porque todavia no hay
          intencion; ponerla despues del cierre es no ponerla.
          Si no hay resenas cargadas la seccion no existe — ver el bloque
          "PRUEBA SOCIAL" arriba. */}
      {RESENAS.length > 0 && (
        <section className="co-sec co-resenas-sec" aria-label="Lo que dicen nuestros clientes">
          <div className="co-sec-head reveal">
            <p className="co-kicker">Lo que dicen</p>
            <h2 className="co-h2">Clientes que ya trabajaron con nosotros.</h2>
          </div>
          {/* El riel se duplica para que el bucle no tenga corte: la copia se
              esconde de lectores de pantalla, si no el texto se lee dos veces. */}
          <div className="co-riel reveal">
            <ul className="co-riel-pista">
              {RESENAS.map((r, i) => (
                <Resena key={`a${i}`} {...r} />
              ))}
              {RESENAS.map((r, i) => (
                <Resena key={`b${i}`} {...r} copia />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ══════════════════════════ CIERRE ══════════════════════════ */}
      <section className="co-cierre">
        <div className="co-cierre-in co-glass-panel co-glint reveal">
          <h2 className="co-h2">¿Conversamos?</h2>
          <p className="co-p">Una reunión de 30 minutos para conocer tu negocio. Sin costo y sin compromiso.</p>
          <div className="co-ctas">
            <button className="co-btn co-btn-primary" onClick={() => abrir("reunion")}>
              <IcoCalendario />
              Quiero agendar una reunión
              <IcoFlecha />
            </button>
            <button className="co-btn co-btn-glass" onClick={() => abrir("contacto")}>
              <IcoChat />
              Prefiero que me contacten
            </button>
          </div>
        </div>
      </section>

      <footer className="co-foot">
        <div className="co-brand">
          <img className="co-mark" src={ave} alt="" width="26" height="19" loading="lazy" />
          <b>
            cóndor<i>.ai</i>
          </b>
        </div>
        <p>
          <a href={WSP_LINK} target="_blank" rel="noopener noreferrer">
            WhatsApp {WSP}
          </a>
          <span>Atendemos de 8:00 a 21:00, hora Colombia.</span>
        </p>
      </footer>

      {open && <LeadModal tipo={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Resena({
  texto,
  quien,
  negocio,
  copia,
}: {
  texto: string;
  quien: string;
  negocio: string;
  copia?: boolean;
}) {
  return (
    <li className="co-resena" aria-hidden={copia || undefined}>
      <p className="co-resena-txt">{texto}</p>
      <p className="co-resena-quien">
        <b>{quien}</b>
        <span>{negocio}</span>
      </p>
    </li>
  );
}

/* ══════════════════════════════ Iconos ═════════════════════════════════════ */
/* Inline y con currentColor: heredan el color del botón y no cuestan pedido. */

function IcoCalendario() {
  return (
    <svg className="co-ico" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IcoChat() {
  return (
    <svg className="co-ico" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12.2c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20l1.4-3.6C4.5 15.2 4 13.8 4 12.2c0-3.9 3.6-7 8-7s8 3.1 8 7Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IcoFlecha() {
  return (
    <svg className="co-ico co-ico-fin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h13m0 0-5.5-5.5M18 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════ Hooks ══════════════════════════════════════ */

/**
 * Meta de la ruta. La landing es el destino de un anuncio pagado: cuando Meta
 * scrapea el link o alguien lo comparte, tiene que salir el título de la
 * campaña y no el genérico del sitio (index.html es uno solo para todo el SPA).
 */
function useMeta() {
  useEffect(() => {
    const titulo = "Cóndor.ai — Creamos tu página web de principio a fin | Colombia";
    const desc =
      "Somos un equipo pequeño. Nos sentamos contigo, entendemos tu negocio y construimos tu página web nosotros mismos. Agenda una reunión sin costo.";
    const previo = document.title;
    document.title = titulo;

    const puestos: HTMLMetaElement[] = [];
    const poner = (attr: "name" | "property", clave: string, valor: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${clave}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, clave);
        document.head.appendChild(el);
        puestos.push(el);
      }
      el.setAttribute("content", valor);
    };
    poner("name", "description", desc);
    poner("property", "og:title", titulo);
    poner("property", "og:description", desc);
    poner("property", "og:type", "website");

    return () => {
      document.title = previo;
      puestos.forEach((el) => el.remove());
    };
  }, []);
}

/**
 * FIRMA DE MOVIMIENTO — el portátil deriva con el scroll.
 *
 * Sube un poco más lento que la página, así el hero gana profundidad y el
 * momento en que se apoya sobre la tarjeta de "quiénes somos" se siente como
 * que ATERRIZA ahí, no como que estaba pegado desde el principio.
 *
 * Es la única animación compleja de la página, a propósito: varias compitiendo
 * es lo que hace ver una landing sobrecargada, y acá todo lo que distrae del
 * CTA cuesta plata.
 *
 * Decisiones de costo (es una imagen grande):
 *   · Solo se escribe `transform` → capa de compositor, sin layout ni paint.
 *   · rAF-throttled: el evento de scroll dispara decenas de veces por frame.
 *   · Se apaga con IntersectionObserver cuando el portátil sale de pantalla:
 *     seguir calculando para algo que no se ve es trabajo regalado.
 *   · Se redondea a 1 decimal y no se escribe si no cambió — evita invalidar
 *     la capa por diferencias invisibles.
 *   · prefers-reduced-motion lo desactiva entero (queda quieto, sin salto).
 */
function useParallax() {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Rango corto: 44px. Más que eso deja de leerse como profundidad y empieza
       a leerse como que el elemento se despega de la página. */
    const RANGO = 44;
    let visible = true;
    let pedido = false;
    let ultimo = -999;

    const pintar = () => {
      const caja = el.getBoundingClientRect();
      /* Progreso del elemento cruzando el viewport: 0 cuando entra por abajo,
         1 cuando sale por arriba. Se centra en 0 para que la deriva sea
         simétrica y el elemento pase por su posición real a mitad de camino. */
      const p = (window.innerHeight - caja.top) / (window.innerHeight + caja.height);
      const y = Math.round((0.5 - Math.min(1, Math.max(0, p))) * RANGO * 10) / 10;
      if (y !== ultimo) {
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        ultimo = y;
      }
    };

    const alScrollear = () => {
      if (pedido || !visible) return;
      pedido = true;
      requestAnimationFrame(() => {
        pedido = false;
        pintar();
      });
    };

    const obs = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) pintar();
    });
    obs.observe(el);
    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alScrollear);
    pintar();

    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", alScrollear);
    };
  }, []);

  return ref;
}

/**
 * Serif itálica del titular (Fontshare). Se carga SOLO en esta ruta, no en el
 * index.html global: es la única página que la usa y el resto del sitio no
 * tiene por qué pagar la descarga.
 */
function useSerif() {
  useEffect(() => {
    const href = "https://api.fontshare.com/v2/css?f[]=zodiak@400i,401&display=swap";
    if (document.head.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }, []);
}

/**
 * Meta Pixel + Conversions API, solo en esta ruta.
 * El script vive en /public (es de Alejandro y lo comparten las landings
 * estáticas); acá solo se inyecta. Se deja montado al desmontar: fbq es global
 * y recargarlo duplicaría PageView si el usuario navega y vuelve.
 */
function useTracking() {
  useEffect(() => {
    if (!PIXEL_ID) {
      if (import.meta.env.DEV) console.info("[tracking] VITE_META_PIXEL_ID sin setear: Pixel desactivado.");
      return;
    }
    const SRC = "/assets/js/condor-tracking.js";
    /* Se pregunta por la ETIQUETA, no por window.condorTrack: el script es
       async, así que entre que se inyecta y se ejecuta hay una ventana en la
       que condorTrack todavía no existe. Con StrictMode eso inyectaba el
       script dos veces y Meta recibía dos PageView — tráfico inflado al doble. */
    if (document.querySelector(`script[src="${SRC}"]`)) {
      track("PageView");
      return;
    }
    window.CONDOR_PIXEL_ID = PIXEL_ID;
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    document.head.appendChild(s);
  }, []);
}

/* ══════════════════════════════ Modal de lead ══════════════════════════════ */

function LeadModal({ tipo, onClose }: { tipo: Tipo; onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [cuando, setCuando] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  /* Atribución: la fuente de verdad es condorAtribucion() (la guarda en la
     primera visita y sobrevive a la navegación del SPA, cuando la URL ya no
     trae ?utm_). La URL actual solo rellena lo que falte. */
  const atribucion = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    let guardada: Record<string, string> = {};
    try {
      guardada = window.condorAtribucion?.() ?? {};
    } catch {
      /* sin tracking cargado */
    }
    const dato = (k: string) => guardada[k] || q.get(k) || "";
    return {
      origen: {
        utm_source: dato("utm_source"),
        utm_medium: dato("utm_medium"),
        utm_campaign: dato("utm_campaign"),
        utm_content: dato("utm_content"),
        fbclid: dato("fbclid"),
        url: window.location.href,
      },
      creativo: q.get("cr") || dato("utm_content"),
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Bloqueo del scroll de fondo: sin esto la página se mueve detrás del modal.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose]);

  const esReunion = tipo === "reunion";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const telOk = whatsapp.replace(/\D/g, "").length >= 7;
  const puedeEnviar = nombre.trim().length >= 2 && emailOk && telOk && status !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setStatus("sending");
    setErrorMsg("");

    const payload = {
      tipo,
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim(),
      correo: correo.trim().toLowerCase(),
      ...(esReunion && cuando.trim() ? { fecha_hora: cuando.trim() } : {}),
      ...atribucion,
    };

    try {
      if (!LEADS_API) {
        // En desarrollo se simula el éxito para poder probar el flujo completo.
        // En producción NO: un "¡Listo!" sin backend es un lead pagado que se
        // pierde en silencio. Mejor mostrar el error y empujar a WhatsApp.
        if (!import.meta.env.DEV) throw new Error("VITE_LEADS_API sin configurar en el deploy");
        console.info("[lead demo] POST /leads →", payload);
        await new Promise((r) => setTimeout(r, 700));
        exito();
        return;
      }
      // Content-Type text/plain a propósito: ver nota CORS arriba del archivo.
      const res = await fetch(LEADS_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({ ok: true }));
      if (data && data.ok === false) throw new Error(data.error || "Backend respondió error");
      exito();
    } catch (err) {
      setStatus("error");
      setErrorMsg("No pudimos enviar tus datos. Reintenta o escríbenos por WhatsApp.");
      console.error("[lead] error", err);
    }

    /* La conversión se reporta SOLO cuando el lead quedó guardado: si Meta
       optimiza sobre envíos fallidos, compra tráfico que nunca llega a la
       hoja. Schedule vs Lead separa "agendó" de "que me contacten". */
    function exito() {
      track(esReunion ? "Schedule" : "Lead", {
        email: payload.correo,
        telefono: payload.whatsapp,
        nombre: payload.nombre,
        pais: "CO",
        extra: { formulario: tipo },
      });
      setStatus("ok");
    }
  }

  return (
    <div
      className="co-modal"
      role="dialog"
      aria-modal="true"
      aria-label={esReunion ? "Agendar reunión" : "Solicitar contacto"}
      onClick={onClose}
    >
      <div className="co-modal-card" ref={cardRef} onClick={(e) => e.stopPropagation()}>
        <button className="co-modal-x" onClick={onClose} aria-label="Cerrar">
          <span aria-hidden>×</span>
        </button>

        {status === "ok" ? (
          <div className="co-ok">
            <div className="co-ok-ico" aria-hidden>
              ✓
            </div>
            <h3>{esReunion ? "¡Listo! Te escribimos." : "¡Recibido!"}</h3>
            <p>
              {esReunion
                ? "Te contactamos por WhatsApp para confirmar el día y la hora (8:00–21:00, hora Colombia)."
                : "Te contactamos en menos de 24 horas por WhatsApp. Gracias por escribirnos."}
            </p>
            <button className="co-btn co-btn-primary co-btn-block" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form className="co-form" onSubmit={submit}>
            <h3>{esReunion ? "Agendemos una reunión" : "Déjanos tus datos"}</h3>
            <p className="co-form-sub">
              {esReunion
                ? "Media hora, entre 8:00 y 21:00 hora Colombia. Sin costo y sin compromiso."
                : "Te contactamos en menos de 24 horas. Rápido y sin vueltas."}
            </p>

            <label className="co-field">
              <span>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoFocus />
            </label>
            <label className="co-field">
              <span>WhatsApp</span>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="tel"
                placeholder="+57 300 000 0000"
              />
            </label>
            <label className="co-field">
              <span>Correo</span>
              <input
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                inputMode="email"
                placeholder="tucorreo@ejemplo.com"
              />
            </label>
            {esReunion && (
              <label className="co-field">
                <span>
                  ¿Qué día y hora te acomoda? <i>(opcional)</i>
                </span>
                <input
                  value={cuando}
                  onChange={(e) => setCuando(e.target.value)}
                  placeholder="Ej: martes en la tarde"
                />
              </label>
            )}

            {status === "error" && (
              <p className="co-form-err" role="alert">
                {errorMsg}{" "}
                {/* Salida de emergencia: el lead ya está pagado, no se puede
                    perder porque el backend falle. */}
                <a
                  href={`${WSP_LINK}?text=${encodeURIComponent(
                    `Hola, soy ${nombre.trim() || "..."} y quiero información sobre mi página web.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribir por WhatsApp →
                </a>
              </p>
            )}

            <button className="co-btn co-btn-primary co-btn-block" type="submit" disabled={!puedeEnviar}>
              {status === "sending" ? "Enviando…" : esReunion ? "Agendar mi reunión" : "Quiero que me contacten"}
            </button>
            <p className="co-form-legal">Al enviar aceptas que te contactemos por estos medios.</p>
          </form>
        )}
      </div>
    </div>
  );
}
