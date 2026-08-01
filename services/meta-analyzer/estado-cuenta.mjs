/**
 * Diagnóstico de la cuenta publicitaria: estado, deuda pendiente y gasto.
 *
 * Existe porque "la cuenta no deja crear campañas" puede ser media docena de
 * cosas distintas —tarjeta rechazada, saldo impago, revisión de riesgo, límite
 * de gasto alcanzado— y cada una se arregla en un lugar diferente del panel.
 * Sin mirar los campos, uno adivina.
 *
 *   node estado-cuenta.mjs
 */
const API = "https://graph.facebook.com/v21.0";
const TOKEN = (process.env.META_ACCESS_TOKEN || "").trim();
let AD_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/i, "").replace(/[^0-9]/g, "");
if (AD_ACCOUNT) AD_ACCOUNT = "act_" + AD_ACCOUNT;

// account_status de la Marketing API. El número solo no dice nada.
const ESTADOS = {
  1: "ACTIVA — puede crear y publicar",
  2: "DESHABILITADA — bloqueada por Meta",
  3: "SIN LIQUIDAR (unsettled) — hay un cobro pendiente o rechazado",
  7: "EN REVISIÓN DE RIESGO",
  8: "PENDIENTE DE LIQUIDACIÓN",
  9: "PERÍODO DE GRACIA",
  100: "PENDIENTE DE CIERRE",
  101: "CERRADA",
};

const RAZONES = {
  0: "ninguna",
  1: "infracción de políticas",
  2: "cuenta de anuncios relacionada bloqueada",
  3: "primera infracción de políticas",
  4: "segunda infracción",
  5: "problema de facturación / impago",
  6: "riesgo de la cuenta",
  7: "gracia",
  8: "cierre por impago",
  9: "cuenta de empresa deshabilitada",
  10: "cuenta de empresa cerrada",
};

async function get(ruta, campos) {
  const url = `${API}/${ruta}?fields=${encodeURIComponent(campos)}&access_token=${TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(`${ruta} → ${j.error.message}`);
  return j;
}

const money = (v, cur) =>
  v == null ? "—" : `${(Number(v) / (cur === "CLP" || cur === "COP" ? 1 : 100)).toLocaleString("es-CL")} ${cur}`;

const c = await get(
  AD_ACCOUNT,
  "name,account_status,disable_reason,currency,balance,amount_spent,spend_cap,funding_source_details,timezone_name,created_time",
);

console.log("═".repeat(62));
console.log(`CUENTA: ${c.name}   (${AD_ACCOUNT})`);
console.log("═".repeat(62));
console.log(`Estado ................. ${c.account_status} · ${ESTADOS[c.account_status] ?? "desconocido"}`);
console.log(`Motivo de bloqueo ...... ${c.disable_reason} · ${RAZONES[c.disable_reason] ?? "—"}`);
console.log(`Moneda ................. ${c.currency}`);
console.log(`Zona horaria ........... ${c.timezone_name}`);
console.log("");
console.log(`SALDO PENDIENTE ........ ${money(c.balance, c.currency)}   ← lo que se debe ahora`);
console.log(`Gasto histórico ........ ${money(c.amount_spent, c.currency)}`);
console.log(`Tope de gasto .......... ${c.spend_cap && c.spend_cap !== "0" ? money(c.spend_cap, c.currency) : "sin tope"}`);
console.log(`Medio de pago .......... ${c.funding_source_details?.display_string ?? "NINGUNO CONFIGURADO"}`);

// Facturas: dicen si la deuda es de un ciclo cerrado o del consumo en curso.
try {
  const f = await get(`${AD_ACCOUNT}/invoices`, "id,billing_period,amount_due,payment_status,due_date");
  const filas = (f.data ?? []).slice(0, 5);
  if (filas.length) {
    console.log("\nÚLTIMAS FACTURAS");
    for (const i of filas) {
      console.log(`  ${i.billing_period ?? "?"}  ${money(i.amount_due, c.currency)}  ${i.payment_status ?? ""}  vence ${i.due_date ?? "—"}`);
    }
  } else {
    console.log("\nSin facturas emitidas: la cuenta nunca cerró un ciclo de cobro.");
  }
} catch (e) {
  console.log(`\n(no se pudieron leer las facturas: ${e.message})`);
}

console.log("\n" + "─".repeat(62));
if (c.account_status === 1) {
  console.log("La cuenta puede crear y publicar campañas.");
} else if (c.account_status === 3) {
  console.log("Meta tiene un cobro sin liquidar. Se resuelve pagando el saldo");
  console.log("pendiente en Administrador de anuncios → Facturación → Pagar ahora.");
  console.log("Suele reactivarse en minutos tras el cobro exitoso.");
} else {
  console.log("La cuenta no está operativa. Revisa el motivo de bloqueo de arriba.");
}
