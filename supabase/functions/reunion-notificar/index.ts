// condor.ai · Edge Function "reunion-notificar"
// Al agendar, editar o reenviar una reunión desde el portal: (1) Sandra avisa
// en el grupo de Telegram y (2) se manda un correo individual a cada invitado
// con el link de la videollamada, botón de Google Calendar y el .ics adjunto.
//
// Seguridad: solo usuarios ADMIN autenticados pueden dispararla (verifica es_admin
// con el token de sesión del usuario). Así nadie externo puede spamear.
//
// Secrets en Supabase: SANDRA_TELEGRAM_BOT_TOKEN, SANDRA_TELEGRAM_CHAT_ID,
//   RESEND_API_KEY, EMAIL_FROM (ej. "condor.ai <hola@tudominio.com>")
// (SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase solo)
// Deploy:  supabase functions deploy reunion-notificar --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

// Fecha → formato calendario UTC: YYYYMMDDTHHMMSSZ
const fmtCal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escIcs = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
// base64 seguro para UTF-8 (Deno)
const b64utf8 = (s: string) => btoa(unescape(encodeURIComponent(s)));

function buildICS(titulo: string, descripcion: string, inicios: Date[], duracionMin: number, meetUrl = "") {
  const eventos = inicios.flatMap((ini) => {
    const fin = new Date(ini.getTime() + duracionMin * 60000);
    return [
      "BEGIN:VEVENT",
      "UID:" + crypto.randomUUID() + "@condorai.cl",
      "DTSTAMP:" + fmtCal(new Date()),
      "DTSTART:" + fmtCal(ini),
      "DTEND:" + fmtCal(fin),
      "SUMMARY:" + escIcs(titulo),
      "DESCRIPTION:" + escIcs(descripcion),
      // LOCATION es lo que Google y Apple convierten en el boton "Unirse".
      // Sin esto el link solo existia dentro del correo y del portal.
      ...(meetUrl ? ["LOCATION:" + escIcs(meetUrl), "URL:" + escIcs(meetUrl)] : []),
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//condor.ai//reuniones//ES", "CALSCALE:GREGORIAN",
    ...eventos, "END:VCALENDAR",
  ].join("\r\n");
}

function gcalLink(titulo: string, descripcion: string, ini: Date, fin: Date, meetUrl = "") {
  const p = new URLSearchParams({
    action: "TEMPLATE", text: titulo || "Reunión",
    dates: fmtCal(ini) + "/" + fmtCal(fin), details: descripcion || "",
  });
  if (meetUrl) p.set("location", meetUrl);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

/**
 * Por que el aviso tiene tres tonos y no uno.
 *
 * La funcion nacia diciendo "Nueva reunion agendada" pase lo que pase. Desde
 * que el portal permite editar y reenviar, ese texto mentia dos de cada tres
 * veces: quien recibia el correo creia que le habian agendado algo nuevo y
 * terminaba con la reunion duplicada en su calendario.
 */
const TONOS = {
  nueva: {
    telegram: "📅 *Nueva reunión agendada*",
    saludo: "tienes una reunión agendada:",
    asunto: "📅 Reunión",
  },
  actualizada: {
    telegram: "✏️ *Reunión actualizada*",
    saludo: "cambió una reunión que tienes agendada:",
    asunto: "✏️ Cambió la reunión",
  },
  recordatorio: {
    telegram: "🔔 *Recordatorio de reunión*",
    saludo: "te recordamos esta reunión:",
    asunto: "🔔 Recordatorio",
  },
} as const;
type Motivo = keyof typeof TONOS;
const tonoDe = (valor: unknown): Motivo =>
  valor === "actualizada" || valor === "recordatorio" ? valor : "nueva";

async function enviarEmails(
  invitados: Array<{ nombre?: string; email?: string }>,
  titulo: string, fechaTxt: string, dur: string, cliente: string, descripcion: string,
  inicios: Date[], duracionMin: number, meetUrl = "", motivo: Motivo = "nueva",
) {
  const KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM");
  if (!KEY || !FROM) return { enviados: 0, motivo: "Resend no configurado" };

  const ini = inicios[0];
  const fin = new Date(ini.getTime() + duracionMin * 60000);
  const esSerie = inicios.length > 1;
  const detalle = [cliente && `Cliente: ${cliente}`, meetUrl && `Videollamada: ${meetUrl}`, descripcion]
    .filter(Boolean);
  const ics = buildICS(titulo, detalle.join("\n"), inicios, duracionMin, meetUrl);
  const icsB64 = b64utf8(ics);
  const gcal = gcalLink(titulo, detalle.join(" — "), ini, fin, meetUrl);
  const tono = TONOS[motivo];
  let enviados = 0;

  for (const inv of invitados) {
    if (!inv?.email) continue;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:520px">
      <p>Hola ${inv.nombre || ""} 👋, ${tono.saludo}</p>
      <p style="font-size:17px;font-weight:bold;margin:14px 0 4px">${titulo || "Reunión"}</p>
      <p style="margin:0">🗓️ ${fechaTxt} (${dur})</p>
      ${esSerie ? `<p style="margin:4px 0;color:#555">${inicios.length} reuniones en esta serie</p>` : ""}
      ${cliente ? `<p style="margin:4px 0">👤 Cliente: ${cliente}</p>` : ""}
      ${descripcion ? `<p style="margin:8px 0;white-space:pre-line">📝 ${descripcion}</p>` : ""}
      ${meetUrl ? `<p style="margin-top:20px"><a href="${meetUrl}" target="_blank" style="background:#0f9d58;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">🎥 Entrar a la videollamada</a></p>` : ""}
      <p style="margin-top:${meetUrl ? 10 : 20}px"><a href="${gcal}" target="_blank" style="background:#1f2bff;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">📅 Añadir a Google Calendar</a></p>
      <p style="color:#666;font-size:13px;margin-top:10px">Abre el archivo <b>reunion.ics</b> adjunto${esSerie ? " para importar todas las fechas de la serie" : " para Apple Calendar / Outlook"}.</p>
      <p style="color:#999;font-size:12px;margin-top:26px">condor.ai · Portal del equipo 🦅</p>
    </div>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: inv.email, subject: `${tono.asunto}: ${titulo || "condor.ai"} — ${fechaTxt}`,
          html, attachments: [{ filename: "reunion.ics", content: icsB64 }],
        }),
      });
      if (r.ok) enviados++;
    } catch (_e) { /* best-effort por invitado */ }
  }
  return { enviados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, servicio: "Sandra · notificar reunión" });

  // 1) Verificar que quien llama es un admin autenticado
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "sin token" }, 401);
  try {
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: "Bearer " + token } } },
    );
    const { data: esAdmin } = await supaUser.rpc("es_admin");
    if (!esAdmin) return json({ error: "no autorizado" }, 403);
  } catch (_e) {
    return json({ error: "no autorizado" }, 403);
  }

  // 2) Datos de la reunión
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  // 3) Datos comunes
  const ini = new Date(b.fecha_hora);
  const dur_min = b.duracion_min || 60;
  const inicios = (Array.isArray(b.ocurrencias) ? b.ocurrencias : [b.fecha_hora])
    .map((valor: unknown) => new Date(String(valor)))
    .filter((valor: Date) => !Number.isNaN(valor.getTime()));
  if (!inicios.length) return json({ error: "fecha inválida" }, 400);
  const fechaUnica = ini.toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const fecha = b.resumen_recurrencia || fechaUnica;
  const dur = dur_min >= 60 ? `${dur_min / 60}h` : `${dur_min} min`;
  const invitados = Array.isArray(b.invitados) ? b.invitados.filter(Boolean) : [];
  const motivo = tonoDe(b.motivo);
  const meetUrl = String(b.meet_url || "").trim();

  // 3a) Aviso al grupo de Telegram (best-effort, no bloquea el email)
  let telegram: any = { ok: false };
  const TG = Deno.env.get("SANDRA_TELEGRAM_BOT_TOKEN");
  const CHAT = Deno.env.get("SANDRA_TELEGRAM_CHAT_ID");
  if (TG && CHAT) {
    const msg = `${TONOS[motivo].telegram}\n\n*${b.titulo || "Reunión"}*\n🗓️ ${fecha} (${dur})` +
      (b.cliente ? `\n👤 Cliente: ${b.cliente}` : "") +
      (meetUrl ? `\n🎥 ${meetUrl}` : "") +
      (invitados.length ? `\n👥 Invitados: ${invitados.join(", ")}` : "") +
      (b.descripcion ? `\n\n📝 ${b.descripcion}` : "") +
      `\n\n_Cada invitado la verá en su calendario del portal y recibió el correo con el .ics._ 🦅`;
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: "Markdown" }),
      });
      const j = await r.json();
      telegram = { ok: !!j.ok, error: j.ok ? undefined : (j.description || "Telegram falló") };
    } catch (e) {
      telegram = { ok: false, error: String(e).slice(0, 120) };
    }
  } else {
    telegram = { ok: false, motivo: "Sandra aún no configurada (faltan secrets)" };
  }

  // 3b) Email individual a cada invitado con botón Google Calendar + .ics adjunto
  const invitadosEmail = Array.isArray(b.invitados_email) ? b.invitados_email : [];
  const emails = await enviarEmails(
    invitadosEmail, b.titulo || "Reunión", fecha, dur, b.cliente || "",
    b.descripcion || "", inicios, dur_min, meetUrl, motivo,
  );

  return json({ ok: true, motivo, telegram, emails });
});
