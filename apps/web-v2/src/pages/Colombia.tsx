import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReveal } from "../lib/useReveal";
import ave from "../assets/colombia/ave.webp";
import fotoEquipo from "../assets/colombia/equipo.webp";
import fotoOficina from "../assets/colombia/oficina.webp";
import sitioEcommerce from "../assets/colombia/sitios/ecommerce.webp";
import sitioInmobiliario from "../assets/colombia/sitios/inmobiliario.webp";
import sitioServicios from "../assets/colombia/sitios/servicios.webp";
import sitioRestaurante from "../assets/colombia/sitios/restaurante.webp";
import sitioEsencial from "../assets/colombia/sitios/esencial.webp";
import "./Colombia.css";

/* =============================================================================
   Landing de campaña — Cóndor.ai × Colombia  (ruta /colombia)
   Un solo objetivo: agendar reunión o pedir contacto.

   DIRECCIÓN DE ARTE — "El visor" (noche andina + cristal real)
   ---------------------------------------------------------------------------
   La página invierte el esquema del sitio (claro) a NOCHE, usando los tokens
   --night / --on-night que ya existen en index.css para la mitad "espacio" de
   la marca. No es gusto: el glass necesita luz y profundidad detrás para leerse
   como material. Sobre blanco plano se ve como una tarjeta gris — es la razón
   #1 por la que el glassmorphism se ve barato.

   FIRMA VISUAL (una sola animación compleja, Fase 4):
   El "visor" del hero es un slab de cristal que obedece física de vidrio:
   aplica backdrop-filter sobre CAPTURAS REALES de los sitios que construimos,
   y un brillo especular sigue al puntero como luz sobre vidrio.

   Presupuesto de performance (Android de gama media en 4G, tráfico de Meta):
     - El slab de cristal NO se transforma nunca → el backdrop-filter no se
       re-muestrea por frame. Mover un elemento con backdrop-filter es caro.
     - Lo único que se mueve por frame es el sheen: un elemento ENCIMA del
       cristal animado solo con transform → compositor puro.
     - La suavidad del sheen va horneada en el radial-gradient, NO con
       filter: blur() (un blur por frame sobre algo que se mueve es caro).
     - En táctil no hay puntero: el sheen se ata al scroll del hero.
   El CTA primario es ESMERALDA (#00C878), no rojo: PROYECTO.md §10 documenta
   "verde esmeralda (CTA)" como convención de marca. Contraste sobre noche 9:1
   y con la tinta del botón 10.7:1 — AA con holgura, que el rojo no alcanzaba.

   Backend: Google Apps Script (docs/campana-colombia/Code.gs), NO Supabase/
   WhatsApp Cloud API — decisión 2026-07-28: sin tiempo para la burocracia de
   Meta Business. El lead cae directo a una fila en Google Sheets y el
   seguimiento (recordatorio 24 h antes, contacto post-lead) se hace a mano
   desde ahí, marcando la columna "Estado".

   Contrato del formulario (NO romper — MAX.md; coordinado con Samuel):
     POST {VITE_LEADS_API}          (la URL /exec del Apps Script, SIN sufijo)
     {
       tipo: "reunion" | "contacto",
       nombre: string, whatsapp: string, correo: string,
       fecha_hora?: string,        // texto libre: "martes en la tarde"
       origen: { utm_source, utm_medium, utm_campaign, url },
       creativo?: string           // ?cr= en la URL, para atribución
     }
   Si VITE_LEADS_API no está seteada => modo demo (simula éxito y loguea el payload).

   OJO CORS: el fetch va con Content-Type "text/plain" a propósito. Un
   Content-Type "application/json" dispara un preflight OPTIONS que los Web
   Apps de Apps Script no responden (falla en silencio). Con text/plain el
   string sigue siendo JSON válido; Code.gs lo parsea igual desde
   e.postData.contents.
   ============================================================================= */

type Tipo = "reunion" | "contacto";
type Status = "idle" | "sending" | "ok" | "error";

const LEADS_API = (import.meta.env.VITE_LEADS_API as string | undefined)?.replace(/\/$/, "") ?? "";

const WSP = "+56 9 8898 9824";

/* Sitios reales en vivo — la prueba más fuerte de la página.
   Las imágenes son capturas reales de cada demo (no mockups). */
const SITIOS = [
  {
    img: sitioInmobiliario,
    marca: "HÁBITAT",
    rubro: "Inmobiliaria",
    txt: "Buscador de propiedades en Bogotá, Medellín y Cali, con una asesora de IA que califica al cliente y agenda las visitas.",
    href: "/demos/inmobiliario/",
  },
  {
    img: sitioEcommerce,
    marca: "CUMBRE",
    rubro: "Tienda online",
    txt: "Catálogo, carrito y suscripción mensual, con un asistente que recomienda el grano según el gusto de cada cliente.",
    href: "/demos/ecommerce/",
  },
  {
    img: sitioServicios,
    marca: "VÉRTICE",
    rubro: "Clínica",
    txt: "Tratamientos, equipo y precios, con una recepcionista de IA que responde dudas y agenda valoraciones 24/7.",
    href: "/demos/servicios/",
  },
  {
    img: sitioRestaurante,
    marca: "DON LUCHO",
    rubro: "Restaurante",
    txt: "Carta digital con video de cada plato, historia de la casa y reservas que caen directo al WhatsApp del local.",
    href: "https://joaquinmunozs.github.io/condorweb-demo-restaurante/",
  },
  {
    img: sitioEsencial,
    marca: "TU NEGOCIO",
    rubro: "Servicios",
    txt: "La base: presencia profesional, clara y directa a WhatsApp. Es el punto de partida de la Landing Express.",
    href: "https://joaquinmunozs.github.io/condorweb-demo-esencial/",
  },
];

const INCLUYE = [
  {
    t: "Un asistente de IA propio",
    d: "Un agente entrenado con tu negocio que atiende, recomienda, cotiza y agenda solo, las 24 horas. Ninguna agencia local te lo entrega.",
  },
  {
    t: "Que te encuentren en Google",
    d: "Ficha de Google y SEO local: apareces cuando alguien busca lo que vendes, en tu ciudad, en el momento en que lo necesita.",
  },
  {
    t: "Todo termina en tu WhatsApp",
    d: "Cada visita se convierte en una conversación tuya, en un clic. Sin formularios eternos ni correos que nadie abre.",
  },
  {
    t: "Hosting, dominio y soporte",
    d: "Incluidos en la mensualidad, con cambios ligeros cuando los pidas. Tu página evoluciona con el negocio.",
  },
];

const PLANES = [
  {
    id: "express",
    nombre: "Landing Express",
    pago: "$400.000",
    mensual: "USD $6",
    mensualCop: "~$24.000 COP",
    destacado: true,
    badge: "Arranca aquí",
    para: "Para vender un servicio o producto con una sola página que convierte.",
    items: ["Una página, enfocada en un objetivo", "Diseño a medida (sin plantillas)", "Botón directo a WhatsApp", "Ficha de Google", "Entrega desde 48 horas"],
  },
  {
    id: "profesional",
    nombre: "Web Profesional",
    pago: "$1.250.000",
    mensual: "USD $18",
    mensualCop: "~$72.000 COP",
    destacado: false,
    badge: "El más elegido",
    para: "Para negocios que necesitan catálogo, varias secciones y automatizar la atención.",
    items: ["Sitio completo, varias secciones", "Asistente de IA entrenado con tu negocio", "Catálogo o portafolio", "Integración con Shopify", "SEO local y analítica"],
  },
  {
    id: "medida",
    nombre: "Plataforma a Medida",
    pago: "desde $2.200.000",
    mensual: null,
    mensualCop: "Mensualidad a cotizar",
    destacado: false,
    badge: null,
    para: "Para cuando el negocio necesita un sistema, no una página.",
    items: ["Desarrollo a medida", "Cuentas de usuario y paneles", "Pagos e integraciones", "Automatizaciones con IA", "Soporte dedicado"],
  },
];

const PASOS = [
  { n: "01", t: "Conversamos", d: "Reunión de 30 minutos. Nos cuentas qué vendes y a quién. Salimos con el objetivo claro." },
  { n: "02", t: "Diseñamos", d: "Armamos tu página a medida con tu marca, tus fotos y tu forma de vender. Nada de plantillas." },
  { n: "03", t: "Revisas", d: "Te la mostramos funcionando y ajustamos los detalles hasta que te guste de verdad." },
  { n: "04", t: "Publicamos", d: "Queda en línea conectada a WhatsApp y Google. Desde ahí empieza a trabajar por ti." },
];

const RESENAS = [
  { txt: "Rápidos y quedó increíble. Empezamos a recibir mensajes la primera semana.", by: "Cliente real · retail" },
  { txt: "Entendieron mi negocio y la web vende sola. La recomiendo.", by: "Cliente real · servicios" },
  { txt: "Precio justo y soporte de verdad. Cero vueltas.", by: "Cliente real · gastronomía" },
];

const FAQ = [
  {
    q: "¿En cuánto tiempo queda lista?",
    a: "Desde 48 horas hábiles una vez que tenemos tu información (logo, fotos y qué quieres lograr). Una web completa toma entre 3 y 5 días.",
  },
  {
    q: "¿Qué pasa si no me gusta el diseño?",
    a: "Lo ajustamos. La revisión es parte del proceso y no avanzamos a publicar hasta que estés conforme con el resultado.",
  },
  {
    q: "¿Para qué es la mensualidad?",
    a: "Cubre el hosting, el dominio, el soporte y los cambios ligeros. Es lo que mantiene tu página en línea, rápida y actualizada. Sin ella tendrías que pagar y administrar todo eso aparte.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Tú nos cuentas del negocio y nosotros nos encargamos del diseño, los textos, el hosting y la conexión con WhatsApp y Google.",
  },
  {
    q: "¿Trabajan con negocios en Colombia?",
    a: "Sí. Todo el proceso es en línea: la reunión, las revisiones y la entrega. Atendemos entre 8:00 y 21:00 hora Colombia.",
  },
  {
    q: "¿Puedo ver algo que hayan hecho?",
    a: "Sí, y en vivo. Los cinco sitios de la sección de arriba son reales y están publicados. Entra, navega y conversa con el asistente de IA de cada uno.",
  },
];

/* -------------------------------------------------------------------------- */

export default function Colombia() {
  useReveal(useLocation().pathname);
  const [open, setOpen] = useState<Tipo | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);

  useSheen(stageRef, sheenRef);
  const pegado = useScrolled(10);

  /* La página es standalone (sin Layout) y el sitio es claro: pinto la raíz de
     noche para que el overscroll y la barra del navegador no muestren blanco. */
  useEffect(() => {
    document.documentElement.classList.add("co-root");
    return () => document.documentElement.classList.remove("co-root");
  }, []);

  useMeta();

  return (
    <main className="co">
      <div className="co-bg" aria-hidden />
      <div className="co-grain" aria-hidden />

      {/* Chrome mínimo: sin nav del sitio, un solo objetivo.
          Barra translúcida con scroll edge effect (gana peso al despegarse del
          top) en vez de un border-bottom de 1px. */}
      <header className={`co-top${pegado ? " is-pegado" : ""}`}>
        <div className="co-top-in">
          <div className="co-brand">
            {/* El ave del logo oficial (recortada de assets/logo.png): el
                wordmark del PNG es negro y desaparecería sobre noche, así que
                la palabra va como texto vivo. */}
            <img className="co-mark" src={ave} alt="" width="34" height="25" />
            <b>
              cóndor<i>.ai</i>
            </b>
          </div>
          <div className="co-top-right">
            <span className="co-tag">Colombia</span>
            <button className="co-btn co-btn-primary co-btn-sm co-top-cta" onClick={() => setOpen("reunion")}>
              Agendar
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════ HERO — "El visor" ═══════════════ */}
      <section className="co-hero">
        <div className="co-hero-copy">
          <p className="co-eyebrow reveal">Páginas web con inteligencia artificial</p>
          <h1 className="co-h1 reveal">
            Tu página web, lista y <span className="co-grad">vendiendo</span> en 48 horas.
          </h1>
          <p className="co-lead reveal">
            Diseño a medida, hecha para el celular y para que te encuentren en Google. Nosotros la construimos; tú
            atiendes a los clientes que llegan.
          </p>
          <ul className="co-trust reveal">
            <li className="co-chip">Entrega desde 48 h</li>
            <li className="co-chip">Hosting y soporte 24/7</li>
            <li className="co-chip">Asistente de IA incluido</li>
          </ul>
        </div>

        {/* El visor: cristal real sobre capturas reales de nuestro trabajo. */}
        <div className="co-stage" ref={stageRef}>
          {/* Dos capas, no tres: .co-stage-back tiene overflow:hidden, así que
              una tercera captura asomando por la izquierda queda recortada y el
              velo la apaga del todo. Se leía como nada y pesaba igual. */}
          <div className="co-stage-back" aria-hidden>
            <img className="co-stage-img co-stage-img-a" src={sitioInmobiliario} alt="" />
            <img className="co-stage-img co-stage-img-b" src={sitioRestaurante} alt="" loading="lazy" />
          </div>

          <div className="co-visor">
            <span className="co-sheen" ref={sheenRef} aria-hidden />
            <div className="co-visor-in">
              <p className="co-visor-lbl">Reunión sin costo</p>
              <p className="co-visor-txt">Te mostramos cómo quedaría tu página y cuánto cuesta. 30 minutos.</p>
              <button className="co-btn co-btn-primary co-btn-block" onClick={() => setOpen("reunion")}>
                Agendemos una reunión
              </button>
              <button className="co-btn co-btn-quiet co-btn-block" onClick={() => setOpen("contacto")}>
                Prefiero que me contacten
              </button>
              <p className="co-visor-legal">Atendemos de 8:00 a 21:00, hora Colombia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Somos personas, con oficina. Prueba, no relleno. */}
      <section className="co-equipo">
        <figure className="co-equipo-foto reveal">
          <img src={fotoEquipo} alt="El equipo de Cóndor.ai trabajando en su oficina" loading="lazy" />
        </figure>
        <div className="co-equipo-copy reveal">
          <p className="co-eyebrow">Quiénes lo hacen</p>
          <h2 className="co-h2">Un equipo con nombre, cara y oficina.</h2>
          <p className="co-p">
            No somos un formulario. Somos cuatro personas que diseñan, programan y responden. A la reunión entra quien
            va a construir tu página, no un vendedor.
          </p>
        </div>
      </section>

      {/* ═══════════════ VITRINA — sitios en vivo ═══════════════ */}
      <section className="co-sec" id="trabajo">
        <div className="co-sec-head reveal">
          <p className="co-eyebrow">Trabajo real, no maquetas</p>
          <h2 className="co-h2">Entra a los sitios que construimos. Están en vivo.</h2>
          <p className="co-p co-p-sub">
            Cada uno tiene su asistente de IA atendiendo. Navégalos como lo haría tu cliente, desde el celular.
          </p>
        </div>

        {/* Riel con scroll-snap nativo en celular · grilla en desktop.
            Sin scroll-jacking: en tráfico pagado, todo lo que retrasa el CTA cuesta. */}
        <ul className="co-rail">
          {SITIOS.map((s, i) => (
            <li className="co-card reveal" key={s.marca} style={{ transitionDelay: `${Math.min(i, 3) * 70}ms` }}>
              <a
                className="co-card-a"
                href={s.href}
                target="_blank"
                rel="noopener"
                aria-label={`Ver el sitio de ${s.marca} en vivo`}
              >
                <span className="co-card-shot">
                  <img src={s.img} alt={`Sitio web de ${s.marca}, ${s.rubro.toLowerCase()}`} loading="lazy" />
                </span>
                <span className="co-card-body">
                  <span className="co-card-rubro">{s.rubro}</span>
                  <b className="co-card-marca">{s.marca}</b>
                  <span className="co-card-txt">{s.txt}</span>
                  <span className="co-card-cta">Ver el sitio en vivo →</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="co-rail-nota reveal">
          ¿Tu rubro no está acá? Lo diseñamos igual, a tu medida.
        </p>
      </section>

      {/* ═══════════════ QUÉ INCLUYE ═══════════════ */}
      <section className="co-sec">
        <div className="co-sec-head reveal">
          <p className="co-eyebrow">Qué te llevas</p>
          <h2 className="co-h2">No es una página. Es un vendedor que no duerme.</h2>
        </div>
        <ul className="co-grid-2">
          {INCLUYE.map((c, i) => (
            <li className="co-panel reveal" key={c.t} style={{ transitionDelay: `${(i % 2) * 80}ms` }}>
              <h3 className="co-panel-t">{c.t}</h3>
              <p className="co-panel-d">{c.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════════ PRECIOS ═══════════════ */}
      <section className="co-sec" id="precios">
        <div className="co-sec-head reveal">
          <p className="co-eyebrow">Precios claros</p>
          <h2 className="co-h2">Un pago para construirla, una mensualidad baja para mantenerla.</h2>
          <p className="co-p co-p-sub">
            La mensualidad cubre hosting, dominio, soporte y cambios ligeros. Precios en pesos colombianos.
          </p>
        </div>
        <ul className="co-planes">
          {PLANES.map((p, i) => (
            <li
              className={`co-plan reveal${p.destacado ? " is-destacado" : ""}`}
              key={p.id}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* El plan sin badge igual reserva el hueco: si no, su título
                  arranca más arriba que el de los otros dos y la fila se
                  desalinea. */}
              <span className={`co-plan-badge${p.badge ? "" : " is-hueco"}`} aria-hidden={!p.badge}>
                {p.badge ?? " "}
              </span>
              <h3 className="co-plan-nombre">{p.nombre}</h3>
              <p className="co-plan-para">{p.para}</p>
              <p className="co-plan-precio">
                <span className="co-plan-monto">{p.pago}</span>
                <span className="co-plan-moneda">COP</span>
              </p>
              <p className="co-plan-mensual">
                {p.mensual ? (
                  <>
                    + <b>{p.mensual}</b>/mes <span className="co-plan-cop">{p.mensualCop}</span>
                  </>
                ) : (
                  <span className="co-plan-cop">{p.mensualCop}</span>
                )}
              </p>
              <ul className="co-plan-items">
                {p.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <button
                className={`co-btn co-btn-block ${p.destacado ? "co-btn-primary" : "co-btn-ghost"}`}
                onClick={() => setOpen("reunion")}
              >
                {p.mensual ? `Quiero la ${p.nombre.split(" ")[0]}` : "Conversemos el proyecto"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════════ PROCESO ═══════════════ */}
      <section className="co-sec co-proceso">
        <div className="co-proceso-copy">
          <div className="co-sec-head co-sec-head-l reveal">
            <p className="co-eyebrow">Cómo trabajamos</p>
            <h2 className="co-h2">Cuatro pasos, sin vueltas.</h2>
          </div>
          <ol className="co-pasos">
            {PASOS.map((p, i) => (
              <li className="co-paso reveal" key={p.n} style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="co-paso-n">{p.n}</span>
                <div>
                  <b className="co-paso-t">{p.t}</b>
                  <p className="co-paso-d">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <figure className="co-proceso-foto reveal">
          <img src={fotoOficina} alt="La oficina de Cóndor.ai, con el logo de la marca en la pared" loading="lazy" />
        </figure>
      </section>

      {/* ═══════════════ RESEÑAS ═══════════════ */}
      <section className="co-sec">
        <div className="co-sec-head reveal">
          <p className="co-eyebrow">Lo que dicen</p>
          <h2 className="co-h2">Clientes que ya tienen su página trabajando.</h2>
        </div>
        <ul className="co-resenas">
          {RESENAS.map((r, i) => (
            <li key={i}>
              <figure className="co-resena reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="co-stars" aria-label="5 de 5 estrellas">
                  ★★★★★
                </div>
                <blockquote>{r.txt}</blockquote>
                <figcaption>{r.by}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="co-sec co-sec-faq">
        <div className="co-sec-head reveal">
          <p className="co-eyebrow">Antes de agendar</p>
          <h2 className="co-h2">Preguntas frecuentes</h2>
        </div>
        <div className="co-faq">
          {FAQ.map((f, i) => (
            <details className="co-faq-item reveal" key={f.q} style={{ transitionDelay: `${Math.min(i, 4) * 50}ms` }}>
              <summary>
                {f.q}
                <span className="co-faq-ico" aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ═══════════════ CIERRE ═══════════════ */}
      <section className="co-cierre">
        <div className="co-cierre-in reveal">
          <h2 className="co-h2">¿Arrancamos con tu página?</h2>
          <p className="co-p">
            Agenda una reunión de 30 minutos o déjanos tus datos y te escribimos. Sin costo y sin compromiso.
          </p>
          <div className="co-cierre-cta">
            <button className="co-btn co-btn-primary" onClick={() => setOpen("reunion")}>
              Agendemos una reunión
            </button>
            <button className="co-btn co-btn-ghost" onClick={() => setOpen("contacto")}>
              Prefiero que me contacten
            </button>
          </div>
        </div>
      </section>

      <footer className="co-foot">
        <div className="co-brand">
          <img className="co-mark" src={ave} alt="" width="34" height="25" loading="lazy" />
          <b>
            cóndor<i>.ai</i>
          </b>
        </div>
        <p className="co-foot-txt">
          WhatsApp {WSP} · condorai.cl
          <br />
          <span>Inteligencia artificial para hacer crecer tu negocio.</span>
        </p>
      </footer>

      {open && <LeadModal tipo={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

/* ══════════════════════════ FIRMA: el sheen del visor ══════════════════════ */

/**
 * Brillo especular del cristal (Fase 4 — la única animación compleja de la página).
 *
 * Puntero fino → el sheen persigue al cursor con un resorte críticamente
 * amortiguado (sin overshoot: es luz, no un objeto con masa).
 * Táctil → no hay puntero, así que se ata al progreso de scroll del hero.
 *
 * Solo se escribe `transform` sobre un elemento que está ENCIMA del cristal:
 * el backdrop-filter del cristal no se re-muestrea. Ver nota de performance
 * arriba del archivo.
 */
function useSheen(
  stageRef: React.RefObject<HTMLDivElement | null>,
  sheenRef: React.RefObject<HTMLSpanElement | null>
) {
  useEffect(() => {
    const stage = stageRef.current;
    const sheen = sheenRef.current;
    if (!stage || !sheen) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // Posición de reposo: arriba a la derecha, como una ventana reflejada.
    const REPOSO = { x: 0.68, y: 0.1 };
    let destino = { ...REPOSO };
    const actual = { ...REPOSO };
    let raf = 0;

    const pintar = (nx: number, ny: number) => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const sw = sheen.offsetWidth;
      const sh = sheen.offsetHeight;
      sheen.style.transform = `translate3d(${(nx * w - sw / 2).toFixed(1)}px, ${(ny * h - sh / 2).toFixed(1)}px, 0)`;
    };

    pintar(actual.x, actual.y);
    if (reduce) return;

    const bucle = () => {
      // Resorte críticamente amortiguado (damping 1.0, response ~0.35s).
      const k = 0.12;
      actual.x += (destino.x - actual.x) * k;
      actual.y += (destino.y - actual.y) * k;
      pintar(actual.x, actual.y);
      const quieto = Math.abs(destino.x - actual.x) < 0.0008 && Math.abs(destino.y - actual.y) < 0.0008;
      raf = quieto ? 0 : requestAnimationFrame(bucle);
    };
    const arrancar = () => {
      if (!raf) raf = requestAnimationFrame(bucle);
    };

    if (fino) {
      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        destino.x = (e.clientX - r.left) / r.width;
        destino.y = (e.clientY - r.top) / r.height;
        arrancar();
      };
      const onLeave = () => {
        destino = { ...REPOSO };
        arrancar();
      };
      // Se escucha en la ventana: la luz reacciona aunque el cursor pase cerca,
      // no solo encima del cristal (así se comporta un reflejo real).
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerleave", onLeave);
        cancelAnimationFrame(raf);
      };
    }

    // Táctil: el reflejo recorre el cristal según el scroll.
    let pendiente = false;
    const onScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        const r = stage.getBoundingClientRect();
        const p = 1 - Math.min(1, Math.max(0, (r.top + r.height) / (window.innerHeight + r.height)));
        destino.x = 0.3 + p * 0.5;
        destino.y = 0.05 + p * 0.6;
        arrancar();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [stageRef, sheenRef]);
}

/** Scroll edge effect de la barra superior (apple-design §12: no un border de 1px). */
function useScrolled(umbral: number) {
  const [pegado, setPegado] = useState(false);
  useEffect(() => {
    let pendiente = false;
    const onScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        setPegado(window.scrollY > umbral);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [umbral]);
  return pegado;
}

/**
 * Meta de la ruta. La landing es el destino de un anuncio pagado: cuando Meta
 * scrapea el link o alguien lo comparte, tiene que salir el título de la
 * campaña y no el genérico del sitio (index.html es uno solo para todo el SPA).
 */
function useMeta() {
  useEffect(() => {
    const titulo = "Cóndor.ai — Tu página web lista y vendiendo en 48 horas | Colombia";
    const desc =
      "Páginas web y landings a medida para negocios en Colombia, con asistente de IA, WhatsApp y Google. Desde $400.000 COP, entrega desde 48 horas. Agenda una reunión sin costo.";
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

/* ══════════════════════════════ Modal de lead ══════════════════════════════ */

function LeadModal({ tipo, onClose }: { tipo: Tipo; onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [cuando, setCuando] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const atribucion = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return {
      origen: {
        utm_source: q.get("utm_source") ?? "",
        utm_medium: q.get("utm_medium") ?? "",
        utm_campaign: q.get("utm_campaign") ?? "",
        url: window.location.href,
      },
      creativo: q.get("cr") ?? q.get("utm_content") ?? "",
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
        // Modo demo (VITE_LEADS_API sin setear): simula éxito.
        console.info("[lead demo] POST /leads →", payload);
        await new Promise((r) => setTimeout(r, 700));
        setStatus("ok");
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
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg("No pudimos enviar tus datos. Reintenta o escríbenos por WhatsApp.");
      console.error("[lead] error", err);
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
            <h3>{esReunion ? "¡Listo! Te enviamos el horario." : "¡Recibido! Te contactamos pronto."}</h3>
            <p>
              {esReunion
                ? "Te escribimos por WhatsApp para confirmar el día y la hora de tu reunión (8:00–21:00, hora Colombia)."
                : "Te contactamos en menos de 24 horas por WhatsApp. Gracias por confiar en Cóndor.ai."}
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
                ? "Máximo 1 hora, entre 8:00 y 21:00 hora Colombia. Sin costo y sin compromiso."
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
                {errorMsg}
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
