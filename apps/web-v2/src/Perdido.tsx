import { Component, type ReactNode } from "react";

const caja: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  textAlign: "center",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif",
  background: "#fff",
  color: "#16191A",
};

/**
 * Lo que se ve cuando la URL no existe.
 *
 * POR QUÉ HACE FALTA
 * ---------------------------------------------------------------------------
 * GitHub Pages entrega `404.html` —la cáscara del SPA— para cualquier ruta que
 * no sea un archivo. Sin una ruta `*`, react-router no encuentra nada que
 * montar y deja la página EN BLANCO, sin un mensaje ni un enlace.
 *
 * Pasó de verdad: una URL mal pegada
 * (`condorai.cl/admin.condorai.cl/acceso`) daba pantalla blanca, y desde
 * afuera es imposible distinguir eso de "el sitio está caído".
 */
export function Perdido() {
  return (
    <div style={caja}>
      <div>
        <p style={{ fontSize: 13, letterSpacing: ".14em", color: "#98A19E", margin: 0 }}>
          CÓNDOR AI
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 660, letterSpacing: "-.03em", margin: "10px 0 6px" }}>
          Esta página no existe
        </h1>
        <p style={{ color: "#6B7472", fontSize: 14, margin: "0 0 20px" }}>
          Puede que el enlace esté mal escrito o que la página se haya movido.
        </p>
        <p style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/" style={boton(true)}>Ir al inicio</a>
          <a href="/acceso" style={boton(false)}>Acceso clientes</a>
        </p>
      </div>
    </div>
  );
}

function boton(solido: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "9px 18px",
    borderRadius: 9,
    fontSize: 13.5,
    fontWeight: 550,
    textDecoration: "none",
    border: "1px solid " + (solido ? "#16191A" : "#E8EBE8"),
    background: solido ? "#16191A" : "#fff",
    color: solido ? "#fff" : "#16191A",
  };
}

/** Lo que se ve mientras carga un trozo pesado (el portal, el motor de PDF). */
export function Cargando() {
  return (
    <div style={{ ...caja, color: "#6B7472", fontSize: 14 }}>
      <span>Cargando…</span>
    </div>
  );
}

/**
 * Atrapa el error en vez de dejar la pantalla en blanco.
 *
 * El caso concreto: al publicar una versión nueva, los archivos cambian de
 * nombre. Un navegador con la página vieja abierta pide un chunk que ya no
 * existe, el import falla, y React desmonta TODO — pantalla blanca sin nada
 * que explique qué pasó ni cómo salir. Recargar lo arregla, pero nadie lo
 * sabe si no se lo dicen.
 */
export class Salvavidas extends Component<
  { children: ReactNode },
  { roto: boolean; detalle: string }
> {
  state = { roto: false, detalle: "" };

  static getDerivedStateFromError(e: unknown) {
    return { roto: true, detalle: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error("[portal] se cayó:", e);
  }

  render() {
    if (!this.state.roto) return this.props.children;
    return (
      <div style={caja}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 660, letterSpacing: "-.02em", margin: "0 0 6px" }}>
            Algo se rompió al cargar
          </h1>
          <p style={{ color: "#6B7472", fontSize: 14, margin: "0 0 18px" }}>
            Suele arreglarse recargando. Si hubo una actualización, tu navegador
            puede tener guardada la versión anterior.
          </p>
          <p style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => location.reload()} style={{ ...boton(true), cursor: "pointer" }}>
              Recargar
            </button>
            <a href="/" style={boton(false)}>Ir al inicio</a>
          </p>
          <p style={{ color: "#98A19E", fontSize: 11.5, marginTop: 18, maxWidth: 420 }}>
            {this.state.detalle.slice(0, 160)}
          </p>
        </div>
      </div>
    );
  }
}
