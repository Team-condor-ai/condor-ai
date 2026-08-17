import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb, plata, enlaceWeb } from "../lib/supabase";
import type { Cliente, Producto } from "./tipos";

type Nodo = {
  id: string;
  tipo: "centro" | "plan" | "cliente" | "producto";
  txt: string;
  sub?: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ref?: Cliente;
  producto?: Producto;
};
type Arco = { a: string; b: string };

/**
 * El mapa de clientes y planes, estilo grafo de Obsidian.
 *
 * SIN LIBRERÍA DE GRAFOS, Y ES UNA DECISIÓN
 * ---------------------------------------------------------------------------
 * `react-force-graph` + three.js suman ~600 kB para dibujar, en el caso real,
 * unas decenas de nodos. La simulación que hace falta —repulsión entre nodos,
 * resortes en las aristas y una fuerza al centro— son treinta líneas, y así
 * el portal no carga medio megabyte para una pantalla que se mira de vez en
 * cuando.
 *
 * Es 2D y no 3D a propósito: en 3D los nodos se tapan entre sí y hay que
 * rotar para leer, que es vistoso en una demo y molesto al usarlo. El grafo
 * de Obsidian, que es la referencia que se pidió, también es 2D.
 */
export function Mapa() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [activo, setActivo] = useState<Nodo | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const navega = useNavigate();

  // Clientes y productos se leen por separado y el mapa se arma con lo que
  // haya: cada vez que se crea uno, aparece acá solo — no hay que registrarlo
  // en ningún lado.
  useEffect(() => {
    Promise.all([
      sb.from("clientes").select("*"),
      sb.from("productos").select("*"),
    ]).then(([resClientes, resProductos]) => {
      setClientes(((resClientes.data ?? []) as Cliente[]).filter((c) => !c.archivado));
      setProductos(((resProductos.data ?? []) as Producto[]).filter((p) => p.activo));
      setCargando(false);
    });
  }, []);

  const { nodos, arcos } = useMemo(() => {
    const n: Nodo[] = [];
    const a: Arco[] = [];
    const suelto = () => (Math.random() - 0.5) * 260;

    n.push({
      id: "condor",
      tipo: "centro",
      txt: "CÓNDOR AI",
      r: 26,
      x: 0, y: 0, vx: 0, vy: 0,
    });

    const planes = [...new Set(clientes.map((c) => c.plan).filter(Boolean))] as string[];
    for (const p of planes) {
      n.push({
        id: "plan:" + p,
        tipo: "plan",
        txt: p,
        r: 15,
        x: suelto(), y: suelto(), vx: 0, vy: 0,
      });
      a.push({ a: "condor", b: "plan:" + p });
    }

    for (const c of clientes) {
      const padre = c.plan ? "plan:" + c.plan : "condor";
      n.push({
        id: c.id,
        tipo: "cliente",
        txt: c.negocio || c.email,
        sub: plata(c.mensual_monto, c.moneda),
        // El radio cuenta lo que aporta cada cliente al mes: en un vistazo se
        // ve quién sostiene el negocio, que es la pregunta que uno le hace a
        // un mapa así.
        r: 7 + Math.min(11, Math.sqrt(Math.max(0, c.mensual_monto ?? 0)) / 22),
        x: suelto(), y: suelto(), vx: 0, vy: 0,
        ref: c,
      });
      a.push({ a: padre, b: c.id });
    }

    // Los productos cuelgan del centro, no de los planes: son lo que Cóndor
    // ofrece, no una forma de agrupar clientes. Cuando un producto tenga
    // clientes asociados, acá irían esos arcos.
    for (const p of productos) {
      n.push({
        id: "producto:" + p.id,
        tipo: "producto",
        txt: p.nombre,
        sub: p.repo_url ? "repo ↗" : undefined,
        r: 13,
        x: suelto(), y: suelto(), vx: 0, vy: 0,
        producto: p,
      });
      a.push({ a: "condor", b: "producto:" + p.id });
    }

    return { nodos: n, arcos: a };
  }, [clientes, productos]);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv || !nodos.length) return;
    const ctx = cv.getContext("2d")!;
    let corriendo = true;
    let cam = { x: 0, y: 0, z: 1 };
    let arrastre: { x: number; y: number } | null = null;

    const css = getComputedStyle(document.documentElement);
    const col = (v: string) => css.getPropertyValue(v).trim() || "#888";

    function medir() {
      const r = cv!.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      cv!.width = r.width * d;
      cv!.height = r.height * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      return r;
    }
    let caja = medir();
    const alMedir = () => (caja = medir());
    window.addEventListener("resize", alMedir);

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function paso() {
      // Repulsión entre todos los nodos
      for (let i = 0; i < nodos.length; i++)
        for (let j = i + 1; j < nodos.length; j++) {
          const a = nodos[i], b = nodos[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const f = 2200 / d2;
          const ux = dx / d, uy = dy / d;
          a.vx -= ux * f; a.vy -= uy * f;
          b.vx += ux * f; b.vy += uy * f;
        }
      // Resortes de las aristas
      for (const e of arcos) {
        const a = nodos.find((n) => n.id === e.a)!;
        const b = nodos.find((n) => n.id === e.b)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - 118) * 0.012;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      }
      for (const n of nodos) {
        if (n.tipo === "centro") { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
        n.vx -= n.x * 0.0016;
        n.vy -= n.y * 0.0016;
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += n.vx; n.y += n.vy;
      }
    }

    function pintar() {
      const w = caja.width, h = caja.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
      ctx.scale(cam.z, cam.z);

      ctx.strokeStyle = col("--borde");
      ctx.lineWidth = 1;
      for (const e of arcos) {
        const a = nodos.find((n) => n.id === e.a)!;
        const b = nodos.find((n) => n.id === e.b)!;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of nodos) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle =
          n.tipo === "centro" ? col("--texto")
          : n.tipo === "plan" ? col("--texto-2")
          // Los productos van con el color de acento para distinguirlos de un
          // vistazo: son otra clase de cosa que los clientes, no otro tamaño.
          : n.tipo === "producto" ? col("--acento")
          : col("--panel");
        ctx.fill();
        ctx.strokeStyle = activo?.id === n.id ? col("--texto") : col("--borde");
        ctx.lineWidth = activo?.id === n.id ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = col("--texto");
        ctx.font = `${n.tipo === "cliente" ? 10 : 11}px -apple-system,system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.txt.slice(0, 22), n.x, n.y + n.r + 13);
      }
      ctx.restore();
    }

    function bucle() {
      if (!corriendo) return;
      paso();
      pintar();
      requestAnimationFrame(bucle);
    }
    if (quieto) { for (let i = 0; i < 220; i++) paso(); pintar(); }
    else bucle();

    function aMundo(ev: MouseEvent) {
      const r = cv!.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left - r.width / 2 - cam.x) / cam.z,
        y: (ev.clientY - r.top - r.height / 2 - cam.y) / cam.z,
      };
    }
    const alBajar = (e: MouseEvent) => (arrastre = { x: e.clientX - cam.x, y: e.clientY - cam.y });
    const alSubir = () => (arrastre = null);
    const alMover = (e: MouseEvent) => {
      if (arrastre) { cam.x = e.clientX - arrastre.x; cam.y = e.clientY - arrastre.y; return; }
      const p = aMundo(e);
      const bajo = nodos.find((n) => Math.hypot(n.x - p.x, n.y - p.y) < n.r + 5);
      cv!.style.cursor = bajo ? "pointer" : "grab";
      setActivo(bajo ?? null);
    };
    const alClic = (e: MouseEvent) => {
      const p = aMundo(e);
      const bajo = nodos.find((n) => Math.hypot(n.x - p.x, n.y - p.y) < n.r + 5);
      if (bajo?.tipo === "cliente") navega(`/acceso/clientes/${bajo.id}`);
      // Un producto no tiene ficha propia todavía, así que el clic abre su
      // repositorio si lo tiene; si no, lleva al catálogo.
      else if (bajo?.tipo === "producto") {
        const repo = bajo.producto?.repo_url;
        if (repo) window.open(enlaceWeb(repo), "_blank", "noreferrer");
        else navega("/acceso/productos");
      }
    };
    const alRodar = (e: WheelEvent) => {
      e.preventDefault();
      cam.z = Math.min(2.6, Math.max(0.35, cam.z * (e.deltaY > 0 ? 0.92 : 1.08)));
    };

    cv.addEventListener("mousedown", alBajar);
    window.addEventListener("mouseup", alSubir);
    cv.addEventListener("mousemove", alMover);
    cv.addEventListener("click", alClic);
    cv.addEventListener("wheel", alRodar, { passive: false });

    return () => {
      corriendo = false;
      window.removeEventListener("resize", alMedir);
      window.removeEventListener("mouseup", alSubir);
      cv.removeEventListener("mousedown", alBajar);
      cv.removeEventListener("mousemove", alMover);
      cv.removeEventListener("click", alClic);
      cv.removeEventListener("wheel", alRodar);
    };
  }, [nodos, arcos, activo, navega]);

  return (
    <>
      <div className="barra">
        <h1>Mapa</h1>
        <span className="conteo">
          {clientes.length} clientes · arrastra, rueda para acercar
        </span>
      </div>
      <div className="cuerpo">
        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : clientes.length === 0 ? (
          <p className="vacio">Todavía no hay clientes que mapear.</p>
        ) : (
          <div className="mapa-caja">
            <canvas ref={lienzo} className="mapa" />
            {activo?.ref && (
              <div className="mapa-ficha">
                <b>{activo.txt}</b>
                <small>{activo.ref.plan || "sin plan"}</small>
                <small>{activo.sub} al mes</small>
                <small style={{ color: "var(--texto-3)" }}>Clic para abrir</small>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
