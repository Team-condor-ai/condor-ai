import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { ChatVisor } from "../agentes-ia/ChatVisor";
import { FormularioBarbara } from "./FormularioBarbara";
import { ReglasAprendidas } from "../agentes-ia/ReglasAprendidas";
import { infoPlan, TIPOS_CONTENIDO, type BarbaraCliente, type BarbaraFormulario } from "../agentes-ia/tipos";

type Cargado = {
  id: string;
  plan: string;
  rubro: string | null;
  formulario: BarbaraFormulario | null;
};

function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/**
 * Lo que ve el cliente de su agente Bárbara. Igual que `MiPlan.tsx`, la
 * consulta NO filtra por email: la policy `cliente_ve_su_barbara` ya limita
 * la tabla a su propia fila.
 */
export function Barbara() {
  const [d, setD] = useState<Cargado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await sb
      .from("barbara_clientes")
      .select("id,plan,rubro,barbara_formulario(*)")
      .limit(1)
      .maybeSingle();
    if (data) {
      const fila = data as unknown as BarbaraCliente & {
        barbara_formulario: BarbaraFormulario | BarbaraFormulario[] | null;
      };
      setD({
        id: fila.id,
        plan: fila.plan,
        rubro: fila.rubro,
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

  const tipos = (d.formulario?.tipo_contenido ?? [])
    .map((id) => TIPOS_CONTENIDO.find((t) => t.id === id)?.texto ?? id)
    .join(", ");

  return (
    <>
      <div className="barra">
        <h1>Bárbara</h1>
      </div>

      <div className="cuerpo">
        <section className="bloque">
          <div className="rejilla-datos">
            <div className="dato">
              <small>Plan</small>
              <b>
                <span className={"pill " + infoPlan(d.plan).pill}>{infoPlan(d.plan).nombre}</span>
                {infoPlan(d.plan).nota ? (
                  <span style={{ color: "var(--texto-3)", fontWeight: 400, marginLeft: 7, fontSize: 12.5 }}>
                    {infoPlan(d.plan).nota}
                  </span>
                ) : null}
              </b>
            </div>
            <div className="dato">
              <small>Rubro</small>
              <b>{d.rubro || "—"}</b>
            </div>
          </div>
        </section>

        <section className="bloque">
          <h3>Formulario de entrada</h3>
          <p className="parrafo" style={{ color: "var(--texto-2)" }}>
            Esto es lo que Bárbara usa para crear tu contenido: qué tipo de
            piezas quieres, a quién le hablas, tu tono y qué evitar.
          </p>
          {d.formulario ? (
            <div className="rejilla-datos" style={{ marginBottom: 14 }}>
              <div className="dato">
                <small>Tipo de contenido</small>
                <b>{tipos || "—"}</b>
              </div>
              <div className="dato">
                <small>Público objetivo</small>
                <b>{d.formulario.publico_objetivo || "—"}</b>
              </div>
              <div className="dato">
                <small>Tono</small>
                <b>{d.formulario.tono || "—"}</b>
              </div>
              <div className="dato">
                <small>Restricciones</small>
                <b>{d.formulario.restricciones || "—"}</b>
              </div>
            </div>
          ) : (
            <p className="vacio">Todavía no llenas tu formulario.</p>
          )}
          <button className="btn solido" onClick={() => setEditando(true)}>
            Editar formulario de entrada
          </button>
        </section>

        {/* Que el cliente vea lo que Bárbara aprendió de SU marca es parte de
            por qué el producto se siente propio: comprueba que lo escucharon.
            No puede apagarlas — eso lo revisa el equipo. */}
        <section className="bloque">
          <h3>Lo que Bárbara aprendió de tu marca</h3>
          <p className="parrafo" style={{ color: "var(--texto-2)" }}>
            Cada vez que pides un cambio por Telegram, Bárbara guarda la
            preferencia detrás de ese cambio para no repetir el error. Esto es
            solo tuyo: nunca se comparte con otras marcas.
          </p>
          <ReglasAprendidas barbaraClienteId={d.id} />
        </section>

        <section className="bloque">
          <h3>Conversación</h3>
          <ChatVisor barbaraClienteId={d.id} />
        </section>
      </div>

      {editando && (
        <FormularioBarbara
          barbaraClienteId={d.id}
          inicial={d.formulario}
          cerrar={() => setEditando(false)}
          guardado={() => {
            setEditando(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
