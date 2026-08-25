import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../portal/lib/supabase";
import "./RatiaOferta.css";

/**
 * "condorai.cl/ratia/oferta" — donde cae el link que ManyChat manda por DM
 * cuando alguien comenta en un post de Rat.IA pidiendo la oferta.
 *
 * EL FLUJO COMPLETO (pedido de Joaquín, 25-ago-2026)
 * ---------------------------------------------------------------------------
 *   Instagram (comenta "OFERTA"/"ERROR")
 *     → ManyChat abre el DM y manda ESTE link, con los datos del producto
 *       en la URL (?producto=...&tienda=...&url=...&tipo=oferta|error)
 *     → acá se pide correo + consentimiento
 *     → se guarda el lead (`ratia_leads`, con RLS: sólo inserta si
 *       `consintio=true` — ver la migración) y se entrega el link real
 *
 * Es la MISMA landing para los dos carriles. No hace falta una por tipo:
 * lo único que cambia es el texto de urgencia ("puede durar minutos" en
 * errores de precio), y eso ya lo resuelve el parámetro `tipo`.
 *
 * POR QUÉ EL LINK NO SE ENTREGA HASTA DESPUÉS DEL FORMULARIO
 * ---------------------------------------------------------------------------
 * No es una barrera de seguridad -- el link va en la URL de esta misma
 * página, cualquiera con curiosidad técnica podría verlo en la barra de
 * direcciones. Es una barrera de INTENCIÓN: exige un paso deliberado
 * (escribir el correo, marcar que acepta) antes de mostrar el botón, que es
 * lo que separa a alguien que de verdad quiere el dato de alguien que sólo
 * comentó por curiosidad. Mismo principio que usan las descargas "deja tu
 * correo para el PDF".
 */
export default function RatiaOferta() {
  const [params] = useSearchParams();
  const producto = params.get("producto") || "";
  const tienda = params.get("tienda") || "";
  const urlProducto = params.get("url") || "";
  const tipo = params.get("tipo") === "error" ? "error" : "oferta";
  const postId = params.get("post_id") || undefined;

  const [correo, setCorreo] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");

    const limpio = correo.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
      setError("Escribe un correo válido.");
      return;
    }
    if (!acepta) {
      setError("Tienes que aceptar para que te enviemos el link.");
      return;
    }

    setEnviando(true);
    const { error: err } = await sb.from("ratia_leads").insert({
      correo: limpio,
      producto_nombre: producto || null,
      producto_url: urlProducto || null,
      comercio: tienda || null,
      tipo,
      post_id: postId || null,
      consintio: true,
      consintio_en: new Date().toISOString(),
    });
    setEnviando(false);

    if (err) {
      // El RLS rechaza filas con `consintio=false` o un correo con formato
      // inválido (ver la migración) -- ninguno de los dos debería pasar acá
      // porque ya se validó arriba, así que un error a esta altura es de
      // red o de la base, no del usuario.
      setError("No se pudo guardar. Intenta de nuevo en un momento.");
      return;
    }
    setListo(true);
  }

  if (!producto || !urlProducto) {
    return (
      <div className="ratia-oferta-pagina">
        <div className="ratia-oferta-tarjeta">
          <p>Este link no trae los datos de una oferta válida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ratia-oferta-pagina">
      <div className="ratia-oferta-tarjeta">
        <span className="ratia-oferta-rotulo">
          {tipo === "error" ? "🚨 Error de precio" : "🐀 Rat.IA"}
        </span>
        <h1>{producto}</h1>
        {tienda && <p className="ratia-oferta-tienda">Disponible en {tienda}</p>}

        {tipo === "error" && (
          <p className="ratia-oferta-aviso">
            Los errores de precio se corrigen en cualquier momento — puede
            que ya no esté disponible cuando entres. Verifica siempre en la
            tienda antes de comprar.
          </p>
        )}

        {listo ? (
          <div className="ratia-oferta-listo">
            <p>¡Listo! Acá tienes el link:</p>
            <a className="ratia-oferta-boton" href={urlProducto}
               target="_blank" rel="noopener noreferrer">
              Ver la oferta →
            </a>
          </div>
        ) : (
          <form onSubmit={enviar} className="ratia-oferta-form">
            <label className="ratia-oferta-campo">
              Tu correo
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tucorreo@ejemplo.cl"
                autoComplete="email"
                required
              />
            </label>

            <label className="ratia-oferta-check">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
              />
              <span>
                Acepto que Rat.IA use mi correo para enviarme el link de esta
                oferta y ofertas similares por email, según la Ley 19.628 de
                protección de datos. Puedo darme de baja cuando quiera.
              </span>
            </label>

            {error && <p className="ratia-oferta-error">{error}</p>}

            <button type="submit" className="ratia-oferta-boton"
                    disabled={enviando}>
              {enviando ? "Enviando…" : "Enviarme el link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
