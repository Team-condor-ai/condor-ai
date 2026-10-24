import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { useSesion } from "../auth/sesion";
import { useEquipo, useYo } from "../staff/personas";
import { Conversacion } from "./Conversacion";

type Fila = {
  cliente_id: string; negocio: string | null; nombre: string | null; email: string | null;
  ultimo_texto: string | null; ultimo_de_equipo: boolean | null; ultimo_en: string | null; sin_leer: number; pedidos_abiertos: number;
};
type Filtro = "todos" | "sin_leer" | "pedidos";

function cuando(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const dias = Math.floor((hoy.getTime() - d.getTime()) / 86400000);
  return dias < 7 ? d.toLocaleDateString("es-CL", { weekday: "short" }) : d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
const nombreDe = (f: Fila) => f.negocio || f.nombre || f.email || "Cliente";

/**
 * Bandeja de chats del equipo (24-oct-2026; reemplaza a «Solicitudes»). A la izquierda todos los clientes
 * activos, primero los que escribieron hace menos; a la derecha la conversación. Se actualiza sola cuando
 * llega un mensaje. En celular se ve una cosa a la vez.
 */
export function Bandeja() {
  const email = useSesion().email;
  const apodo = useYo(email)?.completo ?? (email ?? "").split("@")[0];
  const equipo = useEquipo().map((p) => p.nombre);
  const [params, setParams] = useSearchParams();
  const abierto = params.get("c");
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  const cargar = useCallback(() => {
    void sb.rpc("chat_bandeja").then(({ data }) => setFilas((data ?? []) as Fila[]));
  }, []);
  useEffect(() => {
    cargar();
    let espera: number | undefined;
    const ch = sb.channel("chat-bandeja")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensajes" }, () => { window.clearTimeout(espera); espera = window.setTimeout(cargar, 400); })
      .subscribe();
    return () => { window.clearTimeout(espera); void sb.removeChannel(ch); };
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (filas ?? []).filter((f) => {
      if (filtro === "sin_leer" && !f.sin_leer) return false;
      if (filtro === "pedidos" && !f.pedidos_abiertos) return false;
      if (q && ![f.negocio, f.nombre, f.email].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filas, filtro, busca]);

  const actual = (filas ?? []).find((f) => f.cliente_id === abierto) ?? null;
  const abrir = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("c", id); else p.delete("c"); setParams(p, { replace: true }); };
  const sinLeer = (filas ?? []).reduce((a, f) => a + f.sin_leer, 0);
  const pedidos = (filas ?? []).reduce((a, f) => a + f.pedidos_abiertos, 0);

  return (
    <>
      <div className="barra"><h1>Chat con clientes</h1></div>
      <div className={`cuerpo chat-bandeja${abierto ? " con-chat" : ""}`}>
        <div className="chat-lado" role="navigation" aria-label="Conversaciones">
          <label className="chat-busca">{Ico.buscar({ t: 15 })}<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" /></label>
          <div className="chat-filtros" role="tablist">
            <button className={filtro === "todos" ? "on" : ""} onClick={() => setFiltro("todos")}>Todos</button>
            <button className={filtro === "sin_leer" ? "on" : ""} onClick={() => setFiltro("sin_leer")}>Sin leer{sinLeer ? <em>{sinLeer}</em> : null}</button>
            <button className={filtro === "pedidos" ? "on" : ""} onClick={() => setFiltro("pedidos")}>Pedidos{pedidos ? <em>{pedidos}</em> : null}</button>
          </div>
          <ul className="chat-convs">
            {filas === null ? <li className="chat-vacio-lado">Cargando…</li> : visibles.length === 0 ? <li className="chat-vacio-lado">{filtro === "todos" ? "No hay clientes activos." : "Nada por acá."}</li> : visibles.map((f) => (
              <li key={f.cliente_id}>
                <button className={`chat-conv${f.cliente_id === abierto ? " on" : ""}${f.sin_leer ? " nuevo" : ""}`} onClick={() => abrir(f.cliente_id)}>
                  <span className="chat-av">{nombreDe(f)[0]?.toUpperCase()}</span>
                  <span className="chat-conv-txt">
                    <b>{nombreDe(f)}</b>
                    <small>{f.ultimo_texto ? <>{f.ultimo_de_equipo ? "Tú: " : ""}{f.ultimo_texto}</> : <i>Sin mensajes</i>}</small>
                  </span>
                  <span className="chat-conv-meta">
                    <small>{cuando(f.ultimo_en)}</small>
                    {f.sin_leer > 0 ? <em>{f.sin_leer}</em> : f.pedidos_abiertos > 0 ? <span className="chat-conv-ped" title="Pedidos abiertos">{f.pedidos_abiertos}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <section className="chat-zona">
          {actual ? (
            <Conversacion key={actual.cliente_id} clienteId={actual.cliente_id} soyEquipo yo={email} nombreYo={apodo} equipo={equipo}
              titulo={nombreDe(actual)} subtitulo={actual.email ?? "Sin correo: no puede entrar al portal"}
              acciones={<>
                <button className="btn chico solo-movil" onClick={() => abrir(null)}>← Chats</button>
                <Link className="btn chico" to={`/acceso/clientes?ver=${actual.cliente_id}`}>{Ico.clientes({ t: 13 })} Ficha</Link>
              </>} />
          ) : (
            <div className="chat-elige">{Ico.chat({ t: 30 })}<b>Elige una conversación</b><small>Los clientes te escriben desde su portal; lo que marques como pedido queda con su estado.</small></div>
          )}
        </section>
      </div>
    </>
  );
}
