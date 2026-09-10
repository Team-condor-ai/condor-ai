// condor.ai · Edge Function "disponibilidad"
// Devuelve, para un día dado, qué bloques de 30 min YA están ocupados en
// 'reuniones' — así /agendar puede mostrar un calendario real (no un select
// que ofrece horarios que en realidad ya están tomados).
//
// No expone nombres ni datos de contacto: solo la lista de horas ocupadas.
// Lee con SERVICE_ROLE (server-side) porque RLS de 'reuniones' solo deja ver
// a cada admin sus propias reuniones — un visitante anónimo no vería nada.
//
// GET /disponibilidad?fecha=YYYY-MM-DD  ->  { ok: true, ocupadas: ["09:00", "14:30", ...] }
// Deploy: supabase functions deploy disponibilidad --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const APERTURA_MIN = 9 * 60;      // 09:00
const CIERRE_MIN = 20 * 60 + 30;  // 20:30 (último bloque que ofrece /agendar)
const PASO_MIN = 30;

// Misma técnica que "agendar-publico": interpreta fecha/hora como hora de
// Chile y devuelve el instante UTC equivalente, sin asumir un offset fijo
// (Chile cambia de huso en el año).
function chileAUTC(fecha: string, hora: string): Date {
  const base = new Date(`${fecha}T${hora}:00Z`);
  const sant = new Date(base.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const utc = new Date(base.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(base.getTime() + (utc.getTime() - sant.getTime()));
}
function partesChile(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return { hh: parseInt(p.hour, 10), mm: parseInt(p.minute, 10) };
}
function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const minAHora = (min: number) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const fecha = (url.searchParams.get("fecha") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: "Falta ?fecha=YYYY-MM-DD." }, 400);

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Rango del día completo en hora Chile, convertido a UTC para la consulta.
  const desde = chileAUTC(fecha, "00:00");
  const hasta = chileAUTC(sumarDias(fecha, 1), "00:00");

  const { data, error } = await supa.from("reuniones")
    .select("fecha_hora, duracion_min")
    .gte("fecha_hora", desde.toISOString())
    .lt("fecha_hora", hasta.toISOString());
  if (error) return json({ error: "No se pudo consultar disponibilidad." }, 500);

  const ocupados = new Set<number>();
  for (const r of data || []) {
    const inicio = partesChile(new Date(r.fecha_hora));
    const inicioMin = inicio.hh * 60 + inicio.mm;
    const finMin = inicioMin + (r.duracion_min || 30);
    // Marca cada bloque de 30 min visible en /agendar que la reunión pisa,
    // aunque la reunión no empiece justo en un múltiplo de 30.
    for (let b = APERTURA_MIN; b <= CIERRE_MIN; b += PASO_MIN) {
      if (b < finMin && b + PASO_MIN > inicioMin) ocupados.add(b);
    }
  }

  const ocupadas = [...ocupados].sort((a, b) => a - b).map(minAHora);
  return json({ ok: true, fecha, ocupadas });
});
