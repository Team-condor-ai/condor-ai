import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReveal } from "../lib/useReveal";
import Condor from "../components/Condor";
import fotoEquipo from "../assets/colombia/equipo.jpg";
import fotoOficina from "../assets/colombia/oficina.jpg";
import "./Colombia.css";

/* =============================================================================
   Landing de campaña — Cóndor.ai × Colombia  (ruta /colombia)
   BASE de Joaquín. Un solo objetivo: agendar reunión o pedir contacto.
   Max redisena encima; Samuel conecta el backend (POST /leads).

   Contrato del formulario (acordado en docs/campana-colombia/SAMUEL.md):
     POST {VITE_LEADS_API}/leads
     {
       tipo: "reunion" | "contacto",
       nombre: string, whatsapp: string, correo: string,
       fecha_hora?: string,        // texto libre por ahora (Calendly = follow-up)
       origen: { utm_source, utm_medium, utm_campaign, url },
       creativo?: string           // ?cr= en la URL, para atribución
     }
   Si VITE_LEADS_API no está seteada => modo demo (simula éxito y loguea el payload).
   ============================================================================= */

type Tipo = "reunion" | "contacto";
type Status = "idle" | "sending" | "ok" | "error";

const LEADS_API = (import.meta.env.VITE_LEADS_API as string | undefined)?.replace(/\/$/, "") ?? "";

const RESENAS = [
  { txt: "Rápidos y quedó increíble. Empezamos a recibir mensajes la primera semana.", by: "Cliente real · retail" },
  { txt: "Entendieron mi negocio y la web vende sola. La recomiendo.", by: "Cliente real · servicios" },
  { txt: "Precio justo y soporte de verdad. Cero vueltas.", by: "Cliente real · gastronomía" },
];

const PORTAFOLIO = ["Restaurante", "Tienda de ropa", "Inmobiliaria", "Consultora", "Clínica", "Lavandería"];

export default function Colombia() {
  useReveal(useLocation().pathname);
  const [open, setOpen] = useState<Tipo | null>(null);

  useEffect(() => {
    document.title = "Cóndor.ai — Tu página web que vende, en 48 horas | Colombia";
  }, []);

  return (
    <main className="co">
      <div className="co-bg" aria-hidden />

      {/* Chrome mínimo (sin nav del sitio: un solo objetivo) */}
      <header className="co-top">
        <div className="co-brand">
          <span className="co-mark"><Condor /></span>
          <b>cóndor<i>.ai</i></b>
        </div>
        <span className="co-tag">Colombia</span>
      </header>

      {/* HERO */}
      <section className="co-hero">
        <div className="co-hero-copy">
          <span className="co-eyebrow reveal">Páginas web con Inteligencia Artificial</span>
          <h1 className="co-h1 reveal">
            Tu página web que <span className="co-grad">vende</span>, lista en 48 horas.
          </h1>
          <p className="co-lead reveal">
            Diseño a medida, optimizado para celular y para que te encuentren en Google.
            Sin complicaciones: nosotros la hacemos, tú vendes.
          </p>
          <div className="co-trust reveal">
            <span className="co-chip">⚡ Entrega desde 48 h</span>
            <span className="co-chip">🛟 Hosting + soporte 24/7</span>
            <span className="co-chip">📈 Pensada para vender</span>
          </div>
          <div className="co-cta reveal">
            <button className="co-btn co-btn-primary" onClick={() => setOpen("reunion")}>
              Agendemos una reunión
            </button>
            <button className="co-btn co-btn-ghost" onClick={() => setOpen("contacto")}>
              Quiero que me contacten
            </button>
          </div>
          <p className="co-microcopy reveal">Sin compromiso · cupos limitados por semana</p>
        </div>

        <div className="co-hero-media reveal">
          <div className="co-photo">
            <img src={fotoEquipo} alt="El equipo de Cóndor.ai trabajando en la oficina" />
          </div>
          <div className="co-photo-thumb" aria-hidden>
            <img src={fotoOficina} alt="" loading="lazy" />
          </div>
          <div className="co-badge-float">★★★★★<small>+ clientes felices</small></div>
        </div>
      </section>

      {/* PRUEBA SOCIAL */}
      <section className="co-proof">
        <div className="co-resenas">
          {RESENAS.map((r, i) => (
            <figure className="co-resena reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="co-stars">★★★★★</div>
              <blockquote>{r.txt}</blockquote>
              <figcaption>{r.by}</figcaption>
            </figure>
          ))}
        </div>
        <div className="co-porta reveal">
          <span className="co-porta-lbl">Trabajos entregados</span>
          <div className="co-porta-row">
            {PORTAFOLIO.map((p) => (
              <span className="co-porta-item" key={p}>{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="co-close reveal">
        <h2>¿Lista tu nueva web?</h2>
        <p>Agenda una reunión de 15–30 min o déjanos tus datos. Respondemos rápido.</p>
        <div className="co-cta">
          <button className="co-btn co-btn-primary" onClick={() => setOpen("reunion")}>
            Agendemos una reunión
          </button>
          <button className="co-btn co-btn-ghost" onClick={() => setOpen("contacto")}>
            Quiero que me contacten
          </button>
        </div>
      </section>

      <footer className="co-foot">
        <div className="co-brand">
          <span className="co-mark"><Condor /></span>
          <b>cóndor<i>.ai</i></b>
        </div>
        <span>WhatsApp +56 9 8898 9824 · condorai.cl</span>
      </footer>

      {open && <LeadModal tipo={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

/* --------------------------------------------------------------------------- */

function LeadModal({ tipo, onClose }: { tipo: Tipo; onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [cuando, setCuando] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const atribucion = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return {
      origen: {
        utm_source: q.get("utm_source") ?? "",
        utm_medium: q.get("utm_medium") ?? "",
        utm_campaign: q.get("utm_campaign") ?? "",
        url: window.location.href,
      },
      creativo: q.get("cr") ?? q.get("utm_content") ?? "",
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const esReunion = tipo === "reunion";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const telOk = whatsapp.replace(/\D/g, "").length >= 7;
  const puedeEnviar = nombre.trim().length >= 2 && emailOk && telOk && status !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setStatus("sending");
    setErrorMsg("");

    const payload = {
      tipo,
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim(),
      correo: correo.trim().toLowerCase(),
      ...(esReunion && cuando.trim() ? { fecha_hora: cuando.trim() } : {}),
      ...atribucion,
    };

    try {
      if (!LEADS_API) {
        // Modo demo (backend de Samuel aún no cableado): simula éxito.
        console.info("[lead demo] POST /leads →", payload);
        await new Promise((r) => setTimeout(r, 700));
        setStatus("ok");
        return;
      }
      const res = await fetch(`${LEADS_API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg("No pudimos enviar tus datos. Reintenta o escríbenos por WhatsApp.");
      console.error("[lead] error", err);
    }
  }

  return (
    <div className="co-modal" role="dialog" aria-modal="true" aria-label={esReunion ? "Agendar reunión" : "Solicitar contacto"} onClick={onClose}>
      <div className="co-modal-card reveal in" onClick={(e) => e.stopPropagation()}>
        <button className="co-modal-x" onClick={onClose} aria-label="Cerrar">×</button>

        {status === "ok" ? (
          <div className="co-ok">
            <div className="co-ok-ico">✓</div>
            <h3>{esReunion ? "¡Listo! Te enviaremos el horario." : "¡Recibido! Te contactamos pronto."}</h3>
            <p>
              {esReunion
                ? "Te escribimos por WhatsApp y correo para confirmar tu reunión (8:00–21:00, hora Colombia)."
                : "Uno de nosotros te contacta en menos de 24 horas. Gracias por confiar en Cóndor.ai."}
            </p>
            <button className="co-btn co-btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form className="co-form" onSubmit={submit}>
            <h3>{esReunion ? "Agendemos una reunión" : "Déjanos tus datos"}</h3>
            <p className="co-form-sub">
              {esReunion
                ? "Reunión de máx. 1 hora, entre 8:00 y 21:00 (hora Colombia). Sin compromiso."
                : "Te contactamos en menos de 24 horas. Rápido y sin vueltas."}
            </p>

            <label className="co-field">
              <span>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoFocus />
            </label>
            <label className="co-field">
              <span>WhatsApp</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="+57 300 000 0000" />
            </label>
            <label className="co-field">
              <span>Correo</span>
              <input value={correo} onChange={(e) => setCorreo(e.target.value)} inputMode="email" placeholder="tucorreo@ejemplo.com" />
            </label>
            {esReunion && (
              <label className="co-field">
                <span>¿Qué día y hora te acomoda? <i>(opcional)</i></span>
                <input value={cuando} onChange={(e) => setCuando(e.target.value)} placeholder="Ej: martes en la tarde" />
              </label>
            )}

            {status === "error" && <p className="co-form-err">{errorMsg}</p>}

            <button className="co-btn co-btn-primary co-btn-block" type="submit" disabled={!puedeEnviar}>
              {status === "sending" ? "Enviando…" : esReunion ? "Agendar mi reunión" : "Quiero que me contacten"}
            </button>
            <p className="co-form-legal">Al enviar aceptas que te contactemos por estos medios.</p>
          </form>
        )}
      </div>
    </div>
  );
}
