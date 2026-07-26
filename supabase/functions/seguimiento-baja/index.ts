// condor.ai · Edge Function "seguimiento-baja"
// Link de "no quiero más correos" del pie de los correos de seguimiento.
// Marca leads.seguimiento = false; el trigger 'lead_optout' cancela solo todo lo pendiente en la cola.
//
// GET ?lead=<id>  -> baja del seguimiento (página de confirmación)
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo)
// Deploy: supabase functions deploy seguimiento-baja --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const pagina = (titulo: string, texto: string) =>
  new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
     <body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
       <div style="max-width:460px;background:#fff;border-radius:18px;padding:38px 32px;text-align:center;box-shadow:0 14px 40px -18px rgba(20,20,40,.25)">
         <div style="font-size:20px;font-weight:700;color:#2747ff;margin-bottom:14px">condor.ai</div>
         <h2 style="font-size:19px;color:#1a1a1a;margin:0 0 10px">${titulo}</h2>
         <p style="font-size:15px;color:#555;line-height:1.6;margin:0">${texto}</p>
       </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const lead = url.searchParams.get("lead");
  if (!lead || !/^\d+$/.test(lead)) return pagina("Enlace inválido", "Revisa el enlace del correo o escríbenos por WhatsApp.");

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supa.from("leads").update({ seguimiento: false }).eq("id", lead);
  if (error) return pagina("No pudimos procesarlo", "Inténtalo de nuevo en un momento, o respóndenos el correo y te damos de baja a mano.");

  return pagina("Listo, no recibirás más mensajes 🙏", "Cancelamos los recordatorios y correos pendientes. Si algún día quieres retomar, aquí estaremos.");
});
