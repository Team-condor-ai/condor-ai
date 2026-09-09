(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const carousel = document.querySelector('.hm-carousel');
  const slides = [...document.querySelectorAll('.hm-service-slide')];
  let index = 0, timer, visible = true;
  function schedule() {
    clearTimeout(timer);
    if (!reduced.matches && visible && !document.hidden) timer = setTimeout(advance, 4200);
  }
  async function advance() {
    const next = (index + 1) % slides.length;
    const img = slides[next].querySelector('img');
    img.loading = 'eager';
    try { await img.decode(); } catch { schedule(); return; }
    if (reduced.matches || document.hidden || !visible) return;
    index = next;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.inert = i !== index;
      slide.setAttribute('aria-hidden', String(i !== index));
    });
    schedule();
  }
  if (carousel && slides.length > 1) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(carousel);
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    schedule();
  }
  const track = document.querySelector('.hm-logos');
  if (track) {
    const originals = [...track.children];
    const group = document.createElement('div'); group.className = 'hm-logo-group';
    originals.forEach(image => group.append(image)); track.append(group);
    const clone = group.cloneNode(true); clone.setAttribute('aria-hidden','true');
    clone.querySelectorAll('img').forEach(image => image.alt = '');
    track.append(clone);
    track.classList.add('is-looping');
  }
})();
