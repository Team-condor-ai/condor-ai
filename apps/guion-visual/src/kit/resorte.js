/* Resorte: muelle amortiguado integrado en pasos fijos de tiempo real (8 ms), así
   en un equipo lento se ve igual (no en cámara lenta). Se usa en lo que se toca y
   se arrastra: la lente del segmentado, la hoja, el dial, el carrusel.

   const r = new Resorte(0, { rigidez: 260, amortiguacion: 26 });
   r.a(100, (x) => el.style.transform = `translateX(${x}px)`);   */
export class Resorte {
  constructor(valor = 0, { rigidez = 260, amortiguacion = 26, masa = 1 } = {}) {
    Object.assign(this, { x: valor, v: 0, destino: valor, k: rigidez, c: amortiguacion, m: masa, raf: 0, cb: null });
  }
  a(destino, cb, velocidad) {
    this.destino = destino;
    if (cb) this.cb = cb;
    if (velocidad !== undefined) this.v = velocidad;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { this.x = destino; this.v = 0; this.cb?.(this.x); return; }
    if (this.raf) return;
    let antes = performance.now(), acum = 0;
    const paso = (ahora) => {
      acum += Math.min(64, ahora - antes);
      antes = ahora;
      while (acum >= 8) {
        const f = -this.k * (this.x - this.destino) - this.c * this.v;
        this.v += (f / this.m) * 0.008;
        this.x += this.v * 0.008;
        acum -= 8;
      }
      this.cb?.(this.x);
      if (Math.abs(this.v) < 0.02 && Math.abs(this.x - this.destino) < 0.02) { this.x = this.destino; this.v = 0; this.cb?.(this.x); this.raf = 0; return; }
      this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }
  fijar(valor) { cancelAnimationFrame(this.raf); this.raf = 0; this.x = this.destino = valor; this.v = 0; this.cb?.(valor); }
}

/** Más allá del tope, se estira como goma (×0,25). */
export const goma = (x, min, max) => (x < min ? min + (x - min) * 0.25 : x > max ? max + (x - max) * 0.25 : x);
/** Dónde terminaría algo soltado con velocidad v (px/s) y fricción tipo iOS. */
export const proyectar = (x, v, decel = 0.998) => x + (v / 1000) * decel / (1 - decel);
