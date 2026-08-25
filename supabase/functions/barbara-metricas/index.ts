// Ingesta segura y agnóstica de métricas agregadas.
//
// Se despliega con --no-verify-jwt porque los recolectores externos no tienen
// sesión Supabase. La autenticación real es HMAC-SHA256 + timestamp de 5 min:
// firma hex de `${timestamp}.${rawBody}` en x-barbara-signature.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizarMetricas } from "../_shared/barbara-metricas.mjs";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

function bytesHex(hex: string) {
  const limpio = hex.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(limpio)) return null;
  return Uint8Array.from(limpio.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

async function firmaValida(secret: string, timestamp: string, raw: string, firma: string) {
  const esperada = bytesHex(firma);
  if (!esperada) return false;
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC", clave, esperada, new TextEncoder().encode(`${timestamp}.${raw}`),
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
  const secret = Deno.env.get("BARBARA_METRICAS_WEBHOOK_SECRET") || "";
  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret || secret.length < 32 || !sbUrl || !serviceKey) return json({ error: "servicio no configurado" }, 503);

  const timestamp = req.headers.get("x-barbara-timestamp") || "";
  const segundos = Number(timestamp);
  if (!Number.isFinite(segundos) || Math.abs(Date.now() / 1000 - segundos) > 300) {
    return json({ error: "timestamp vencido" }, 401);
  }
  const raw = await req.text();
  if (!raw || raw.length > 65_536) return json({ error: "payload inválido" }, 400);
  const firma = req.headers.get("x-barbara-signature") || "";
  if (!(await firmaValida(secret, timestamp, raw, firma))) return json({ error: "firma inválida" }, 401);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "JSON inválido" }, 400); }
  const programacionId = String(body?.programacion_id || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(programacionId)) return json({ error: "programacion_id inválido" }, 400);
  const capturadoEn = new Date(body?.capturado_en || Date.now());
  if (Number.isNaN(capturadoEn.getTime())) return json({ error: "capturado_en inválido" }, 400);
  const metricas = normalizarMetricas(body?.metricas || body?.metrics || {});

  const sb = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("barbara_ingestar_metricas", {
    p_programacion_id: programacionId,
    p_capturado_en: capturadoEn.toISOString(),
    p_metricas: metricas,
  });
  if (error) return json({ error: "no se pudo guardar", detalle: error.message }, 422);
  return json({ ok: true, metricas, hitos_nuevos: data || [] });
});

