import { useState } from "react";
import { Ico } from "../disenio/iconos";
import { infoPlan, type BarbaraBrandBook, type BarbaraFormulario } from "./tipos";
import { ReglasAprendidas } from "./ReglasAprendidas";
import { BarbaraChat } from "./BarbaraChat";
import { BarbaraCalendario } from "./BarbaraCalendario";
import { BarbaraBiblioteca } from "./BarbaraBiblioteca";
import { BarbaraAnalisis } from "./BarbaraAnalisis";
import { BarbaraConfiguracion } from "./BarbaraConfiguracion";
import { GrafoMemoria } from "../staff/memoria/GrafoMemoria";

type Seccion = "chat" | "analisis" | "calendario" | "biblioteca" | "memoria" | "configuracion";

const NAV: { grupo: string; items: { id: Seccion; texto: string; icono: keyof typeof Ico }[] }[] = [
  { grupo: "Inicio", items: [
    { id: "chat", texto: "Bárbara IA", icono: "chat" },
    { id: "analisis", texto: "Análisis y reportes", icono: "grafo" },
  ] },
  { grupo: "Contenido", items: [
    { id: "calendario", texto: "Calendario", icono: "reuniones" },
    { id: "biblioteca", texto: "Biblioteca", icono: "biblioteca" },
    { id: "memoria", texto: "Memoria", icono: "memoria" },
  ] },
  { grupo: "Ajustes", items: [
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
};

/**
 * El módulo "Agentes IA > Bárbara" completo — el mismo componente para un
 * cliente externo viendo SU Bárbara y para staff viendo la de Cóndor o la
 * de cualquier cliente. Pedido explícito de Joaquín (24-ago-2026): un solo
 * portal, no dos experiencias paralelas que puedan divergir.
 *
 * La navegación interna (Inicio/Contenido/Ajustes) es un riel propio del
 * módulo, no el menú lateral del portal — ver `.barbara-modulo` en
 * `disenio/barbara.css`. Mismo patrón de layout que usan Organización o
 * Contabilidad para sus propias sub-secciones, llevado a una barra vertical
 * porque acá son 6 pantallas, no 3 pestañas.
 */
export function BarbaraModulo({ barbaraClienteId, negocio, plan, rubro, brandBook, formulario, onCambio, esStaff }: Props) {
  const [seccion, setSeccion] = useState<Seccion>("chat");

  return (
    <div className="barbara-modulo">
      <aside className="barbara-modulo-rail">
        <div className="barbara-modulo-marca">
          <span className="barbara-modulo-avatar">🦅</span>
          <div>
            <b>Bárbara</b>
            <span className={"pill " + infoPlan(plan).pill}>{infoPlan(plan).nombre}</span>
          </div>
        </div>

        <nav>
          {NAV.map((g) => (
            <div key={g.grupo} className="barbara-modulo-grupo">
              <small>{g.grupo}</small>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  className={"barbara-modulo-item" + (seccion === item.id ? " on" : "")}
                  onClick={() => setSeccion(item.id)}
                >
                  {Ico[item.icono]({ t: 16 })}
                  <span>{item.texto}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="barbara-modulo-contenido">
        {seccion === "chat" && (
          <section className="bloque">
            <h3>¡Hola! Soy Bárbara</h3>
            <p className="parrafo" style={{ color: "var(--texto-2)" }}>
              Tu agente de IA para impulsar {negocio}. ¿En qué te ayudo hoy?
            </p>
            <BarbaraChat barbaraClienteId={barbaraClienteId} />
            {esStaff && (
              <div style={{ marginTop: 22 }}>
                <h3>Lo que Bárbara aprendió</h3>
                <ReglasAprendidas barbaraClienteId={barbaraClienteId} puedeApagar />
              </div>
            )}
          </section>
        )}

        {seccion === "analisis" && (
          <section className="bloque">
            <h3>Análisis y reportes</h3>
            <BarbaraAnalisis barbaraClienteId={barbaraClienteId} />
          </section>
        )}

        {seccion === "calendario" && (
          <section className="bloque">
            <h3>Calendario</h3>
            <BarbaraCalendario barbaraClienteId={barbaraClienteId} />
          </section>
        )}

        {seccion === "biblioteca" && (
          <section className="bloque">
            <h3>Biblioteca</h3>
            <BarbaraBiblioteca barbaraClienteId={barbaraClienteId} />
          </section>
        )}

        {seccion === "memoria" && (
          <section className="bloque">
            <h3>Memoria</h3>
            <GrafoMemoria barbaraClienteId={barbaraClienteId} negocio={negocio} />
          </section>
        )}

        {seccion === "configuracion" && (
          <BarbaraConfiguracion
            barbaraClienteId={barbaraClienteId}
            negocio={negocio}
            rubro={rubro}
            brandBook={brandBook}
            formulario={formulario}
            onCambio={onCambio}
          />
        )}
      </div>
    </div>
  );
}
