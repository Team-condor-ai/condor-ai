/* Controls and content intentionally have different attributes.
   Never hide the controls while changing the price panel. */
(() => {
  const page = document.querySelector('.sites-page');
  if (!page) return;
  const countries = page.querySelectorAll('input[name="cs-country"]');
  const panels = page.querySelectorAll('[data-price-country]');
  const status = page.querySelector('#cs-price-status');
  const labels = { cl: 'Chile en CLP · IVA incluido', pe: 'Perú en PEN · IGV incluido', co: 'Colombia en COP · IVA incluido' };
  function selectCountry(value) {
    if (!labels[value]) return;
    panels.forEach(panel => { panel.hidden = panel.dataset.priceCountry !== value; });
    if (status) status.textContent = 'Precios para ' + labels[value];
  }
  countries.forEach(input => input.addEventListener('change', () => selectCountry(input.value)));
  // Respect browser-restored radio state on back/forward navigation.
  const restoreCountry = () => selectCountry([...countries].find(input => input.checked)?.value || 'cl');
  restoreCountry();
  window.addEventListener('pageshow', restoreCountry);

  const demoButtons = page.querySelectorAll('[data-demo-button]');
  demoButtons.forEach(button => button.addEventListener('click', () => {
    demoButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    page.querySelectorAll('[data-demo-panel]').forEach(panel => { panel.hidden = panel.dataset.demoPanel !== button.dataset.demoButton; });
  }));

  // Progressive enhancement: all content is visible if animation is unavailable.
  // Finite entrances, no scroll hijacking or perpetual decorative movement.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate(
        [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  page.querySelectorAll('[data-cs-reveal]').forEach(el => observer.observe(el));
  reduced.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    page.getAnimations({ subtree: true }).forEach(animation => animation.finish());
  });
})();
