import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { BarbaraModulo } from "../agentes-ia/BarbaraModulo";
import type { BarbaraBrandBook, BarbaraCliente, BarbaraFormulario } from "../agentes-ia/tipos";

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
 * Lo que ve el cliente de su agente Bárbara. Igual que `MiPlan.tsx`, la
 * consulta NO filtra por email: la policy `cliente_ve_su_barbara` ya limita
 * la tabla a su propia fila.
 *
 * Rediseñado el 24-ago-2026: mismo `BarbaraModulo` que usa staff para ver
 * la Bárbara de un cliente — un solo portal para las dos audiencias, con
 * `esStaff={false}` acá porque el cliente no puede apagar reglas aprendidas.
 */
export function Barbara() {
  const [d, setD] = useState<Cargado | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const { data } = await sb
      .from("barbara_clientes")
      .select("*, clientes(negocio), barbara_brand_book(*), barbara_formulario(*)")
      .limit(1)
      .maybeSingle();
    if (data) {
      const fila = data as unknown as BarbaraCliente & {
        clientes: { negocio: string | null } | null;
        barbara_brand_book: BarbaraBrandBook | BarbaraBrandBook[] | null;
        barbara_formulario: BarbaraFormulario | BarbaraFormulario[] | null;
      };
      setD({
        cliente: fila,
        negocio: fila.clientes?.negocio || "tu marca",
        brandBook: uno(fila.barbara_brand_book),
        formulario: uno(fila.barbara_formulario),
      });
    } else {
      setD(null);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  if (cargando) return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;

  if (!d)
    return (
      <div className="cuerpo">
        <p className="vacio">
          Todavía no tienes Bárbara activada. Escríbenos y la activamos.
        </p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <h1>Bárbara</h1>
      </div>
      <div className="cuerpo">
        <BarbaraModulo
          barbaraClienteId={d.cliente.id}
          negocio={d.negocio}
          plan={d.cliente.plan}
          rubro={d.cliente.rubro}
          brandBook={d.brandBook}
          formulario={d.formulario}
          onCambio={cargar}
          esStaff={false}
        />
      </div>
    </>
  );
}
