import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
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

const SELECT = "*, clientes(negocio), barbara_brand_book(*), barbara_formulario(*)";
// Con !inner para que el filtro sobre la tabla embebida realmente aplique
// (sin el hint, PostgREST no garantiza que .eq() sobre una relación filtre
// las filas del lado izquierdo).
const SELECT_STAFF = "*, clientes!inner(negocio), barbara_brand_book(*), barbara_formulario(*)";

/**
 * "/acceso/barbara" — EL portal de Bárbara, para las dos audiencias.
 *
 * Pedido explícito de Joaquín (24-ago-2026): clic en "Bárbara" del menú de
 * staff tiene que abrir el portal DIRECTO, sin pasar por una lista de
 * clientes ni apretar un botón "Ver portal" — Cóndor es cliente de su
 * propio producto, así que su Bárbara se abre igual que la de cualquier
 * cliente externo.
 *
 * Por eso esta ruta vive ANTES de la bifurcación staff/cliente en
 * `Portal.tsx` y este componente decide QUÉ fila mostrar según el rol:
 *   · cliente → su propia fila (RLS ya la limita, sin filtro).
 *   · staff   → la fila de Cóndor.AI, identificada por el negocio — no por
 *     un UUID hardcodeado, para no romper si algún día se recrea la fila.
 *
 * La lista completa de TODOS los clientes de Bárbara (administrar planes,
 * dar de alta) sigue en `/acceso/agentes-ia` — accesible desde acá con el
 * link "Administrar clientes" en Ajustes, no se perdió, solo dejó de ser
 * la puerta de entrada por defecto.
 */
export function Barbara() {
  const sesion = useSesion();
  const [d, setD] = useState<Cargado | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const esStaff = sesion.rol === "staff";
    const query = esStaff
      ? sb.from("barbara_clientes").select(SELECT_STAFF).eq("clientes.negocio", "Cóndor.AI")
      : sb.from("barbara_clientes").select(SELECT).limit(1);
    const { data } = await query.maybeSingle();
    if (data) {
      const fila = data as unknown as BarbaraCliente & {
        clientes: { negocio: string | null } | null;
        barbara_brand_book: BarbaraBrandBook | BarbaraBrandBook[] | null;
        barbara_formulario: BarbaraFormulario | BarbaraFormulario[] | null;
      };
      setD({
        cliente: fila,
        negocio: fila.clientes?.negocio || (esStaff ? "Cóndor.AI" : "tu marca"),
        brandBook: uno(fila.barbara_brand_book),
        formulario: uno(fila.barbara_formulario),
      });
    } else {
      setD(null);
    }
    setCargando(false);
  }

  useEffect(() => {
    if (sesion.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion.cargando, sesion.rol]);

  if (sesion.cargando || cargando)
    return <div style={{ minHeight: "100vh", background: "#0A0A0B" }} />;

  const esStaff = sesion.rol === "staff";

  if (!d)
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0B", color: "#F4F5EF", padding: 40 }}>
        <p>
          {esStaff
            ? "No existe todavía la fila de Cóndor.AI en Bárbara Clientes."
            : "Todavía no tienes Bárbara activada. Escríbenos y la activamos."}
        </p>
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
      esStaff={esStaff}
      activo={d.cliente.activo}
      telegramListo={Boolean(d.cliente.telegram_chat_id)}
      volverA={esStaff ? "/acceso/dashboard" : "/acceso/plan"}
      volverTexto="Volver a Cóndor"
    />
  );
}
