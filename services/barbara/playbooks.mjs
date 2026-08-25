/**
 * Bárbara · memoria FUNDACIONAL — los playbooks propios de Cóndor.
 *
 * La tercera capa, debajo de las dos que ya existían:
 *   barbara_reglas    → privada    (lo que corrigió ESTA marca)      · manda
 *   barbara_patrones  → global     (lo que se repite entre clientes)
 *   barbara_playbooks → fundacional(lo que Cóndor ya sabe)           · pesa menos
 *
 * Si el gusto del cliente contradice un playbook, gana el cliente. Eso no es
 * una preferencia de diseño: es lo que el cliente está pagando.
 *
 * USO COMO CLI (staff de Cóndor):
 *   node services/barbara/playbooks.mjs                    # lista los activos
 *   node services/barbara/playbooks.mjs --todos            # incluye apagados
 *   node services/barbara/playbooks.mjs --agregar \
 *        --titulo "..." --regla "..." --evidencia "..." \
 *        [--tipo carrusel|historia|ugc|general] [--rubro gastronomia] [--peso 10]
 *   node services/barbara/playbooks.mjs --apagar <id>
 *
 * Se agrega A MANO a propósito. Ver el encabezado de la migración
 * supabase/migrations/barbara_playbooks.sql.
 */

const TIPOS = ["carrusel", "historia", "ugc", "general"];

/**
 * Trae los playbooks que aplican a esta generación.
 * `tipo` filtra por formato ('general' entra siempre); `rubro` trae los del
 * rubro del cliente más los que no tienen rubro (que sirven para cualquiera).
 */
export async function playbooksPara(db, { tipo = "general", rubro = null, limite = 12 } = {}) {
  const t = TIPOS.includes(tipo) ? tipo : "general";

  /* PostgREST: `or=(...)` con `is.null` es la forma de decir "de este rubro o
     sin rubro". El rubro se normaliza a minúsculas porque así se guarda. */
  const filtroRubro = rubro
    ? `&or=(rubro.is.null,rubro.eq.${encodeURIComponent(String(rubro).trim().toLowerCase())})`
    : "&rubro=is.null";
  const filtroTipo = t === "general" ? "&tipo=eq.general" : `&or=(tipo.eq.general,tipo.eq.${t})`;

  /* Ojo: PostgREST no acepta dos `or=` en la misma query — el segundo pisa al
     primero. Cuando hacen falta los dos filtros se traen por tipo y se filtra
     el rubro acá, que es barato (son decenas de filas, no miles). */
  const usarOrDoble = Boolean(rubro) && t !== "general";
  const query = usarOrDoble
    ? `barbara_playbooks?activo=eq.true${filtroTipo}&select=regla,tipo,rubro,peso&order=peso.desc&limit=${limite * 3}`
    : `barbara_playbooks?activo=eq.true${filtroTipo}${filtroRubro}&select=regla,tipo,rubro,peso&order=peso.desc&limit=${limite}`;

  const filas = await db.get(query).catch(() => []);
  if (!usarOrDoble) return filas.slice(0, limite);

  const r = String(rubro).trim().toLowerCase();
  return filas.filter((p) => !p.rubro || p.rubro === r).slice(0, limite);
}

/**
 * Arma el bloque de texto para el prompt. Devuelve "" si no hay nada, para
 * que el llamador no meta un encabezado vacío.
 */
export function bloquePrompt(playbooks) {
  if (!playbooks?.length) return "";
  return (
    "\n\nLO QUE CÓNDOR YA APRENDIÓ HACIENDO ESTO (guía de la casa; si choca con " +
    "algo que pidió esta marca, MANDA LA MARCA):\n" +
    playbooks.map((p) => `- ${p.regla}`).join("\n")
  );
}

/* ── CLI ──────────────────────────────────────────────────────────────── */

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function cli() {
  const { supabase } = await import("./motor.mjs");
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const db = supabase(SB_URL, SB_KEY);

  if (process.argv.includes("--agregar")) {
    const titulo = arg("titulo"), regla = arg("regla"), evidencia = arg("evidencia");
    if (!titulo || !regla || !evidencia) {
      console.error(
        "Faltan campos. --titulo, --regla y --evidencia son obligatorios.\n" +
        "La evidencia no es burocracia: es lo que separa un playbook de una opinión.");
      process.exit(1);
    }
    const tipo = (arg("tipo") || "general").toLowerCase();
    if (!TIPOS.includes(tipo)) {
      console.error(`--tipo tiene que ser uno de: ${TIPOS.join(", ")}`);
      process.exit(1);
    }
    const rubro = arg("rubro") ? arg("rubro").trim().toLowerCase() : null;
    await db.post("barbara_playbooks", {
      titulo, regla, evidencia, tipo, rubro, peso: Number(arg("peso") || 0),
    });
    console.log(`Guardado: [${tipo}${rubro ? "/" + rubro : ""}] ${titulo}`);
    return;
  }

  const apagar = arg("apagar");
  if (apagar) {
    await db.patch(`barbara_playbooks?id=eq.${apagar}`, {
      activo: false, actualizado_en: new Date().toISOString(),
    });
    console.log("Apagado:", apagar);
    return;
  }

  const filtro = process.argv.includes("--todos") ? "" : "&activo=eq.true";
  const filas = await db.get(
    `barbara_playbooks?select=id,titulo,regla,tipo,rubro,peso,activo,evidencia${filtro}&order=peso.desc`);
  if (!filas.length) {
    console.log("Sin playbooks todavía. Se agregan a mano:\n" +
      '  node services/barbara/playbooks.mjs --agregar --titulo "..." --regla "..." --evidencia "..."');
    return;
  }
  for (const p of filas) {
    console.log(`${p.activo ? "●" : "○"} [${p.tipo}${p.rubro ? "/" + p.rubro : ""}] ${p.titulo}  (peso ${p.peso})`);
    console.log(`   ${p.regla}`);
    console.log(`   evidencia: ${p.evidencia}`);
    console.log(`   id: ${p.id}\n`);
  }
}

/* Sólo corre el CLI si se invocó el archivo directamente, no al importarlo. */
if (process.argv[1] && process.argv[1].endsWith("playbooks.mjs")) {
  cli().catch((e) => { console.error(e); process.exit(1); });
}
