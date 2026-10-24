import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "../lib/supabase";
import type { Grupo } from "./Lateral";
import { Ico } from "./iconos";

type Item = { clave: string; grupo: string; titulo: string; detalle?: string; ir: string };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Buscador global (⌘K / Ctrl+K), solo para el equipo (24-oct-2026).
 * Salta a una página, un lead, un cliente o una clave escribiendo unas letras. Los datos se piden al abrirlo,
 * nunca antes: así no pesa en cada pantalla. Las claves se buscan por nombre y usuario; el valor secreto nunca viaja.
 */
export function BuscadorGlobal({ grupos }: { grupos: Grupo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [datos, setDatos] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const ir = useNavigate();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAbierto((v) => !v); }
      else if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", tecla);
    const abrir = () => setAbierto(true);
    window.addEventListener("portal:buscar", abrir);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener("portal:buscar", abrir); };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setQ(""); setSel(0);
    window.setTimeout(() => entrada.current?.focus(), 30);
    void Promise.all([
      sb.from("leads").select("id,negocio,nombre,email,tipo").order("creado_en", { ascending: false }).limit(300),
      sb.from("clientes").select("id,negocio,nombre,email").eq("archivado", false).limit(200),
      sb.from("claves").select("id,titulo,usuario").limit(400),
    ]).then(([l, c, k]) => {
      const out: Item[] = [];
      for (const x of l.data ?? []) out.push({ clave: `l${x.id}`, grupo: "Leads", titulo: x.negocio || x.nombre || (x.email ?? "").split("@")[0] || "Sin nombre", detalle: x.tipo ?? x.email ?? "", ir: `/acceso/leads?lead=${x.id}` });
      for (const x of c.data ?? []) out.push({ clave: `c${x.id}`, grupo: "Clientes", titulo: x.negocio || x.nombre || x.email || "Cliente", detalle: x.email ?? "", ir: `/acceso/clientes?ver=${x.id}` });
      for (const x of k.data ?? []) out.push({ clave: `k${x.id}`, grupo: "Bóveda", titulo: x.titulo, detalle: x.usuario ?? "", ir: `/acceso/claves?q=${encodeURIComponent(x.titulo)}` });
      setDatos(out);
    });
  }, [abierto]);

  const paginas: Item[] = useMemo(() => grupos.flatMap((g) => g.entradas.map((e) => ({ clave: `p${e.a}`, grupo: "Ir a", titulo: e.texto, detalle: g.titulo, ir: e.a }))), [grupos]);

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    const todos = [...paginas, ...datos];
    if (!t) return paginas;
    return todos.filter((i) => norm(`${i.titulo} ${i.detalle ?? ""}`).includes(t)).slice(0, 24);
  }, [q, datos, paginas]);

  useEffect(() => setSel(0), [q]);
  if (!abierto) return null;

  function elegir(i: Item | undefined) { if (!i) return; setAbierto(false); ir(i.ir); }
  let ultimoGrupo = "";

  return (
    <div className="bg-fondo" onMouseDown={(e) => e.target === e.currentTarget && setAbierto(false)}>
      <div className="bg-caja" role="dialog" aria-modal="true" aria-label="Buscar en el portal">
        <label className="bg-entrada">{Ico.buscar({ t: 18 })}
          <input ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un lead, cliente, clave o página…"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(resultados.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") elegir(resultados[sel]);
            }} />
          <kbd>esc</kbd>
        </label>
        <ul className="bg-lista">
          {resultados.length === 0 && <li className="bg-vacio">Nada con «{q}». Prueba con otra palabra.</li>}
          {resultados.map((i, n) => {
            const cab = i.grupo !== ultimoGrupo ? i.grupo : ""; ultimoGrupo = i.grupo;
            return (
              <li key={i.clave}>
                {cab && <p className="bg-grupo">{cab}</p>}
                <button className={n === sel ? "on" : ""} onMouseEnter={() => setSel(n)} onClick={() => elegir(i)}>
                  <b>{i.titulo}</b>{i.detalle && <small>{i.detalle}</small>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
