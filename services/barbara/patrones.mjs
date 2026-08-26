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
 * Combina aprobación/correcciones con métricas sociales cuando existen. Para
 * que una cuenta grande no domine, las métricas se convierten a percentil
 * contra el historial de la misma marca y formato antes de agregarlas.
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
import { construirContrastes, huellaEvidencia, materialAnonimo } from "./rendimiento.mjs";
import { MINIMO_PIEZAS, MINIMO_MARCAS, cumpleUmbralGlobal } from "./umbral-global.mjs";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY;
const APLICAR = process.argv.includes("--aplicar");

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
        required: ["patron", "tipo", "confianza", "nota", "evidencia_id"],
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
          evidencia_id: { type: "string", description: "ID exacto entre corchetes del contraste que sustenta el patrón." },
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
    "&select=id,tipo,pilar,contenido,correcciones_pedidas,aprobada_sin_cambios,barbara_cliente_id,metricas" +
    "&order=creado_en.desc&limit=400"
  );

  const marcas = new Set(piezas.map((p) => p.barbara_cliente_id));
  const bien = piezas.filter((p) => p.aprobada_sin_cambios);
  const mal = piezas.filter((p) => !p.aprobada_sin_cambios);

  console.log(`Piezas cerradas: ${piezas.length} de ${marcas.size} marcas ` +
              `(${bien.length} sin correcciones, ${mal.length} con correcciones).`);

  if (!cumpleUmbralGlobal({ totalPiezas: piezas.length, totalMarcas: marcas.size })) {
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

  // ANONIMIZACIÓN ESTRUCTURAL: ni siquiera viajan ángulos. El modelo recibe
  // sólo contrastes agregados (ej. titular corto: 75% vs 42%) que ya pasaron
  // mínimos de muestra y variedad de marcas. Así no puede reconstruir una
  // cuenta ni inventar una diferencia que los datos no mostraron.
  const contrastes = construirContrastes(piezas);
  if (!contrastes.length) {
    console.log("\nNo hay contrastes multi-marca con diferencia suficiente. No se fuerza ningún patrón.");
    return 0;
  }
  const material = materialAnonimo(contrastes);
  const huella = huellaEvidencia(piezas);
  if (APLICAR) {
    const corrida = await db.get(`barbara_patrones_corridas?huella=eq.${huella}&select=id&limit=1`).catch(() => []);
    if (corrida.length) {
      console.log("\nEsta evidencia exacta ya fue procesada. No se duplican muestras ni patrones.");
      return 0;
    }
  }

  const r = await claude(AK, {
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system:
      "Redactas recomendaciones de forma y estructura usando EXCLUSIVAMENTE contrastes estadísticos agregados de aprobación y rendimiento social normalizado. " +
      "Cada recomendación debe citar en evidencia_id exactamente uno de los IDs entre corchetes recibidos. " +
      "Si el contraste dice mejor, recomienda ese rasgo; si dice peor, recomienda evitarlo. " +
      "No agregues causas, audiencias, marcas, productos ni tácticas que el contraste no mida. " +
      "Es preferible devolver dos patrones sustentados que ocho interpretaciones.",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: material }],
  });

  const { patrones } = JSON.parse(textOf(r));
  const contrastePorId = new Map(contrastes.map((c) => [c.id, c]));
  /* Los de confianza baja no se guardan. La tabla influye en la generación de
     todos los clientes: el listón para entrar tiene que ser alto. */
  const buenos = (patrones || []).filter((p) => p.confianza !== "baja" && contrastePorId.has(p.evidencia_id));

  console.log(`\nEl modelo devolvió ${patrones?.length ?? 0} patrones; ` +
              `${buenos.length} con confianza suficiente:\n`);
  for (const p of buenos) console.log(`  [${p.tipo}/${p.confianza}] ${p.patron}\n      ${p.nota}`);

  if (!APLICAR) {
    console.log("\nCorrida en seco. Para guardar:  node services/barbara/patrones.mjs --aplicar");
    return 0;
  }

  const yaHay = await db.get("barbara_patrones?select=id,patron,muestras,evidencia_clave");
  let nuevos = 0, reforzados = 0;

  for (const p of buenos) {
    const evidencia = contrastePorId.get(p.evidencia_id);
    // La clave estable del contraste evita duplicar el mismo hallazgo cuando
    // el redactor cambie una palabra. Las muestras son el tamaño REAL del
    // grupo actual, no una suma semanal del mismo historial.
    const igual = yaHay.find((x) => x.evidencia_clave === p.evidencia_id);
    if (igual) {
      await db.patch(`barbara_patrones?id=eq.${igual.id}`, {
        patron: p.patron,
        muestras: evidencia.muestras,
        marcas: evidencia.marcas,
        confianza_numerica: Math.min(1, Math.abs(evidencia.delta)),
        evidencia: evidencia,
        nota: p.nota,
        actualizado_en: new Date().toISOString(),
      });
      reforzados++;
    } else {
      await db.post("barbara_patrones", {
        patron: p.patron,
        tipo: p.tipo,
        muestras: evidencia.muestras,
        marcas: evidencia.marcas,
        confianza_numerica: Math.min(1, Math.abs(evidencia.delta)),
        evidencia_clave: p.evidencia_id,
        evidencia,
        activo: false,           // se enciende a mano, nunca solo
        nota: `${p.nota} · contraste agregado de ${evidencia.muestras} piezas / ${evidencia.marcas} marcas.`,
      });
      nuevos++;
    }
  }

  await db.post("barbara_patrones_corridas", {
    huella,
    piezas: piezas.length,
    marcas: marcas.size,
    contrastes: contrastes.length,
    patrones_guardados: buenos.length,
  });

  console.log(`\nGuardados: ${nuevos} nuevos, ${reforzados} reforzados.`);
  console.log("Nacen APAGADOS a propósito: revísalos en el portal y enciende " +
              "solo los que se sostengan. Mientras estén apagados no tocan la generación.");
  return 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
