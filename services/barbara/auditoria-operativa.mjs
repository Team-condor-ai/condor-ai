/** Vigilancia operativa determinista de Bárbara, sin llamadas de IA. */

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { supabase, tg } from "./motor.mjs";

const uno = (v) => Array.isArray(v) ? v[0] : v;
const edadMin = (fecha, ahora) => (ahora.getTime() - Date.parse(fecha || "")) / 60_000;
const clave = (tipo, ids = []) => createHash("sha256").update(`${tipo}:${ids.filter(Boolean).join(":")}`).digest("hex").slice(0, 32);

function alerta(tipo, severidad, resumen, ids, detalles = {}) {
  return { clave: clave(tipo, ids), tipo, severidad, resumen, detalles };
}

export function auditarBarbara({
  ahora = new Date(), programaciones = [], memorias = [], generaciones = [],
  canales = [], propuestas = [], patrones = [], notificaciones = [], decisiones = [],
} = {}) {
  const alertas = [];
  const mediaPorMemoria = new Map(memorias.map((m) => [m.id, Array.isArray(m.barbara_media) ? m.barbara_media.length : 0]));
  const decisionPorMemoria = new Set(decisiones.map((d) => d.barbara_memoria_id));

  for (const p of programaciones) {
    if (p.estado === "publicada" && !String(p.external_id || "").trim()) {
      alertas.push(alerta("publicada_sin_id", "critica", "Una publicación figura publicada sin ID del proveedor", [p.id], { programacion_id: p.id }));
    }
    if (p.estado === "publicando" && edadMin(p.claimed_at, ahora) > 25) {
      alertas.push(alerta("publicacion_colgada", "critica", "Una publicación lleva más de 25 minutos reclamada", [p.id], { programacion_id: p.id, minutos: Math.round(edadMin(p.claimed_at, ahora)) }));
    }
    if (p.estado === "programada" && edadMin(p.programada_para, ahora) > 15) {
      alertas.push(alerta("publicacion_atrasada", "alta", "Una publicación aprobada está atrasada más de 15 minutos", [p.id], { programacion_id: p.id, minutos: Math.round(edadMin(p.programada_para, ahora)) }));
    }
    if (p.estado === "fallida" && Number(p.intentos_publicacion || 0) >= 3) {
      alertas.push(alerta("publicacion_reincidente", Number(p.intentos_publicacion) >= 5 ? "critica" : "alta", "Una publicación acumula fallos", [p.id], { programacion_id: p.id, intentos: p.intentos_publicacion, error: String(p.ultimo_error || "").slice(0, 240) }));
    }
  }

  for (const m of memorias) {
    const edad = edadMin(m.creado_en, ahora);
    if (m.entrega_estado === "incompleta" && edad > 30) {
      alertas.push(alerta("pieza_incompleta", "critica", "Una pieza quedó incompleta después de generar", [m.id], { memoria_id: m.id, minutos: Math.round(edad), assets: mediaPorMemoria.get(m.id) || 0 }));
    }
    if (["pendiente", "fallida", "media_enviada"].includes(m.entrega_estado) && (mediaPorMemoria.get(m.id) || 0) === 0) {
      alertas.push(alerta("entrega_sin_media", "critica", "Una entrega pendiente no tiene assets persistidos", [m.id], { memoria_id: m.id, estado: m.entrega_estado }));
    }
    if (m.entrega_estado === "fallida" && Number(m.entrega_intentos || 0) >= 6) {
      alertas.push(alerta("entrega_agotada", "critica", "Telegram agotó los reintentos de una pieza", [m.id], { memoria_id: m.id, intentos: m.entrega_intentos, error: String(m.entrega_ultimo_error || "").slice(0, 240) }));
    }
    if (edad < 7 * 24 * 60 && !decisionPorMemoria.has(m.id)) {
      alertas.push(alerta("pieza_sin_decision", "media", "Una pieza reciente no tiene trazabilidad creativa", [m.id], { memoria_id: m.id }));
    }
  }

  for (const g of generaciones) {
    if (g.estado === "generando" && edadMin(g.claimed_at, ahora) > 100) {
      alertas.push(alerta("generacion_colgada", "critica", "Una generación lleva más de 100 minutos reclamada", [g.id], { generacion_id: g.id, minutos: Math.round(edadMin(g.claimed_at, ahora)) }));
    }
    if (g.estado === "fallida" && Number(g.intentos || 0) >= 3) {
      alertas.push(alerta("generacion_reincidente", Number(g.intentos) >= 5 ? "critica" : "alta", "Una generación acumula fallos pagados o intentos", [g.id], { generacion_id: g.id, intentos: g.intentos, error: String(g.ultimo_error || "").slice(0, 240) }));
    }
  }

  for (const c of canales) {
    if (c.auto_publicar && (!c.activo || !String(c.account_ref || "").trim())) {
      alertas.push(alerta("canal_auto_invalido", "critica", "Un canal tiene autopublicación sin conexión válida", [c.id], { canal_id: c.id, plataforma: c.plataforma }));
    }
  }

  for (const p of patrones) {
    if (p.activo && (Number(p.muestras || 0) < 12 || Number(p.marcas || 0) < 3 || Number(p.confianza_numerica || 0) < 0.15)) {
      alertas.push(alerta("patron_debil_activo", "critica", "Un patrón global débil está influyendo en clientes", [p.id], { patron_id: p.id, muestras: p.muestras, marcas: p.marcas, confianza: p.confianza_numerica }));
    }
  }

  for (const p of propuestas) {
    if (p.estado === "pendiente" && edadMin(p.creado_en, ahora) > 45 * 24 * 60) {
      alertas.push(alerta("memoria_pendiente_antigua", "media", "Una propuesta de memoria lleva más de 45 días sin resolver", [p.id], { propuesta_id: p.id }));
    }
  }
  for (const n of notificaciones) {
    if (n.estado === "fallida" && Number(n.intentos || 0) >= 5) {
      alertas.push(alerta("notificacion_agotada", "alta", "Un aviso de rendimiento agotó sus reintentos", [n.id], { notificacion_id: n.id, error: String(n.ultimo_error || "").slice(0, 240) }));
    }
  }

  // Defensa extra si una migración vieja o una edición directa saltó la RPC.
  const ordenadas = [...programaciones]
    .filter((p) => ["borrador", "programada", "publicando"].includes(p.estado) && p.programada_para)
    .sort((a, b) => Date.parse(a.programada_para) - Date.parse(b.programada_para));
  for (let i = 1; i < ordenadas.length; i++) {
    const a = ordenadas[i - 1], b = ordenadas[i];
    if (a.barbara_cliente_id === b.barbara_cliente_id && a.plataforma === b.plataforma
      && Math.abs(Date.parse(b.programada_para) - Date.parse(a.programada_para)) < 15 * 60_000) {
      alertas.push(alerta("calendario_colision", "alta", "Dos piezas del mismo canal están separadas por menos de 15 minutos", [a.id, b.id], { programaciones: [a.id, b.id] }));
    }
  }
  return alertas.sort((a, b) => ["critica", "alta", "media"].indexOf(a.severidad) - ["critica", "alta", "media"].indexOf(b.severidad) || a.clave.localeCompare(b.clave));
}

export function resumenAlertas(alertas = []) {
  const icono = { critica: "🛑", alta: "⚠️", media: "ℹ️" };
  const lineas = alertas.map((a) => `${icono[a.severidad] || "•"} ${a.resumen}\n   ${Object.entries(a.detalles || {}).slice(0, 3).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(",") : v}`).join(" · ")}`);
  return (`🩺 Bárbara detectó ${alertas.length} incidencia(s) operativas\n\n${lineas.join("\n\n")}`).slice(0, 4000);
}

async function cargarEstado(db, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 60 * 24 * 3600_000).toISOString();
  const [programaciones, memorias, generaciones, canales, propuestas, patrones, notificaciones, decisiones] = await Promise.all([
    db.get(`barbara_programaciones?creado_en=gte.${encodeURIComponent(desde)}&select=id,barbara_cliente_id,estado,plataforma,programada_para,claimed_at,external_id,intentos_publicacion,ultimo_error`),
    db.get(`barbara_memoria?creado_en=gte.${encodeURIComponent(desde)}&select=id,creado_en,entrega_estado,entrega_intentos,entrega_ultimo_error,barbara_media(id)`),
    db.get(`barbara_generaciones?creado_en=gte.${encodeURIComponent(desde)}&select=id,estado,claimed_at,intentos,ultimo_error`),
    db.get("barbara_canales?select=id,plataforma,activo,auto_publicar,account_ref"),
    db.get("barbara_memoria_propuestas?estado=eq.pendiente&select=id,estado,creado_en"),
    db.get("barbara_patrones?activo=eq.true&select=id,activo,muestras,marcas,confianza_numerica"),
    db.get("barbara_notificaciones?estado=eq.fallida&select=id,estado,intentos,ultimo_error"),
    db.get(`barbara_decisiones?creado_en=gte.${encodeURIComponent(desde)}&select=barbara_memoria_id`),
  ]);
  return { ahora, programaciones, memorias, generaciones, canales, propuestas, patrones, notificaciones, decisiones };
}

export async function ejecutarAuditoria({ db, notificar, ahora = new Date() } = {}) {
  const alertas = auditarBarbara(await cargarEstado(db, ahora));
  const reclamadas = await db.rpc("barbara_sincronizar_alertas_operativas", { p_alertas: alertas });
  if (!reclamadas?.length) return { alertas, notificadas: 0 };
  try {
    const respuesta = await notificar(resumenAlertas(reclamadas));
    const telegramId = Number(respuesta?.message_id || respuesta?.result?.message_id || 0) || null;
    for (const a of reclamadas) await db.rpc("barbara_finalizar_alerta_operativa", {
      p_clave: a.clave, p_claim_token: a.claim_token, p_notificada: true, p_error: null, p_telegram_message_id: telegramId,
    });
    return { alertas, notificadas: reclamadas.length };
  } catch (error) {
    for (const a of reclamadas) await db.rpc("barbara_finalizar_alerta_operativa", {
      p_clave: a.clave, p_claim_token: a.claim_token, p_notificada: false,
      p_error: String(error?.message || error).slice(0, 700), p_telegram_message_id: null,
    }).catch(() => {});
    throw error;
  }
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.BARBARA_ALERTAS_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!url || !key || !token || !chatId) throw new Error("Faltan credenciales de auditoría/Telegram");
  const salida = await ejecutarAuditoria({
    db: supabase(url, key),
    notificar: async (texto) => {
      const r = await tg(token, "sendMessage", { chat_id: chatId, text: texto });
      const body = await r.json();
      if (!body.ok) throw new Error(`Telegram: ${body.description || r.status}`);
      return body;
    },
  });
  console.log(`Auditoría Bárbara: ${salida.alertas.length} activas, ${salida.notificadas} notificadas.`);
  if (salida.alertas.some((a) => a.severidad === "critica")) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

