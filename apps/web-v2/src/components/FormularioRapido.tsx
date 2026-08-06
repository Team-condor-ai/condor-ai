import { useRef, useState } from "react";

/* =============================================================================
   Un campo: el WhatsApp. Siempre visible.

   POR QUÉ EXISTE (datos del 5-ago-2026)
   ---------------------------------------------------------------------------
   La primera versión pedía nombre + WhatsApp + correo + día + hora, dentro de
   un modal que había que abrir. En dos días de campaña:

       146 personas llegaron a la página
        43 abrieron el formulario   (29% — la landing convence)
         0 lo completaron           (0%)

   Las 43 tenían intención: la perdieron los cinco campos y el calendario.

   Quedó en dos campos (nombre y WhatsApp) y después en uno solo: el número.
   El nombre se pregunta en el primer mensaje de WhatsApp, que es gratis y no
   cuesta una conversión. Lo único que hace falta para poder escribirle a
   alguien es su número.

   El +57 va fijo a la izquierda, fuera del campo: en móvil, escribir el
   indicativo es un paso más y un lugar más donde equivocarse.

   Va abierto en la página, no detrás de un botón. Un clic menos es un punto
   menos donde perder a alguien que llegó hace cuarenta segundos desde un
   anuncio.
   ========================================================================== */

type Estado = "idle" | "enviando" | "ok" | "error";

type Props = {
  /** URL /exec del Apps Script. Sin esto no se envía nada. */
  endpoint: string;
  /** Atribución de la campaña (utm_*, fbclid). */
  atribucion?: Record<string, string>;
  /** Para el Pixel: se avisa cuando el lead entra de verdad. */
  onLead?: (datos: { whatsapp: string }) => void;
  /** Se avisa UNA vez, cuando la persona escribe el primer dígito. Es la única
      métrica intermedia que queda: sin modal que abrir, sin esto solo se sabe
      "llegó" y "dejó el número", y un día con cero leads no distingue entre
      "nadie lo intentó" y "lo intentaron y el formulario falló". */
  onIntento?: () => void;
  /** WhatsApp de la empresa, para el que prefiere escribir él. */
  whatsappEmpresa?: string;
  /** Abre la política de datos. Obligatorio en Colombia (Ley 1581 de 2012):
      quien entrega sus datos tiene que poder leer para qué se usan. */
  onPrivacidad?: () => void;
};

/* El Apps Script valida que `nombre` venga con algo y devuelve
   {"ok":false} si llega vacío. No se toca el backend por esto: se manda este
   marcador, que además deja claro en la hoja de dónde salió el lead. */
const SIN_NOMBRE = "Sin nombre (form rápido)";

/** Deja solo dígitos y saca el 57 del país si la persona lo pegó completo. */
function normalizar(texto: string): string {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("57") && d.length > 10) d = d.slice(2);
  return d.slice(0, 10);
}

/** 300 123 4567 — se muestra agrupado, se envía limpio. */
function agrupar(d: string): string {
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean);
  return p.join(" ");
}

export default function FormularioRapido({
  endpoint,
  atribucion = {},
  onLead,
  onIntento,
  whatsappEmpresa,
  onPrivacidad,
}: Props) {
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  /* Un ref y no un estado: avisar el intento no tiene que redibujar nada. */
  const yaAviso = useRef(false);

  /* Colombia son 10 dígitos, celular o fijo (los fijos también migraron a 10
     con el indicativo 60X). Menos que eso no sirve para escribirle a nadie. */
  const digitos = normalizar(telefono);
  const puedeEnviar = digitos.length === 10 && estado !== "enviando";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) {
      /* Decir qué falta, no marcar en rojo y que el visitante adivine. */
      setError(
        digitos.length === 0
          ? "Escribe tu número de WhatsApp"
          : "El número debe tener 10 dígitos",
      );
      campo.current?.focus();
      return;
    }

    setEstado("enviando");
    setError("");

    const datos = {
      tipo: "contacto" as const,
      nombre: SIN_NOMBRE,
      whatsapp: "+57" + digitos,
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
      onLead?.({ whatsapp: datos.whatsapp });
    } catch (err) {
      setEstado("error");
      setError("No pudimos enviar tu número.");
      console.error("[lead rápido]", err);
    }
  }

  if (estado === "ok") {
    return (
      <div className="co-form-rapido co-form-ok" role="status">
        <strong>¡Listo!</strong>
        <p>Te escribimos por WhatsApp hoy mismo.</p>
      </div>
    );
  }

  return (
    <form className="co-form-rapido" onSubmit={enviar} noValidate>
      <p className="co-form-titulo">Déjanos tu WhatsApp y te escribimos hoy</p>

      <div className="co-form-campos">
        <div className="co-form-tel">
          <span className="co-form-prefijo" aria-hidden="true">
            +57
          </span>
          <input
            ref={campo}
            type="tel"
            name="whatsapp"
            autoComplete="tel-national"
            inputMode="numeric"
            placeholder="300 123 4567"
            aria-label="Tu número de WhatsApp, sin el indicativo 57"
            value={agrupar(digitos)}
            onChange={(e) => {
              setTelefono(e.target.value);
              setError("");
              /* Al primer dígito, una sola vez: es "esta persona intentó
                 dejarnos su número", no "tocó el campo sin querer". */
              if (!yaAviso.current && normalizar(e.target.value).length > 0) {
                yaAviso.current = true;
                onIntento?.();
              }
            }}
          />
        </div>
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
        Solo para contactarte.
        {onPrivacidad && (
          <>
            {" "}
            <button type="button" className="co-form-link" onClick={onPrivacidad}>
              Cómo tratamos tus datos
            </button>
          </>
        )}
      </p>
    </form>
  );
}
