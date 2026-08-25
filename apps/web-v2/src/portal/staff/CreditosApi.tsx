import { useCallback, useEffect, useMemo, useState } from "react";
import { Ico } from "../disenio/iconos";
import { sb } from "../lib/supabase";

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
};

const BASE: CreditoApi[] = [
  {
    proveedor: "anthropic", nombre: "Anthropic", estado: "requiere_configuracion",
    saldo: null, unidad_saldo: null, uso_periodo: null, unidad_uso: "tokens",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Agrega ANTHROPIC_ADMIN_KEY para leer uso y costo. Anthropic no expone el saldo prepago por API.",
    fuente: "Usage & Cost Admin API", actualizado_en: null, orden: 10,
  },
  {
    proveedor: "kie", nombre: "Kie.ai", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: "créditos",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Esperando la primera sincronización. Reemplaza a Higgsfield: gpt-image-2 + seedance-2-0.",
    fuente: "Kie.ai API", actualizado_en: null, orden: 15,
  },
  {
    proveedor: "higgsfield", nombre: "Higgsfield", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: "créditos",
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "El sincronizador seguro todavía no ha informado el saldo.",
    fuente: "Higgsfield CLI", actualizado_en: null, orden: 20,
  },
  {
    proveedor: "blotato", nombre: "Blotato", estado: "sin_datos",
    saldo: null, unidad_saldo: "créditos", uso_periodo: null, unidad_uso: null,
    tokens_entrada: null, tokens_salida: null, costo_usd: null, periodo_desde: null,
    detalle: "Blotato permite verificar la conexión, pero no publica un endpoint de saldo de créditos.",
    fuente: "Blotato API", actualizado_en: null, orden: 30,
  },
];

// El portal nunca revela claves: los secretos viven en GitHub/Supabase, no
// en una base que pueda terminar enviándolos a un navegador.
const PROVEEDORES_REVELABLES = new Set<string>();

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
  const [filas, setFilas] = useState<CreditoApi[]>(BASE);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revelando, setRevelando] = useState<string | null>(null);
  const [revelada, setRevelada] = useState<{ proveedor: string; valor: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errorRevelar, setErrorRevelar] = useState("");

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
          <h1>Créditos y tokens API</h1>
          <small className="subtitulo-barra">Combustible operativo de las automatizaciones</small>
        </div>
        <button className="btn" onClick={() => void cargar()} disabled={cargando}>
          {Ico.repetir({ t: 14 })} {cargando ? "Consultando…" : "Actualizar vista"}
        </button>
      </div>

      <div className="cuerpo creditos-api">
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
                  const puedeRevelar = PROVEEDORES_REVELABLES.has(f.proveedor);
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
      </div>
    </>
  );
}
