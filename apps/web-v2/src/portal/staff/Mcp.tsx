import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

/**
 * MCP / CLI — que el Claude de cada uno lea y escriba en el portal.
 *
 * Mismo patrón que se armó ayer para Veci Leads, pero acá el token se genera
 * DESDE una sesión ya autenticada del portal (`mcp-condor-token`, que valida
 * el JWT real de Supabase) en vez de un selector de persona — Cóndor ya tiene
 * login de verdad, así que no hace falta inventar uno nuevo.
 */
export function Mcp() {
  const [token, setToken] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(true);
  const [rotando, setRotando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError("");
    const { data, error } = await sb.functions.invoke("mcp-condor-token", { method: "GET" });
    if (error) setError(error.message);
    else {
      setToken((data as { token: string }).token);
      setNombre((data as { nombre: string }).nombre);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function rotar() {
    if (
      !confirm(
        "Se genera un token nuevo y el actual deja de servir.\n\n" +
          "Vas a tener que volver a correr el `claude mcp add` con el nuevo.",
      )
    ) {
      return;
    }
    setRotando(true);
    const { data, error } = await sb.functions.invoke("mcp-condor-token", { method: "POST" });
    if (error) setError(error.message);
    else setToken((data as { token: string }).token);
    setRotando(false);
  }

  async function copiar(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1600);
    } catch {
      setError("El navegador no dejó copiar. Selecciónalo a mano.");
    }
  }

  const comando = token
    ? "claude mcp add condor --scope user \\\n" +
      `  --env CONDOR_TOKEN=${token} \\\n` +
      "  -- node RUTA/condor-mcp/servidor.mjs"
    : "";

  return (
    <>
      <div className="barra">
        <h1>MCP / CLI</h1>
      </div>

      <div className="cuerpo" style={{ maxWidth: 790, display: "flex", flexDirection: "column", gap: 16 }}>
        <section className="bloque">
          <h3>Tu Claude, conectado al portal</h3>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5, lineHeight: 1.55 }}>
            Conecta tu Claude personal al portal de Cóndor: puede leer las
            reuniones (con sus notas) y la biblioteca, y escribir en ellas. Lo
            que guarda uno lo lee el Claude de todo el equipo — dejas el
            resumen de una reunión y cualquiera puede preguntarle a su Claude
            qué se acordó.
          </p>
          <div className="aviso" style={{ marginTop: 10 }}>
            Al conectarse, tu Claude ya sabe qué reuniones hay próximas, cuáles
            quedaron sin notas, y qué hay en la biblioteca. No hace falta
            explicarle nada.
          </div>
        </section>

        {error && <p className="error">{error}</p>}

        <section className="bloque">
          <h3>1. Tu token personal</h3>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5, marginBottom: 10 }}>
            Te identifica a ti, {nombre || "…"}. No lo compartas: quien lo
            tenga escribe en el portal con tu nombre. Si se te escapó, rótalo
            y el anterior deja de servir al instante.
          </p>
          {cargando ? (
            <p style={{ color: "var(--texto-2)", fontSize: 13 }}>Cargando…</p>
          ) : (
            <>
              <pre className="mcp-copiable">
                {token}
                <button className="btn chico" onClick={() => copiar("token", token || "")}>
                  {copiado === "token" ? "Copiado" : "Copiar"}
                </button>
              </pre>
              <button className="btn chico" style={{ marginTop: 8 }} onClick={rotar} disabled={rotando}>
                {rotando ? "Generando…" : "Rotar mi token"}
              </button>
            </>
          )}
        </section>

        <section className="bloque">
          <h3>2. Bájalo e instálalo</h3>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5 }}>
            Necesitas <b>Node 18 o más nuevo</b> — para saber si lo tienes,
            corre <code>node --version</code>.
          </p>
          <p style={{ marginTop: 8 }}>
            <a className="btn chico" href="/descargas/condor-mcp.zip" download>
              Descargar condor-mcp.zip
            </a>
          </p>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5, marginTop: 8 }}>
            Descomprímelo donde lo quieras dejar. Después, en la terminal,
            dentro de la carpeta:
          </p>
          <pre className="mcp-copiable">
            npm install
            <button className="btn chico" onClick={() => copiar("npm", "npm install")}>
              {copiado === "npm" ? "Copiado" : "Copiar"}
            </button>
          </pre>
        </section>

        <section className="bloque">
          <h3>3. Conéctalo a tu Claude</h3>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5 }}>
            Cambia <code>RUTA</code> por dónde dejaste la carpeta (la ruta
            completa, no relativa):
          </p>
          {token && (
            <pre className="mcp-copiable">
              {comando}
              <button className="btn chico" onClick={() => copiar("cmd", comando)}>
                {copiado === "cmd" ? "Copiado" : "Copiar"}
              </button>
            </pre>
          )}
          <p style={{ color: "var(--texto-2)", fontSize: 14.5, marginTop: 8 }}>
            Para comprobar que quedó: <code>claude mcp list</code> tiene que
            decir <code>condor ✔ Connected</code>.
          </p>
        </section>

        <section className="bloque">
          <h3>4. Háblale normal</h3>
          <p style={{ color: "var(--texto-2)", fontSize: 14.5, marginBottom: 10 }}>
            No hay comandos que aprender:
          </p>
          <table className="mcp-tabla">
            <tbody>
              <tr>
                <td>"anota que en la reunión con X quedamos en…"</td>
                <td>Guarda el resumen en la reunión</td>
              </tr>
              <tr>
                <td>"¿qué reuniones tengo esta semana?"</td>
                <td>Lista las próximas</td>
              </tr>
              <tr>
                <td>"¿qué se habló con Fintoc la última vez?"</td>
                <td>Busca y lee las notas guardadas</td>
              </tr>
              <tr>
                <td>"guarda este documento en la biblioteca, carpeta Legal"</td>
                <td>Lo sube y lo deja a la vista del equipo</td>
              </tr>
            </tbody>
          </table>
          <div className="aviso" style={{ marginTop: 10 }}>
            Tu Claude <b>no puede borrar</b> nada. Es a propósito: es memoria
            compartida y un borrado equivocado le cuesta al equipo. Para
            borrar se entra al portal, donde además pide confirmación.
          </div>
        </section>
      </div>
    </>
  );
}
