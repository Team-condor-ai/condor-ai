import { useSearchParams } from "react-router-dom";
import { Ico } from "../disenio/iconos";
import { Cursos } from "./Cursos";
import { Claves } from "./Claves";
import { Servicios } from "./Servicios";

const TABS = [
  { id: "cursos", texto: "Cursos", ico: "plan" },
  { id: "passwords", texto: "Passwords", ico: "candado" },
  { id: "archivos", texto: "Archivos", ico: "documentos" },
  { id: "suscripciones", texto: "Suscripciones", ico: "cobros" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * La Biblioteca del equipo (24-oct-2026): cursos, passwords, archivos y suscripciones en un solo lugar.
 * Lo secreto (claves y archivos) vive en la Bóveda, que es privada y registra quién ve cada clave;
 * los cursos pueden marcarse «visibles para clientes» y entonces aparecen en el portal de cada cliente.
 */
export function Biblioteca({ tabInicial = "cursos" }: { tabInicial?: Tab }) {
  const [params, setParams] = useSearchParams();
  const pedida = params.get("tab") as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === pedida) ? (pedida as Tab) : tabInicial;
  const ir = (t: Tab) => { const p = new URLSearchParams(params); p.set("tab", t); setParams(p, { replace: true }); };

  return (
    <>
      <div className="barra">
        <div><p className="rotulo-mini">Todo lo que el equipo necesita saber y tener a mano</p><h1>Biblioteca</h1></div>
      </div>
      <div className="cuerpo">
        <div className="bib-tabs" role="tablist" aria-label="Secciones de la biblioteca">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => ir(t.id)}>
              {Ico[t.ico]({ t: 16 })}<span>{t.texto}</span>
            </button>
          ))}
        </div>
        {tab === "cursos" && <Cursos editable />}
        {tab === "passwords" && <Claves modo="passwords" embebido />}
        {tab === "archivos" && <Claves modo="archivos" embebido />}
        {tab === "suscripciones" && <Servicios />}
      </div>
    </>
  );
}
