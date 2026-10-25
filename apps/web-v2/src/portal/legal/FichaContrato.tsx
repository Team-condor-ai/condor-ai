import { useCallback, useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { useSesion } from "../auth/sesion";
import { PAISES, SERVICIOS, VERSION } from "../../legal/contenido.mjs";
import { entregaLimite, fechaLarga, type Aceptacion, type Cancelacion } from "./datos";

const CANALES: Record<Cancelacion["canal"], string> = { portal: "Botón del portal", chat: "Chat del portal", correo: "Correo", whatsapp: "WhatsApp" };
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Pestaña «Contrato» de la ficha (25-oct-2026): qué términos aceptó el cliente (con la prueba) y su cancelación.
 * Las cancelaciones que llegan por chat, correo o WhatsApp se anotan acá: cualquiera de los cuatro medios vale
 * (cláusula 7.1), y desde que termina el servicio corren 10 días hábiles para entregar carpeta y credenciales.
 */
export function FichaContrato({ clienteId, proximoCobro }: { clienteId: string; proximoCobro: string | null }) {
  const email = useSesion().email;
  const [aceptaciones, setAceptaciones] = useState<Aceptacion[] | null>(null);
  const [cancel, setCancel] = useState<Cancelacion | null>(null);
  const [form, setForm] = useState<{ canal: Cancelacion["canal"]; termina: string; motivo: string } | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      sb.from("terminos_aceptaciones").select("version, servicio, pais, huella, ip, navegador, aceptado_en").eq("cliente_id", clienteId).order("aceptado_en", { ascending: false }),
      sb.from("cancelaciones").select("*").eq("cliente_id", clienteId).is("anulada_en", null).order("solicitada_en", { ascending: false }).limit(1),
    ]);
    setAceptaciones((a ?? []) as Aceptacion[]);
    setCancel(((c ?? [])[0] as Cancelacion | undefined) ?? null);
  }, [clienteId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiar(cambios: Partial<Cancelacion>) {
    if (!cancel) return;
    setError("");
    const { error: e } = await sb.from("cancelaciones").update(cambios).eq("id", cancel.id);
    if (e) setError(e.message); else void cargar();
  }
  async function registrar() {
    if (!form || !email) return;
    setError("");
    const { error: e } = await sb.from("cancelaciones").insert({
      cliente_id: clienteId, canal: form.canal, motivo: form.motivo.trim() || null, termina_el: form.termina, registrada_por: email,
    });
    if (e) setError(e.message); else { setForm(null); void cargar(); }
  }

  const vigente = aceptaciones?.[0];
  return (
    <div className="tc-ficha">
      <section className="bloque">
        <h3>Términos aceptados</h3>
        {aceptaciones === null ? <p className="vacio">Cargando…</p> : !vigente ? (
          <p className="parrafo">Todavía no los acepta: se le pedirán la próxima vez que entre al portal.</p>
        ) : (
          <>
            <p className="parrafo">
              {vigente.version === VERSION ? <span className="tc-ok">Al día</span> : <span className="tc-pend">Debe aceptar la {VERSION}</span>}{" "}
              Versión {vigente.version} · {SERVICIOS[vigente.servicio].nombre} · {PAISES[vigente.pais].nombre}
            </p>
            <ul className="tc-registro">
              {aceptaciones.map((a) => (
                <li key={a.aceptado_en}>
                  <b>{fechaHora(a.aceptado_en)}</b> · versión {a.version}
                  <small>IP {a.ip ?? "sin registro"} · {(a.navegador ?? "").slice(0, 70) || "navegador sin registro"}</small>
                  <small className="tc-huella" title={a.huella}>Huella SHA-256 {a.huella.slice(0, 16)}…</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bloque">
        <h3>Cancelación</h3>
        {error && <p className="error">{error}</p>}
        {cancel ? (
          <>
            <p className="parrafo">
              Pedida el {fechaLarga(cancel.solicitada_en)} por <b>{CANALES[cancel.canal]}</b>{cancel.canal !== "portal" ? ` (anotó ${cancel.registrada_por.split("@")[0]})` : ""}.
              {cancel.motivo && <><br />Motivo: «{cancel.motivo}»</>}
            </p>
            <ul className="tc-pasos">
              <li className={cancel.confirmada_en ? "hecho" : ""}>Confirmar por escrito al cliente {cancel.confirmada_en ? `· ${fechaLarga(cancel.confirmada_en)}` : "· máximo 5 días hábiles"}</li>
              <li>El servicio sigue hasta el <b>{fechaLarga(cancel.termina_el)}</b>; desde ahí no se cobra más</li>
              <li className={cancel.entregado_en ? "hecho" : ""}>Entregar carpeta, credenciales y datos {cancel.entregado_en ? `· ${fechaLarga(cancel.entregado_en)}` : <>· antes del <b>{fechaLarga(entregaLimite(cancel.termina_el))}</b></>}</li>
            </ul>
            <div className="tc-acciones">
              {!cancel.confirmada_en && <button className="btn chico" onClick={() => void cambiar({ confirmada_en: new Date().toISOString() })}>Ya se la confirmé</button>}
              {!cancel.entregado_en && <button className="btn chico solido" onClick={() => void cambiar({ entregado_en: new Date().toISOString() })}>Entregado</button>}
              {!cancel.entregado_en && <button className="btn chico" onClick={() => void cambiar({ anulada_en: new Date().toISOString() })} title="El cliente se arrepintió">Anular cancelación</button>}
            </div>
          </>
        ) : form ? (
          <div className="tc-form">
            <label className="campo-lbl">Por dónde la pidió
              <select className="campo" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as Cancelacion["canal"] })}>
                <option value="chat">Chat del portal</option><option value="correo">Correo</option><option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label className="campo-lbl">Servicio activo hasta
              <input className="campo" type="date" value={form.termina} onChange={(e) => setForm({ ...form, termina: e.target.value })} />
              <small>El fin del período pagado.</small>
            </label>
            <label className="campo-lbl">Motivo (opcional)
              <textarea className="campo" rows={2} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
            </label>
            <div className="tc-acciones">
              <button className="btn chico" onClick={() => setForm(null)}>Volver</button>
              <button className="btn chico solido" disabled={!form.termina} onClick={() => void registrar()}>Registrar cancelación</button>
            </div>
          </div>
        ) : (
          <>
            <p className="parrafo">Sin cancelación. Si el cliente la pidió por chat, correo o WhatsApp, anótala acá: vale igual que el botón.</p>
            <button className="btn chico" onClick={() => setForm({ canal: "chat", termina: proximoCobro ?? new Date().toISOString().slice(0, 10), motivo: "" })}>Anotar cancelación</button>
          </>
        )}
      </section>
    </div>
  );
}
