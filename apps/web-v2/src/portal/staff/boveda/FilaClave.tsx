import { useEffect, useRef, useState } from "react";
import { sb } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { type Item, colorDe, iniciales } from "./tipos";

const SEGUNDOS_VISIBLE = 20;

/** Una clave en la lista: se arrastra a otra carpeta, se muestra 20 s, se copia (usuario o clave) y se abre su sitio. */
export function FilaClave({ k, ruta, onEditar }: { k: Item; ruta: string; onEditar: () => void }) {
  const [valor, setValor] = useState<string | null>(null);
  const [resto, setResto] = useState(0);
  const [aviso, setAviso] = useState("");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  async function obtener() {
    const { data, error } = await sb.rpc("revelar_clave", { p_id: k.id });
    if (error) { setAviso("No se pudo revelar"); return null; }
    return (data as string | null) ?? "";
  }
  async function alternar() {
    if (valor !== null) { setValor(null); if (timer.current) window.clearInterval(timer.current); return; }
    const v = await obtener(); if (v === null) return;
    setValor(v); setResto(SEGUNDOS_VISIBLE);
    timer.current = window.setInterval(() => setResto((r) => { if (r <= 1) { setValor(null); if (timer.current) window.clearInterval(timer.current); return 0; } return r - 1; }), 1000);
  }
  async function copiar(que: "clave" | "usuario") {
    const texto = que === "usuario" ? k.usuario ?? "" : valor ?? (await obtener()) ?? "";
    if (!texto) { setAviso(que === "usuario" ? "Sin usuario" : "Sin clave guardada"); return; }
    try { await navigator.clipboard.writeText(texto); setAviso(que === "usuario" ? "Usuario copiado" : "Clave copiada"); } catch { setAviso("No se pudo copiar"); }
    // A los 30 s se limpia el portapapeles, pero solo si todavía tiene la clave (no se pisa lo que copiaste después).
    if (que === "clave") window.setTimeout(async () => { try { if ((await navigator.clipboard.readText()) === texto) await navigator.clipboard.writeText(""); } catch { /* el navegador no deja leer: se deja como está */ } }, 30000);
    window.setTimeout(() => setAviso(""), 2200);
  }

  return (
    <li className="bv-fila" draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-boveda", `item:${k.id}`); e.dataTransfer.effectAllowed = "move"; }}>
      <span className="bv-av" style={{ background: colorDe(k.titulo) }} aria-hidden="true">{iniciales(k.titulo)}</span>
      <button className="bv-info" onClick={onEditar}>
        <b>{k.titulo}</b>
        <small>{k.usuario || (k.tipo === "api" ? "API key" : k.tipo === "nota" ? "Nota segura" : "Sin usuario")}{ruta ? ` · ${ruta}` : ""}</small>
      </button>
      <code className={`bv-valor${valor !== null ? " visible" : ""}`} onClick={alternar} title={valor !== null ? "Ocultar" : "Mostrar"}>
        {valor !== null ? (valor || "—") : "••••••••••"}
        {valor !== null && <i style={{ width: `${(resto / SEGUNDOS_VISIBLE) * 100}%` }} />}
      </code>
      <div className="bv-fila-acc">
        {aviso && <span className="bv-aviso">{aviso}</span>}
        {k.usuario && <button className="icono-btn" title="Copiar usuario" onClick={() => copiar("usuario")}>{Ico.clientes({ t: 15 })}</button>}
        <button className="icono-btn" title="Copiar clave" onClick={() => copiar("clave")}>{Ico.documentos({ t: 15 })}</button>
        {k.url ? <a className="icono-btn" title="Abrir sitio" href={k.url.startsWith("http") ? k.url : `https://${k.url}`} target="_blank" rel="noreferrer">{Ico.abrirWeb({ t: 15 })}</a> : <span className="icono-btn hueco" />}
      </div>
    </li>
  );
}
