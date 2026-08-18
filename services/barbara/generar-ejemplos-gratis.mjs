/**
 * Genera los carruseles de ejemplo para la página de plantillas gratis
 * (productos/barbara/plantillas-gratis). Se corre a mano cuando cambia el
 * copy o se agrega una plantilla nueva — no es parte del pipeline de un
 * cliente, es material de marketing propio de Cóndor.
 *
 * Solo 3 de las 4 plantillas: `foto` necesita una fotografía real de fondo,
 * y no hay ninguna que se pueda regalar sin ser de un cliente o de un banco
 * de imágenes con licencia. Mejor 3 completas que 4 con una a medias.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { componerSlide } from "./plantillas.mjs";

const OUT = "../../apps/web-v2/public/productos/barbara/plantillas-gratis/ejemplos";
mkdirSync(new URL(OUT, import.meta.url), { recursive: true });

const MARCA = "TU MARCA AQUÍ";

const SETS = [
  {
    plantilla: "editorial",
    archivo: "editorial",
    color: "#1F5A08", color2: "#F3F1E7", tipografia: "serif editorial",
    slides: [
      { titular: "3 señales de que tu contenido no está funcionando",
        cuerpo: "La primera: nadie comenta, solo mira. Eso no es desinterés, es que no le diste nada que responder." },
      { titular: "La segunda: siempre el mismo formato",
        cuerpo: "Si todos tus posts se ven igual, tu audiencia dejó de sorprenderse hace semanas." },
      { titular: "La tercera: hablas de ti, no de ellos",
        cuerpo: "¿De qué habla este carrusel? De un problema que tiene quien lo lee. Ese es el cambio." },
    ],
  },
  {
    plantilla: "bloque",
    archivo: "bloque",
    color: "#141414", color2: "#F3F1E7", tipografia: "sans",
    slides: [
      { titular: "Deja de publicar “lo que se te ocurra”",
        cuerpo: "Cada pieza debería tener un trabajo: educar, vender, o hacer que te recuerden." },
      { titular: "Un carrusel sin ángulo es ruido",
        cuerpo: "“Tips de marketing” no es un ángulo. “3 errores que cometí antes de entenderlo” sí." },
      { titular: "¿Cuál es el trabajo de tu próximo post?",
        cuerpo: "Si no puedes responder en una frase, todavía no está listo para publicarse." },
    ],
  },
  {
    plantilla: "ficha",
    archivo: "ficha",
    color: "#1F5A08", color2: "#F3F1E7", tipografia: "sans",
    slides: [
      { titular: "El gancho va en las primeras 2 líneas",
        cuerpo: "Si el primer slide no promete algo concreto, el segundo nadie lo ve." },
      { titular: "Un ángulo, no un tema",
        cuerpo: "“Ventas” es un tema. “El error que te cuesta 3 clientes al mes” es un ángulo." },
      { titular: "Cierra con una pregunta",
        cuerpo: "Los carruseles que más se guardan invitan a responderse algo, no a leer y seguir de largo." },
    ],
  },
];

let total = 0;
for (const set of SETS) {
  set.slides.forEach((s, i) => {
    const buf = componerSlide(set.plantilla, {
      titular: s.titular, cuerpo: s.cuerpo, marca: MARCA,
      indice: i + 1, total: set.slides.length,
      color: set.color, color2: set.color2, tipografia: set.tipografia,
    });
    const ruta = new URL(`${OUT}/${set.archivo}-${i + 1}.png`, import.meta.url);
    writeFileSync(ruta, buf);
    total++;
  });
  console.log(`${set.plantilla}: ${set.slides.length} slides`);
}
console.log(`\nListo: ${total} imágenes en apps/web-v2/public/productos/barbara/plantillas-gratis/ejemplos/`);
