import { useRef, useState } from "react";
import { EMPRESA, PAISES, SERVICIOS, VERSION, VIGENTE_DESDE, documentosDe, type Documento, type PaisId, type ServicioId } from "../../legal/contenido.mjs";
import { Ico } from "../disenio/iconos";

/**
 * Los tres documentos que acepta un cliente (generales, contrato de su servicio, anexo de su país), en pestañas.
 * Al imprimir salen los tres seguidos, con los datos de la empresa: «Descargar PDF» es imprimir → Guardar como PDF.
 */
export function Lector({ servicio, pais, alto }: { servicio: ServicioId; pais: PaisId; alto?: boolean }) {
  const docs = documentosDe(servicio, pais);
  const [i, setI] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const nombres = ["Términos generales", SERVICIOS[servicio].nombre, `Anexo ${PAISES[pais].nombre}`];
  const ir = (n: number) => { setI(n); caja.current?.scrollTo({ top: 0 }); };

  return (
    <div className={`tc-lector${alto ? " alto" : ""}`}>
      <div className="tc-lector-cab">
        <div className="tc-pestanas" role="tablist" aria-label="Documentos">
          {nombres.map((n, k) => (
            <button key={n} role="tab" aria-selected={i === k} className={i === k ? "on" : ""} onClick={() => ir(k)}>{n}</button>
          ))}
        </div>
        <button className="btn chico tc-pdf" onClick={() => window.print()} title="Imprimir o guardar como PDF">{Ico.descargar({ t: 13 })} PDF</button>
      </div>
      <div className="tc-texto" ref={caja} tabIndex={0}>
        {docs.map((d, k) => <Doc key={d.id} d={d} oculto={k !== i} />)}
        <p className="tc-pie">
          Versión {VERSION} · vigente desde el {VIGENTE_DESDE} · {EMPRESA.razonSocial}, RUT {EMPRESA.rut}.
          {i < 2 && <> <button className="tc-sigue" onClick={() => ir(i + 1)}>Seguir con {nombres[i + 1]} →</button></>}
        </p>
      </div>
    </div>
  );
}

function Doc({ d, oculto }: { d: Documento; oculto: boolean }) {
  return (
    <article className="tc-doc" data-oculto={oculto || undefined}>
      <h2>{d.titulo}</h2>
      <p className="tc-bajada">{d.bajada}</p>
      {d.secciones.map((s) => (
        <section key={s.n}>
          <h3><span>{s.n}</span>{s.titulo}</h3>
          {/* El HTML es nuestro (contenido.mjs), no del usuario. */}
          {s.parrafos.map((p, k) => <p key={k} dangerouslySetInnerHTML={{ __html: p }} />)}
        </section>
      ))}
    </article>
  );
}
