import { useEffect, useState } from "react";
import { sb, fecha } from "../lib/supabase";

type Fila = { id: string; fecha: string; tipo: string; angulo: string | null; creado_en: string };

const ETIQUETA_TIPO: Record<string, string> = {
  carrusel: "🖼️ Carrusel", historia: "📱 Historia", ugc: "🎬 UGC",
};

/**
 * "Biblioteca" — historial buscable de piezas, NO una galería de imágenes.
 *
 * POR QUÉ NO HAY MINIATURAS
 * ---------------------------------------------------------------------------
 * Cada imagen/video se manda directo a Telegram (`sendPhoto`/`sendVideo`) y
 * nunca pasa por almacenamiento propio — no hay un bucket ni una URL
 * permanente guardada en ningún lado. Mostrar una "biblioteca visual" acá
 * significaría inventar datos que no existen. Lo real es esto: el registro
 * completo de qué se generó, cuándo y con qué ángulo — las imágenes viven en
 * la conversación de Telegram del cliente, que es la fuente real hoy.
 *
 * Si en algún momento se agrega almacenamiento permanente de cada pieza
 * (Supabase Storage, por ejemplo), esta pantalla es donde se conectarían
 * las miniaturas reales — no antes.
 */
export function BarbaraBiblioteca({ barbaraClienteId }: { barbaraClienteId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    sb.from("barbara_memoria")
      .select("id,fecha,tipo,angulo,creado_en")
      .eq("barbara_cliente_id", barbaraClienteId)
      .order("creado_en", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setError(error.message);
        else { setFilas((data ?? []) as Fila[]); setError(""); }
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [barbaraClienteId]);

  const filtradas = busqueda.trim()
    ? filas.filter((f) => (f.angulo || "").toLowerCase().includes(busqueda.toLowerCase()))
    : filas;

  return (
    <div>
      <input
        className="campo"
        placeholder="Buscar por ángulo…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: 14, maxWidth: 340 }}
      />

      {error && <p className="error">{error}</p>}
      {cargando && <p className="vacio">Cargando…</p>}
      {!cargando && filtradas.length === 0 && <p className="vacio">Sin piezas todavía.</p>}

      {!cargando && filtradas.length > 0 && (
        <div className="tabla-caja">
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Ángulo</th></tr></thead>
            <tbody>
              {filtradas.map((f) => (
                <tr key={f.id}>
                  <td>{fecha(f.creado_en)}</td>
                  <td>{ETIQUETA_TIPO[f.tipo] || f.tipo}</td>
                  <td>{f.angulo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="tenue" style={{ marginTop: 14 }}>
        Las imágenes y videos viven en tu conversación de Telegram con Bárbara — acá está el
        registro completo de qué se generó y cuándo.
      </p>
    </div>
  );
}
