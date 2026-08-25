import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ico } from "../disenio/iconos";
import { navegarConTransicion } from "../disenio/vistaTransicion";
import { infoPlan, type BarbaraBrandBook, type BarbaraFormulario } from "./tipos";
import { ReglasAprendidas } from "./ReglasAprendidas";
import { BarbaraChat } from "./BarbaraChat";
import { BarbaraCalendario } from "./BarbaraCalendario";
import { BarbaraBiblioteca } from "./BarbaraBiblioteca";
import { BarbaraAnalisis } from "./BarbaraAnalisis";
import { BarbaraConfiguracion } from "./BarbaraConfiguracion";
import { BarbaraUso } from "./BarbaraUso";
import { GrafoMemoria } from "../staff/memoria/GrafoMemoria";
import { Mcp } from "../staff/Mcp";

type Seccion = "chat" | "analisis" | "calendario" | "biblioteca" | "memoria" | "mcp" | "configuracion";

const NAV: { grupo: string; icono: keyof typeof Ico; items: { id: Seccion; texto: string; icono: keyof typeof Ico }[] }[] = [
  { grupo: "Inicio", icono: "panel", items: [
    { id: "chat", texto: "Bárbara IA", icono: "chat" },
    { id: "analisis", texto: "Análisis y reportes", icono: "grafo" },
  ] },
  { grupo: "Contenido", icono: "reuniones", items: [
    { id: "calendario", texto: "Calendario", icono: "reuniones" },
    { id: "biblioteca", texto: "Entregas", icono: "biblioteca" },
    { id: "memoria", texto: "Memoria", icono: "memoria" },
  ] },
  { grupo: "Ajustes", icono: "ajustes", items: [
    { id: "mcp", texto: "MCP", icono: "mcp" },
    { id: "configuracion", texto: "Configuración", icono: "ajustes" },
  ] },
];

type Props = {
  barbaraClienteId: string;
  negocio: string;
  plan: string;
  rubro: string | null;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  onCambio: () => void;
  /** Staff ve además "Lo que Bárbara aprendió" con permiso de apagar reglas. */
  esStaff?: boolean;
  activo?: boolean | null;
  telegramListo?: boolean;
  /** A dónde vuelve el botón de la esquina superior izquierda. */
  volverA: string;
  volverTexto: string;
};

/**
 * El módulo "Agentes IA > Bárbara" completo — mismo componente para un
 * cliente externo viendo SU Bárbara y para staff viendo la de cualquier
 * cliente (incluida la de Cóndor mismo). Pedido explícito de Joaquín
 * (24-ago-2026): que se sienta como entrar a OTRA app dentro del portal,
 * fiel a las 5 capturas de referencia que mandó — riel oscuro propio,
 * acento lima, tipografía serif para los saludos grandes. `Portal.tsx`
 * saca este módulo por completo del chrome de Cóndor (sin `Marco`, sin el
 * menú lateral del portal) antes de llegar acá — por eso existe el botón
 * de volver propio, es la única salida.
 */
export function BarbaraModulo({
  barbaraClienteId, negocio, plan, rubro, brandBook, formulario, onCambio, esStaff, activo, telegramListo, volverA, volverTexto,
}: Props) {
  const [seccion, setSeccion] = useState<Seccion>("chat");
  const navegar = useNavigate();

  return (
    <div className="barbara-modulo">
      <aside className="barbara-modulo-rail" aria-label="Navegación de Bárbara">
        <div className="barbara-modulo-rail-cabecera">
          <button
            className="barbara-modulo-volver"
            onClick={() => navegarConTransicion(navegar, volverA)}
          >
            {Ico.volver({ t: 15 })} {volverTexto}
          </button>
          <div className="barbara-modulo-marca">
            <span className="barbara-modulo-avatar">
              <img src="/assets/barbara/avatar.png" alt="" />
            </span>
            <div>
              <b>Bárbara</b>
              <span className="barbara-modulo-badge-ia">IA</span>
            </div>
          </div>
        </div>

        <nav>
          {NAV.map((g) => (
            <div key={g.grupo} className="barbara-modulo-grupo">
              <small>{Ico[g.icono]({ t: 12 })} {g.grupo}</small>
              {g.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={"barbara-modulo-item" + (seccion === item.id ? " on" : "")}
                  onClick={() => setSeccion(item.id)}
                  aria-current={seccion === item.id ? "page" : undefined}
                >
                  <span className="barbara-modulo-item-dot" />
                  {Ico[item.icono]({ t: 16 })}
                  <span>{item.texto}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="barbara-modulo-contenido">
        {seccion === "chat" && (
          <div className="barbara-inicio">
            <div className="barbara-hero">
              <img src="/assets/barbara/hero.png" alt="Bárbara" className="barbara-hero-img" />
              <div className="barbara-hero-cuerpo">
                <h1>¡Hola! Soy Bárbara ✨</h1>
                <p>Tu agente de IA para impulsar {negocio} cada semana.<br />¿En qué puedo ayudarte hoy?</p>
                <BarbaraChat barbaraClienteId={barbaraClienteId} />
              </div>
            </div>

            <BarbaraUso barbaraClienteId={barbaraClienteId} plan={plan} />

            <div className="barbara-tarjeta">
              <h3>{Ico.reuniones({ t: 17 })} Tu semana de contenido ✨</h3>
              <BarbaraCalendario barbaraClienteId={barbaraClienteId} vistaInicial="semana" />
            </div>

            {esStaff && (
              <div className="barbara-tarjeta">
                <h3>Lo que Bárbara aprendió</h3>
                <ReglasAprendidas barbaraClienteId={barbaraClienteId} puedeApagar />
              </div>
            )}
          </div>
        )}

        {seccion === "analisis" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.grafo({ t: 22 })} Análisis y reportes ✨</h1>
            <p className="barbara-subtitulo">Resumen de lo que Bárbara generó y cómo respondiste.</p>
            <BarbaraAnalisis barbaraClienteId={barbaraClienteId} />
          </div>
        )}

        {seccion === "calendario" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.reuniones({ t: 22 })} Calendario ✨</h1>
            <BarbaraCalendario barbaraClienteId={barbaraClienteId} vistaInicial="mes" />
          </div>
        )}

        {seccion === "biblioteca" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.biblioteca({ t: 22 })} Entregas y revisión ✨</h1>
            <BarbaraBiblioteca barbaraClienteId={barbaraClienteId} esStaff={Boolean(esStaff)} />
          </div>
        )}

        {seccion === "memoria" && (
          <div className="barbara-tarjeta barbara-tarjeta-memoria">
            <h1>{Ico.memoria({ t: 22 })} Memoria ✨</h1>
            <p className="barbara-subtitulo">La memoria de Bárbara. Conecta ideas, contenidos e insights.</p>
            <GrafoMemoria barbaraClienteId={barbaraClienteId} negocio={negocio} puedeEditar={Boolean(esStaff)} />
          </div>
        )}

        {seccion === "mcp" && (
          <div className="barbara-tarjeta">
            <Mcp />
          </div>
        )}

        {seccion === "configuracion" && (
          <div className="barbara-tarjeta">
            <h1>{Ico.ajustes({ t: 22 })} Configuración ✨</h1>
            <BarbaraConfiguracion
              barbaraClienteId={barbaraClienteId}
              negocio={negocio}
              rubro={rubro}
              brandBook={brandBook}
              formulario={formulario}
              onCambio={onCambio}
              esStaff={esStaff}
              activo={activo}
              telegramListo={telegramListo}
            />
            <div className="barbara-config-plan">
              <small>Plan</small>
              <span className={"pill " + infoPlan(plan).pill}>{infoPlan(plan).nombre}</span>
            </div>
            {esStaff && (
              <div style={{ marginTop: 18 }}>
                <button className="btn" onClick={() => navegarConTransicion(navegar, "/acceso/agentes-ia")}>
                  Administrar todos los clientes de Bárbara →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
