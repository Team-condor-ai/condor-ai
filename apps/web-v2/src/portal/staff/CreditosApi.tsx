import { useCallback, useEffect, useMemo, useState } from "react";
import { Ico } from "../disenio/iconos";
import { invocar, sb } from "../lib/supabase";
import { NotasInternas } from "./organizacion/NotasInternas";

// "Información interna" (Organización) se fusionó acá el 2-sept-2026 (pedido
// de Joaquín): las dos pantallas guardaban lo mismo en el fondo -- datos
// sensibles que hay que poder revelar -- solo que una lo hacía por proveedor
// de API (con reveal server-side, ver `revelar()` más abajo) y la otra por
// cuenta suelta (usuario/clave con un toggle simple, ver NotasInternas.tsx).
// Quedan como dos pestañas de una sola pantalla, "Claves / API Tokens", en
// vez de fundir sus modelos de datos: el de créditos revela vía Edge
// Function sin que el navegador vea la llave hasta pedirla, y bajar eso al
// nivel de NotasInternas sería MENOS seguro, no más ordenado.
type Vista = "creditos" | "cuentas";

type EstadoCredito = "ok" | "advertencia" | "sin_datos" | "error" | "requiere_configuracion";

type CreditoApi = {
  proveedor: string;
  nombre: string;
  estado: EstadoCredito;
  saldo: number | null;
  unidad_saldo: string | null;
  uso_periodo: number | null;
  unidad_uso: string | null;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  costo_usd: number | null;
  periodo_desde: string | null;
  detalle: string | null;
  fuente: string | null;
  actualizado_en: string | null;
  orden: number;
  // La setea el backend cuando existe una fila asociada en `api_credenciales`
  // (ver migración `20260829_api_creditos_revelable.sql`). Antes era un `Set`
  // hardcodeado acá, pero dejó de servir cuando el staff empezó a dar de alta
  // proveedores desde el portal.
  revelable: boolean;
};

const BASE: CreditoApi[] = [
  {
    proveedor: "anthropic", nombre: "Anthropic", estado: "requiere_configuracion",
    saldo: null, unidad_saldo: null, uso_periodo: null, unidad_uso: "tokens",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Agrega ANTHROPIC_ADMIN_KEY para leer uso y costo. Anthropic no expone el saldo prepago por API.",
    fuente: "Usage & Cost Admin API", actualizado_en: null, orden: 10, revelable: true,
  },
  {
    proveedor: "kie", nombre: "Kie.ai", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: "créditos",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Esperando la primera sincronización. Reemplaza a Higgsfield: gpt-image-2 + seedance-2-0.",
    fuente: "Kie.ai API", actualizado_en: null, orden: 15, revelable: true,
  },
  {
    proveedor: "higgsfield", nombre: "Higgsfield", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: "créditos",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "El sincronizador seguro todavía no ha informado el saldo.",
    fuente: "Higgsfield CLI", actualizado_en: null, orden: 20, revelable: false,
  },
  {
    proveedor: "blotato", nombre: "Blotato", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: null,
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Blotato permite verificar la conexión, pero no publica un endpoint de saldo de créditos.",
    fuente: "Blotato API", actualizado_en: null, orden: 30, revelable: true,
  },
];

const etiquetas: Record<EstadoCredito, string> = {
  ok: "Conectado",
  advertencia: "Atención",
  sin_datos: "Sin datos",
  error: "Error",
  requiere_configuracion: "Configurar",
};

function numero(n: number | null, unidad?: string | null) {
  if (n == null) return "No disponible";
  return `${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })}${unidad ? ` ${unidad}` : ""}`;
}

function cuando(iso: string | null) {
  if (!iso) return "Nunca";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";
  return fecha.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

// Cuánto dura visible una credencial revelada antes de re-ocultarse sola.
const SEGUNDOS_VISIBLE = 25;

export function CreditosApi() {
  const [vista, setVista] = useState<Vista>("creditos");
  const [filas, setFilas] = useState<CreditoApi[]>(BASE);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revelando, setRevelando] = useState<string | null>(null);
  const [revelada, setRevelada] = useState<{ proveedor: string; valor: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errorRevelar, setErrorRevelar] = useState("");
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const { data, error } = await sb
      .from("api_creditos")
      .select("*")
      .order("orden")
      .order("nombre");
    if (error) {
      setError("Todavía no está aplicada la migración de créditos API en Supabase.");
      setFilas(BASE);
    } else {
      const recibidas = (data ?? []) as CreditoApi[];
      setFilas(recibidas.length ? recibidas : BASE);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  // Se re-oculta sola: una credencial visible en pantalla más tiempo del
  // necesario es justo el tipo de descuido que esta pantalla existe para
  // evitar (nunca antes se mandaba una key completa al navegador).
  useEffect(() => {
    if (!revelada) return;
    const t = window.setTimeout(() => setRevelada(null), SEGUNDOS_VISIBLE * 1000);
    return () => window.clearTimeout(t);
  }, [revelada]);

  async function revelar(proveedor: string) {
    setErrorRevelar("");
    setCopiado(false);
    setRevelando(proveedor);
    const { data, error } = await sb.functions.invoke("revelar-credencial", { body: { proveedor } });
    setRevelando(null);
    if (error) {
      const msg = (data as { error?: string } | null)?.error || error.message;
      setErrorRevelar(msg);
      return;
    }
    const valor = (data as { valor?: string } | null)?.valor;
    if (!valor) {
      setErrorRevelar("La respuesta no trajo el valor.");
      return;
    }
    setRevelada({ proveedor, valor });
  }

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErrorRevelar("No se pudo copiar — copia el texto a mano.");
    }
  }

  const resumen = useMemo(() => ({
    conectadas: filas.filter((f) => f.estado === "ok").length,
    atencion: filas.filter((f) => f.estado !== "ok").length,
    ultima: filas.map((f) => f.actualizado_en).filter(Boolean).sort().pop() ?? null,
  }), [filas]);

  return (
    <>
      <div className="barra">
        <div>
          <h1>Claves / API Tokens</h1>
          <small className="subtitulo-barra">Todo lo sensible del equipo: proveedores de API, cuentas, correos y claves</small>
        </div>
        {vista === "creditos" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setMostrarAgregar(true)}>
              {Ico.mas({ t: 14 })} Agregar API
            </button>
            <button className="btn" onClick={() => void cargar()} disabled={cargando}>
              {Ico.repetir({ t: 14 })} {cargando ? "Consultando…" : "Actualizar vista"}
            </button>
          </div>
        )}
      </div>

      <div className="cuerpo creditos-api">
        <div className="subnav-organizacion">
          <button className={vista === "creditos" ? "on" : ""} onClick={() => setVista("creditos")}>
            {Ico.creditos({ t: 15 })} Créditos API
          </button>
          <button className={vista === "cuentas" ? "on" : ""} onClick={() => setVista("cuentas")}>
            {Ico.documentos({ t: 15 })} Cuentas y claves
          </button>
        </div>

        {vista === "cuentas" ? (
          <NotasInternas />
        ) : (
        <>
        <section className="creditos-resumen" aria-label="Resumen de integraciones">
          <div><small>Proveedores</small><b>{filas.length}</b></div>
          <div><small>Con datos</small><b>{resumen.conectadas}</b></div>
          <div><small>Requieren atención</small><b>{resumen.atencion}</b></div>
          <div><small>Última sincronización</small><b>{cuando(resumen.ultima)}</b></div>
        </section>

        {error && <div className="aviso">{error} La pantalla queda operativa en modo informativo hasta aplicarla.</div>}

        <section className="bloque">
          <div className="cabecera-bloque">
            <div>
              <h3>Disponibilidad y consumo</h3>
              <p>Los datos automáticos se sincronizan en servidor; ninguna llave llega al navegador salvo que la reveles a propósito.</p>
            </div>
          </div>
          <div className="tabla-caja scroll-x" style={{ marginTop: 12 }}>
            <table className="tabla-creditos">
              <thead><tr>
                <th>Proveedor</th><th>Estado</th><th>Disponible</th><th>Últimos 30 días</th><th>Costo</th><th>Actualizado</th><th></th>
              </tr></thead>
              <tbody>
                {filas.map((f) => {
                  const tokens = (f.tokens_entrada ?? 0) + (f.tokens_salida ?? 0);
                  const puedeRevelar = f.revelable;
                  return <tr key={f.proveedor}>
                    <td><b>{f.nombre}</b><small>{f.fuente || "Fuente no informada"}</small></td>
                    <td><span className={`estado-api ${f.estado}`}><i />{etiquetas[f.estado]}</span></td>
                    <td><b>{numero(f.saldo, f.unidad_saldo)}</b></td>
                    <td>
                      <b>{tokens > 0 ? numero(tokens, "tokens") : numero(f.uso_periodo, f.unidad_uso)}</b>
                      {tokens > 0 && <small>{numero(f.tokens_entrada, "entrada")} · {numero(f.tokens_salida, "salida")}</small>}
                    </td>
                    <td><b>{f.costo_usd == null ? "No disponible" : f.costo_usd.toLocaleString("en-US", { style: "currency", currency: "USD" })}</b></td>
                    <td><b>{cuando(f.actualizado_en)}</b><small>{f.detalle}</small></td>
                    <td>
                      {puedeRevelar && (
                        <button
                          className="btn chico"
                          onClick={() => revelar(f.proveedor)}
                          disabled={revelando === f.proveedor}
                        >
                          {revelando === f.proveedor ? "Revelando…" : "Revelar"}
                        </button>
                      )}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          {errorRevelar && <p className="error" style={{ marginTop: 10 }}>{errorRevelar}</p>}

          {revelada && (
            <div className="caja-baja" style={{ marginTop: 14 }}>
              <h4>Credencial de {filas.find((f) => f.proveedor === revelada.proveedor)?.nombre || revelada.proveedor}</h4>
              <p className="parrafo">
                Se oculta sola en {SEGUNDOS_VISIBLE}s. No la dejes copiada en un chat ni en un documento sin cifrar.
              </p>
              <div className="fila-busca" style={{ gap: 8 }}>
                <code className="campo" style={{ userSelect: "all", flex: 1, overflowX: "auto" }}>
                  {revelada.valor}
                </code>
                <button className="btn solido" onClick={() => copiar(revelada.valor)}>
                  {copiado ? "Copiado ✓" : "Copiar"}
                </button>
                <button className="btn" onClick={() => setRevelada(null)}>Ocultar</button>
              </div>
            </div>
          )}
        </section>

        <p className="creditos-nota">
          “No disponible” significa que el proveedor no publica ese dato por API; nunca se interpreta como saldo cero.
        </p>
        </>
        )}
      </div>

      {mostrarAgregar && (
        <ModalAgregarApi
          cerrar={() => setMostrarAgregar(false)}
          guardado={() => {
            setMostrarAgregar(false);
            void cargar();
          }}
        />
      )}
    </>
  );
}

// Modal para dar de alta un proveedor nuevo sin editar código.
// La credencial es opcional: si no se agrega, la fila queda en
// "requiere_configuracion" y sin botón de revelar hasta que alguien
// vuelva a abrir el modal y la cargue. La escritura la hace la Edge
// Function `agregar-credito-api` (staff-only, verifica `admins`).
function ModalAgregarApi({ cerrar, guardado }: { cerrar: () => void; guardado: () => void }) {
  const [proveedor, setProveedor] = useState("");
  const [nombre, setNombre] = useState("");
  const [fuente, setFuente] = useState("");
  const [unidadSaldo, setUnidadSaldo] = useState("");
  const [unidadUso, setUnidadUso] = useState("");
  const [orden, setOrden] = useState("100");
  const [detalle, setDetalle] = useState("");
  const [credencial, setCredencial] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    const slug = proveedor.trim().toLowerCase();
    if (!slug) return setError("Falta el identificador del proveedor.");
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return setError("El identificador solo puede tener letras minúsculas, números, guion y guion bajo.");
    }
    if (!nombre.trim()) return setError("Falta el nombre visible.");

    const cuerpo: Record<string, unknown> = { proveedor: slug, nombre: nombre.trim() };
    if (fuente.trim()) cuerpo.fuente = fuente.trim();
    if (unidadSaldo.trim()) cuerpo.unidad_saldo = unidadSaldo.trim();
    if (unidadUso.trim()) cuerpo.unidad_uso = unidadUso.trim();
    if (detalle.trim()) cuerpo.detalle = detalle.trim();
    const ordenN = Number(orden);
    if (Number.isFinite(ordenN)) cuerpo.orden = ordenN;
    if (credencial.trim()) cuerpo.credencial = credencial.trim();
    if (nota.trim()) cuerpo.nota = nota.trim();

    setGuardando(true);
    try {
      await invocar("agregar-credito-api", cuerpo);
      guardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="velo" onClick={cerrar}>
      <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Agregar proveedor de API</h2>
        </header>
        <div className="contenido">
          <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="campo-lbl">
              Identificador
              <input
                className="campo"
                required
                autoFocus
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="openai"
              />
              <small>Slug corto en minúsculas. Solo letras, números, guion y guion bajo.</small>
            </label>

            <label className="campo-lbl">
              Nombre visible
              <input
                className="campo"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="OpenAI"
              />
            </label>

            <label className="campo-lbl">
              Fuente
              <input
                className="campo"
                value={fuente}
                onChange={(e) => setFuente(e.target.value)}
                placeholder="OpenAI Usage API"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="campo-lbl">
                Unidad de saldo
                <input
                  className="campo"
                  value={unidadSaldo}
                  onChange={(e) => setUnidadSaldo(e.target.value)}
                  placeholder="créditos"
                />
              </label>
              <label className="campo-lbl">
                Unidad de uso
                <input
                  className="campo"
                  value={unidadUso}
                  onChange={(e) => setUnidadUso(e.target.value)}
                  placeholder="tokens"
                />
              </label>
            </div>

            <label className="campo-lbl">
              Orden
              <input
                className="campo"
                type="number"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
              />
              <small>Menor número = aparece antes en la tabla.</small>
            </label>

            <label className="campo-lbl">
              Detalle
              <textarea
                className="campo"
                rows={2}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Nota corta que aparece debajo de la fecha."
              />
            </label>

            <hr style={{ border: 0, borderTop: "1px solid var(--linea, rgba(255,255,255,0.08))", margin: "6px 0" }} />
            <b style={{ fontSize: 13, color: "var(--texto-2)" }}>Credencial (opcional)</b>

            <label className="campo-lbl">
              API key
              <input
                className="campo"
                type="password"
                value={credencial}
                onChange={(e) => setCredencial(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <small>
                Si la agregas ahora, queda disponible para revelar y copiar desde la tabla. Si el
                proveedor se usa en un workflow de GitHub Actions, también hay que ponerla en los
                secretos del repo — no hay sincronización automática.
              </small>
            </label>

            <label className="campo-lbl">
              Nota interna
              <input
                className="campo"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Dónde se generó, cuándo rota, quién la administra."
              />
            </label>

            <button className="btn solido ancho" disabled={guardando}>
              {guardando ? "Guardando…" : "Agregar proveedor"}
            </button>
          </form>

          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
        <footer>
          <button type="button" className="btn" onClick={cerrar} disabled={guardando}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
