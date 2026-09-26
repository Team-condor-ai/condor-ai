// Bandeja de ecommerce@tecnoboxchile.cl en el Portal (26-sept-2026, pedido de Joaquín).
//
//   POST {accion:"sincronizar"}          → trae por IMAP los correos nuevos de INBOX a `correo_tecnobox`.
//                                          La llama pg_cron cada 2 min con la cabecera x-cron-secret (o el equipo desde el Portal).
//   POST {accion:"responder", id, cuerpo} → responde ese correo por SMTP COMO ecommerce@tecnoboxchile.cl
//                                          (el cliente nunca ve otra dirección) y deja copia en Enviados.
//
// La clave de la casilla se lee de `api_credenciales` (proveedor tecnobox_ecommerce_email, "usuario:clave").
// Nunca se marcan como leídos en el servidor: se lee con BODY.PEEK, así Roundcube sigue igual que antes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PostalMime from "npm:postal-mime@2.4.4";
import { Imap, enviarSmtp, armarMime } from "./correo.ts";

const HOST = "mail.tecnoboxchile.cl";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-cron-secret",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });
const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function credencial() {
  const { data, error } = await sb().from("api_credenciales").select("valor").eq("proveedor", "tecnobox_ecommerce_email").maybeSingle();
  if (error || !data?.valor) throw new Error("falta la credencial tecnobox_ecommerce_email");
  const i = data.valor.indexOf(":");
  return { user: data.valor.slice(0, i).trim(), pass: data.valor.slice(i + 1).trim() };
}

async function sincronizar() {
  const db = sb();
  const { data: ultima } = await db.from("correo_tecnobox").select("uid").order("uid", { ascending: false }).limit(1).maybeSingle();
  const desde = (ultima?.uid ?? 0) + 1;
  const auth = await credencial();
  const imap = new Imap();
  await imap.abrir(HOST, auth.user, auth.pass);
  const nuevos: Record<string, unknown>[] = [];
  try {
    for (const uid of (await imap.uidsDesde(desde)).slice(0, 10)) {   // de a 10 por vuelta: la función tiene tiempo y memoria limitados
      const crudo = await imap.mensaje(uid);
      if (!crudo) continue;
      const p = await PostalMime.parse(crudo);
      nuevos.push({
        uid, message_id: p.messageId || null,
        de_nombre: p.from?.name || null, de_email: p.from?.address || null,
        para: (p.to || []).map((t: { name?: string; address?: string }) => t.address).join(", ") || null,
        asunto: p.subject || "(sin asunto)", fecha: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
        texto: (p.text || "").slice(0, 60000), html: p.html ? String(p.html).slice(0, 200000) : null,
      });
    }
  } finally { await imap.cerrar(); }
  if (!nuevos.length) return { nuevos: 0 };
  const { error } = await db.from("correo_tecnobox").upsert(nuevos, { onConflict: "uid", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return { nuevos: nuevos.length };
}

async function responder(id: number, cuerpo: string, quien: string) {
  const db = sb();
  const { data: c } = await db.from("correo_tecnobox").select("*").eq("id", id).maybeSingle();
  if (!c?.de_email) throw new Error("no encontré el correo");
  const auth = await credencial();
  const asunto = /^re:/i.test(c.asunto || "") ? c.asunto : `Re: ${c.asunto || ""}`;
  const citado = String(c.texto || "").split("\n").map((l: string) => "> " + l).join("\n");
  const texto = `${cuerpo.trim()}\n\n--\nEquipo Tecnobox\n\nEl ${new Date(c.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago" })}, ${c.de_nombre || c.de_email} escribió:\n${citado}`;
  const { crudo } = armarMime({ de: `Tecnobox <${auth.user}>`, para: c.de_email, asunto, texto, enRespuestaA: c.message_id || undefined, host: "tecnoboxchile.cl" });
  await enviarSmtp(HOST, auth.user, auth.pass, auth.user, c.de_email, crudo);
  // Copia en Enviados de la casilla, para que en Roundcube también se vea la respuesta.
  try {
    const imap = new Imap(); await imap.abrir(HOST, auth.user, auth.pass);
    await imap.anexar(await imap.carpetaEnviados(), new TextEncoder().encode(crudo));
    await imap.cerrar();
  } catch (e) { console.log("[correo-tecnobox] no se pudo copiar a Enviados:", String(e)); }
  await db.from("correo_tecnobox_respuestas").insert({ correo_id: id, cuerpo, enviado_por: quien });
  await db.from("correo_tecnobox").update({ respondido_en: new Date().toISOString(), respondido_por: quien, leido: true }).eq("id", id);
  return { enviado: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
  let b: { accion?: string; id?: number; cuerpo?: string } = {};
  try { b = await req.json(); } catch { /* se valida abajo */ }

  // pg_cron entra con el secreto; el equipo, con su sesión del Portal.
  const secreto = Deno.env.get("CORREO_CRON_SECRET");
  let quien = "";
  if (secreto && req.headers.get("x-cron-secret") === secreto) quien = "cron";
  else {
    const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await u.auth.getUser();
    if (!user?.email) return json({ error: "no autenticado" }, 401);
    const { data: admin } = await sb().from("admins").select("email").eq("email", user.email).maybeSingle();
    if (!admin) return json({ error: "solo el equipo de Cóndor" }, 403);
    quien = user.email;
  }
  try {
    if (b.accion === "probar") {
      // Diagnóstico: ¿llega el servidor de funciones a la casilla? (saludo IMAP crudo, 10 s máx.)
      const t0 = Date.now();
      const conn = await Promise.race([Deno.connectTls({ hostname: HOST, port: 993 }), new Promise<never>((_, r) => setTimeout(() => r(new Error("sin conexión TCP/TLS en 10 s")), 10000))]);
      const buf = new Uint8Array(512);
      const n = await Promise.race([conn.read(buf), new Promise<never>((_, r) => setTimeout(() => r(new Error("conectó pero sin saludo IMAP en 10 s")), 10000))]);
      conn.close();
      return json({ ok: true, ms: Date.now() - t0, saludo: new TextDecoder().decode(buf.subarray(0, n || 0)).slice(0, 120) });
    }
    if (b.accion === "sincronizar") return json(await sincronizar());
    if (b.accion === "responder") {
      if (quien === "cron") return json({ error: "no permitido" }, 403);
      if (!b.id || !String(b.cuerpo || "").trim()) return json({ error: "faltan el correo o el texto" }, 400);
      return json(await responder(Number(b.id), String(b.cuerpo), quien));
    }
    return json({ error: "acción desconocida" }, 400);
  } catch (e) {
    console.log("[correo-tecnobox]", String(e));
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
