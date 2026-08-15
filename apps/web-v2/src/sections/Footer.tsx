export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img className="footer-logo" src="/assets/logo.png" alt="condor.ai" />
          <p>Inteligencia artificial para hacer crecer tu negocio.</p>
          <a
            className="footer-wsp"
            href="https://wa.me/56988989824?text=Hola%20condor.ai"
            target="_blank"
            rel="noopener"
          >
            <WspIcon /> Escríbenos
          </a>
        </div>

        <div className="footer-col">
          <h5>Servicios</h5>
          <a href="/productos/">Páginas web</a>
          <a href="/productos/">Automatización</a>
          <a href="/contacto/">Diagnóstico</a>
        </div>

        <div className="footer-col">
          <h5>Empresa</h5>
          <a href="/inicio/">Nosotros</a>
          <a href="/clientes/">Portafolio</a>
          <a href="/blog/">Blog</a>
          <a href="/contacto/">Contacto</a>
        </div>

        <div className="footer-col">
          <h5>Clientes</h5>
          <a href="/acceso">Acceso clientes</a>
          <a href="/acceso">Panel admin</a>
          <a href="https://wa.me/56988989824" target="_blank" rel="noopener">
            WhatsApp +56 9 8898 9824
          </a>
          <a href="mailto:contacto@teamcondorcl.com">contacto@teamcondorcl.com</a>
        </div>
      </div>
      <p className="footer-copy mono-label">
        © {new Date().getFullYear()} condor.ai · Inteligencia Artificial para tu negocio
      </p>
    </footer>
  );
}

function WspIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.515 5.26l-.999 3.648 3.733-.979z" />
    </svg>
  );
}
