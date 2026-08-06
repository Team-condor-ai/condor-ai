import { useEffect, useState } from "react";
import ave from "../assets/colombia/ave.webp";
import laptop from "../assets/colombia/laptop.webp";
import fotoEquipo from "../assets/colombia/equipo.webp";
import fotoOficina from "../assets/colombia/oficina.webp";
import sitioInmobiliario from "../assets/colombia/sitios/inmobiliario.webp";
import sitioEcommerce from "../assets/colombia/sitios/ecommerce.webp";
import sitioRestaurante from "../assets/colombia/sitios/restaurante.webp";
import FormularioRapido from "../components/FormularioRapido";
import "./Colombia.css";

/* =============================================================================
   Landing de campaña — Cóndor.ai × Colombia  (ruta /colombia)
   Un solo objetivo: conseguir un número de WhatsApp.

   REESCRITURA 2026-07-31 — "La página honesta"
   ---------------------------------------------------------------------------
   La versión anterior era oscura, con video atado al scroll, cristal, precios,
   planes, FAQ y nueve secciones. Se cambió por decisión de negocio: el anuncio
   trae a alguien que no nos conoce, y una página que promete mucho antes de
   habernos visto la cara genera desconfianza, no deseo.

   Lo que esta página NO dice, a propósito:
     · que usamos IA — es cómo trabajamos, no lo que el cliente compra
     · plazos de entrega — prometer días sin conocer el proyecto es mentir
   Nada de eso sobrevive al primer "depende", y prometerlo en la landing
   convierte peor y quema la reunión.

   CAMBIO 2026-08-05 — el precio SÍ va
   ---------------------------------------------------------------------------
   La versión anterior omitía el precio a propósito ("se habla en la reunión").
   Los dos primeros días de campaña lo desmintieron: 129 visitas desde el
   anuncio, CTR 7,3% (excelente) y **cero** leads. El anuncio convence y la
   página no cierra.

   En "páginas web" el precio es LA pregunta. No responderla no la evita: hace
   que la persona se vaya a averiguar a otro lado. Por eso ahora va el "desde
   $390.000 COP" en el titular, en las señales de confianza y en los metadatos.

   El resto del razonamiento sigue en pie: los plazos y el alcance se cierran
   en la reunión, que es donde hay un proyecto concreto sobre la mesa.

   CAMBIO 2026-08-05 (tarde) — fuera el agendamiento
   ---------------------------------------------------------------------------
   Con el precio puesto, el embudo del segundo día quedó así:

       146 llegaron a la página
        43 abrieron el formulario   (29% — la página convence)
         0 lo completaron           (0%)

   El problema no era la página: era pedirle a alguien que llegó hace cuarenta
   segundos su nombre, su WhatsApp, su correo, un día y una hora, dentro de un
   modal que primero había que abrir. Las 43 tenían intención y se perdieron
   ahí.

   Ahora hay un solo formulario, abierto, de UN campo —el WhatsApp, con el +57
   fijo— en el hero y repetido en el cierre. El calendario, el modal, el correo
   y hasta el nombre se eliminaron: el nombre se pregunta en el primer mensaje
   de WhatsApp, que es gratis y no cuesta una conversión. El horario se acuerda
   ahí mismo, que es lo que pasaba de todos modos.
   Ver components/FormularioRapido.tsx.

   La bajada del hero también se acortó a una línea: la versión larga empujaba
   el formulario fuera de la primera pantalla en móvil, y en tráfico pagado lo
   que no se ve al llegar no existe.

   Lo que SÍ dice: quiénes somos, con nuestras caras y nuestra oficina de
   verdad (fotos reales, no stock ni render), qué hemos hecho (sitios en vivo,
   no maquetas) y cómo hablar con nosotros.

   Estructura completa: hero → quiénes somos → trabajo → cierre. Cuatro
   secciones. Cada scroll extra en tráfico pagado es gente que se va.

   Contrato del formulario (NO romper — coordinado con Samuel):
     POST {VITE_LEADS_API}          (la URL /exec del Apps Script, SIN sufijo)
     {
       tipo: "contacto",
       nombre: string, whatsapp: string, correo: string,
       origen: { utm_source, utm_medium, utm_campaign, utm_content, fbclid, url },
       creativo?: string
     }
   El Apps Script valida que `nombre`, `whatsapp` y `tipo` vengan con algo
   (devuelve {"ok":false} si falta uno). Como el formulario ya no pide nombre,
   se manda el marcador "Sin nombre (form rápido)" y `correo` vacío; `tipo` va
   siempre "contacto". Así la hoja de cálculo no cambia y Samuel no toca nada.
   Sin VITE_LEADS_API el envío falla a propósito (un "¡Listo!" sin backend =
   lead pagado perdido en silencio).

   OJO CORS: el fetch va con Content-Type "text/plain" a propósito. Con
   "application/json" se dispara un preflight OPTIONS que los Web Apps de Apps
   Script no responden (falla en silencio). El string sigue siendo JSON válido.

   TRACKING: Meta Pixel + CAPI (ALEJANDRO-ENTREGA.md §Tracking). Solo en esta
   ruta. Eventos: PageView y Lead. ViewContent y Schedule desaparecieron junto
   con el modal y el calendario. Sin VITE_META_PIXEL_ID no se carga nada.
   ============================================================================= */

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

/* Correo de contacto para el ejercicio de derechos (Ley 1581). */
const CORREO_DATOS = "contacto@teamcondorcl.com";

/* Metadatos de la ruta. Viven acá y en scripts/prerender.mjs, que es el que
   genera el /colombia/index.html que sí leen los scrapers. Si cambias uno,
   cambia el otro: son la misma tarjeta. */
const META_URL = "https://condorai.cl/colombia/";
const META_TITULO = "Página web profesional desde $390.000 COP | Cóndor.ai Colombia";
const META_DESC =
  "Diseño propio, no plantilla: se ve bien en el celular, aparece en Google y lleva el botón de WhatsApp. Desde $390.000 COP. Déjanos tu WhatsApp y te contactamos hoy, sin costo.";
const META_IMG = "https://condorai.cl/assets/og-colombia.jpg";

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

/* ═══════════════════════ SEÑALES DE CONFIANZA ══════════════════════════════
   Van bajo el CTA del hero, que es donde nace la duda.

   REGLA DURA: cada línea tiene que ser VERIFICABLE por el visitante o cierta
   en la operación. Nada de "+100 clientes felices" ni "10 años de experiencia"
   mientras no sea verdad: en una página cuya propuesta entera es "somos reales,
   estas son nuestras caras", una cifra inflada la destruye completa — y el
   comprador colombiano llega con el radar de estafa encendido.

   JOAQUÍN: confirma estas cuatro antes de publicar. Si alguna no se cumple
   siempre, sácala; una promesa que se rompe en la reunión cuesta el cliente.
   ============================================================================ */
const SEÑALES = [
  "Desde $390.000 COP, sin mensualidad obligatoria",
  "Cotización sin costo y sin compromiso",
  "Más de 4 años haciendo sitios para empresas en Latinoamérica",
  "El dominio queda a tu nombre, no al nuestro",
  "Hablas siempre con quien construye tu página",
  "Puedes visitar los sitios que hicimos, están en vivo",
];

/* ═══════════════════════════ CÓMO TRABAJAMOS ═══════════════════════════════
   La incertidumbre sobre "qué pasa después de que doy mis datos" es uno de los
   motivos más comunes para no dejarlos. Describir el proceso completo antes de
   pedirlos elimina esa duda sin prometer nada que no se cumpla. */
const PASOS = [
  {
    n: "01",
    t: "Nos dejas tu WhatsApp",
    d: "Solo tu nombre y tu número. Te escribimos el mismo día para coordinar cuándo conversamos.",
  },
  {
    n: "02",
    t: "Conversamos 30 minutos",
    d: "Por videollamada. Te preguntamos por tu negocio, quién te compra y qué necesitas que la página haga.",
  },
  {
    n: "03",
    t: "Te pasamos la propuesta",
    d: "Con el alcance y el precio por escrito. Si no te sirve, no pasa nada: la reunión no te costó.",
  },
  {
    n: "04",
    t: "La construimos y te la entregamos",
    d: "Con el dominio a tu nombre y te enseñamos a administrarla. Después sigues hablando con la misma persona.",
  },
];

/* ══════════════════════════════ OBJECIONES ═════════════════════════════════
   Las preguntas que un dueño de PYME se hace y que, si no encuentra
   respondidas, resuelve cerrando la pestaña. Están redactadas como las haría
   él, no como las haría un vendedor.

   JOAQUÍN: estas respuestas describen cómo trabajan ustedes. Revísalas una por
   una — están escritas desde lo que dice el resto de la página, y si alguna no
   es exacta hay que corregirla acá antes de publicar. */
const PREGUNTAS = [
  {
    q: "¿Cuánto cuesta?",
    a: "Depende de lo que necesite tu negocio, y por eso no ponemos un precio en esta página: una cifra inventada para atraerte y después cambiarla en la reunión sería una pérdida de tiempo para los dos. En la reunión te damos el precio por escrito, con el alcance detallado. Si no te sirve, no seguimos y no te costó nada.",
  },
  {
    q: "¿Están en Colombia?",
    a: "Nuestra oficina está en Chile y trabajamos con clientes en Colombia. Atendemos en horario colombiano, de 8:00 a 21:00, y las reuniones son por videollamada. Te lo decimos de entrada porque preferimos que lo sepas antes de escribirnos y no después.",
  },
  {
    q: "¿El dominio y la página quedan a mi nombre?",
    a: "Sí. El dominio se registra a nombre de tu empresa y los accesos son tuyos. No trabajamos con páginas arrendadas de las que no te puedes llevar.",
  },
  {
    q: "¿Puedo editarla yo después?",
    a: "Sí. Te entregamos la página junto con una sesión para que aprendas a cambiar textos, fotos y precios por tu cuenta. Si prefieres que lo hagamos nosotros, también.",
  },
  {
    q: "¿Cuánto se demoran?",
    a: "Depende del tamaño del sitio, y lo sabemos recién después de conocer tu proyecto. En la reunión te damos una fecha concreta y queda por escrito en la propuesta.",
  },
  {
    q: "¿Qué pasa si no me gusta cómo va quedando?",
    a: "Lo revisas mientras la construimos, no al final. Trabajamos por etapas y en cada una nos dices qué cambiar antes de seguir.",
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
  const [privacidad, setPrivacidad] = useState(false);

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
      </header>

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      {/* La entrada va ESCALONADA (--d) y no toda junta: el orden en que
          aparecen las cosas es el orden en que hay que leerlas. Titular, luego
          la promesa, luego la accion. Todo entra en menos de un segundo — es
          trafico pagado, no una intro. */}
      <section className="co-hero">
        <h1 className="co-h1">
          Tu página web profesional
          <em>desde $390.000 COP</em>
        </h1>
        {/* Una línea, no un párrafo. La versión larga (Google, WhatsApp, los 4
            años) empujaba el formulario fuera de la primera pantalla en móvil:
            en tráfico pagado, lo que no se ve al llegar no existe. Ese detalle
            vive ahora en las señales de acá abajo y en "cómo trabajamos". */}
        <p className="co-lead">
          Diseño propio, no una plantilla. Se ve bien en el celular y lleva a tus clientes a WhatsApp.
        </p>

        {/* El formulario va ABIERTO, no detrás de un botón.
            El 5-ago los datos fueron claros: de 146 visitas, 43 abrieron el
            formulario y ninguna lo completó. La intención estaba; la mataron
            los cinco campos y el calendario. Ahora son dos campos y ningún
            clic previo. */}
        <FormularioRapido
          endpoint={LEADS_API}
          atribucion={window.condorAtribucion?.() ?? {}}
          whatsappEmpresa={WSP_LINK}
          onPrivacidad={() => setPrivacidad(true)}
          onLead={(d) =>
            track("Lead", { telefono: d.whatsapp, pais: "CO" })
          }
        />

        {/* Señales de confianza JUSTO bajo el CTA: es donde aparece la duda
            ("¿y si me estafan?"). En Colombia el fraude digital es una
            preocupación cotidiana y este comprador no nos conoce.
            REGLA: cada línea de acá tiene que ser verificable. Nada de "+100
            clientes" ni años inventados. */}
        <ul className="co-senales">
          {SEÑALES.map((s) => (
            <li key={s}>
              <IcoCheck />
              {s}
            </li>
          ))}
        </ul>

        {/* Mockup real con fondo transparente: el portátil se apoya sobre el
            lavado de color de la página en vez de traer su propio recuadro
            blanco, que es lo que delata a los mockups pegados.
            Es ademas el objeto de la FIRMA de movimiento: deriva con el scroll
            (ver useParallax) para que el hero tenga profundidad. */}
        {/* El parallax va en la IMG y el revelado en la FIGURE: los dos escriben
            `transform`, y en el mismo elemento uno pisaría al otro. */}
        <figure className="co-laptop">
          <img
            src={laptop}
            alt="Un sitio web hecho por Cóndor.ai, abierto en un computador"
            width="1600"
            height="973"
          />
        </figure>
      </section>

      {/* ═══════════════════════ QUIÉNES SOMOS ═══════════════════════ */}
      <section className="co-sec" id="equipo">
        <div className="co-nosotros co-glass-panel co-glint">
          <div className="co-nosotros-copy">
            <p className="co-kicker">Quiénes somos</p>
            <h2 className="co-h2">Cuatro personas y una oficina.</h2>
            <p className="co-p">
              No somos una agencia grande ni un formulario de contacto. A la reunión entra quien va a construir tu
              página, y es con quien vas a hablar después.
            </p>
            <p className="co-p">Estas somos nosotros trabajando, un martes cualquiera.</p>
          </div>
          <div className="co-fotos">
            <figure>
              <img src={fotoEquipo} alt="El equipo de Cóndor.ai trabajando en la oficina" loading="lazy" />
            </figure>
            <figure>
              <img src={fotoOficina} alt="La oficina de Cóndor.ai" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      {/* ═════════════════════════ TRABAJO ═════════════════════════ */}
      <section className="co-sec" id="trabajo">
        <div className="co-sec-head">
          <p className="co-kicker">Nuestro trabajo</p>
          <h2 className="co-h2">Algunos sitios que hicimos.</h2>
          <p className="co-p co-p-sub">Están publicados. Entra y navégalos como lo haría tu cliente.</p>
        </div>
        <ul className="co-sitios">
          {SITIOS.map((s, i) => (
            <li
              
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

      {/* ═══════════════════════ CÓMO TRABAJAMOS ═══════════════════════ */}
      {/* Va DESPUÉS del trabajo y ANTES de las preguntas: primero ve que
          sabemos hacerlo, después cómo sería trabajar con nosotros. */}
      <section className="co-sec" id="proceso">
        <div className="co-sec-head">
          <p className="co-kicker">Cómo trabajamos</p>
          <h2 className="co-h2">Qué pasa después de que nos escribes.</h2>
          <p className="co-p co-p-sub">Sin sorpresas. Estos son los cuatro pasos, completos.</p>
        </div>
        <ol className="co-pasos">
          {PASOS.map((p, i) => (
            <li className="co-glass" key={p.n} style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="co-paso-n">{p.n}</span>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ═════════════════════════ OBJECIONES ═══════════════════════════ */}
      {/* Detalles nativos: sin JS, accesibles, y el navegador se encarga del
          teclado. Abrir una no cierra las otras a propósito — quien está
          comparando quiere leer varias. */}
      <section className="co-sec" id="preguntas">
        <div className="co-sec-head">
          <p className="co-kicker">Sin letra chica</p>
          <h2 className="co-h2">Lo que siempre nos preguntan.</h2>
        </div>
        <ul className="co-faq">
          {PREGUNTAS.map((f, i) => (
            <li  key={f.q} style={{ transitionDelay: `${i * 50}ms` }}>
              <details className="co-glass">
                <summary>
                  {f.q}
                  <IcoMas />
                </summary>
                <p>{f.a}</p>
              </details>
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
          <div className="co-sec-head">
            <p className="co-kicker">Lo que dicen</p>
            <h2 className="co-h2">Clientes que ya trabajaron con nosotros.</h2>
          </div>
          {/* El riel se duplica para que el bucle no tenga corte: la copia se
              esconde de lectores de pantalla, si no el texto se lee dos veces. */}
          <div className="co-riel">
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
        <div className="co-cierre-in co-glass-panel co-glint">
          <h2 className="co-h2">¿Conversamos?</h2>
          <p className="co-p">
            Déjanos tu WhatsApp: te escribimos hoy para entender qué necesitas. Sin costo, y si no te
            convence la propuesta no seguimos.
          </p>
          {/* El mismo formulario del hero, otra vez acá: quien llegó leyendo
              hasta el final no debería tener que volver arriba para escribirnos. */}
          <FormularioRapido
            endpoint={LEADS_API}
            atribucion={window.condorAtribucion?.() ?? {}}
            whatsappEmpresa={WSP_LINK}
            onPrivacidad={() => setPrivacidad(true)}
            onLead={(d) =>
              track("Lead", { telefono: d.whatsapp, pais: "CO" })
            }
          />
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
          <button className="co-foot-link" onClick={() => setPrivacidad(true)}>
            Política de tratamiento de datos
          </button>
        </p>
      </footer>

      {/* ═══════════════════ BARRA FIJA (SOLO MÓVIL) ═══════════════════ */}
      {/* Casi todo el tráfico de la campaña llega por celular, y ahí el
          formulario del hero desaparece al primer scroll: entre esa pantalla y
          la del cierre hay cuatro secciones sin ninguna forma de escribirnos.
          Está visible desde el primer frame y no aparece con el scroll — que
          algo se materialice a mitad de página es justo lo que la página no
          hace. Lleva al formulario y deja el cursor puesto en el primer campo. */}
      {!privacidad && (
        <div className="co-fijo">
          <button className="co-btn co-btn-primary"
                  onClick={() => {
                    const c = document.querySelector<HTMLInputElement>(".co-form-rapido input");
                    c?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => c?.focus(), 420);
                  }}>
            Déjanos tu WhatsApp y te contactamos
            <IcoFlecha />
          </button>
        </div>
      )}

      {privacidad && <ModalPrivacidad onClose={() => setPrivacidad(false)} />}
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

function IcoFlecha() {
  return (
    <svg className="co-ico co-ico-fin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h13m0 0-5.5-5.5M18 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Flecha hacia abajo de la etiqueta que apunta al botón principal. */
function IcoCheck() {
  return (
    <svg className="co-ico-check" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4.5 12.5 5 5 10-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoMas() {
  return (
    <svg className="co-ico-mas" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}


/* ══════════════════════ Política de tratamiento de datos ═══════════════════ */
/* Ley 1581 de 2012 + Decreto 1377 de 2013. Va como modal y no como página
   aparte para no sacar al visitante de la landing: salir del embudo en tráfico
   pagado es perderlo.

   JOAQUÍN: revisa que la razón social y el correo sean los correctos antes de
   publicar. Si la empresa tiene NIT o razón social colombiana, agrégala: es
   justamente el dato que este comprador busca para comprobar que existes. */
function ModalPrivacidad({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [onClose]);

  return (
    <div className="co-modal" role="dialog" aria-modal="true" aria-label="Política de tratamiento de datos" onClick={onClose}>
      <div className="co-modal-card co-modal-texto" onClick={(e) => e.stopPropagation()}>
        <button className="co-modal-x" onClick={onClose} aria-label="Cerrar">
          <span aria-hidden>×</span>
        </button>
        <h3>Política de tratamiento de datos</h3>
        <p className="co-form-sub">Ley 1581 de 2012 y Decreto 1377 de 2013 de Colombia.</p>

        <h4>Quién trata tus datos</h4>
        <p>
          Cóndor.ai, responsable del tratamiento. Puedes escribirnos a <b>{CORREO_DATOS}</b> o al WhatsApp {WSP}.
        </p>

        <h4>Qué datos recogemos y para qué</h4>
        <p>
          Solo tu nombre, tu número de WhatsApp y tu correo, más el horario que prefieras. Los usamos para dos cosas:
          coordinar y realizar la reunión que solicitaste, y enviarte por correo la confirmación y un recordatorio
          antes de esa reunión. Nada más.
        </p>

        <h4>Qué NO hacemos</h4>
        <p>
          No vendemos, arrendamos ni entregamos tus datos a terceros con fines comerciales. No te inscribimos en
          listas de publicidad sin que lo pidas.
        </p>

        <h4>Cuánto tiempo los guardamos</h4>
        <p>
          Mientras dure la relación comercial. Si no llegamos a trabajar juntos, los eliminamos al pedirlo o pasados
          doce meses desde el último contacto.
        </p>

        <h4>Tus derechos</h4>
        <p>
          Puedes conocer, actualizar y rectificar tus datos, pedir prueba de esta autorización, ser informado sobre su
          uso, presentar quejas ante la Superintendencia de Industria y Comercio y solicitar que los eliminemos.
          Escríbenos a <b>{CORREO_DATOS}</b> y respondemos dentro de los plazos de ley.
        </p>

        <button className="co-btn co-btn-primary co-btn-block" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
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
    const previo = document.title;
    document.title = META_TITULO;

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
    poner("name", "description", META_DESC);
    poner("property", "og:title", META_TITULO);
    poner("property", "og:description", META_DESC);
    poner("property", "og:type", "website");
    poner("property", "og:url", META_URL);
    poner("property", "og:locale", "es_CO");
    /* Sin og:image, compartir el link por WhatsApp muestra un rectángulo gris.
       En Colombia el link de un proveedor circula por WhatsApp antes de que
       alguien decida, así que esa tarjeta es parte de la venta.
       OJO: los scrapers de Meta y WhatsApp NO ejecutan JavaScript — estas
       etiquetas puestas desde React no las ven. Las que valen son las que
       escribe scripts/prerender.mjs en /colombia/index.html. Estas quedan para
       el navegador y para que dev y producción digan lo mismo. */
    poner("property", "og:image", META_IMG);
    poner("property", "og:image:width", "1200");
    poner("property", "og:image:height", "630");
    poner("name", "twitter:card", "summary_large_image");
    poner("name", "twitter:image", META_IMG);

    return () => {
      document.title = previo;
      puestos.forEach((el) => el.remove());
    };
  }, []);
}

/**
 * Serif itálica del titular (Fontshare). Se carga SOLO en esta ruta, no en el
 * index.html global: es la única página que la usa y el resto del sitio no
 * tiene por qué pagar la descarga.
 */
function useSerif() {
  useEffect(() => {
    /* Zodiak: la serif itálica del titular, la firma de la página.
       Inter: puente hacia San Francisco en Android y Windows. SF no se puede
       servir por web fuera de plataformas Apple, e Inter es lo más cercano
       que sí se puede. En un iPhone nunca se descarga: -apple-system gana
       antes en el stack. */
    const hrefs = [
      "https://api.fontshare.com/v2/css?f[]=zodiak@400i,401&display=swap",
      // Solo los pesos que usa la página y solo el subconjunto latino: con
      // los cuatro pesos y todos los subconjuntos, el navegador terminaba
      // pidiendo el MISMO archivo tres veces (141 KB de más).
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap&subset=latin",
    ];
    hrefs.forEach((href) => {
      if (document.head.querySelector(`link[href="${href}"]`)) return;
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    });
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
