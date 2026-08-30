/**
 * Plantillas de carrusel · el texto se compone, no se "dibuja".
 *
 * POR QUÉ NO SE GENERAN LOS SLIDES CON UN MODELO DE IMAGEN
 * ---------------------------------------------------------------------------
 * Un carrusel de Instagram es una pieza TIPOGRÁFICA: casi todo lo que importa
 * es texto puesto en un lugar exacto. Pedírselo a un modelo de imagen es
 * pedirle justo lo que peor hace. La prueba está en el propio código: existe
 * `REGLA_TEXTO`, un párrafo entero rogándole al modelo que no escriba "titular"
 * ni "subtítulo:" dentro de la imagen. Esa regla existe porque el problema es
 * real y no se puede resolver del todo desde el prompt.
 *
 * Componiendo en HTML el texto sale bien SIEMPRE: las tildes y las eñes son
 * correctas, el hex de la marca es exacto (un modelo lo aproxima), la
 * tipografía es la que el cliente pidió, y dos corridas dan lo mismo. Además
 * el costo marginal es cero — hoy cada slide cuesta 2 créditos de Higgsfield y
 * la CLI misma avisa que ninguna sale bien a la primera.
 *
 * QUÉ SIGUE SIENDO DE HIGGSFIELD
 * ---------------------------------------------------------------------------
 * Lo que sí es fotografía: el UGC en video, y el fondo de los slides que
 * piden una imagen real. La plantilla `foto` acepta ese fondo y le compone el
 * texto encima. Cada herramienta en lo que gana.
 *
 * POR QUÉ CHROME Y NO UNA LIBRERÍA DE IMÁGENES
 * ---------------------------------------------------------------------------
 * Chrome ya viene instalado en el runner de GitHub Actions y sabe de
 * tipografía más que cualquier librería: kerning, balance de líneas, saltos.
 * Sin dependencias nuevas que mantener.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* 1080×1350 es el 4:5 de Instagram, el formato que más alto ocupa en el feed.
   Se renderiza a esa medida exacta para que no haya reescalado. */
export const ANCHO = 1080;
export const ALTO = 1350;

/** Escapa el texto del cliente antes de meterlo en el HTML. */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Las plantillas. Cada una recibe los mismos datos y decide cómo se ven. Son
   familias distintas de composición, no variaciones de color: elegir plantilla
   tiene que cambiar de verdad el aspecto del carrusel. */
export const PLANTILLAS = {
  editorial: {
    nombre: "Editorial",
    descripcion: "Serif grande sobre fondo claro, mucho aire. Formal y con autoridad.",
  },
  bloque: {
    nombre: "Bloque",
    descripcion: "Fondo de color pleno de la marca y titular enorme. Directo, alto contraste.",
  },
  ficha: {
    nombre: "Ficha",
    descripcion: "Tarjeta blanca con número grande. Para listas y pasos.",
  },
  foto: {
    nombre: "Foto",
    descripcion: "Fotografía de fondo con degradado y el texto encima. Necesita imagen.",
  },
  sello: {
    nombre: "Sello",
    descripcion: "Foto de fondo, lista de beneficios y barra de sellos abajo. " +
      "Para marcas de producto que certifican origen o composición.",
  },
};

export const PLANTILLA_POR_DEFECTO = "editorial";

/* Fuentes del sistema. NO se cargan webfonts: el CSP y la red del runner no
   son de fiar, y una fuente que no baja hace que el slide salga en Times sin
   que nadie se entere hasta ver el resultado publicado. */
const SERIF = `Georgia,'Times New Roman',serif`;
const SANS = `system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;

/** ¿El color de marca es oscuro? Decide si el texto encima va blanco o negro. */
function esOscuro(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return true;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  // Luminancia percibida: el ojo ve el verde mucho más claro que el azul, así
  // que promediar los tres canales a secas da el resultado equivocado.
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

function armarHtml(plantilla, d) {
  const {
    titular = "", cuerpo = "", marca = "", indice = 1, total = 1,
    color = "#111111", color2 = "#f4f2ec", tipografia = "", fondoDataUri = "",
    logo = "",
    /* Sólo los usa la plantilla `sello`. Van con tope de elementos porque el
       lienzo es fijo: siete bullets o siete sellos no entran, y el navegador
       no avisa — recorta en silencio o encoge todo hasta volverlo ilegible.
       Es mejor perder el sexto sello que perder el titular. */
    bullets = [], sellos = [],
  } = d;

  const lista = (Array.isArray(bullets) ? bullets : [])
    .map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 5);
  const marcas = (Array.isArray(sellos) ? sellos : [])
    .map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);

  const serif = /serif|didot|garamond|playfair|georgia/i.test(tipografia);
  const familia = serif ? SERIF : SANS;
  const tinta = esOscuro(color) ? "#ffffff" : "#111111";
  /* NUNCA se numera la slide (26-ago-2026, retroalimentación de Joaquín).
     Era `total > 1 ? `${indice}/${total}` : ""`, o sea "1/6" en el pie de
     cada pieza del carrusel.

     Por qué se saca: el número de slide es información del ARMADO, no del
     mensaje. Instagram ya dibuja sus propios puntitos de posición debajo del
     carrusel, así que el contador es una segunda barra de progreso, peor y
     encima del diseño. Y en una marca delata la plantilla: se ve pieza de
     serie automatizada en vez de anuncio.

     Se deja la variable —vacía— en vez de borrar los `<span>` del pie: el
     pie tiene reglas de layout (flex, separación con el logo) y quitarlo
     movería el logo de sitio en las cuatro plantillas. */
  const paso = "";
  // El logo del cliente SIEMPRE es el archivo real que subió al brand book
  // (Chrome lo pinta pixel a pixel, como cualquier <img>) — nunca el nombre
  // del negocio escrito con la tipografía de la plantilla, que es lo que
  // pasaba antes: dos clientes con el mismo color de marca terminaban con la
  // "identidad" reducida a una palabra en la misma letra. Si el cliente
  // todavía no subió un logo, el texto queda de respaldo.
  const marcaHtml = logo
    ? `<img class="logo" src="${logo}" alt="">`
    : `<span>${esc(marca)}</span>`;

  const comun = `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${ANCHO}px;height:${ALTO}px;overflow:hidden}
    body{font-family:${familia};-webkit-font-smoothing:antialiased}
    .marco{width:100%;height:100%;padding:96px 88px;display:flex;
      flex-direction:column;position:relative}
    /* text-wrap:balance reparte las líneas del titular en vez de dejar una
       palabra sola abajo, que es lo que delata a un diseño automático. */
    h1{font-size:96px;line-height:1.05;letter-spacing:-.03em;text-wrap:balance;
      font-weight:${serif ? 400 : 700}}
    p{font-size:40px;line-height:1.45;margin-top:32px;max-width:24ch}
    .centro{flex:1;display:flex;flex-direction:column;justify-content:center}
    .pie{display:flex;align-items:center;justify-content:space-between;
      font-size:26px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;
      font-family:${SANS}}
    /* Alto fijo, ancho libre: todos los logos de cliente comparten el mismo
       alto en el pie sin importar su proporción (un isotipo cuadrado y un
       lockup horizontal largo quedan del mismo tamaño visual). */
    .logo{height:40px;width:auto;display:block}
  `;

  const cuerpos = {
    editorial: `
      <style>${comun}
        body{background:${color2}}
        .marco{color:#141414}
        h1{font-family:${SERIF};font-weight:400}
        .raya{width:88px;height:6px;background:${color};margin-bottom:44px}
        p{color:#43413c}
        .pie{color:${color}}
      </style>
      <div class="marco">
        <div class="centro">
          <div class="raya"></div>
          <h1>${esc(titular)}</h1>
          ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
        </div>
        <div class="pie">${marcaHtml}<span>${paso}</span></div>
      </div>`,

    bloque: `
      <style>${comun}
        body{background:${color}}
        .marco{color:${tinta}}
        h1{font-size:112px}
        p{opacity:.88}
        .pie{opacity:.75}
      </style>
      <div class="marco">
        <div class="centro">
          <h1>${esc(titular)}</h1>
          ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
        </div>
        <div class="pie">${marcaHtml}<span>${paso}</span></div>
      </div>`,

    ficha: `
      <style>${comun}
        body{background:${color}}
        .marco{padding:72px}
        .tarjeta{flex:1;background:#fff;border-radius:44px;padding:80px 72px;
          display:flex;flex-direction:column;color:#141414}
        .num{font-size:104px;font-weight:800;line-height:1;color:${color};
          opacity:.2;font-family:${SANS};margin-bottom:8px}
        h1{font-size:82px}
        p{color:#55524c}
        .pie{color:${color}}
      </style>
      <div class="marco"><div class="tarjeta">
        <div class="centro">
          <div class="num">${String(indice).padStart(2, "0")}</div>
          <h1>${esc(titular)}</h1>
          ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
        </div>
        <div class="pie">${marcaHtml}<span>${paso}</span></div>
      </div></div>`,

    foto: `
      <style>${comun}
        body{background:#111}
        .fondo{position:absolute;inset:0;background:${
          fondoDataUri ? `url('${fondoDataUri}') center/cover` : color};}
        /* El degradado no es decoración: sin él, un titular blanco sobre una
           foto clara es ilegible, y no se sabe de antemano cómo es la foto. */
        .velo{position:absolute;inset:0;
          background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.82) 68%)}
        .marco{color:#fff;justify-content:flex-end}
        h1{font-size:100px;text-shadow:0 2px 24px rgba(0,0,0,.35)}
        p{opacity:.92}
        .pie{opacity:.85;margin-top:44px}
      </style>
      <div class="fondo"></div><div class="velo"></div>
      <div class="marco">
        <h1>${esc(titular)}</h1>
        ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
        <div class="pie">${marcaHtml}<span>${paso}</span></div>
      </div>`,

    /* Como `foto`, pero con las dos cosas que una marca de producto necesita y
       las otras cuatro plantillas no saben hacer: una lista de beneficios y
       una barra de sellos abajo.

       POR QUÉ NO ALCANZABA `foto`
       -----------------------------------------------------------------------
       Una ficha de producto no es un titular con bajada: es una promesa
       (titular), sus razones (bullets) y sus garantías (sellos de origen,
       composición, certificación). Metidas dentro de `cuerpo` como texto
       corrido, las razones se leen como un párrafo y las garantías se pierden.
       Separarlas en campos propios permite que cada una tenga el tamaño y el
       lugar que le corresponde — y que el modelo tenga que pensarlas como
       cosas distintas al escribir la pieza.

       DEGRADA SIN ROMPERSE
       -----------------------------------------------------------------------
       Sin `bullets` ni `sellos` queda igual que `foto`. Sin `fondoDataUri`
       usa el color de marca. Ninguno de los dos campos es obligatorio, así
       que una marca puede adoptarla de a poco. */
    sello: `
      <style>${comun}
        body{background:${color}}
        .fondo{position:absolute;inset:0;background:${
          fondoDataUri ? `url('${fondoDataUri}') center/cover` : color};}
        /* Más opaco abajo que en la plantilla foto: acá el texto compite con una lista
           entera, no con dos líneas. Arriba se deja casi limpio para que se
           vea el producto, que es lo que la marca está vendiendo. */
        /* Verificado con una foto real de gpt-image-2 el 30-ago-2026: con el
           gradiente anterior (.35 al 42%) un titular blanco caía justo sobre
           la zona clara del producto y se sostenía sólo por el text-shadow.
           Salió legible esa vez, pero la foto la elige un modelo distinto en
           cada pieza — el velo tiene que garantizar el contraste con
           CUALQUIER foto, no confiar en que la próxima sea oscura ahí. */
        .velo{position:absolute;inset:0;background:linear-gradient(180deg,
          rgba(0,0,0,.05) 0%,rgba(0,0,0,.50) 38%,rgba(0,0,0,.93) 72%)}
        /* El padding de abajo deja libre la franja de sellos: si la barra se
           superpusiera al pie, el logo del cliente quedaría tapado. */
        /* Con foto el texto se ancla abajo, sobre la zona oscura del velo, y
           el producto respira arriba. SIN foto ese anclaje deja media pieza
           vacía, así que se centra: es el caso real cuando el proveedor de
           imagen falla, y una pieza descompensada se nota más que una simple. */
        .marco{color:#fff;justify-content:${fondoDataUri ? "flex-end" : "center"};
          padding:88px 80px ${marcas.length ? 176 : 96}px}
        h1{font-size:88px;text-shadow:0 2px 24px rgba(0,0,0,.4)}
        p{font-size:36px;opacity:.93;margin-top:24px}
        .lista{list-style:none;margin-top:36px;display:flex;flex-direction:column;gap:18px}
        .lista li{font-size:34px;line-height:1.3;display:flex;gap:20px;align-items:flex-start;
          font-family:${SANS};text-shadow:0 1px 12px rgba(0,0,0,.45)}
        /* Punto dibujado con CSS y no un carácter "•": el bullet tipográfico
           cambia de tamaño y de línea base según la fuente que resuelva el
           sistema, y acá la familia depende del brand book del cliente. */
        .lista li::before{content:"";flex:none;width:14px;height:14px;border-radius:50%;
          background:${color2};margin-top:11px}
        .pie{opacity:.9;margin-top:40px}
        .barra{position:absolute;left:0;right:0;bottom:0;height:112px;
          background:${color};display:flex;align-items:center;justify-content:space-around;
          gap:24px;padding:0 56px}
        .barra span{color:${tinta};font-family:${SANS};font-size:24px;font-weight:700;
          letter-spacing:.1em;text-transform:uppercase;text-align:center;line-height:1.2}
      </style>
      <div class="fondo"></div><div class="velo"></div>
      <div class="marco">
        <h1>${esc(titular)}</h1>
        ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
        ${lista.length ? `<ul class="lista">${
          lista.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
        <div class="pie">${marcaHtml}<span>${paso}</span></div>
      </div>
      ${marcas.length ? `<div class="barra">${
        marcas.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}`,
  };

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>${
    cuerpos[plantilla] || cuerpos[PLANTILLA_POR_DEFECTO]}</body></html>`;
}

/* Dónde está Chrome. En el runner de GitHub Actions viene instalado; en un
   Windows de escritorio está en Archivos de Programa. Se prueban en orden y
   se usa el primero que exista, en vez de fallar pidiendo configuración. */
const CANDIDATOS = [
  process.env.CHROME_BIN,
  "google-chrome", "chromium-browser", "chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

let chromeCache = null;
function buscarChrome() {
  if (chromeCache) return chromeCache;
  for (const c of CANDIDATOS) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore", timeout: 15000 });
      chromeCache = c;
      return c;
    } catch { /* el siguiente */ }
  }
  throw new Error(
    "No se encontró Chrome para componer los slides. Instálalo o define CHROME_BIN.");
}

/**
 * Compone un slide y devuelve el PNG como Buffer, listo para mandarlo a
 * Telegram igual que venía la imagen de Higgsfield.
 */
export function componerSlide(plantilla, datos) {
  const dir = mkdtempSync(join(tmpdir(), "barbara-slide-"));
  const html = join(dir, "slide.html");
  const png = join(dir, "slide.png");
  try {
    writeFileSync(html, armarHtml(plantilla, datos), "utf8");
    execFileSync(buscarChrome(), [
      "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
      `--window-size=${ANCHO},${ALTO}`,
      `--screenshot=${png}`,
      // `file://` y no una ruta suelta: Chrome interpreta la ruta de Windows
      // con dos puntos como si fuera un esquema y no carga nada.
      "file:///" + html.replace(/\\/g, "/"),
    ], { stdio: "ignore", timeout: 90000 });
    return readFileSync(png);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
