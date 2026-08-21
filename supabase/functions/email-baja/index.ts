// Desplegar con: supabase functions deploy email-baja --no-verify-jwt
// El token aleatorio del enlace es la autorizaciÃ³n; el destinatario no tiene sesiÃ³n.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const html = (titulo: string, texto: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${titulo}</title><body style="margin:0;background:#f4f5f4;font-family:system-ui;color:#16191a;display:grid;place-items:center;min-height:100vh"><main style="max-width:480px;background:white;border:1px solid #e8ebe8;border-radius:16px;padding:32px"><h1 style="font-size:22px">${titulo}</h1><p style="line-height:1.6;color:#6b7472">${texto}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token)
    return html(
      "Enlace inválido",
      "No encontramos el identificador de esta suscripción.",
      400,
    );
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await sb
    .from("email_contactos")
    .update({ estado: "baja", baja_en: new Date().toISOString() })
    .eq("baja_token", token)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return html(
      "Enlace inválido",
      "El enlace no existe o ya no está disponible.",
      404,
    );
  return html(
    "Suscripción cancelada",
    "No recibirás más campañas de Cóndor AI. Los correos operativos relacionados con tus servicios no se ven afectados.",
  );
});
