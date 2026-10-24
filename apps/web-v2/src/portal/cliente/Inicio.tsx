import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb, plata } from "../lib/supabase";
import { Ico } from "../disenio/iconos";

type Cliente = { id: string; negocio: string | null; nombre: string | null; plan: string | null; web_url: string | null; linea: string | null; moneda: string | null };
type Cobro = { id: string; titulo: string; tipo: string; monto: number; moneda: string; estado: string; proximo_cobro: string | null };
type Pago = { monto: number; estado: string; fecha: string | null; creado_en: string };
type Sol = { estado: string; creado_en: string; lista_en: string | null };
type Web = { estado: "probando" | "ok" | "caida"; ms?: number };

const LINEA: Record<string, string> = { sites: "Cóndor Sites", ecommerce: "Cóndor Ecommerce", crm: "Cóndor CRM" };

/** ¿Responde el sitio? Un `fetch` sin CORS no deja leer la respuesta, pero sí saber si el servidor contestó y cuánto tardó. */
async function probarWeb(url: string): Promise<Web> {
  const u = /^https?:\/\//.test(url) ? url : `https://${url}`;
  const t0 = performance.now();
  try {
    const c = new AbortController(); const tope = window.setTimeout(() => c.abort(), 8000);
    await fetch(u, { mode: "no-cors", cache: "no-store", signal: c.signal });
    window.clearTimeout(tope);
    return { estado: "ok", ms: Math.round(performance.now() - t0) };
  } catch { return { estado: "caida" }; }
}

/**
 * Inicio del cliente (24-oct-2026): lo primero que ve al entrar. Su plan y si está al día, su sitio en línea
 * (y cuánto demora en responder), lo que nos ha pedido y en cuánto lo resolvimos, sus pagos del año y sus cursos.
 * Todo sale de datos reales del portal; nada se inventa.
 */
export function Inicio() {
  const [c, setC] = useState<Cliente | null | undefined>(undefined);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [sols, setSols] = useState<Sol[]>([]);
  const [cursos, setCursos] = useState({ total: 0, vistas: 0 });
  const [web, setWeb] = useState<Web | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from("clientes").select("id,negocio,nombre,plan,web_url,linea,moneda").limit(1).maybeSingle();
      setC((data ?? null) as Cliente | null);
      if (!data) return;
      const [co, pa, so, le, pr] = await Promise.all([
        sb.from("cobros").select("id,titulo,tipo,monto,moneda,estado,proximo_cobro").order("numero"),
        sb.from("pagos").select("monto,estado,fecha,creado_en").order("creado_en", { ascending: false }),
        sb.from("solicitudes").select("estado,creado_en,lista_en").eq("cliente_id", data.id),
        sb.from("lecciones").select("id", { count: "exact", head: true }),
        sb.from("curso_progreso").select("leccion_id", { count: "exact", head: true }),
      ]);
      setCobros((co.data ?? []) as Cobro[]); setPagos((pa.data ?? []) as Pago[]); setSols((so.data ?? []) as Sol[]);
      setCursos({ total: le.count ?? 0, vistas: pr.count ?? 0 });
      if (data.web_url) { setWeb({ estado: "probando" }); setWeb(await probarWeb(data.web_url)); }
    })();
  }, []);

  if (c === undefined) return <><div className="barra"><h1>Inicio</h1></div><div className="cuerpo"><p className="vacio">Cargando…</p></div></>;
  if (c === null) return <><div className="barra"><h1>Inicio</h1></div><div className="cuerpo"><p className="vacio">Tu cuenta todavía no tiene un plan asociado. Escríbenos y lo activamos.</p></div></>;

  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes = cobros.filter((x) => x.estado === "pendiente");
  const vencidos = pendientes.filter((x) => x.proximo_cobro && x.proximo_cobro < hoy);
  const mensual = cobros.find((x) => x.tipo === "mensual" && ["activa", "pendiente"].includes(x.estado));
  const anio = new Date().getFullYear();
  const pagadoAnio = pagos.filter((p) => p.estado === "pagado" && (p.fecha ?? p.creado_en).startsWith(String(anio))).reduce((a, p) => a + p.monto, 0);
  const abiertas = sols.filter((s) => s.estado !== "lista").length;
  const listas = sols.filter((s) => s.estado === "lista");
  const conFecha = listas.filter((s) => s.lista_en);
  const horasProm = conFecha.length ? conFecha.reduce((a, s) => a + (Date.parse(s.lista_en!) - Date.parse(s.creado_en)), 0) / conFecha.length / 3600000 : null;
  const tiempo = horasProm === null ? null : horasProm < 24 ? `${Math.max(1, Math.round(horasProm))} h` : `${Math.round(horasProm / 24)} días`;
  const pctCursos = cursos.total ? Math.round((cursos.vistas / cursos.total) * 100) : 0;
  const nombre = c.nombre?.split(" ")[0] || c.negocio || "";

  return (
    <>
      <div className="barra"><h1>Inicio</h1></div>
      <div className="cuerpo ini-cliente">
        <header className="ini-hola">
          <div>
            <p className="rotulo-mini">{c.linea ? LINEA[c.linea] ?? "Cóndor" : "Cóndor"}{c.plan && !(c.linea && LINEA[c.linea]?.toLowerCase().endsWith(c.plan.toLowerCase())) ? ` · ${c.plan}` : ""}</p>
            <h2>Hola{nombre ? `, ${nombre}` : ""} 👋</h2>
            <p>Así va {c.negocio || "tu proyecto"} con Cóndor.</p>
          </div>
          <span className={`ini-estado${vencidos.length ? " mal" : ""}`}><i />{vencidos.length ? `Tienes ${vencidos.length} pago${vencidos.length === 1 ? "" : "s"} vencido${vencidos.length === 1 ? "" : "s"}` : "Todo al día"}</span>
        </header>

        <div className="ini-kpis">
          <Link to="/acceso/plan" className={vencidos.length ? "mal" : ""}>
            <span>Próximo pago</span>
            <b>{mensual ? plata(mensual.monto, mensual.moneda) : pendientes[0] ? plata(pendientes[0].monto, pendientes[0].moneda) : "—"}</b>
            <small>{mensual?.proximo_cobro ? `el ${new Date(mensual.proximo_cobro + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" })}` : pendientes.length ? "pendiente" : "nada pendiente"}</small>
          </Link>
          <Link to="/acceso/boletas"><span>Pagado en {anio}</span><b>{plata(pagadoAnio, c.moneda ?? "CLP")}</b><small>{(() => { const n = pagos.filter((p) => p.estado === "pagado").length; return `${n} pago${n === 1 ? "" : "s"} registrado${n === 1 ? "" : "s"}`; })()}</small></Link>
          <Link to="/acceso/solicitudes"><span>Tus pedidos</span><b>{abiertas ? `${abiertas} en curso` : `${listas.length} listos`}</b><small>{tiempo ? `Los resolvemos en ${tiempo} en promedio` : "Pídenos un cambio cuando quieras"}</small></Link>
          <Link to="/acceso/cursos"><span>Tus cursos</span><b>{cursos.total ? `${pctCursos}%` : "—"}</b><small>{cursos.total ? `${cursos.vistas} de ${cursos.total} lecciones vistas` : "Pronto tendrás cursos acá"}</small></Link>
        </div>

        <div className="ini-dos">
          <section className="bloque">
            <h3>Tu sitio</h3>
            {c.web_url ? (
              <div className="ini-web">
                <span className="ini-web-ico">{Ico.abrirWeb({ t: 20 })}</span>
                <div>
                  <b>{c.web_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b>
                  <small>
                    {!web || web.estado === "probando" ? "Revisando…" : web.estado === "ok"
                      ? <><span className="en-linea">● En línea</span> · respondió en {web.ms} ms</>
                      : <span className="caida">● No responde ahora mismo. Ya lo estamos revisando; si sigue así, escríbenos.</span>}
                  </small>
                </div>
                <a className="btn chico" href={/^https?:\/\//.test(c.web_url) ? c.web_url : `https://${c.web_url}`} target="_blank" rel="noreferrer">Abrir</a>
              </div>
            ) : <p className="vacio-linea">Cuando tu sitio esté publicado lo vas a ver acá, con su estado en línea.</p>}
          </section>

          <section className="bloque">
            <h3>¿Necesitas algo?</h3>
            <p className="vacio-linea" style={{ marginBottom: 12 }}>Cambios de textos, fotos, horarios o lo que necesites: pídelo y lo ves avanzar acá mismo.</p>
            <Link className="btn solido" to="/acceso/solicitudes">{Ico.editar({ t: 15 })} Pedir un cambio</Link>
          </section>
        </div>
      </div>
    </>
  );
}
