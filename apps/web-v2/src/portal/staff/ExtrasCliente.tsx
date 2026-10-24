import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";

type T = { id: string; titulo: string; estado: string; vence: string | null };
type K = { id: string; titulo: string; tipo: string };
type R = { id: string; titulo: string; fecha_hora: string };

/**
 * Lo que el equipo necesita de un cliente además de su plan y sus cobros: tareas abiertas, claves y archivos
 * de la Bóveda, y reuniones. Va debajo de la ficha para no abrir cuatro pantallas distintas (24-oct-2026).
 */
export function ExtrasCliente({ id, negocio }: { id: string; negocio: string | null }) {
  const [tareas, setTareas] = useState<T[]>([]);
  const [claves, setClaves] = useState<K[]>([]);
  const [reuniones, setReuniones] = useState<R[]>([]);

  useEffect(() => {
    void sb.from("tareas").select("id,titulo,estado,vence").eq("cliente_id", id).neq("estado", "hecha").order("vence", { nullsFirst: false }).limit(6).then(({ data }) => setTareas((data ?? []) as T[]));
    void sb.from("claves").select("id,titulo,tipo").eq("cliente_id", id).order("titulo").limit(8).then(({ data }) => setClaves((data ?? []) as K[]));
    if (negocio) void sb.from("reuniones").select("id,titulo,fecha_hora").ilike("cliente", `%${negocio.replace(/[%,]/g, "")}%`).order("fecha_hora", { ascending: false }).limit(4).then(({ data }) => setReuniones((data ?? []) as R[]));
  }, [id, negocio]);

  return (
    <div className="extras-cliente">
      <section>
        <header><h4>Tareas abiertas</h4><Link to="/acceso/organizacion/tablero">Tablero</Link></header>
        {tareas.length === 0 ? <p>Sin tareas pendientes.</p> : <ul>{tareas.map((t) => <li key={t.id}><b>{t.titulo}</b><small>{t.vence ? new Date(t.vence + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : "Sin fecha"}</small></li>)}</ul>}
      </section>
      <section>
        <header><h4>Bóveda</h4><Link to={`/acceso/claves?cliente=${id}`}>Abrir</Link></header>
        {claves.length === 0 ? <p>Sin claves ni archivos de este cliente.</p> : <ul>{claves.map((k) => <li key={k.id}><span aria-hidden="true">{k.tipo === "archivo" ? Ico.documentos({ t: 14 }) : Ico.candado({ t: 14 })}</span><b>{k.titulo}</b></li>)}</ul>}
      </section>
      <section>
        <header><h4>Reuniones</h4><Link to="/acceso/organizacion/calendario">Calendario</Link></header>
        {reuniones.length === 0 ? <p>Sin reuniones registradas.</p> : <ul>{reuniones.map((r) => <li key={r.id}><b>{r.titulo}</b><small>{new Date(r.fecha_hora).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</small></li>)}</ul>}
      </section>
    </div>
  );
}
