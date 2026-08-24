import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
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

  return (
    <>
      <div className="barra">
        <Link to={`/acceso/agentes-ia/${id}`} className="icono-btn" title="Volver a la ficha">
          {Ico.volver({ t: 16 })}
        </Link>
        <h1>{d?.negocio || "Bárbara"}</h1>
      </div>
      <div className="cuerpo">
        {cargando && <p className="vacio">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {!cargando && !error && !d && <p className="vacio">Ese cliente de Bárbara no existe.</p>}
        {d && (
          <BarbaraModulo
            barbaraClienteId={d.cliente.id}
            negocio={d.negocio}
            plan={d.cliente.plan}
            rubro={d.cliente.rubro}
            brandBook={d.brandBook}
            formulario={d.formulario}
            onCambio={cargar}
            esStaff
          />
        )}
      </div>
    </>
  );
}
