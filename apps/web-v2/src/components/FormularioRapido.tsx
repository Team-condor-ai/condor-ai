import { useRef, useState } from "react";

/* =============================================================================
   Formulario de contacto en 2 campos, siempre visible.

   POR QUÉ EXISTE (datos del 5-ago-2026)
   ---------------------------------------------------------------------------
   La primera versión pedía nombre + WhatsApp + correo + día + hora, dentro de
   un modal que había que abrir. En dos días de campaña:

       146 personas llegaron a la página
        43 abrieron el formulario   (29% — la landing convence)
         0 lo completaron           (0%)

   Las 43 tenían intención: la perdieron los cinco campos y el calendario.
   Este formulario deja solo lo indispensable para poder escribirle a alguien:
   **nombre y WhatsApp**. Sin correo, sin elegir horario, sin modal.

   Va abierto en la página, no detrás de un botón. Un clic menos es un punto
   menos donde perder a alguien que llegó hace cuarenta segundos desde un
   anuncio.

   El envío usa el mismo contrato que ya espera el Apps Script, así que no hay
   que tocar el backend ni la hoja de cálculo.
   ========================================================================== */

type Estado = "idle" | "enviando" | "ok" | "error";

type Props = {
  /** URL /exec del Apps Script. Sin esto no se envía nada. */
  endpoint: string;
  /** Atribución de la campaña (utm_*, fbclid). */
  atribucion?: Record<string, string>;
  /** Para el Pixel: se avisa cuando el lead entra de verdad. */
  onLead?: (datos: { nombre: string; whatsapp: string }) => void;
  /** WhatsApp de la empresa, para el que prefiere escribir él. */
  whatsappEmpresa?: string;
  /** Abre la política de datos. Obligatorio en Colombia (Ley 1581 de 2012):
      quien entrega sus datos tiene que poder leer para qué se usan. */
  onPrivacidad?: () => void;
};

export default function FormularioRapido({
  endpoint,
  atribucion = {},
  onLead,
  whatsappEmpresa,
  onPrivacidad,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  const campoNombre = useRef<HTMLInputElement>(null);

  /* Colombia usa 10 dígitos (300 000 0000). Se aceptan 7 o más para no
     rechazar fijos ni números escritos con el +57 adelante. */
  const soloDigitos = telefono.replace(/\D/g, "");
  const telOk = soloDigitos.length >= 7;
  const nombreOk = nombre.trim().length >= 2;
  const puedeEnviar = nombreOk && telOk && estado !== "enviando";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) {
      /* Decir qué falta, no marcar en rojo y que el visitante adivine. */
      setError(!nombreOk ? "Falta tu nombre" : "Revisa el número de WhatsApp");
      (!nombreOk ? campoNombre.current : null)?.focus();
      return;
    }

    setEstado("enviando");
    setError("");

    const datos = {
      tipo: "contacto" as const,
      nombre: nombre.trim(),
      whatsapp: telefono.trim(),
      /* El Apps Script espera el campo; se manda vacío a propósito: pedir el
         correo era justo uno de los pasos que hacía abandonar. */
      correo: "",
      ...atribucion,
    };

    try {
      if (!endpoint) throw new Error("Sin endpoint configurado");
      /* text/plain a propósito: con application/json el navegador dispara un
         preflight OPTIONS que los Web App de Apps Script no responden. */
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(datos),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const resp = await r.json().catch(() => ({ ok: true }));
      if (resp && resp.ok === false) throw new Error(resp.error || "backend");

      setEstado("ok");
      onLead?.({ nombre: datos.nombre, whatsapp: datos.whatsapp });
    } catch (err) {
      setEstado("error");
      setError("No pudimos enviar tus datos.");
      console.error("[lead rápido]", err);
    }
  }

  if (estado === "ok") {
    return (
      <div className="co-form-rapido co-form-ok" role="status">
        <strong>¡Listo, {nombre.trim().split(" ")[0]}!</strong>
        <p>Te escribimos por WhatsApp hoy mismo para conversar tu página.</p>
      </div>
    );
  }

  return (
    <form className="co-form-rapido" onSubmit={enviar} noValidate>
      <p className="co-form-titulo">
        Déjanos tu WhatsApp y te contactamos
      </p>
      <p className="co-form-bajada">
        Te escribimos hoy para conversar qué necesita tu página. Sin costo y sin
        compromiso.
      </p>

      <div className="co-form-campos">
        <input
          ref={campoNombre}
          type="text"
          name="nombre"
          autoComplete="given-name"
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setError("");
          }}
        />
        <input
          type="tel"
          name="whatsapp"
          autoComplete="tel"
          inputMode="tel"
          placeholder="Tu WhatsApp"
          aria-label="Tu número de WhatsApp"
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
            setError("");
          }}
        />
        <button type="submit" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Enviando…" : "Quiero mi página"}
        </button>
      </div>

      {error && (
        <p className="co-form-error" role="alert">
          {error}
          {estado === "error" && whatsappEmpresa && (
            <>
              {" "}
              <a href={whatsappEmpresa} target="_blank" rel="noopener">
                Escríbenos por WhatsApp
              </a>
            </>
          )}
        </p>
      )}

      <p className="co-form-legal">
        Solo usamos tus datos para contactarte por este servicio.
        {onPrivacidad && (
          <>
            {" "}
            <button type="button" className="co-form-link" onClick={onPrivacidad}>
              Política de tratamiento de datos
            </button>
            .
          </>
        )}
      </p>
    </form>
  );
}
