import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import type { Cliente } from "../staff/tipos";

/**
 * Datos de contacto y baja del servicio.
 *
 * LA BAJA TIENE FRICCIÓN A PROPÓSITO
 * ---------------------------------------------------------------------------
 * Se pidió que el cliente pueda cancelar solo, pero con muchas advertencias.
 * Acá eso significa tres cosas concretas, no un `confirm()`:
 *
 *   1. Se le muestra QUÉ pierde, con nombre y apellido (su plan, su web).
 *   2. Se le dice HASTA CUÁNDO tiene servicio pagado — la mayoría cancela
 *      creyendo que pierde el mes ya pagado, y con eso solo se apura.
 *   3. Tiene que ESCRIBIR "CANCELAR". Un botón se aprieta sin querer; una
 *      palabra escrita, no.
 *
 * Y la baja NO borra nada: marca `archivado`. La ficha y los pagos quedan,
 * porque son contabilidad.
 */
export function MiCuenta() {
  const [c, setC] = useState<Cliente | null>(null);
  const [tel, setTel] = useState("");
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [bajando, setBajando] = useState(false);
  const [palabra, setPalabra] = useState("");
  const [hayTelefono, setHayTelefono] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("clientes").select("*").limit(1).maybeSingle();
      const f = data as (Cliente & { telefono?: string }) | null;
      setC(f);
      setCorreo(f?.email ?? "");
      setTel(f?.telefono ?? "");
      // La columna `telefono` puede no existir todavía (se agrega en su
      // migración). Si no está, se oculta el campo en vez de reventar al
      // guardar con un error de Postgres que el cliente no entiende.
      setHayTelefono(f ? "telefono" in f : true);
      setCargando(false);
    })();
  }, []);

  async function guardar() {
    if (!c) return;
    setGuardando(true);
    setError("");
    setAviso("");
    const cambios: Record<string, unknown> = {};
    if (hayTelefono && tel !== ((c as Cliente & { telefono?: string }).telefono ?? ""))
      cambios.telefono = tel;
    if (Object.keys(cambios).length) {
      // SE PIDE LA FILA DE VUELTA, Y NO ES UN CAPRICHO
      // Cuando RLS bloquea un UPDATE, Supabase NO devuelve error: informa
      // cero filas afectadas. Sin `.select()`, este código daba "guardado"
      // aunque no hubiera guardado nada — que es la peor forma de fallar,
      // porque el cliente se entera después.
      const { data, error } = await sb
        .from("clientes").update(cambios).eq("id", c.id).select();
      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
      if (!data || data.length === 0) {
        setError(
          "No se pudo guardar: tu cuenta no tiene permiso para editar estos " +
          "datos. Escríbenos y lo cambiamos nosotros.",
        );
        setGuardando(false);
        return;
      }
    }
    // El correo es la llave de la sesión: cambiarlo en `clientes` sin cambiar
    // el usuario de Auth deja al cliente sin poder entrar. Por eso se pide a
    // Cóndor en vez de hacerlo acá.
    setAviso("Listo, guardamos tus datos.");
    setGuardando(false);
  }

  async function darDeBaja() {
    if (!c) return;
    setGuardando(true);
    const { data, error } = await sb
      .from("clientes")
      .update({ archivado: true, mensual_estado: "pendiente" })
      .eq("id", c.id)
      .select();
    setGuardando(false);
    if (error) setError(error.message);
    else if (!data || data.length === 0) {
      // Mismo caso que arriba: sin filas afectadas, la baja no ocurrió.
      // Decirle "listo" a alguien que quiso cancelar y no se canceló es
      // exactamente cómo se llega a un cobro reclamado el mes siguiente.
      setError(
        "No pudimos registrar la baja desde acá. Escríbenos a " +
        "contacto@teamcondorcl.com y la procesamos hoy.",
      );
    } else {
      setBajando(false);
      setAviso(
        "Registramos tu solicitud. Te escribimos hoy para confirmar y coordinar el cierre.",
      );
    }
  }

  if (cargando)
    return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;
  if (!c)
    return (
      <div className="cuerpo">
        <p className="vacio">Tu cuenta todavía no tiene un plan asociado.</p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <h1>Mi cuenta</h1>
      </div>

      <div className="cuerpo">
        <section className="bloque" style={{ maxWidth: 460 }}>
          <h3>Datos de contacto</h3>

          <label className="campo-lbl">
            Correo
            <input className="campo" value={correo} disabled />
            <small>
              Es con el que inicias sesión. Para cambiarlo escríbenos y lo
              hacemos nosotros, así no pierdes el acceso.
            </small>
          </label>

          {hayTelefono && (
            <label className="campo-lbl" style={{ marginTop: 12 }}>
              Teléfono
              <input
                className="campo"
                value={tel}
                placeholder="+56 9 1234 5678"
                onChange={(e) => setTel(e.target.value)}
              />
            </label>
          )}

          {aviso && <p className="ok-msg">{aviso}</p>}
          {error && <p className="error">{error}</p>}

          <button
            className="btn solido"
            style={{ marginTop: 14 }}
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </section>

        <section className="bloque" style={{ maxWidth: 560 }}>
          <h3>Suscripción</h3>

          {!bajando ? (
            <>
              <p className="parrafo">
                Tu plan <b>{c.plan || "—"}</b> está{" "}
                {c.archivado ? "dado de baja" : "activo"}.
              </p>
              {!c.archivado && (
                <button className="btn peligro" onClick={() => setBajando(true)}>
                  Dar de baja mi plan
                </button>
              )}
            </>
          ) : (
            <div className="caja-baja">
              <h4>Antes de darte de baja</h4>

              <p className="parrafo">Si cancelas, desde el cierre pierdes:</p>
              <ul className="lista-perdida">
                <li>
                  Tu plan <b>{c.plan || "—"}</b>
                  {c.concepto ? ` — ${c.concepto}` : ""}
                </li>
                {c.web_url && <li>El mantenimiento de {c.web_url}</li>}
                <li>El soporte y las mejoras continuas</li>
                <li>Tu precio actual: al volver, rige la tarifa vigente</li>
              </ul>

              {c.proximo_cobro && (
                <p className="parrafo">
                  Tu servicio está pagado hasta el{" "}
                  <b>
                    {new Date(c.proximo_cobro + "T12:00:00").toLocaleDateString(
                      "es-CL",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </b>
                  . No pierdes lo que ya pagaste.
                </p>
              )}

              <p className="parrafo">
                ¿Hay algo que podamos arreglar? Muchas veces se resuelve con un
                cambio de plan.{" "}
                <a href="mailto:contacto@teamcondorcl.com">Escríbenos primero</a>
                .
              </p>

              <label className="campo-lbl">
                Para confirmar, escribe <b>CANCELAR</b>
                <input
                  className="campo"
                  value={palabra}
                  onChange={(e) => setPalabra(e.target.value)}
                  placeholder="CANCELAR"
                />
              </label>

              <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
                <button
                  className="btn solido"
                  onClick={() => {
                    setBajando(false);
                    setPalabra("");
                  }}
                >
                  Mejor me quedo
                </button>
                <button
                  className="btn peligro"
                  disabled={palabra.trim().toUpperCase() !== "CANCELAR" || guardando}
                  onClick={darDeBaja}
                >
                  Confirmar la baja
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
