// condor.ai · Bárbara multi-cliente — genera contenido para cada cliente
// activo del módulo "Agentes IA > Bárbara" del portal, usando SU brand book
// y SU formulario de entrada (no las plantillas fijas de barbara.mjs, que
// son el contenido propio de Cóndor y siguen intactas y separadas).
//
// Genera carruseles, historias (imagen, nano_banana_2) y video UGC de
// UGC con persona a camara, sin vocera FIJA (seedance1_5, ver motor.mjs).
//
// Secrets: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, SUPABASE_URL,
//          SUPABASE_SERVICE_ROLE_KEY
// Variables: TIPO (carrusel|historia|ugc, default carrusel) · CLIENTE_ID
//            (forzar un solo cliente, para probar) · TEST=1 (solo valida
//            conexión) · RETRY=1 (el webhook de Telegram lo dispara cuando
//            el cliente pide una corrección — salta el candado de "ya se
//            publicó hoy" y le pide a Bárbara una versión claramente mejor)

import { tg, claude, textOf, genImagen, genVideo, unirClips, REGLA_TEXTO, supabase } from "./motor.mjs";
import { componerSlide, PLANTILLAS, PLANTILLA_POR_DEFECTO } from "./plantillas.mjs";
import { piezaAnterior, leerPedido, extraerCambios, instrucciones, verificar, faltantes } from "./correccion.mjs";

const AK = process.env.ANTHROPIC_API_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isTest = process.env.TEST === "1";
const isRetry = process.env.RETRY === "1";
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
      titular: { type: "string", description: "El titular del slide, EN ESPAÑOL, tal cual se va a leer. Corto y con fuerza: 4 a 9 palabras. Sin rótulos ni dos puntos de etiqueta." },
      cuerpo: { type: "string", description: "Una o dos frases que desarrollan el titular, EN ESPAÑOL, tal cual se van a leer. Máximo 160 caracteres. Puede ir vacío si el titular se basta solo." },
    }, required: ["titular", "cuerpo"] } },
    caption: { type: "string", description: "Caption para Instagram con hook, valor real para el público objetivo del cliente, tono acorde a su marca, y 5-8 hashtags relevantes a su rubro." },
  },
  required: ["angulo", "slides", "caption"],
};

// UGC: UNA PERSONA MOSTRANDO EL PRODUCTO Y HABLANDO DE ÉL A CÁMARA.
// Ese es el género completo — no son tomas de producto y ambiente.
//
// "Sin vocera fija" (como lo dice el modelo de negocio) significa que la
// persona CAMBIA entre piezas, a diferencia del UGC propio de Cóndor
// (reels.mjs, Veo 3.1 + avatar.png: siempre la misma mujer). NO significa
// "sin persona".
//
// Corregido el 17-ago-2026 por Joaquín: el motor venía generando tomas de
// producto sin nadie hablando, que es otro formato y no es lo que se vende.
const schemaUGC = {
  type: "object", additionalProperties: false,
  properties: {
    angulo: { type: "string", description: "Ángulo/idea ÚNICO de este UGC en una frase (para no repetir)." },
    clips: {
      type: "array", description: "2 o 3 tomas de 4-6s, en orden, estilo UGC grabado con celular: una persona mostrando el producto y hablándole a la cámara (nada de look publicitario pulido).",
      items: { type: "object", additionalProperties: false, properties: {
        escena: { type: "string", description: "Prompt EN INGLÉS de la toma: una persona real sosteniendo/usando el producto y hablándole directamente a la cámara, estilo selfie grabado a mano con celular, luz natural, look casero y genuino (NO publicitario)." },
        duracion: { type: "number", description: "Duración en segundos, entre 4 y 6." },
      }, required: ["escena", "duracion"] },
    },
    texto_en_pantalla: { type: "string", description: "Frase corta en español para sobreimprimir (hook o dato del producto), fiel al tono de marca." },
    caption: { type: "string", description: "Caption para Instagram/TikTok, tono UGC auténtico, con hook + valor + CTA + 5-8 hashtags relevantes al rubro." },
  },
  required: ["angulo", "clips", "texto_en_pantalla", "caption"],
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

  // Candado: no publicar dos veces el mismo tipo el mismo día para este
  // cliente — salvo RETRY=1 (el webhook lo pone cuando el cliente pidió
  // una corrección; ahí SÍ hay que regenerar aunque ya se haya publicado).
  const hoyISO = new Date().toISOString().slice(0, 10);
  if (!isRetry) {
    const memoriaHoy = await db.get(
      `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&fecha=eq.${hoyISO}&tipo=eq.${TIPO}&select=id`
    );
    if (memoriaHoy.length) {
      console.log(`[${negocio}] ya se publicó "${TIPO}" hoy. Nada que hacer.`);
      return;
    }
  }

  // Bloqueo por 3 reintentos de corrección: si está bloqueado, no se genera
  // contenido nuevo hasta que staff lo desbloquee desde el portal.
  const bloqueo = await db.get(
    `barbara_correcciones?barbara_cliente_id=eq.${barbaraId}&select=bloqueado,intentos_usados`);
  if (bloqueo[0]?.bloqueado) {
    console.log(`[${negocio}] bloqueado por reintentos de corrección — staff debe desbloquear en el portal.`);
    return;
  }
  // Cuántas correcciones acumuló la pieza que está por cerrarse. Se lee ANTES
  // de generar la nueva, que es cuando el número todavía es el de la anterior.
  const correccionesPrevias = bloqueo[0]?.intentos_usados ?? 0;

  const recientesRaw = await db.get(
    `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&select=fecha,tipo,angulo&order=creado_en.desc&limit=15`
  );
  const recientes = recientesRaw.map(e => `- [${e.fecha} ${e.tipo}] ${e.angulo}`).join("\n") || "(sin historial)";

  // LO QUE LA MARCA YA CORRIGIO. Es la memoria individual: reglas destiladas
  // de lo que el cliente pidio cambiar, ordenadas por cuantas veces insistio.
  // Sin esto Barbara repetia el mismo error para siempre — la correccion se
  // guardaba en `barbara_chats` y nadie volvia a leer esa tabla nunca.
  const reglasRaw = await db.get(
    `barbara_reglas?barbara_cliente_id=eq.${barbaraId}&activa=eq.true` +
    `&select=regla,veces_reforzada&order=veces_reforzada.desc&limit=25`
  ).catch(() => []);
  const reglas = reglasRaw.length
    ? reglasRaw.map(r => `- ${r.regla}${r.veces_reforzada > 1 ? ` (lo pidio ${r.veces_reforzada} veces)` : ""}`).join(String.fromCharCode(10))
    : "(todavia no corrigio nada)";

  // MEMORIA GLOBAL: patrones aprendidos entre todos los clientes. Solo entran
  // los marcados `activo`, que hoy son cero a proposito — con pocos clientes
  // un patron cruzado es ruido, y aprender de ruido es peor que no aprender.
  // El tubo queda armado para cuando haya volumen.
  const patronesRaw = await db.get(
    `barbara_patrones?activo=eq.true&select=patron&order=muestras.desc&limit=10`
  ).catch(() => []);
  const patrones = patronesRaw.length
    ? patronesRaw.map(p => `- ${p.patron}`).join(String.fromCharCode(10))
    : "";


  // El primer color de la paleta manda como color de marca; el segundo, si
  // existe, es el fondo claro. Que el hex sea EXACTO es media ventaja de
  // componer: un modelo de imagen lo aproxima y la marca queda "parecida".
  const hexes = (bb.paleta_colores || []).map(c => c.hex).filter(h => /^#[0-9a-f]{6}$/i.test(h));
  const colorMarca = hexes[0] || "#141414";
  const colorFondo = hexes[1] || "#F4F2EC";

  const paleta = (bb.paleta_colores || []).map(c => `${c.hex}${c.uso ? ` (${c.uso})` : ""}`).join(", ") || "a criterio, coherente con el rubro";
  const tipos = (form.tipo_contenido || []).join(", ") || "contenido general para redes";
  // CORRECCIÓN DIRIGIDA. Antes acá había una sola línea que le decía al
  // modelo "genera una versión claramente mejor y distinta", sin pasarle ni
  // el pedido del cliente ni la pieza anterior. Eso no corrige: rehace.
  // Ver el encabezado de `correccion.mjs`.
  let previa = null, correccion = { cambios: [], es_correccion: false };
  if (isRetry) {
    previa = await piezaAnterior(db, barbaraId, TIPO);
    const mensajes = await leerPedido(db, barbaraId, previa?.creado_en);
    correccion = await extraerCambios(AK, mensajes, previa);
    console.log(`[${negocio}] corrección: ${correccion.cambios.length} cambio(s) pedido(s)` +
      (correccion.cambios.length ? " — " + correccion.cambios.map(c => c.que).join(", ") : ""));
  }
  // Si es reintento pero no se entendió ningún cambio concreto (mensaje vago
  // o perdido), se cae al comportamiento viejo en vez de quedarse sin
  // instrucciones: rehacer es peor que corregir, pero no entregar es peor aún.
  const extraRetry = !isRetry ? ""
    : correccion.cambios.length ? instrucciones(correccion.cambios, previa)
    : "\n\n⚠️ ESTE ES UN REINTENTO: el cliente pidió una corrección pero no se pudo interpretar qué. Genera una versión CLARAMENTE MEJOR del mismo tema.";
  const contexto = `Marca: ${negocio} (rubro: ${rubro || "no especificado"})
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

LO QUE ESTA MARCA YA TE CORRIGIO (respetalo SIEMPRE, es lo que mas pesa):
${reglas}${patrones ? `

LO QUE FUNCIONA EN GENERAL (patrones de rendimiento, no reglas de esta marca):
${patrones}` : ""}${extraRetry}`;

  // VERIFICAR ANTES DE GASTAR. Se comprueba el PLAN (el JSON), no la pieza
  // compuesta, y por dos razones que importan en pesos y en paciencia:
  //
  //   · Un carrusel se compone DESDE este JSON (ver plantillas.mjs), así que
  //     el JSON es la pieza: verificarlo es verificarla.
  //   · Un UGC son 2-3 clips de Seedance (~131 CLP cada uno). Descubrir
  //     recién ahí que la corrección no se cumplió sería pagar por una pieza
  //     que hay que rehacer igual.
  //
  // Y si falta algo, se reintenta UNA vez pidiendo solo lo que faltó. Ese
  // reintento es de texto, cuesta centavos y NO gasta uno de los 3 intentos
  // del cliente: sus intentos son para cuando la pieza no le gusta, no para
  // cuando Bárbara no entendió.
  async function asegurarCorreccion(pedirPlan, plan) {
    if (!correccion.cambios.length || !previa?.contenido) return { plan, cumplidos: null };
    let v = await verificar(AK, correccion.cambios, previa.contenido, plan);
    let falta = faltantes(correccion.cambios, v.resultados);
    if (falta.length) {
      console.log(`[${negocio}] faltaron ${falta.length} punto(s), reintento interno: ` +
        falta.map(f => f.que).join(", "));
      const insistir = "\n\nLA VERSIÓN QUE ACABAS DE PROPONER NO CUMPLE ESTOS PUNTOS:\n" +
        falta.map(f => `  · ${f.que} → ${f.accion}${f.motivo ? ` (${f.motivo})` : ""}`).join("\n") +
        "\n\nHazlos ahora, sin tocar nada más de lo que ya estaba bien.";
      try {
        const plan2 = await pedirPlan(insistir);
        const v2 = await verificar(AK, correccion.cambios, previa.contenido, plan2);
        const falta2 = faltantes(correccion.cambios, v2.resultados);
        if (falta2.length <= falta.length) { plan = plan2; v = v2; falta = falta2; }
      } catch (e) {
        console.log(`[${negocio}] el reintento interno falló, sigo con la primera versión:`, String(e).slice(0, 120));
      }
    }
    if (v.cambio_de_mas) console.log(`[${negocio}] ojo, cambió algo que nadie pidió: ${v.cambio_de_mas}`);
    return { plan, cumplidos: v.resultados, falta };
  }
  let verificacion = { cumplidos: null, falta: [] };

  let plan_contenido, mediaCaption;

  if (TIPO === "ugc") {
    const pedirPlanUGC = async (extra = "") => JSON.parse(textOf(await claude(AK, {
      model: "claude-sonnet-5", max_tokens: 2500,
      system: `Eres Bárbara, directora creativa de "${negocio}" (rubro: ${rubro || "no especificado"}). Diriges un video UGC vertical 9:16 (2-3 tomas de 4-6s): UNA PERSONA mostrando el producto o servicio y HABLÁNDOLE A LA CÁMARA, estilo grabado con su propio celular — casero y genuino, nunca un comercial pulido. La persona puede cambiar entre piezas. Sigues la identidad de marca del cliente. NUNCA repites ángulos de las piezas recientes. Responde SOLO con el JSON.`,
      output_config: { format: { type: "json_schema", schema: schemaUGC } },
      messages: [{ role: "user", content: `${contexto}${extra}\n\nCrea el UGC con un ángulo NUEVO, fiel a la marca.` }],
    })));
    plan_contenido = await pedirPlanUGC("");
    verificacion = await asegurarCorreccion(pedirPlanUGC, plan_contenido);
    plan_contenido = verificacion.plan || plan_contenido;
    const clips = (plan_contenido.clips || []).slice(0, 3);
    const urls = [];
    for (let i = 0; i < clips.length; i++) {
      try {
        urls.push(genVideo(clips[i].escena + "\n\n" + REGLA_TEXTO, Math.min(Math.max(clips[i].duracion || 5, 4), 6), i));
      } catch (e) {
        if (e.permanent) throw e;
        console.log(`[${negocio}] clip ${i + 1} falló:`, String(e).slice(0, 140));
      }
    }
    if (!urls.length) throw new Error(`[${negocio}] no se generó ningún clip UGC`);
    const videoBuf = await unirClips(urls);

    const fd = new FormData();
    fd.append("chat_id", telegram_chat_id);
    fd.append("caption", `🎬 UGC · ${negocio}\n\n💬 Texto en pantalla: ${plan_contenido.texto_en_pantalla || ""}`);
    fd.append("video", new Blob([videoBuf], { type: "video/mp4" }), "ugc.mp4");
    const j = await (await tg(TG_TOKEN, "sendVideo", fd, true)).json();
    if (!j.ok) throw new Error(`[${negocio}] Telegram sendVideo: ` + (j.description || ""));
    mediaCaption = plan_contenido.caption;
  } else {
    const nSlides = TIPO === "historia" ? 1 : 6;
    const pedirPlanSlides = async (extra = "") => JSON.parse(textOf(await claude(AK, {
      model: "claude-sonnet-5", max_tokens: 4000,
      system: `Eres Bárbara, directora creativa de "${negocio}" (rubro: ${rubro || "no especificado"}). Diseñas ${TIPO === "historia" ? "una historia de Instagram (1 imagen)" : `un carrusel de Instagram (${nSlides} slides)`} de nivel agencia. Sigues la identidad de marca del cliente al pie de la letra. Escribes la COPY FINAL de cada slide: el titular y el cuerpo tal cual los va a leer la persona. El diseño lo pone una plantilla de marca, así que NO describes imágenes ni composición — solo escribes las palabras, y tienen que sostenerse solas. NUNCA repites ángulos de las piezas recientes. Responde SOLO con el JSON.`,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: `${contexto}${extra}\n\nCrea ${TIPO === "historia" ? "la historia" : `el carrusel de ${nSlides} slides`} con un ángulo NUEVO, fiel a la marca.` }],
    })));
    plan_contenido = await pedirPlanSlides("");
    verificacion = await asegurarCorreccion(pedirPlanSlides, plan_contenido);
    plan_contenido = verificacion.plan || plan_contenido;
    const slides = (plan_contenido.slides || []).slice(0, nSlides);

    // Los slides se COMPONEN, no se dibujan. Ver `plantillas.mjs`: un carrusel
    // es una pieza tipográfica, y componerla en HTML deja el texto siempre
    // correcto (tildes, eñes), el hex de marca exacto y el costo en cero.
    const plantilla = PLANTILLAS[bb.plantilla] ? bb.plantilla : PLANTILLA_POR_DEFECTO;
    const imgs = [];
    for (let i = 0; i < slides.length; i++) {
      try {
        imgs.push(componerSlide(plantilla, {
          titular: slides[i].titular,
          cuerpo: slides[i].cuerpo,
          marca: negocio,
          indice: i + 1,
          total: slides.length,
          color: colorMarca,
          color2: colorFondo,
          tipografia: bb.tipografia || "",
        }));
      } catch (e) {
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
    mediaCaption = plan_contenido.caption;
  }

  await tg(TG_TOKEN, "sendMessage", {
    chat_id: telegram_chat_id,
    text: `🤖 *Bárbara* — contenido listo para revisar y aprobar.\n\n📝 *Caption:*\n\n${mediaCaption || ""}\n\n_Si quieres cambios, responde a este mensaje describiéndolos (máximo 3 correcciones antes de derivar a soporte)._`,
    parse_mode: "Markdown",
  });

  // CIERRE DE LA PIEZA ANTERIOR. Se hace acá, al empezar una nueva, porque el
  // cliente nunca dice "me gustó": solo escribe cuando quiere cambios. El
  // silencio ES la aprobación, pero recién se puede dar por buena cuando ya
  // pasó el turno de esa pieza. Sin este cierre, `aprobada_sin_cambios` se
  // queda en NULL para siempre y no hay de dónde aprender.
  //
  // Solo en piezas nuevas: un reintento es LA MISMA pieza, y darla por
  // cerrada ahí contaría dos veces la misma historia.
  if (!isRetry) {
    const previa = await db.get(
      `barbara_memoria?barbara_cliente_id=eq.${barbaraId}&aprobada_sin_cambios=is.null` +
      `&select=id,correcciones_pedidas&order=creado_en.desc&limit=1`
    ).catch(() => []);
    if (previa[0]) {
      // Se mira el contador DE ESA PIEZA, no el del cliente. El del cliente
      // suma todas las correcciones desde el último reinicio, y un reintento
      // crea su propia fila: usando el contador del cliente, esa fila nueva
      // heredaría las correcciones de la anterior y quedaría marcada como
      // corregida sin que nadie la hubiera corregido. Dato falso, y encima
      // uno del que después aprende la memoria global.
      const suyas = previa[0].correcciones_pedidas ?? 0;
      await db.patch(`barbara_memoria?id=eq.${previa[0].id}`, {
        aprobada_sin_cambios: suyas === 0,
      }).catch((e) => console.error("no se pudo cerrar la pieza previa:", String(e).slice(0, 120)));
    }

    // REINICIO DEL CONTADOR. Las 3 correcciones son POR PIEZA, no por cliente
    // de por vida: sin esto, quien gastó sus 3 en la primera semana quedaba
    // bloqueado para siempre y solo un humano podía destrabarlo desde el
    // portal. El bloqueo real (`bloqueado`) lo sigue levantando staff — eso no
    // se toca, porque significa "hubo un problema que alguien debe mirar".
    if (correccionesPrevias > 0) {
      await db.patch(`barbara_correcciones?barbara_cliente_id=eq.${barbaraId}`, {
        intentos_usados: 0,
        actualizado_en: new Date().toISOString(),
      }).catch((e) => console.error("no se pudo reiniciar el contador:", String(e).slice(0, 120)));
    }
  }

  await db.post("barbara_memoria", {
    barbara_cliente_id: barbaraId,
    fecha: hoyISO,
    tipo: TIPO,
    angulo: plan_contenido.angulo || "",
    titulo: negocio,
    // El plan ES la pieza: los carruseles se componen desde este JSON. Sin
    // guardarlo, el próximo reintento no tiene qué corregir y vuelve a
    // empezar de cero, que es el bug que esto vino a arreglar.
    contenido: plan_contenido,
    cambios_pedidos: correccion.cambios.length ? correccion.cambios : null,
    cambios_cumplidos: verificacion.cumplidos || null,
    corrige_a: isRetry && previa ? previa.id : null,
  });

  // AVISARLE A STAFF SI LA CORRECCIÓN NO SE LOGRÓ.
  //
  // Antes, al agotarse los 3 intentos el cliente quedaba `bloqueado` y no
  // pasaba nada más: nadie se enteraba. Es el mismo modo de falla silenciosa
  // que ya costó caro cuando las 3 correcciones eran por cliente de por vida
  // — el sistema se traba y solo se descubre porque el cliente reclama.
  //
  // Ahora queda registrado QUÉ se pidió y QUÉ no se pudo hacer, para que el
  // portal lo muestre y alguien se haga cargo con el detalle a la vista.
  if (verificacion.falta?.length) {
    await db.patch(`barbara_correcciones?barbara_cliente_id=eq.${barbaraId}`, {
      ultimo_pedido: correccion.cambios.map(c => `${c.que}: ${c.accion}`).join(" | ").slice(0, 500),
      ultimo_faltante: verificacion.falta,
      avisado_staff_en: new Date().toISOString(),
    }).catch((e) => console.error("no se pudo registrar el faltante:", String(e).slice(0, 120)));
    console.log(`[${negocio}] ⚠️ quedaron ${verificacion.falta.length} punto(s) sin cumplir:`,
      verificacion.falta.map(f => f.que).join(", "));
  }
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
