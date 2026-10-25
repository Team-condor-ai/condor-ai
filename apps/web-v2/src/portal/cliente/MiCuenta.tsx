import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { CambiarClave } from "../auth/CambiarClave";
import type { Cliente } from "../staff/tipos";
import { MiCuentaLegal } from "../legal/MiCuentaLegal";

/**
 * Datos de contacto, contraseña, suscripción y términos del cliente.
 * La baja vive en `legal/MiCuentaLegal.tsx` desde el 25-oct-2026: ya no archiva al instante ni pide escribir
 * «CANCELAR» (los términos prometen cancelar sin trámites); el servicio sigue hasta el fin del período.
 */
export function MiCuenta() {
  const [c, setC] = useState<Cliente | null>(null);
  const [tel, setTel] = useState("");
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
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

        <section className="bloque" style={{ maxWidth: 460 }}>
          <CambiarClave />
        </section>

        <MiCuentaLegal />
      </div>
    </>
  );
}
