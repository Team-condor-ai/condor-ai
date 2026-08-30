/**
 * Bárbara · tasa de aprobación A LA PRIMERA, por cliente y por mes.
 *
 * POR QUÉ EXISTE
 * ---------------------------------------------------------------------------
 * Es la única demostración de que el moat existe. Bárbara acumula reglas,
 * correcciones y patrones por cliente, pero nada de eso prueba que APRENDA:
 * un cliente que en su mes 6 sigue corrigiendo 6 de cada 10 piezas tiene un
 * archivo de reglas gordísimo y una Bárbara que no aprendió nada. Lo único
 * que separa un caso del otro es esta serie: qué porcentaje de las piezas de
 * cada mes salió bien sin que el cliente pidiera un solo cambio, y si ese
 * número sube mes a mes.
 *
 * Con dos clientes se puede mirar pieza por pieza. Con cientos, no: sin esta
 * métrica nadie se entera de que el sistema empeoró hasta que un cliente se
 * va.
 *
 * DE DÓNDE SALE EL DATO
 * ---------------------------------------------------------------------------
 * De `barbara_memoria`, que `clientes.mjs` cierra con retraso deliberado: el
 * cliente nunca escribe "me gustó", solo escribe cuando quiere cambios, así
 * que el silencio ES la aprobación y recién se puede dar por buena cuando ya
 * pasó el turno de esa pieza (ver "CIERRE DE LA PIEZA ANTERIOR" en
 * clientes.mjs). Consecuencia práctica que manda sobre todo lo de abajo: la
 * última pieza de cada cliente está SIEMPRE abierta, y una pieza abierta
 * todavía no dice nada.
 *
 * ARQUITECTURA
 * ---------------------------------------------------------------------------
 * El cálculo es puro y determinista —igual que pilares.mjs o planes.mjs— y la
 * consulta vive aparte, al final del archivo. Es el mismo corte que memoria.mjs
 * (puntaje puro) vs memoria-semantica.mjs (la que toca la base): así las
 * reglas de conteo, que son la parte delicada, se prueban con arrays a mano y
 * sin un solo mock.
 */

import { fileURLToPath } from "node:url";

/**
 * Mínimo de piezas CERRADAS para que un mes muestre porcentaje.
 *
 * Con 4 piezas, mover una sola de lado cambia el número 25 puntos: más de lo
 * que se mueve entre un mes bueno y uno malo de verdad, así que reportar ese
 * porcentaje es reportar ruido con cara de tendencia — y esta métrica se usa
 * justamente para decidir si el sistema mejora. Con 6 el salto de una pieza
 * baja a ~17 puntos, que ya es leíble.
 *
 * Y no más alto que 6 por dos razones concretas de este negocio:
 *   · 6 es la mitad del cupo mensual del plan más chico (12 carruseles, ver
 *     LIMITES_PLAN en planes.mjs). Un cliente que trabajó medio mes merece
 *     tener número.
 *   · Por el cierre diferido siempre queda al menos una pieza abierta, así
 *     que un mes de cupo completo aporta 11 cerradas, no 12: pedir el cupo
 *     entero dejaría meses normales sin número.
 *
 * Un mes por debajo del mínimo NO se esconde: aparece en la serie con
 * `tasa: null` y `suficiente: false`. Borrarlo haría ver como continuidad lo
 * que en realidad es un hueco.
 */
export const MINIMO_PIEZAS_MES = 6;

/**
 * Banda de ruido de la tendencia, en puntos porcentuales. Con muestras de 6 a
 * 12 piezas, una sola pieza de diferencia ya mueve el número entre 8 y 17
 * puntos: llamarle "mejora" a menos de 10 puntos es leer el azar del mes.
 */
export const RUIDO_TENDENCIA = 10;

const MES_ISO = /^(\d{4})-(\d{2})/;

const CLAVE_DESCARTE = { reintento: "reintentos", abierta: "abiertas", sin_fecha: "sin_fecha" };

/**
 * El mes al que pertenece una pieza, "YYYY-MM".
 *
 * Manda `fecha` (el día de la pieza) y no `creado_en`: "su mes 6" se cuenta
 * por el calendario del cliente, no por cuándo el worker alcanzó a escribir
 * la fila — una pieza del 31 generada pasada la medianoche UTC caería en el
 * mes siguiente y ensuciaría los dos meses a la vez. `creado_en` queda solo
 * de respaldo para filas viejas que quedaron sin `fecha`.
 */
function mesDe(fila) {
  const m = MES_ISO.exec(String(fila?.fecha || fila?.creado_en || ""));
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Qué hacer con una pieza: descartarla (y por qué) o contarla (y de qué lado).
 *
 * TRES REGLAS, cada una con su cicatriz:
 *
 * 1. Los reintentos (`corrige_a` no nulo) no son piezas nuevas. Un reintento
 *    es LA MISMA pieza corregida; contarlo aparte hace que la misma historia
 *    entre dos veces al denominador, y encima entra por el lado bueno (el
 *    reintento suele quedar aprobado), así que un cliente que corrige MUCHO
 *    saldría con mejor tasa que uno que no corrige nada. Justo al revés de lo
 *    que la métrica quiere decir.
 *
 * 2. Las piezas sin cerrar (`aprobada_sin_cambios === null`) no cuentan ni a
 *    favor ni en contra. Todavía están dentro de la ventana en la que el
 *    cliente puede escribir pidiendo cambios: darlas por aprobadas sería
 *    inventarse la mitad del numerador, y darlas por rechazadas castigaría al
 *    cliente por el silencio que en este sistema significa lo contrario.
 *
 * 3. "A la primera" se decide con `correcciones_pedidas` DE ESTA FILA, jamás
 *    con el contador acumulado del cliente (`barbara_correcciones`). Es la
 *    trampa documentada en clientes.mjs: el contador del cliente suma todo
 *    desde el último reinicio, así que si se lo usa acá, toda pieza cerrada
 *    de un cliente que hoy tiene 2 correcciones gastadas figura corregida —
 *    incluidas las que nadie tocó. La métrica que tiene que demostrar el moat
 *    no puede ser la más fácil de falsear.
 *
 * Cuando las dos señales de la fila se contradicen (el veredicto dice
 * aprobada pero el contador propio marca correcciones, o al revés) la pieza
 * cuenta como NO aprobada y queda anotada en `inconsistentes`. La fila no es
 * confiable, y ante la duda esta métrica redondea en contra: es la que
 * justifica el producto, no puede darse el beneficio de la duda a sí misma.
 */
export function clasificarPieza(fila = {}) {
  if (fila.corrige_a) return { descarte: "reintento" };
  if (fila.aprobada_sin_cambios === null || fila.aprobada_sin_cambios === undefined) return { descarte: "abierta" };
  const mes = mesDe(fila);
  if (!mes) return { descarte: "sin_fecha" };
  const veredicto = fila.aprobada_sin_cambios === true;
  const limpia = (Number(fila.correcciones_pedidas) || 0) === 0;
  return { mes, aprobada: veredicto && limpia, inconsistente: veredicto !== limpia };
}

const tasa = (aprobadas, cerradas, minimo) =>
  cerradas >= minimo ? Number((aprobadas / cerradas).toFixed(3)) : null;

/**
 * La serie completa de un cliente a partir de sus filas crudas de
 * `barbara_memoria`. Puro: no toca red ni base, no lee env, no ordena por
 * fecha antes de empezar (agrupa, así que el orden de entrada da igual).
 *
 * Devuelve los meses en orden cronológico —la serie sirve para ver si el
 * número sube, y para eso hay que poder leerla de izquierda a derecha— más el
 * acumulado del cliente y el recuento de lo descartado, que es lo que permite
 * distinguir "este cliente aprueba poco" de "este cliente casi no tiene
 * piezas cerradas todavía".
 */
export function tasaAprobacionPorMes(piezas = [], { minimo = MINIMO_PIEZAS_MES } = {}) {
  const buckets = new Map();
  const descartes = { reintentos: 0, abiertas: 0, sin_fecha: 0 };

  for (const fila of piezas) {
    const c = clasificarPieza(fila);
    if (c.descarte) { descartes[CLAVE_DESCARTE[c.descarte]]++; continue; }
    if (!buckets.has(c.mes)) buckets.set(c.mes, { mes: c.mes, cerradas: 0, aprobadas: 0, inconsistentes: 0 });
    const b = buckets.get(c.mes);
    b.cerradas++;
    if (c.aprobada) b.aprobadas++;
    if (c.inconsistente) b.inconsistentes++;
  }

  // "YYYY-MM" ordena cronológicamente como texto; por eso se guarda así y no
  // como Date, que además arrastraría zona horaria a un dato que no la tiene.
  const meses = [...buckets.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((b) => ({ ...b, suficiente: b.cerradas >= minimo, tasa: tasa(b.aprobadas, b.cerradas, minimo) }));

  const cerradas = meses.reduce((n, m) => n + m.cerradas, 0);
  const aprobadas = meses.reduce((n, m) => n + m.aprobadas, 0);

  return {
    meses,
    // El acumulado usa el mismo mínimo: un cliente con 3 piezas cerradas en
    // toda su vida tampoco tiene un porcentaje que signifique algo.
    total: {
      cerradas,
      aprobadas,
      suficiente: cerradas >= minimo,
      tasa: tasa(aprobadas, cerradas, minimo),
      inconsistentes: meses.reduce((n, m) => n + m.inconsistentes, 0),
    },
    descartes,
  };
}

/**
 * Si el cliente mejora o no: compara el primer mes con número contra el
 * último. Se saltean los meses sin muestra suficiente en vez de tratarlos
 * como 0 — un mes flojo de producción no es un mes de piezas rechazadas.
 *
 * Devuelve null cuando todavía no hay dos meses medibles: con un solo punto
 * no hay tendencia que reportar, y fabricar una sería exactamente el tipo de
 * señal inventada que esta métrica existe para evitar.
 */
export function tendenciaAprobacion(meses = [], { ruido = RUIDO_TENDENCIA } = {}) {
  const medibles = meses.filter((m) => m.tasa !== null);
  if (medibles.length < 2) return null;
  const desde = medibles[0];
  const hasta = medibles[medibles.length - 1];
  const delta = Math.round((hasta.tasa - desde.tasa) * 100);
  return {
    desde: desde.mes,
    hasta: hasta.mes,
    delta,
    direccion: Math.abs(delta) < ruido ? "estable" : delta > 0 ? "mejora" : "empeora",
    meses_medibles: medibles.length,
  };
}

/** Una línea por mes, para consola o Telegram. Sin emojis en los datos: esto
 *  se lee en columna y los iconos rompen la alineación. */
export function resumenAprobacion(informe, { negocio = "" } = {}) {
  const { meses, total, descartes } = informe;
  const pct = (t) => (t === null ? "sin muestra" : `${Math.round(t * 100)}%`);
  const lineas = meses.map((m) =>
    `  ${m.mes}  ${String(pct(m.tasa)).padStart(11)}  (${m.aprobadas}/${m.cerradas} cerradas)` +
    (m.suficiente ? "" : `  · menos de ${MINIMO_PIEZAS_MES} piezas, no se reporta porcentaje`) +
    (m.inconsistentes ? `  · ${m.inconsistentes} fila(s) inconsistente(s)` : ""));
  const tendencia = tendenciaAprobacion(meses);
  return [
    `Aprobación a la primera${negocio ? ` · ${negocio}` : ""}`,
    ...(lineas.length ? lineas : ["  (todavía no hay ninguna pieza cerrada)"]),
    `  acumulado: ${pct(total.tasa)} (${total.aprobadas}/${total.cerradas})`,
    tendencia
      ? `  tendencia: ${tendencia.direccion} ${tendencia.delta >= 0 ? "+" : ""}${tendencia.delta} pts (${tendencia.desde} → ${tendencia.hasta})`
      : "  tendencia: hacen falta dos meses con muestra suficiente",
    `  descartadas: ${descartes.reintentos} reintento(s), ${descartes.abiertas} sin cerrar` +
      (descartes.sin_fecha ? `, ${descartes.sin_fecha} sin fecha` : ""),
  ].join("\n");
}

// ---- Lo único que toca la base ----------------------------------------------

/**
 * La serie de un cliente contra Supabase. `db` es el helper que exporta
 * motor.mjs (`supabase(url, key)`), y se recibe por parámetro para poder
 * pasarle un objeto de prueba sin levantar nada.
 *
 * A propósito la consulta NO filtra por `corrige_a` ni por
 * `aprobada_sin_cambios`, aunque PostgREST podría hacerlo y traer menos filas.
 * Dos razones: las reglas de qué cuenta viven en un solo lugar —el cálculo
 * puro, que es el que está testeado— y el informe necesita saber cuántas
 * piezas quedaron fuera para poder decir "este cliente no tiene tasa baja,
 * tiene 9 piezas todavía sin cerrar". Filtrar en el servidor haría que esos
 * contadores dieran siempre cero.
 *
 * El volumen no es problema: son piezas de UN cliente, decenas por mes.
 */
export async function aprobacionDelCliente(db, barbaraClienteId, { desde = null, minimo = MINIMO_PIEZAS_MES, limite = 2000 } = {}) {
  if (!barbaraClienteId) throw new Error("aprobacionDelCliente necesita un barbara_cliente_id");
  const filtroFecha = desde ? `&fecha=gte.${encodeURIComponent(desde)}` : "";
  const filas = await db.get(
    `barbara_memoria?barbara_cliente_id=eq.${encodeURIComponent(barbaraClienteId)}${filtroFecha}` +
    "&select=id,fecha,creado_en,tipo,corrige_a,aprobada_sin_cambios,correcciones_pedidas" +
    `&order=fecha.asc&limit=${limite}`,
  );
  return tasaAprobacionPorMes(filas || [], { minimo });
}

/**
 * La misma serie para todos los clientes activos, que es el caso que motiva
 * la métrica: con cientos de cuentas nadie va a revisar pieza por pieza.
 *
 * Secuencial y de a un cliente por consulta: es un comando que se corre a
 * mano, y disparar cientos de requests en paralelo contra Supabase solo
 * cambia una espera de un minuto por un rate limit.
 */
export async function aprobacionDeTodos(db, { minimo = MINIMO_PIEZAS_MES, desde = null } = {}) {
  const clientes = await db.get("barbara_clientes?activo=eq.true&select=id,clientes(negocio)");
  const salida = [];
  for (const c of clientes || []) {
    const informe = await aprobacionDelCliente(db, c.id, { minimo, desde });
    salida.push({
      barbara_cliente_id: c.id,
      negocio: (Array.isArray(c.clientes) ? c.clientes[0]?.negocio : c.clientes?.negocio) || "",
      ...informe,
      tendencia: tendenciaAprobacion(informe.meses),
    });
  }
  // Primero los que peor están y ya tienen muestra: son los que hay que mirar
  // hoy. Los que todavía no tienen número van al final, no arriba con un 0
  // que no se ganaron.
  return salida.sort((a, b) =>
    (a.total.tasa === null) - (b.total.tasa === null) ||
    (a.total.tasa ?? 0) - (b.total.tasa ?? 0) ||
    String(a.negocio).localeCompare(String(b.negocio)));
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  // El helper se importa ACÁ y no arriba, por la misma razón que umbral-global.mjs
  // no importa motor.mjs: motor.mjs arrastra sharp y las dos APIs de imagen, y
  // eso convertiría el test de una métrica de aritmética pura en un test que
  // necesita `npm install` y binarios nativos para correr. `db` viaja por
  // parámetro, así que el resto del archivo nunca lo necesita.
  const { supabase } = await import("./motor.mjs");
  const db = supabase(url, key);
  const id = process.argv[2];

  if (id) {
    console.log(resumenAprobacion(await aprobacionDelCliente(db, id)));
    return;
  }
  const todos = await aprobacionDeTodos(db);
  if (!todos.length) return console.log("No hay clientes activos.");

  const linea = (c) => {
    const pct = c.total.tasa === null ? "sin muestra" : `${Math.round(c.total.tasa * 100)}%`;
    const t = c.tendencia ? `${c.tendencia.direccion} ${c.tendencia.delta >= 0 ? "+" : ""}${c.tendencia.delta} pts` : "sin tendencia";
    return { pct, t, nombre: String(c.negocio || c.barbara_cliente_id) };
  };

  for (const c of todos) {
    const { pct, t, nombre } = linea(c);
    console.log(`${pct.padStart(11)}  ${nombre.slice(0, 32).padEnd(32)}  ${t}  (${c.total.aprobadas}/${c.total.cerradas} cerradas)`);
  }
  console.log(`\nDetalle de un cliente: node services/barbara/metricas-aprobacion.mjs <barbara_cliente_id>`);

  /* Y se manda a Telegram.
     ---------------------------------------------------------------------
     Sin esto el ranking mensual moriría en el log de GitHub Actions, que es
     exactamente el problema que este número viene a resolver: un dato que
     nadie mira no cambia ninguna decisión. Es la misma razón por la que la
     revisión visual pasó de `console.log` a alerta.

     Sólo en el ranking completo (sin id): consultar un cliente puntual es un
     acto de alguien que ya está mirando, y no hace falta avisarle a nadie de
     algo que acaba de pedir. */
  const { alertarStaff } = await import("./alertas.mjs");
  const cuerpo = todos.map((c) => {
    const { pct, t, nombre } = linea(c);
    return `· ${nombre}: ${pct} (${t})`;
  }).join("\n");
  await alertarStaff(
    `📊 Bárbara · aprobación a la primera\n\n${cuerpo}\n\n` +
    `Es el % de piezas que el cliente aceptó sin pedir un solo cambio. ` +
    `Si no sube mes a mes, la memoria no está aprendiendo.`,
  ).catch(() => {});  // la métrica ya se imprimió: el envío no puede tumbar el run
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
