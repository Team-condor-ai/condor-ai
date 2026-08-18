/**
 * Bárbara aprende de TODOS · destila patrones globales de rendimiento.
 *
 * EL AGUJERO QUE TAPA
 * ---------------------------------------------------------------------------
 * `barbara_patrones` la LEE el motor en cada generación, pero hasta ahora no
 * la escribía nadie. La memoria global era un tubo conectado a una tabla vacía:
 * el código estaba, el aprendizaje no existía.
 *
 * DE QUÉ APRENDE
 * ---------------------------------------------------------------------------
 * De la única señal que existe desde el primer cliente y no depende de conectar
 * ninguna cuenta: si la pieza pasó sin correcciones o hubo que rehacerla.
 * Es peor dato que el alcance real de Instagram —que llegará cuando Meta
 * apruebe la app— pero es real, es de hoy, y ya se estaba guardando.
 *
 * LA LÍNEA QUE NO SE CRUZA
 * ---------------------------------------------------------------------------
 * Acá salen SOLO patrones de rendimiento, nunca contenido ni identidad de
 * ninguna marca. "Los carruseles que cierran con pregunta se aprueban a la
 * primera" entra; "la joyería X publicó sobre anillos" no entra jamás. No es
 * solo ética: está publicado como promesa en la landing de Bárbara, así que
 * romperlo sería mentirle al público.
 *
 * Por eso lo que se le manda al modelo va ANONIMIZADO en origen — no se le
 * pide que "no mencione marcas", se le manda un material donde las marcas no
 * están. Una instrucción se puede desobedecer; un dato que no viajó, no.
 *
 * POR QUÉ NACEN APAGADOS
 * ---------------------------------------------------------------------------
 * Los patrones se guardan con `activo=false`. Con 2-3 clientes, un patrón
 * cruzado es ruido, y aprender de ruido es peor que no aprender. La tabla
 * acumula desde ya —eso no se recupera después— pero no toca la generación
 * hasta que alguien lo encienda a mano con muestras suficientes.
 *
 *   node services/barbara/patrones.mjs           # muestra, no escribe
 *   node services/barbara/patrones.mjs --aplicar
 */
import { claude, textOf, supabase } from "./motor.mjs";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY;
const APLICAR = process.argv.includes("--aplicar");

/* Mínimo de piezas cerradas para que mirar el conjunto signifique algo. Por
   debajo de esto, cualquier "patrón" es la casualidad de dos clientes. */
const MINIMO_PIEZAS = 12;
/* Y de cuántas marcas distintas: 20 piezas de un solo cliente describen a ese
   cliente, no un patrón global. Eso es justo lo que la memoria individual ya
   hace mejor. */
const MINIMO_MARCAS = 3;

if (!SB_URL || !SB_KEY) { console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!AK) { console.error("Falta ANTHROPIC_API_KEY"); process.exit(1); }

const db = supabase(SB_URL, SB_KEY);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["patrones"],
  properties: {
    patrones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["patron", "tipo", "confianza", "nota"],
        properties: {
          patron: {
            type: "string",
            description:
              "Una regla de rendimiento accionable al generar, en español, en imperativo. " +
              "Sin nombres de marca, productos ni rubros.",
          },
          tipo: { type: "string", enum: ["carrusel", "historia", "ugc", "general"] },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string", description: "En qué se apoya, para poder auditarlo después." },
        },
      },
    },
  },
};

async function main() {
  /* Solo piezas CERRADAS: las que ya tienen veredicto. Una pieza recién
     generada todavía no dice nada — el cliente aún puede corregirla. */
  const piezas = await db.get(
    "barbara_memoria?aprobada_sin_cambios=not.is.null" +
    "&select=tipo,angulo,correcciones_pedidas,aprobada_sin_cambios,barbara_cliente_id" +
    "&order=creado_en.desc&limit=400"
  );

  const marcas = new Set(piezas.map((p) => p.barbara_cliente_id));
  const bien = piezas.filter((p) => p.aprobada_sin_cambios);
  const mal = piezas.filter((p) => !p.aprobada_sin_cambios);

  console.log(`Piezas cerradas: ${piezas.length} de ${marcas.size} marcas ` +
              `(${bien.length} sin correcciones, ${mal.length} con correcciones).`);

  if (piezas.length < MINIMO_PIEZAS || marcas.size < MINIMO_MARCAS) {
    console.log(
      `\nTodavía no alcanza para destilar nada (hacen falta ${MINIMO_PIEZAS} piezas ` +
      `de ${MINIMO_MARCAS} marcas). No se inventa un patrón con poca muestra: ` +
      `un patrón falso pasa a TODOS los clientes a la vez.`);
    return 0;
  }
  if (!mal.length || !bien.length) {
    console.log("\nTodas las piezas cayeron del mismo lado. Sin contraste no hay nada que comparar.");
    return 0;
  }

  /* ANONIMIZACIÓN EN ORIGEN. Al modelo le llega el tipo de pieza y el ángulo
     creativo, nunca de qué marca es ni de qué rubro. El `barbara_cliente_id`
     se descarta acá: ni siquiera viaja como identificador opaco, porque con un
     id se pueden agrupar piezas y reconstruir a un cliente. */
  const linea = (p) => `- [${p.tipo}] ${p.angulo}`;
  const material =
    `PIEZAS QUE EL CLIENTE APROBÓ SIN PEDIR NINGÚN CAMBIO (${bien.length}):\n` +
    bien.map(linea).join("\n") +
    `\n\nPIEZAS QUE EL CLIENTE PIDIÓ CORREGIR (${mal.length}):\n` +
    mal.map(linea).join("\n");

  const r = await claude(AK, {
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system:
      "Analizas qué distingue al contenido de redes que se aprueba a la primera del que hay " +
      "que rehacer. Recibes ángulos creativos de varias marcas distintas, ya anonimizados.\n\n" +
      "Devuelve solo patrones de FORMA y ESTRUCTURA que sirvan al generar la próxima pieza " +
      "de cualquier marca: cómo abre, cómo cierra, qué largo, qué tipo de gancho, qué " +
      "estructura narrativa. Nunca menciones marcas, productos ni rubros — si un patrón solo " +
      "se sostiene nombrando un rubro, no es global y no va.\n\n" +
      "Sé conservador: es preferible devolver dos patrones sólidos que ocho tibios. Un patrón " +
      "falso acá se le aplica a TODOS los clientes a la vez. Si la diferencia entre los dos " +
      "grupos se explica por casualidad, devuelve la lista vacía y ya.",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: material }],
  });

  const { patrones } = JSON.parse(textOf(r));
  /* Los de confianza baja no se guardan. La tabla influye en la generación de
     todos los clientes: el listón para entrar tiene que ser alto. */
  const buenos = (patrones || []).filter((p) => p.confianza !== "baja");

  console.log(`\nEl modelo devolvió ${patrones?.length ?? 0} patrones; ` +
              `${buenos.length} con confianza suficiente:\n`);
  for (const p of buenos) console.log(`  [${p.tipo}/${p.confianza}] ${p.patron}\n      ${p.nota}`);

  if (!APLICAR) {
    console.log("\nCorrida en seco. Para guardar:  node services/barbara/patrones.mjs --aplicar");
    return 0;
  }

  const yaHay = await db.get("barbara_patrones?select=id,patron,muestras");
  let nuevos = 0, reforzados = 0;

  for (const p of buenos) {
    /* Un patrón que se vuelve a observar no se duplica: sube `muestras`. Que
       reaparezca ES la señal de que no era casualidad, y `muestras` es
       justamente el número que alguien va a mirar para decidir encenderlo. */
    const igual = yaHay.find(
      (x) => x.patron.trim().toLowerCase() === p.patron.trim().toLowerCase());
    if (igual) {
      await db.patch(`barbara_patrones?id=eq.${igual.id}`, {
        muestras: (igual.muestras || 0) + piezas.length,
        actualizado_en: new Date().toISOString(),
      });
      reforzados++;
    } else {
      await db.post("barbara_patrones", {
        patron: p.patron,
        tipo: p.tipo,
        muestras: piezas.length,
        activo: false,           // se enciende a mano, nunca solo
        nota: `${p.nota} · destilado de ${piezas.length} piezas de ${marcas.size} marcas.`,
      });
      nuevos++;
    }
  }

  console.log(`\nGuardados: ${nuevos} nuevos, ${reforzados} reforzados.`);
  console.log("Nacen APAGADOS a propósito: revísalos en el portal y enciende " +
              "solo los que se sostengan. Mientras estén apagados no tocan la generación.");
  return 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
