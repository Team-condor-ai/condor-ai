import { useEffect, useState } from "react";
import { BrandBookEditor } from "../staff/agentes-ia/BrandBookEditor";
import { FormularioBarbara } from "../cliente/FormularioBarbara";
import type { BarbaraBrandBook, BarbaraFormulario } from "./tipos";
import { sb } from "../lib/supabase";

type Props = {
  barbaraClienteId: string;
  negocio: string;
  rubro: string | null;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  onCambio: () => void;
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
export function BarbaraConfiguracion({ barbaraClienteId, negocio, rubro, brandBook, formulario, onCambio }: Props) {
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
    <div>
      <section className="bloque" style={{ marginBottom: 18 }}>
        <h3>Identidad de marca</h3>
        <BrandBookEditor
          barbaraClienteId={barbaraClienteId}
          negocio={negocio}
          rubro={rubro}
          inicial={brandBook}
          onGuardado={onCambio}
        />
      </section>

      <section className="bloque">
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
