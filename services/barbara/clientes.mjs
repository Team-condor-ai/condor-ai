// condor.ai · Bárbara multi-cliente — genera contenido para cada cliente
// activo del módulo "Agentes IA > Bárbara" del portal, usando SU brand book
// y SU formulario de entrada (no las plantillas fijas de barbara.mjs, que
// son el contenido propio de Cóndor y siguen intactas y separadas).
//
// Primera versión: genera carruseles e historias (imagen, nano_banana_2).
// Video UGC queda documentado pero SIN CONECTAR todavía — ver el aviso más
// abajo antes de la sección de video.
//
// Secrets: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, SUPABASE_URL,
//          SUPABASE_SERVICE_ROLE_KEY
// Variables: TIPO (carrusel|historia, default carrusel) · CLIENTE_ID (forzar
//            un solo cliente, para probar) · TEST=1 (solo valida conexión)

import { tg, claude, textOf, genImagen, REGLA_TEXTO, supabase } from "./motor.mjs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isTest = process.env.TEST === "1";
const TIPO = (process.env.TIPO || "carrusel").trim().toLowerCase();
const SOLO_CLIENTE = (process.env.CLIENTE_ID || "").trim();

if (!AK || !TG_TOKEN || !SB_URL || !SB_KEY) {
  console.error("Faltan variables: ANTHROPIC_API_KEY / TELEGRAM_BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = supabase(SB_URL, SB_KEY);

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    angulo: { type: "string", description: "El ángulo/idea ÚNICO de esta pieza en una frase (para registrar y no repetir)." },
    slides: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      titulo: { type: "string" },
      prompt: { type: "string", description: "Prompt EN INGLÉS, art-directed, usando la paleta y tipografía de marca del cliente. Debe especificar el TEXTO EXACTO en español que se verá, como copy FINAL de diseño (solo lo que lee la persona). PROHIBIDO incluir rótulos ni meta-palabras ('titular', 'título', 'subtítulo', 'dato', 'texto', 'slide', 'CTA') ni una palabra seguida de dos puntos como etiqueta. NO logos genéricos de stock, sí puede mencionarse el logo real si se describe explícitamente." },
    }, required: ["titulo", "prompt"] } },
    caption: { type: "string", description: "Caption para Instagram con hook, valor real para el público objetivo del cliente, tono acorde a su marca, y 5-8 hashtags relevantes a su rubro." },
  },
  required: ["angulo", "slides", "caption"],
};

async function generarPara(cliente) {
  const { id: barbaraId, plan, rubro, telegram_chat_id, cliente_id } = cliente;
  const negocio = cliente.clientes?.negocio || cliente.clientes?.[0]?.negocio || "el negocio";
  const bb = Array.isArray(cliente.barbara_brand_book) ? cliente.barbara_brand_book[0] : cliente.barbara_brand_book;
  const form = Array.isArray(cliente.barbara_formulario) ? cliente.barbara_formulario[0] : cliente.barbara_formulario;

  if (!telegram_chat_id) {
    console.log(`[${negocio}] sin telegram_chat_id configurado — se salta (staff debe completarlo en el portal).`);
    return;
  }
  if (!bb || !form) {
    console.log(`[${negocio}] falta brand book o formulario todavía — se salta hasta que el staff los complete.`);
    return;
  }

  // Candado: no publicar dos veces el mismo tipo el mismo día para este cliente.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const memoriaHoy = await db.get(
    `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&fecha=eq.${hoyISO}&tipo=eq.${TIPO}&select=id`
  );
  if (memoriaHoy.length) {
    console.log(`[${negocio}] ya se publicó "${TIPO}" hoy. Nada que hacer.`);
    return;
  }

  // Bloqueo por 3 reintentos de corrección: si está bloqueado, no se genera
  // contenido nuevo hasta que staff lo desbloquee desde el portal.
  const bloqueo = await db.get(`barbara_correcciones?barbara_cliente_id=eq.${barbaraId}&select=bloqueado`);
  if (bloqueo[0]?.bloqueado) {
    console.log(`[${negocio}] bloqueado por reintentos de corrección — staff debe desbloquear en el portal.`);
    return;
  }

  const recientesRaw = await db.get(
    `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&select=fecha,tipo,angulo&order=creado_en.desc&limit=15`
  );
  const recientes = recientesRaw.map(e => `- [${e.fecha} ${e.tipo}] ${e.angulo}`).join("\n") || "(sin historial)";

  const nSlides = TIPO === "historia" ? 1 : 6;
  const paleta = (bb.paleta_colores || []).map(c => `${c.hex}${c.uso ? ` (${c.uso})` : ""}`).join(", ") || "a criterio, coherente con el rubro";
  const tipos = (form.tipo_contenido || []).join(", ") || "contenido general para redes";

  const dir = await claude(AK, {
    model: "claude-sonnet-4-6", max_tokens: 4000,
    system: `Eres Bárbara, directora creativa de "${negocio}" (rubro: ${rubro || "no especificado"}). Diseñas ${TIPO === "historia" ? "una historia de Instagram (1 imagen)" : `un carrusel de Instagram (${nSlides} slides)`} de nivel agencia. Sigues la identidad de marca del cliente al pie de la letra. Incluyes el texto exacto a renderizar en cada imagen COMO COPY FINAL: en la imagen SOLO aparece lo que lee la persona, JAMÁS palabras estructurales ni rótulos con dos puntos. NUNCA repites ángulos de las piezas recientes (te las paso). Responde SOLO con el JSON.`,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content:
`Marca: ${negocio} (rubro: ${rubro || "no especificado"})
Paleta de marca: ${paleta}
Tipografía de marca: ${bb.tipografia || "a criterio, legible y editorial"}
Detalles a considerar (restricciones/gustos del dueño): ${bb.detalles || "ninguno registrado"}

Tipo de contenido que pidió el cliente en su formulario: ${tipos}
Público objetivo: ${form.publico_objetivo || "no especificado"}
Tono: ${form.tono || "no especificado"}
Restricciones del cliente: ${form.restricciones || "ninguna"}
Ejemplos de referencia que le gustan: ${form.ejemplos_referencia || "ninguno"}
Producto/servicio a destacar hoy: ${form.producto_destacar || "el negocio en general"}

PIEZAS RECIENTES DE ESTE CLIENTE (NO repitas estos ángulos, innova):
${recientes}

Crea ${TIPO === "historia" ? "la historia" : `el carrusel de ${nSlides} slides`} con un ángulo NUEVO, fiel a la marca.` }],
  });
  const plan_contenido = JSON.parse(textOf(dir));
  const slides = (plan_contenido.slides || []).slice(0, nSlides);

  const imgs = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      const url = genImagen(slides[i].prompt + "\n\n" + REGLA_TEXTO, i);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      imgs.push(buf);
    } catch (e) {
      if (e.permanent) throw e;
      console.log(`[${negocio}] slide ${i + 1} falló:`, String(e).slice(0, 140));
    }
  }
  if (!imgs.length) throw new Error(`[${negocio}] no se generó ninguna imagen`);

  for (let i = 0; i < imgs.length; i++) {
    const fd = new FormData();
    fd.append("chat_id", telegram_chat_id);
    fd.append("caption", `${TIPO === "historia" ? "📱 Historia" : "🖼️ Carrusel"} · ${negocio}${imgs.length > 1 ? ` · ${i + 1}/${imgs.length}` : ""}`);
    fd.append("photo", new Blob([imgs[i]], { type: "image/png" }), `slide_${i + 1}.png`);
    const j = await (await tg(TG_TOKEN, "sendPhoto", fd, true)).json();
    if (!j.ok) throw new Error(`[${negocio}] Telegram sendPhoto: ` + (j.description || ""));
  }
  await tg(TG_TOKEN, "sendMessage", {
    chat_id: telegram_chat_id,
    text: `🤖 *Bárbara* — contenido listo para revisar y aprobar.\n\n📝 *Caption:*\n\n${plan_contenido.caption || ""}\n\n_Si quieres cambios, responde a este mensaje describiéndolos (máximo 3 correcciones antes de derivar a soporte)._`,
    parse_mode: "Markdown",
  });

  await db.post("barbara_memoria", {
    barbara_cliente_id: barbaraId,
    fecha: hoyISO,
    tipo: TIPO,
    angulo: plan_contenido.angulo || slides[0]?.titulo || "",
    titulo: negocio,
  });
  console.log(`[${negocio}] OK — ${TIPO} generado, ángulo: ${plan_contenido.angulo}`);
}

async function main() {
  console.log("Bárbara clientes | tipo:", TIPO, "| solo:", SOLO_CLIENTE || "(todos los activos)");
  if (isTest) {
    const clientes = await db.get("barbara_clientes?activo=eq.true&select=id");
    console.log(`Conexión OK. Clientes activos: ${clientes.length}`);
    return;
  }

  const filtroId = SOLO_CLIENTE ? `&id=eq.${SOLO_CLIENTE}` : "";
  const clientes = await db.get(
    `barbara_clientes?activo=eq.true${filtroId}&select=id,plan,rubro,telegram_chat_id,cliente_id,clientes(negocio),barbara_brand_book(paleta_colores,tipografia,detalles),barbara_formulario(tipo_contenido,publico_objetivo,tono,restricciones,ejemplos_referencia,producto_destacar)`
  );

  if (!clientes.length) {
    console.log("No hay clientes activos todavía en barbara_clientes. Nada que generar.");
    return;
  }

  // Una falla en un cliente no debe tumbar a los demás — a diferencia de
  // barbara.mjs (un solo tenant, ahí sí tiene sentido abortar todo).
  let fallas = 0;
  for (const cliente of clientes) {
    try {
      await generarPara(cliente);
    } catch (e) {
      fallas++;
      console.error(`Cliente ${cliente.id} falló:`, String(e).slice(0, 300));
    }
  }
  console.log(`Listo. ${clientes.length - fallas}/${clientes.length} clientes generados sin error.`);
  if (fallas === clientes.length && clientes.length > 0) process.exit(1); // todos fallaron: marca el run en rojo
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// ── VIDEO UGC: pendiente de conectar ──────────────────────────────────────
// El motor de reels.mjs para UGC usa Veo 3.1 con un avatar fijo (la misma
// vocera en cada clip) — eso es específico de Cóndor, no sirve tal cual para
// clientes que no tienen una vocera propia. Para UGC de cliente conviene
// `seedance1_5` en 720p (motor recomendado en docs/motores-higgsfield.md del
// repo `barbara`, ~4x más barato que seedance_2_0 y suficiente para el
// formato "amateur" del UGC) generando clips de producto/negocio sin
// vocera fija, no una adaptación directa del script de Cóndor. Se deja fuera
// de esta primera versión a propósito — no vale la pena escribir esa lógica
// sin poder probarla contra un cliente real todavía.
