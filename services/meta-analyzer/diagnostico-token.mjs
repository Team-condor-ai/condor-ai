/**
 * Qué permisos tiene realmente el token de Meta que usan los workflows.
 *
 * Existe porque el 22-ago-2026 `pausar-anuncio.mjs` falló al escribir con un
 * "does not exist, cannot be loaded due to missing permissions, or does not
 * support this operation" — el mensaje genérico de Meta, que mezcla tres
 * causas distintas (objeto inexistente / permiso faltante / app en modo
 * desarrollo) y no dice cuál es. Sin esto, se adivina.
 *
 *   node services/meta-analyzer/diagnostico-token.mjs
 */
const API = "https://graph.facebook.com/v21.0";
const TOKEN = (process.env.META_ACCESS_TOKEN || "").replace(/[\s\r\n]+/g, "").trim();
let CUENTA = (process.env.META_AD_ACCOUNT_ID || "").replace(/[^0-9]/g, "");
if (CUENTA) CUENTA = "act_" + CUENTA;

async function get(ruta, params = {}) {
  const url = new URL(`${API}/${ruta}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

async function main() {
  if (!TOKEN) { console.error("Sin META_ACCESS_TOKEN"); process.exit(1); }

  // debug_token se autoinspecciona: el token se valida a sí mismo.
  const info = await get("debug_token", { input_token: TOKEN }).then((r) => r.data || {});
  console.log("TOKEN");
  console.log("  tipo        ", info.type || "?");
  console.log("  app         ", info.application || "?", "(id " + (info.app_id || "?") + ")");
  console.log("  válido      ", info.is_valid ? "sí" : "NO");
  console.log("  expira      ", info.expires_at ? new Date(info.expires_at * 1000).toISOString().slice(0, 10) : "nunca");
  console.log("  permisos    ", (info.scopes || []).join(", ") || "(ninguno)");

  const necesarios = ["ads_read", "ads_management"];
  console.log("\nLO QUE HACE FALTA");
  for (const p of necesarios) {
    const tiene = (info.scopes || []).includes(p);
    console.log(`  ${tiene ? "✓" : "✗"} ${p}` +
      (p === "ads_management" && !tiene ? "   ← sin esto NO se puede pausar ni crear nada" : "") +
      (p === "ads_read" && !tiene ? "   ← sin esto no se puede ni leer" : ""));
  }

  // Permiso efectivo sobre la cuenta: distinto de los scopes del token.
  // Se puede tener ads_management y aun así no ser admin de ESTA cuenta.
  if (CUENTA) {
    try {
      const c = await get(CUENTA, { fields: "name,account_status,currency" });
      console.log("\nCUENTA");
      console.log("  nombre      ", c.name);
      console.log("  estado      ", c.account_status === 1 ? "activa" : "estado " + c.account_status);
      console.log("  moneda      ", c.currency);
      const tareas = await get(CUENTA, { fields: "user_tasks" });
      console.log("  mis permisos", (tareas.user_tasks || []).join(", ") || "(ninguno)");
      if (!(tareas.user_tasks || []).includes("MANAGE")) {
        console.log("               ← falta MANAGE: solo se puede mirar, no modificar");
      }
    } catch (e) {
      console.log("\nCUENTA — no se pudo leer:", e.message);
    }
  }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
