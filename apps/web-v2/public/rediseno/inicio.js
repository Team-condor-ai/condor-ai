(() => {
  const carousel = document.querySelector('.hm-carousel');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.hm-service-slide')];
  const selectors = [...carousel.querySelectorAll('[data-slide]')];
  const controls = carousel.querySelector('.hm-carousel-controls');
  const pause = carousel.querySelector('.hm-carousel-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, timer, paused = reduced.matches, hovered = false, focused = false, visible = true;
  function schedule() {
    clearTimeout(timer);
    if (!paused && !hovered && !focused && visible && !document.hidden) timer = setTimeout(() => show((index + 1) % slides.length), 5500);
  }
  function show(next) {
    const image = slides[next].querySelector('img');
    // Do not crossfade to an unloaded or failed image.
    image.loading = 'eager';
    if (!image.complete) { image.addEventListener('load', () => show(next), { once:true }); schedule(); return; }
    if (!image.naturalWidth) { schedule(); return; }
    index = next;
    slides.forEach((slide,i) => {
      slide.classList.toggle('is-active', i === index);
      slide.inert = i !== index;
      slide.setAttribute('aria-hidden', String(i !== index));
      selectors[i].setAttribute('aria-pressed', String(i === index));
    });
    schedule();
  }
  function label() { pause.textContent = paused ? 'Reproducir' : 'Pausar'; }
  controls.hidden = false;
  label();
  selectors.forEach((button,i) => button.addEventListener('click', () => { paused = true; label(); show(i); }));
  pause.addEventListener('click', () => { paused = !paused; label(); schedule(); });
  carousel.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  carousel.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = true; schedule(); });
  carousel.addEventListener('focusout', event => { focused = carousel.contains(event.relatedTarget); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches; label(); schedule(); });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(carousel);
  schedule();
})();
