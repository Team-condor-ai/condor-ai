// condor.ai · Webhook de Telegram para revisar contenido de Bárbara.
// "Denuevo barbara" regenera la última pieza.
// "Aprobar barbara" publica exactamente el artefacto revisado mediante Blotato.
//
// ⚠️ SIN TRÁFICO desde el 22-ago-2026: esta lógica se fusionó dentro de
// `telegram-barbara-clientes` (ver su encabezado) porque las dos funciones
// usan el MISMO bot de Telegram y un bot solo tiene un webhook activo. No se
// borró este archivo por si hace falta volver atrás, pero el webhook real
// hoy apunta a `telegram-barbara-clientes`, no acá.

const REPO = Deno.env.get("GH_REPO") || "Team-condor-ai/condor-ai";
const GH = Deno.env.get("GH_TOKEN");
const TG = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_PERMITIDO = Deno.env.get("TELEGRAM_CHAT_ID");

type UltimoContenido = {
  tipo: string;
  runId?: string;
  workflowReintento: string;
  inputsReintento: Record<string, string>;
};

async function tgSend(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${GH}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "condor-barbara",
  };
}

async function ultimoContenido(): Promise<UltimoContenido | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/services/barbara/content-log.json?ref=main&t=${Date.now()}`, {
      headers: githubHeaders(),
    });
    if (!r.ok) return null;
    const archivo = await r.json();
    const texto = atob(String(archivo.content || "").replace(/\s/g, ""));
    const log = JSON.parse(texto);
    const last = (log || [])[log.length - 1];
    if (!last) return null;
    const tipo = String(last.tipo || "");
    if (tipo.startsWith("reel-")) {
      return {
        tipo,
        runId: last.runId ? String(last.runId) : undefined,
        workflowReintento: "reels.yml",
        inputsReintento: { tipo: tipo.replace("reel-", ""), retry: "1" },
      };
    }
    return {
      tipo,
      runId: last.runId ? String(last.runId) : undefined,
      workflowReintento: "barbara.yml",
      inputsReintento: { dia: tipo, retry: "1" },
    };
  } catch {
    return null;
  }
}

async function dispararWorkflow(workflow: string, inputs: Record<string, string>) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  const msg = update?.message || update?.channel_post;
  const texto = String(msg?.text || "").trim().toLowerCase();
  const chatId = msg?.chat?.id;
  if (!chatId) return new Response("ok");

  // Solo el grupo configurado puede disparar workflows y publicaciones.
  if (!CHAT_PERMITIDO || String(chatId) !== String(CHAT_PERMITIDO)) return new Response("ok");

  if (texto === "denuevo barbara" || texto === "de nuevo barbara") {
    const ultimo = await ultimoContenido();
    if (!ultimo) {
      await tgSend(chatId, "🤔 No encuentro el último contenido para reintentar. Genera uno primero.");
      return new Response("ok");
    }
    const ok = await dispararWorkflow(ultimo.workflowReintento, ultimo.inputsReintento);
    await tgSend(chatId, ok
      ? "🔄 Bárbara está rehaciendo el último contenido. En unos minutos llegará la nueva versión."
      : "⚠️ No pude disparar el reintento. Revisa GH_TOKEN y sus permisos.");
  }

  if (texto === "aprobar barbara") {
    const ultimo = await ultimoContenido();
    if (!ultimo?.runId) {
      await tgSend(chatId, "⚠️ La última pieza no tiene un artefacto publicable. Genera una nueva con el flujo actualizado.");
      return new Response("ok");
    }
    if (ultimo.tipo.startsWith("reel-")) {
      await tgSend(chatId, "⚠️ La aprobación automática de reels aún no está habilitada. Esta primera versión publica carruseles.");
      return new Response("ok");
    }
    const ok = await dispararWorkflow("barbara-publicar-blotato.yml", {
      run_id: ultimo.runId,
      confirmacion: "PUBLICAR",
    });
    await tgSend(chatId, ok
      ? `✅ Pieza ${ultimo.runId} aprobada. Blotato está procesando la publicación.`
      : "⚠️ No pude iniciar la publicación. Revisa la cuenta de Blotato y GH_TOKEN.");
  }

  return new Response("ok");
});
