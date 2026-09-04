// condor.ai · Edge Function "tipo-cambio"
// Devuelve cuántos pesos chilenos vale cada moneda que cobramos, y refresca el
// dato desde una fuente pública cuando ya está viejo.
//
// Deploy: supabase functions deploy tipo-cambio --project-ref <ref>
// No necesita secretos: la fuente es pública y sin llave.
//
// POR QUÉ NO LO PIDE EL NAVEGADOR DIRECTO
// ---------------------------------------------------------------------------
// Si cada pestaña del portal consultara la API pública, cada persona vería un
// número distinto según el momento en que abrió la página, y no habría forma
// de saber con qué cambio se calculó un total. Acá se guarda UNA vez en la
// base, con su fecha, y todos leen lo mismo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Una unidad de USD en cada moneda. Gratis, sin llave, se actualiza a diario.
const FUENTE = "https://open.er-api.com/v6/latest/USD";
// PYG se sumó el 3-sept-2026 con Silver & Co, la joyería paraguaya: su
// comisión se calcula en guaraníes y se contabiliza en pesos, así que si
// la tasa no se refresca queda congelada mientras las otras avanzan — y
// el PYG/CLP se movió 15,3% en el último año.
const MONEDAS = ["CLP", "COP", "PEN", "PYG", "USD"];
// Doce horas: el dato de origen cambia una vez al día, así que pedirlo más
// seguido solo gasta. Y si la fuente se cae, se sigue sirviendo lo último
// bueno en vez de dejar el CRM sin números.
const FRESCO_MS = 12 * 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: guardado } = await sb.from("tipos_cambio").select("*");
  const filas = guardado ?? [];
  const masNuevo = filas
    .filter((f) => f.moneda !== "CLP")
    .map((f) => new Date(f.actualizado_en).getTime())
    .sort((a, b) => b - a)[0];

  const vencido = !masNuevo || Date.now() - masNuevo > FRESCO_MS;

  if (vencido) {
    try {
      const r = await fetch(FUENTE, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      const tasas = d?.rates ?? {};
      // La fuente da todo respecto al dólar; lo que se necesita es respecto al
      // peso. `a_clp(X) = CLP_por_dolar / X_por_dolar`.
      const clpPorDolar = Number(tasas.CLP);
      if (r.ok && clpPorDolar > 0) {
        const ahora = new Date().toISOString();
        const nuevas = MONEDAS
          .map((m) => {
            const porDolar = m === "USD" ? 1 : Number(tasas[m]);
            if (!porDolar || porDolar <= 0) return null;
            return {
              moneda: m,
              a_clp: m === "CLP" ? 1 : clpPorDolar / porDolar,
              fuente: "open.er-api.com · " + (d.time_last_update_utc ?? ahora),
              actualizado_en: ahora,
            };
          })
          .filter(Boolean);
        if (nuevas.length) {
          await sb.from("tipos_cambio").upsert(nuevas, { onConflict: "moneda" });
          return json({ tasas: nuevas, refrescado: true });
        }
      }
    } catch (e) {
      // Se cayó la fuente: NO es motivo para dejar el CRM sin totales. Se
      // devuelve lo último que había, con su fecha, y que la pantalla decida
      // si avisar que está viejo.
      console.error("tipo-cambio, fuente caída:", String(e).slice(0, 200));
    }
  }

  if (!filas.length) return json({ error: "sin tipos de cambio guardados" }, 503);
  return json({ tasas: filas, refrescado: false });
});
