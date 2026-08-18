import { useEffect, useState } from "react";
import { sb } from "../../lib/supabase";
import { infoPlan } from "../../agentes-ia/tipos";
import { GrafoMemoria } from "./GrafoMemoria";

type ClienteMemoria = { id: string; negocio: string; plan: string };

/**
 * Módulo "Memoria" — su propio módulo del portal, no una pestaña escondida
 * dentro de la ficha de un cliente. Empieza con Cóndor AI (el primer cliente
 * calibrado desde cero) y crece con cada nuevo cliente que se instale.
 */
export function Memoria() {
  const [clientes, setClientes] = useState<ClienteMemoria[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("barbara_clientes")
        .select("id, plan, clientes(negocio)")
        .eq("activo", true)
        .order("creado_en");
      const filas = ((data ?? []) as unknown as { id: string; plan: string; clientes: { negocio: string | null } | null }[])
        .map((f) => ({ id: f.id, plan: f.plan, negocio: f.clientes?.negocio || "Sin nombre" }));
      setClientes(filas);
      setElegido(filas[0]?.id ?? null);
      setCargando(false);
    })();
  }, []);

  return (
    <>
      <div className="barra">
        <h1>Memoria</h1>
      </div>

      <div className="cuerpo">
        <p className="tenue" style={{ marginBottom: 14 }}>
          Cómo aprende Bárbara de cada marca: correcciones, gustos, datos, su
          perfil de estilo, y los patrones globales que le aplican. Toca un
          nodo para ver el detalle.
        </p>

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : clientes.length === 0 ? (
          <p className="vacio">Todavía no hay clientes activos en Bárbara.</p>
        ) : (
          <>
            <div className="memoria-selector">
              {clientes.map((c) => (
                <button
                  key={c.id}
                  className={"memoria-chip" + (elegido === c.id ? " on" : "")}
                  onClick={() => setElegido(c.id)}
                >
                  {c.negocio}
                  <span className={"pill " + infoPlan(c.plan).pill} style={{ marginLeft: 8 }}>
                    {infoPlan(c.plan).nombre}
                  </span>
                </button>
              ))}
            </div>

            {elegido && (
              <GrafoMemoria
                key={elegido}
                barbaraClienteId={elegido}
                negocio={clientes.find((c) => c.id === elegido)?.negocio || ""}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
