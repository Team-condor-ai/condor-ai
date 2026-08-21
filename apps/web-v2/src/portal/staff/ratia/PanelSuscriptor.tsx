import { useEffect, useMemo, useState } from "react";
import { sb, plata, fecha } from "../../lib/supabase";
import { PanelLateral } from "../../disenio/PanelLateral";
import { CampoVivo } from "../CampoVivo";
import { PLANES_RATIA, type IngresoRatia, type SuscriptorRatia } from "../tipos";

const ESTADOS = ["activa", "pausada", "cancelada"];

/**
 * La ficha de un suscriptor de Rat.IA, en el mismo cajón que la de un cliente.
 *
 * MISMA FORMA QUE CLIENTES, A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Dos listas que se ven igual tienen que manejarse igual: se abre con "Ver",
 * los datos se editan donde se leen y no hay botón de "configurar". Que una
 * pantalla se opere distinto que su gemela obliga a aprender dos veces lo
 * mismo — es la misma razón por la que el cajón del catálogo entra desde el
 * mismo lado que este.
 *
 * Lo único distinto es lo que hay adentro, porque un suscriptor no tiene
 * cobros: tiene UNA suscripción y los pagos que Flow registró de ella.
 */
export function PanelSuscriptor({
  suscriptor,
  cerrar,
  cambiado,
}: {
  suscriptor: SuscriptorRatia;
  cerrar: () => void;
  cambiado: () => void;
}) {
  const [s, setS] = useState(suscriptor);
  const [ingresos, setIngresos] = useState<IngresoRatia[]>([]);

  // Los pagos de ESTE suscriptor salen de `ingresos_ratia`, que es lo que
  // cobró Flow. No se derivan de su monto: eso diría lo que debería pagar.
  useEffect(() => {
    if (!s.flow_subscription_id) return;
    sb.from("ingresos_ratia")
      .select("*")
      .eq("flow_subscription_id", s.flow_subscription_id)
      .order("creado_en", { ascending: false })
      .then(({ data }) => setIngresos((data ?? []) as IngresoRatia[]));
  }, [s.flow_subscription_id]);

  const total = useMemo(
    () => ingresos.reduce((t, g) => t + (g.monto_bruto ?? 0), 0),
    [ingresos],
  );

  async function guardar(campos: Partial<SuscriptorRatia>) {
    const { error } = await sb.from("suscriptores_ratia").update(campos).eq("id", s.id);
    if (error) return error.message;
    setS((p) => ({ ...p, ...campos }));
    cambiado();
    return null;
  }

  return (
    <PanelLateral
      titulo={s.nombre}
      bajada={`${PLANES_RATIA.find((p) => p.id === s.plan)?.nombre ?? s.plan ?? "Sin plan"} · ${s.estado}`}
      cerrar={cerrar}
    >
      <section className="bloque">
        <h3>Datos</h3>
        <div className="rejilla-datos">
          <CampoVivo etiqueta="Nombre" valor={s.nombre} guardar={(v) => guardar({ nombre: v ?? "" })} />
          <CampoVivo
            etiqueta="Telegram" valor={s.telegram}
            guardar={(v) => guardar({ telegram: v ? v.replace(/^@/, "") : null })}
            ayuda={
              s.telegram ? (
                <a href={`https://t.me/${s.telegram}`} target="_blank" rel="noreferrer">Abrir Telegram</a>
              ) : "Por donde recibe los avisos"
            }
          />
          <CampoVivo etiqueta="Correo" tipo="email" valor={s.email} guardar={(v) => guardar({ email: v })} />
          <CampoVivo etiqueta="Teléfono" tipo="tel" valor={s.telefono} guardar={(v) => guardar({ telefono: v })} />
          <CampoVivo
            etiqueta="Plan" valor={s.plan ?? ""} opciones={PLANES_RATIA.map((p) => p.id)}
            guardar={(v) => {
              const p = PLANES_RATIA.find((x) => x.id === v);
              // Al cambiar de plan se propone su precio. Queda editable: hay
              // suscriptores con precio heredado que no calza con la lista.
              return guardar(p ? { plan: v, monto: p.monto } : { plan: v });
            }}
          />
          <CampoVivo
            etiqueta="Monto al mes" tipo="number" valor={String(s.monto ?? 0)}
            guardar={(v) => guardar({ monto: Math.round(Number(v) || 0) })}
          />
          <CampoVivo etiqueta="Estado" valor={s.estado} opciones={ESTADOS} guardar={(v) => guardar({ estado: v ?? "activa" })} />
          <CampoVivo etiqueta="Próximo cobro" tipo="date" valor={s.proximo_cobro} guardar={(v) => guardar({ proximo_cobro: v })} />
        </div>

        <div style={{ marginTop: 12 }}>
          <CampoVivo etiqueta="Nota" valor={s.notas} multilinea guardar={(v) => guardar({ notas: v })} />
        </div>
      </section>

      <section className="bloque">
        <h3>
          Pagos{" "}
          <span className="tenue" style={{ fontWeight: 400 }}>
            · {plata(total)} en total, según Flow
          </span>
        </h3>
        {ingresos.length === 0 ? (
          <p className="vacio">
            {s.flow_subscription_id
              ? "Flow todavía no registró ningún pago de esta suscripción."
              : "Sin id de Flow, no se pueden cruzar sus pagos."}
          </p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Plan</th><th className="num">Monto</th></tr>
              </thead>
              <tbody>
                {ingresos.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.creado_en)}</td>
                    <td>{g.tipo}</td>
                    <td>{g.plan ?? "—"}</td>
                    <td className="num">{plata(g.monto_bruto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PanelLateral>
  );
}
