import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb, plata, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { EditorCliente } from "./EditorCliente";
import type { Cliente } from "./tipos";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "al_dia", texto: "Al día" },
  { id: "pendiente", texto: "Pendiente" },
  { id: "vencido", texto: "Vencido" },
  { id: "archivado", texto: "Archivados" },
] as const;

type Filtro = (typeof FILTROS)[number]["id"];

function Estado({ v }: { v: string | null }) {
  const mapa: Record<string, string> = {
    al_dia: "ok",
    pagado: "ok",
    pendiente: "warn",
    vencido: "mal",
  };
  const clase = mapa[v ?? ""] ?? "gris";
  const texto = (v ?? "—").replace("_", " ");
  return <span className={`pill ${clase}`}>{texto}</span>;
}

export function Clientes() {
  const [filas, setFilas] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [editando, setEditando] = useState<Cliente | "nuevo" | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await sb
      .from("clientes")
      .select("*")
      .order("creado_en", { ascending: false });
    // Se muestra el error REAL de Supabase, no un "algo salió mal": si RLS
    // rechaza o falta una columna, hay que poder leerlo sin abrir la consola.
    if (error) setError(error.message);
    else {
      setFilas((data ?? []) as Cliente[]);
      setError("");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((c) => {
      const archivado = Boolean(c.archivado);
      if (filtro === "archivado") {
        if (!archivado) return false;
      } else {
        if (archivado) return false;
        if (filtro !== "todos" && c.mensual_estado !== filtro) return false;
      }
      if (!q) return true;
      return [c.negocio, c.email, c.plan, c.concepto]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q));
    });
  }, [filas, busca, filtro]);

  const cuenta = useMemo(() => {
    const n: Record<string, number> = { todos: 0, archivado: 0 };
    for (const c of filas) {
      if (c.archivado) n.archivado++;
      else {
        n.todos++;
        const e = c.mensual_estado ?? "";
        n[e] = (n[e] ?? 0) + 1;
      }
    }
    return n;
  }, [filas]);

  async function archivar(c: Cliente, valor: boolean) {
    // Se ARCHIVA, no se borra. `pagos` cuelga de `clientes` con
    // `on delete cascade`: borrar la ficha se lleva el historial de pagos, y
    // un cliente que se fue sigue siendo contabilidad.
    const { error } = await sb
      .from("clientes")
      .update({ archivado: valor })
      .eq("id", c.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <>
      <div className="barra">
        <h1>Clientes</h1>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>
          {Ico.mas({ t: 15 })} Nuevo cliente
        </button>
      </div>

      <div className="fila-busca">
        <div className="mini-busca">
          {Ico.buscar({ t: 15 })}
          <input
            placeholder="Buscar negocio, correo o plan…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="cuerpo">
        <div className="chips">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              className={"chip" + (filtro === f.id ? " on" : "")}
              onClick={() => setFiltro(f.id)}
            >
              {f.texto}
              <span>{cuenta[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}
        {cargando && <p className="vacio">Cargando…</p>}

        {!cargando && visibles.length === 0 && (
          <p className="vacio">
            {filas.length === 0
              ? "Todavía no hay clientes. Crea el primero."
              : "Ningún cliente calza con ese filtro."}
          </p>
        )}

        {!cargando && visibles.length > 0 && (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Plan</th>
                  <th className="num">Setup</th>
                  <th className="num">Mensual</th>
                  <th>Estado</th>
                  <th>Próximo cobro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/acceso/clientes/${c.id}`} className="enlace-tabla">
                        <b>{c.negocio || "—"}</b>
                        <small>{c.email}</small>
                      </Link>
                    </td>
                    <td>{c.plan || "—"}</td>
                    <td className="num">{plata(c.setup_monto, c.moneda)}</td>
                    <td className="num">{plata(c.mensual_monto, c.moneda)}</td>
                    <td>
                      <Estado v={c.mensual_estado} />
                    </td>
                    <td>{fecha(c.proximo_cobro)}</td>
                    <td className="acciones">
                      <button
                        className="icono-btn"
                        title={c.archivado ? "Restaurar" : "Archivar"}
                        onClick={() => archivar(c, !c.archivado)}
                      >
                        {c.archivado ? Ico.volver({ t: 15 }) : Ico.archivar({ t: 15 })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <EditorCliente
          cliente={editando === "nuevo" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
