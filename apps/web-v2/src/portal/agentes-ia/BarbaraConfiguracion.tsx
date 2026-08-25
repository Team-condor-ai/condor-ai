import { useEffect, useState } from "react";
import { BrandBookEditor } from "../staff/agentes-ia/BrandBookEditor";
import { FormularioBarbara } from "../cliente/FormularioBarbara";
import type { BarbaraBrandBook, BarbaraFormulario } from "./tipos";
import { sb } from "../lib/supabase";
import { BarbaraUso } from "./BarbaraUso";

type Props = {
  barbaraClienteId: string;
  negocio: string;
  rubro: string | null;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  /** Para el bloque de uso del mes: los límites dependen del plan. */
  plan: string;
  onCambio: () => void;
  esStaff?: boolean;
  activo?: boolean | null;
  telegramListo?: boolean;
};

async function consultarOperacion(barbaraClienteId: string) {
  const [rCanales, rCliente] = await Promise.all([
    sb.from("barbara_canales").select("id,plataforma,activo,auto_publicar")
      .eq("barbara_cliente_id", barbaraClienteId).order("plataforma"),
    sb.from("barbara_clientes").select("zona_horaria").eq("id", barbaraClienteId).single(),
  ]);
  const error = rCanales.error || rCliente.error;
  return {
    error: error?.message || "",
    canales: rCanales.data ?? [],
    zonaHoraria: rCliente.data?.zona_horaria || "America/Santiago",
  };
}

/** Reutiliza el editor de marca (staff) + el formulario de entrada (cliente):
 * los dos son igual de válidos para cualquiera que esté configurando SU
 * Bárbara, sea un cliente externo o Cóndor viendo la suya. */
export function BarbaraConfiguracion({ barbaraClienteId, negocio, rubro, brandBook, formulario, plan, onCambio, esStaff = false, activo = true, telegramListo = false }: Props) {
  const [editandoFormulario, setEditandoFormulario] = useState(false);
  const [canales, setCanales] = useState<{ id: string; plataforma: string; activo: boolean; auto_publicar: boolean }[]>([]);
  const [zonaHoraria, setZonaHoraria] = useState("America/Santiago");
  const [guardandoCanal, setGuardandoCanal] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cargarOperacion() {
    const r = await consultarOperacion(barbaraClienteId);
    if (r.error) setError(r.error);
    else {
      setCanales(r.canales);
      setZonaHoraria(r.zonaHoraria);
    }
  }

  useEffect(() => {
    let vivo = true;
    const timer = window.setTimeout(() => {
      void consultarOperacion(barbaraClienteId).then((r) => {
        if (!vivo) return;
        if (r.error) setError(r.error);
        else { setCanales(r.canales); setZonaHoraria(r.zonaHoraria); }
      });
    }, 0);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [barbaraClienteId]);

  async function cambiarAutomatico(canal: typeof canales[number]) {
    setGuardandoCanal(canal.id); setError("");
    const { error } = await sb.rpc("barbara_configurar_auto_publicar", {
      p_canal_id: canal.id, p_auto_publicar: !canal.auto_publicar,
    });
    setGuardandoCanal(null);
    if (error) { setError(error.message); return; }
    await cargarOperacion();
  }

  async function cambiarZona(nueva: string) {
    const anterior = zonaHoraria;
    setZonaHoraria(nueva); setError("");
    const { error } = await sb.rpc("barbara_configurar_zona_horaria", {
      p_barbara_cliente_id: barbaraClienteId, p_zona_horaria: nueva,
    });
    if (error) { setZonaHoraria(anterior); setError(error.message); }
  }

  return (
    <div className="barbara-configuracion">
      <EstadoOperacion activo={activo} telegramListo={telegramListo} brandBook={brandBook} formulario={formulario} />

      {/* El uso del mes se muestra SOLO acá. Estaba también en el inicio, y
          ahí competía con el saludo y el calendario por la atención sin que
          nadie fuera a buscarlo (pedido de Joaquín, 25-ago-2026). */}
      <section className="barbara-config-seccion">
        <h3>Uso del plan</h3>
        <BarbaraUso barbaraClienteId={barbaraClienteId} plan={plan} />
      </section>

      <section className="barbara-config-seccion">
        <h3>Identidad de marca</h3>
        {esStaff ? <BrandBookEditor
          barbaraClienteId={barbaraClienteId}
          negocio={negocio}
          rubro={rubro}
          inicial={brandBook}
          onGuardado={onCambio}
        /> : <ResumenMarca brandBook={brandBook} />}
      </section>

      <section className="barbara-config-seccion">
        <h3>Formulario de entrada</h3>
        <p className="parrafo" style={{ color: "var(--texto-2)" }}>
          Qué tipo de piezas quieres, a quién le hablas, tu tono y qué evitar.
        </p>
        <button className="btn solido" onClick={() => setEditandoFormulario(true)}>
          Editar formulario de entrada
        </button>
      </section>

      <section className="bloque" style={{ marginTop: 18 }}>
        <h3>Calendario y publicación</h3>
        {error && <p className="error">{error}</p>}
        <label className="campo-lbl" style={{ maxWidth: 330 }}>
          Zona horaria del calendario
          <select className="campo" value={zonaHoraria} onChange={(e) => { void cambiarZona(e.target.value); }}>
            <option value="America/Santiago">Chile · Santiago</option>
            <option value="America/Bogota">Colombia · Bogotá</option>
            <option value="America/Lima">Perú · Lima</option>
            <option value="America/Mexico_City">México · Ciudad de México</option>
            <option value="America/Argentina/Buenos_Aires">Argentina · Buenos Aires</option>
            <option value="America/New_York">EE. UU. · Nueva York</option>
          </select>
        </label>
        <p className="parrafo" style={{ color: "var(--texto-2)" }}>
          Aprobar una pieza en el calendario no la publica automáticamente salvo que actives esa autorización para su canal.
        </p>
        {!canales.length && <p className="tenue">Todavía no hay redes conectadas. El equipo debe conectar una cuenta antes de habilitar publicación automática.</p>}
        {canales.map((canal) => (
          <div className="barbara-canal" key={canal.id}>
            <span><b style={{ textTransform: "capitalize" }}>{canal.plataforma}</b><small>{canal.activo ? "Cuenta conectada" : "Canal inactivo"}</small></span>
            <button className={"chip-toggle" + (canal.auto_publicar ? " on" : "")}
              disabled={!canal.activo || guardandoCanal === canal.id}
              onClick={() => { void cambiarAutomatico(canal); }}>
              {canal.auto_publicar ? "Publicación automática activa" : "Activar publicación automática"}
            </button>
          </div>
        ))}
      </section>

      {editandoFormulario && (
        <FormularioBarbara
          barbaraClienteId={barbaraClienteId}
          inicial={formulario}
          cerrar={() => setEditandoFormulario(false)}
          guardado={() => { setEditandoFormulario(false); onCambio(); }}
        />
      )}
    </div>
  );
}

function EstadoOperacion({ activo, telegramListo, brandBook, formulario }: { activo: boolean | null; telegramListo: boolean; brandBook: BarbaraBrandBook | null; formulario: BarbaraFormulario | null }) {
  const tieneFormulario = Boolean(formulario && (formulario.publico_objetivo || formulario.tono || formulario.producto_destacar || (formulario.tipo_contenido?.length ?? 0) > 0));
  const puntos = [
    { texto: "Cuenta activa", listo: Boolean(activo) },
    { texto: "Identidad de marca", listo: Boolean(brandBook) },
    { texto: "Brief de contenido", listo: tieneFormulario },
    { texto: "Canal de entrega", listo: telegramListo },
  ];
  const listos = puntos.filter((p) => p.listo).length;
  return <section className="barbara-estado-operacion">
    <header><div><small>Estado operativo</small><b>{listos === puntos.length ? "Bárbara está lista para entregar" : `${listos} de ${puntos.length} pasos completados`}</b></div><span className={"pill " + (listos === puntos.length ? "ok" : "warn")}>{listos === puntos.length ? "Lista" : "Configuración pendiente"}</span></header>
    <div>{puntos.map((p) => <span key={p.texto} className={p.listo ? "listo" : "pendiente"}>{p.listo ? "✓" : "○"} {p.texto}</span>)}</div>
  </section>;
}

function ResumenMarca({ brandBook }: { brandBook: BarbaraBrandBook | null }) {
  if (!brandBook) return <p className="tenue">Tu identidad visual todavía está siendo configurada por el equipo.</p>;
  const colores = brandBook.paleta_colores?.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex)) ?? [];
  return <div className="barbara-marca-resumen">
    <div><small>Paleta de marca</small><span className="barbara-marca-colores">{colores.length ? colores.map((c) => <i key={c.hex} title={c.uso || c.hex} style={{ background: c.hex }} />) : "Sin paleta registrada"}</span></div>
    <div><small>Tipografía</small><b>{brandBook.tipografia || "Definida por el equipo"}</b></div>
    {brandBook.detalles && <p>{brandBook.detalles}</p>}
    <p className="tenue">¿Necesitas cambiar la identidad? Escríbenos y la ajustamos antes de la siguiente pieza.</p>
  </div>;
}
