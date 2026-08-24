import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { BarbaraModulo } from "../../agentes-ia/BarbaraModulo";
import type { BarbaraBrandBook, BarbaraCliente, BarbaraFormulario } from "../../agentes-ia/tipos";

type Cargado = {
  cliente: BarbaraCliente;
  negocio: string;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
};

function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/**
 * El mismo `BarbaraModulo` que ve un cliente, pero abierto por staff para
 * un cliente cualquiera de la lista — "vivir la Bárbara de X" en vez de
 * solo administrar sus datos (eso lo sigue haciendo `FichaBarbaraCliente`).
 * Con `esStaff` en true: puede apagar reglas aprendidas.
 */
export function BarbaraClientePortal() {
  const { id } = useParams();
  const [d, setD] = useState<Cargado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");
    const { data, error } = await sb
      .from("barbara_clientes")
      .select("*, clientes(negocio), barbara_brand_book(*), barbara_formulario(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) { setError(error.message); setCargando(false); return; }
    if (!data) { setD(null); setCargando(false); return; }
    const fila = data as unknown as BarbaraCliente & {
      clientes: { negocio: string | null } | null;
      barbara_brand_book: BarbaraBrandBook | BarbaraBrandBook[] | null;
      barbara_formulario: BarbaraFormulario | BarbaraFormulario[] | null;
    };
    setD({
      cliente: fila,
      negocio: fila.clientes?.negocio || "—",
      brandBook: uno(fila.barbara_brand_book),
      formulario: uno(fila.barbara_formulario),
    });
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (cargando)
    return <div style={{ minHeight: "100vh", background: "#0A0A0B" }} />;

  if (error)
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0B", color: "#F4F5EF", padding: 40 }}>
        <p>{error}</p>
      </div>
    );

  if (!d)
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0B", color: "#F4F5EF", padding: 40 }}>
        <p>Ese cliente de Bárbara no existe.</p>
      </div>
    );

  return (
    <BarbaraModulo
      barbaraClienteId={d.cliente.id}
      negocio={d.negocio}
      plan={d.cliente.plan}
      rubro={d.cliente.rubro}
      brandBook={d.brandBook}
      formulario={d.formulario}
      onCambio={cargar}
      esStaff
      volverA={`/acceso/agentes-ia/${id}`}
      volverTexto="Volver a la ficha"
    />
  );
}
