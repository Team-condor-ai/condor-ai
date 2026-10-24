import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";

/**
 * Chat cliente ↔ Cóndor (24-oct-2026). Una conversación por cliente (`chat_mensajes.cliente_id`).
 * - Los mensajes nuevos llegan por Realtime (cambios de la tabla, que respetan RLS).
 * - «Escribiendo…» va por un canal privado `chat:<cliente_id>` (solo el equipo y ese cliente entran).
 * - Leído: `chat_marcar_leido(cliente)` marca los del otro lado; ✓✓ cuando `leido_en` tiene fecha.
 * - Un mensaje del cliente puede ser un pedido (`pedido_estado`): reemplaza a las antiguas «Solicitudes».
 */
export type Mensaje = {
  id: string; cliente_id: string; de_equipo: boolean; autor: string; texto: string | null;
  adjunto_ruta: string | null; adjunto_nombre: string | null; adjunto_tipo: string | null; adjunto_bytes: number | null;
  pedido_estado: "nueva" | "en_curso" | "lista" | null; pedido_responsable: string | null;
  creado_en: string; leido_en: string | null;
  /** Solo en pantalla: enviado pero todavía sin confirmar por la base. */
  pendiente?: boolean;
};

const limpio = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);

export function useConversacion(clienteId: string | null, soyEquipo: boolean, yo: string | null, nombreYo: string) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const canal = useRef<RealtimeChannel | null>(null);
  const ultimoAviso = useRef(0);
  const borrarAviso = useRef<number | undefined>(undefined);

  const marcarLeido = useCallback(() => {
    if (!clienteId || document.visibilityState !== "visible") return;
    // Ojo: una consulta de supabase-js solo se envía cuando alguien espera su resultado; sin `.then` no corre.
    void sb.rpc("chat_marcar_leido", { c: clienteId }).then(() => undefined);
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMensajes(null); setEscribiendo(null);
    void sb.from("chat_mensajes").select("*").eq("cliente_id", clienteId).order("creado_en", { ascending: false }).limit(300)
      .then(({ data, error: e }) => {
        if (!vivo) return;
        setError(e ? "No se pudo cargar el chat: " + e.message : "");
        setMensajes(((data ?? []) as Mensaje[]).reverse());
        marcarLeido();
      });

    (async () => {
      await sb.realtime.setAuth();
      if (!vivo) return;
      const ch = sb.channel(`chat:${clienteId}`, { config: { private: true } });
      ch.on("postgres_changes", { event: "*", schema: "public", table: "chat_mensajes", filter: `cliente_id=eq.${clienteId}` }, (p) => {
        if (p.eventType === "DELETE") { setMensajes((ms) => ms?.filter((m) => m.id !== (p.old as Mensaje).id) ?? null); return; }
        const m = p.new as Mensaje;
        setMensajes((ms) => {
          if (!ms) return ms;
          const i = ms.findIndex((x) => x.id === m.id);
          if (i >= 0) { const n = [...ms]; n[i] = m; return n; }
          return [...ms, m];
        });
        if (p.eventType === "INSERT" && m.de_equipo !== soyEquipo) { setEscribiendo(null); marcarLeido(); }
      });
      ch.on("broadcast", { event: "escribiendo" }, ({ payload }) => {
        if (payload?.equipo === soyEquipo) return;
        setEscribiendo(payload?.nombre ?? "Alguien");
        window.clearTimeout(borrarAviso.current);
        borrarAviso.current = window.setTimeout(() => setEscribiendo(null), 4000);
      });
      ch.subscribe();
      canal.current = ch;
    })();

    const alVolver = () => marcarLeido();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", alVolver);
      window.clearTimeout(borrarAviso.current);
      if (canal.current) void sb.removeChannel(canal.current);
      canal.current = null;
    };
  }, [clienteId, soyEquipo, marcarLeido]);

  /** Avisa «escribiendo…» como mucho cada 2,5 s. */
  const avisarEscribiendo = useCallback(() => {
    if (!canal.current || Date.now() - ultimoAviso.current < 2500) return;
    ultimoAviso.current = Date.now();
    void canal.current.send({ type: "broadcast", event: "escribiendo", payload: { equipo: soyEquipo, nombre: nombreYo } });
  }, [soyEquipo, nombreYo]);

  async function enviar(texto: string, archivo?: File | null) {
    if (!clienteId || !yo) return;
    const t = texto.trim();
    if (!t && !archivo) return;
    setError("");
    const id = crypto.randomUUID();
    let adjunto: Partial<Mensaje> = {};
    if (archivo) {
      if (archivo.size > 25 * 1024 * 1024) { setError("El archivo pesa más de 25 MB."); return; }
      const ruta = `${clienteId}/${id}-${limpio(archivo.name)}`;
      const { error: e } = await sb.storage.from("chat").upload(ruta, archivo, { contentType: archivo.type || undefined });
      if (e) { setError("No se pudo subir el archivo: " + e.message); return; }
      adjunto = { adjunto_ruta: ruta, adjunto_nombre: archivo.name, adjunto_tipo: archivo.type || null, adjunto_bytes: archivo.size };
    }
    const fila = { id, cliente_id: clienteId, de_equipo: soyEquipo, autor: soyEquipo ? nombreYo : yo, texto: t || null, ...adjunto };
    const optimista: Mensaje = { adjunto_ruta: null, adjunto_nombre: null, adjunto_tipo: null, adjunto_bytes: null, pedido_estado: null, pedido_responsable: null, leido_en: null, creado_en: new Date().toISOString(), ...fila, pendiente: true } as Mensaje;
    setMensajes((ms) => [...(ms ?? []), optimista]);
    const { data, error: e } = await sb.from("chat_mensajes").insert(fila).select("*").single();
    if (e) { setError("No se pudo enviar: " + e.message); setMensajes((ms) => ms?.filter((m) => m.id !== id) ?? null); return; }
    setMensajes((ms) => ms?.map((m) => (m.id === id ? (data as Mensaje) : m)) ?? null);
  }

  /** Solo el equipo: convertir un mensaje del cliente en pedido, moverlo de estado o quitarle la marca. */
  async function cambiarPedido(m: Mensaje, cambios: Partial<Pick<Mensaje, "pedido_estado" | "pedido_responsable">>) {
    setMensajes((ms) => ms?.map((x) => (x.id === m.id ? { ...x, ...cambios } : x)) ?? null);
    const { error: e } = await sb.from("chat_mensajes").update(cambios).eq("id", m.id);
    if (e) setError("No se pudo cambiar el pedido: " + e.message);
  }

  return { mensajes, escribiendo, error, enviar, avisarEscribiendo, cambiarPedido };
}

/**
 * Cuántos mensajes sin leer hay para mí: el equipo cuenta los de todos los clientes; un cliente, los del equipo
 * en su conversación. Se refresca solo cuando llega o se lee algo.
 */
export function useNoLeidos(soyEquipo: boolean | null) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (soyEquipo === null) return;
    let vivo = true;
    let espera: number | undefined;
    const contar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        void sb.from("chat_mensajes").select("id", { count: "exact", head: true }).eq("de_equipo", !soyEquipo).is("leido_en", null)
          .then(({ count }) => { if (vivo) setN(count ?? 0); });
      }, 300);
    };
    contar();
    const ch = sb.channel(`chat-no-leidos-${soyEquipo ? "eq" : "cl"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensajes" }, contar)
      .subscribe();
    return () => { vivo = false; window.clearTimeout(espera); void sb.removeChannel(ch); };
  }, [soyEquipo]);
  return n;
}

/** Enlace firmado (1 h) para ver un adjunto del bucket privado `chat`. */
export async function enlaceAdjunto(ruta: string, descargar?: string) {
  const { data } = await sb.storage.from("chat").createSignedUrl(ruta, 3600, descargar ? { download: descargar } : undefined);
  return data?.signedUrl ?? null;
}
