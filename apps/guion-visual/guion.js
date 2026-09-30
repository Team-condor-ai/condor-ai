/* =========================================================================
   Guion visual condor.ai V1 · motor
   - Vertido: un solo contexto WebGL2 dibuja todas las texturas acrílicas
     y las copia a cada <canvas> destino (así no chocamos con el límite de
     contextos del navegador). Solo se animan las que están en pantalla.
   - Marca: sprite del isotipo/wordmark + máscaras CSS + SVG copiables.
   - Carga, altímetro, demos de motion, kit de interfaz.
   ========================================================================= */
(() => {
  "use strict";
  const M = window.CONDOR_MARCA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ── 1. Marca: sprite, máscaras y SVG ─────────────────────────────── */
  const NS = "http://www.w3.org/2000/svg";
  const sprite = document.createElementNS(NS, "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  sprite.innerHTML =
    `<symbol id="iso" viewBox="0 0 ${M.iso.w} ${M.iso.h}"><path d="${M.iso.d}"/></symbol>` +
    `<symbol id="iso-corte" viewBox="0 0 ${M.iso.w} ${M.iso.h}"><mask id="m-corte" maskUnits="userSpaceOnUse" x="0" y="0" width="${M.iso.w}" height="${M.iso.h}"><rect width="${M.iso.w}" height="${M.iso.h}" fill="#fff"/><path d="${M.iso.corte}" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round"/></mask><path d="${M.iso.d}" mask="url(#m-corte)"/></symbol>` +
    `<symbol id="word" viewBox="${M.word.vb}"><path d="${M.word.d}"/></symbol>` +
    `<symbol id="lockup-h" viewBox="${M.lockupH.vb}">${M.lockupH.cuerpo}</symbol>` +
    `<symbol id="lockup-v" viewBox="${M.lockupV.vb}">${M.lockupV.cuerpo}</symbol>`;
  document.body.prepend(sprite);
  // Cada <svg><use href="#x"/></svg> hereda el viewBox de su símbolo: así basta
  // con darle un ancho en CSS y el alto sale de la proporción real de la pieza.
  $$("svg > use").forEach((u) => {
    const s = u.parentNode;
    if (s.hasAttribute("viewBox") || s.closest("symbol")) return;
    const sim = document.querySelector(u.getAttribute("href"));
    if (sim && sim.getAttribute("viewBox")) s.setAttribute("viewBox", sim.getAttribute("viewBox"));
  });
  // Trazos animables: el path va dentro (no por <use>) para poder usar pathLength.
  $$("svg.iso-trazo").forEach((s) => {
    s.setAttribute("viewBox", `0 0 ${M.iso.w} ${M.iso.h}`);
    s.innerHTML = `<path pathLength="1" d="${M.iso.d}"/>`;
  });

  const isoSvg = (fill, extra = "") =>
    `<svg xmlns="${NS}" viewBox="0 0 ${M.iso.w} ${M.iso.h}"${extra}><path fill="${fill}" d="${M.iso.d}"/></svg>`;
  const mascara = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  document.documentElement.style.setProperty("--mask-iso", mascara(isoSvg("#000")));
  document.documentElement.style.setProperty(
    "--mask-word",
    mascara(`<svg xmlns="${NS}" viewBox="${M.word.vb}"><path d="${M.word.d}"/></svg>`),
  );

  const GRADS = {
    "gradiente-azul": ["#8FB2FF", "#2747FF", "#0B1A7A"],
    "rosa-puna": ["#FFC2DA", "#FF6FA8", "#8A5CFF"],
    aurora: ["#7CF5D8", "#2FB8FF", "#2747FF"],
    cromo: ["#FFFFFF", "#9AA6C8", "#3A4466"],
  };
  function svgArchivo(pieza, color) {
    const vb = pieza === "lockup" ? M.lockupH.vb : `0 0 ${M.iso.w} ${M.iso.h}`;
    const cuerpo = pieza === "lockup" ? M.lockupH.cuerpo : `<path d="${M.iso.d}"/>`;
    const n = vb.split(" ").map(Number);
    let defs = "", fill = color;
    if (GRADS[color]) {
      const st = GRADS[color];
      defs = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${n[0]}" y1="${n[1]}" x2="${n[0] + n[2]}" y2="${n[1] + n[3]}">${st
        .map((c, i) => `<stop offset="${i / (st.length - 1)}" stop-color="${c}"/>`)
        .join("")}</linearGradient></defs>`;
      fill = "url(#g)";
    }
    return `<svg xmlns="${NS}" viewBox="${vb}" fill="${fill}" role="img" aria-label="condor.ai">${defs}${cuerpo}</svg>`;
  }

  /* ── 2. Copiar (con respaldo si el portapapeles no está) ──────────── */
  const aviso = $("#aviso");
  let avisoT;
  function avisar(txt) {
    aviso.textContent = txt;
    aviso.classList.add("visible");
    clearTimeout(avisoT);
    avisoT = setTimeout(() => aviso.classList.remove("visible"), 1800);
  }
  function copiar(texto, etiqueta) {
    const ok = () => avisar(`${etiqueta} copiado`);
    const respaldo = () => {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { avisar("Selecciona y copia a mano"); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, respaldo);
    else respaldo();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const v = b.dataset.copiar;
    if (v.startsWith("svg:")) {
      const [, pieza, color] = v.split(":");
      copiar(svgArchivo(pieza, color), "SVG");
    } else if (v === "tokens") {
      copiar($("#codigo-tokens").textContent, "Tokens");
    } else copiar(v, v);
  });

  /* ── 3. Tema ───────────────────────────────────────────────────────── */
  const raiz = document.documentElement;
  const temas = ["sistema", "claro", "oscuro"];
  const btnTema = $("#btn-tema");
  function aplicarTema(t) {
    if (t === "claro") raiz.dataset.theme = "light";
    else if (t === "oscuro") raiz.dataset.theme = "dark";
    else delete raiz.dataset.theme;
    btnTema.dataset.tema = t;
    btnTema.querySelector("span").textContent = t === "sistema" ? "Auto" : t === "claro" ? "Claro" : "Oscuro";
    guardar("cn-tema", t);
  }
  aplicarTema(leer("cn-tema") || "sistema");
  btnTema.addEventListener("click", () => aplicarTema(temas[(temas.indexOf(btnTema.dataset.tema) + 1) % 3]));

  /* ── 4. Vertido acrílico (WebGL2) ─────────────────────────────────── */
  const PALETAS = {
    cobalto: ["#050A24", "#0B1A7A", "#2747FF", "#D6E1FF"],
    "rosa-puna": ["#1A0B2E", "#8A5CFF", "#FF6FA8", "#FFE3EE"],
    aurora: ["#041226", "#2747FF", "#2FB8FF", "#7CF5D8"],
    obsidiana: ["#020308", "#141828", "#3A4466", "#C9D1E8"],
    glaciar: ["#F2F5FC", "#D6E1FF", "#8FB2FF", "#2747FF"],
    atacama: ["#2A0A12", "#8A1238", "#FF5A3C", "#FFD3A8"],
    indigo: ["#08082A", "#2B22B8", "#6F5BFF", "#E3DEFF"],
    cielo: ["#041226", "#1E6BFF", "#57C2FF", "#E0F4FF"],
    lila: ["#140A2E", "#5A2BE0", "#B38CFF", "#F0E6FF"],
    medula: ["#06102E", "#013ECC", "#1B75FD", "#A9CCFF"],
  };
  const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uSeed;
uniform float uCells; uniform float uZoom; uniform float uGloss; uniform float uSwirl;
uniform vec3 uC[4];
out vec4 o;
float h(vec2 p){p=fract(p*vec2(123.34,456.21)+uSeed*.137);p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return v;}
vec2 cel(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 r=g+vec2(h(i+g),h(i+g+17.))-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}}
  return vec2(sqrt(d1),sqrt(d2));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;
  vec2 base=vec2(uSeed*1.7,uSeed*.9);
  vec2 p=(uv-.5)*vec2(asp,1.)*uZoom+base;
  vec2 m=(uM-.5)*vec2(asp,1.)*uZoom+base; vec2 d=p-m;
  float ang=exp(-dot(d,d)*2.5)*uSwirl; p=m+mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*d;
  float t=uT;
  vec2 q=vec2(fbm(p+vec2(0.,t*.06)),fbm(p+vec2(5.2,1.3)-t*.05));
  vec2 r=vec2(fbm(p+2.6*q+vec2(1.7,9.2)+t*.04),fbm(p+2.6*q+vec2(8.3,2.8)-t*.03));
  float f=fbm(p+3.2*r);
  vec3 col=mix(uC[0],uC[1],smoothstep(.26,.48,f));
  col=mix(col,uC[2],smoothstep(.5,.62,f));
  col=mix(col,uC[3],smoothstep(.67,.76,f)*.92);
  float lace=smoothstep(.014,.0,abs(f-.495))*.5+smoothstep(.01,.0,abs(f-.645))*.45;
  col=mix(col,uC[3],lace);
  if(uCells>0.){
    vec2 c=cel(p*8.+r*3.);
    float borde=1.-smoothstep(.0,.09,c.y-c.x);
    float banda=smoothstep(.44,.54,f)*(1.-smoothstep(.63,.72,f));
    col=mix(col,mix(uC[0],col,.3),borde*banda*uCells);
    col=mix(col,uC[3],smoothstep(.14,.0,c.x)*banda*uCells*.3);
  }
  vec3 N=normalize(vec3(-dFdx(f)*uRes.y*uGloss,-dFdy(f)*uRes.y*uGloss,1.));
  vec3 L=normalize(vec3(-.45,.6,.66));
  float spec=pow(max(dot(reflect(-L,N),vec3(0,0,1)),0.),26.);
  col*=.84+.26*(dot(N,L)*.5+.5);
  col+=spec*.2;
  col+=(h(gl_FragCoord.xy+fract(t*.37)*91.)-.5)*.018;
  o=vec4(col,1.);
}`;
  const VERT = `#version 300 es
in vec2 a; void main(){gl_Position=vec4(a,0.,1.);}`;

  const GLW = 1280, GLH = 1280;
  const glc = document.createElement("canvas");
  glc.width = GLW; glc.height = GLH;
  const gl = glc.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false });
  let U = null;
  if (gl) {
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = {};
    ["uRes", "uT", "uM", "uSeed", "uCells", "uZoom", "uGloss", "uSwirl", "uC"].forEach((k) => (U[k] = gl.getUniformLocation(pr, k)));
  }

  /** Dibuja un vertido de w×h en el contexto compartido y devuelve el rect usado. */
  function pintar(w, h, o, t) {
    const pal = PALETAS[o.paleta] || PALETAS.cobalto;
    const k = Math.min(1, GLW / w, GLH / h);
    const rw = Math.max(2, Math.round(w * k)), rh = Math.max(2, Math.round(h * k));
    gl.viewport(0, 0, rw, rh);
    gl.uniform2f(U.uRes, rw, rh);
    gl.uniform1f(U.uT, t);
    gl.uniform2f(U.uM, o.mx ?? 0.5, o.my ?? 0.5);
    gl.uniform1f(U.uSeed, o.semilla ?? 1);
    gl.uniform1f(U.uCells, o.celdas ?? 0);
    gl.uniform1f(U.uZoom, o.zoom ?? 1.6);
    gl.uniform1f(U.uGloss, o.brillo ?? 0.35);
    gl.uniform1f(U.uSwirl, o.remolino ?? 0);
    gl.uniform3fv(U.uC, new Float32Array(pal.flatMap(hex3)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return [rw, rh];
  }
  // El framebuffer tiene origen abajo; drawImage lee desde arriba → recortamos la franja inferior.
  function volcar(ctx, rw, rh, w, h) {
    ctx.drawImage(glc, 0, GLH - rh, rw, rh, 0, 0, w, h);
  }
  const cacheFotos = new Map();
  /** Imagen fija (dataURL) de un vertido, para fondos CSS de fichas, posts, etc. */
  function foto(o, w = 320, h = 320) {
    const clave = JSON.stringify([o, w, h]);
    if (cacheFotos.has(clave)) return cacheFotos.get(clave);
    let url;
    if (!gl) {
      const p = PALETAS[o.paleta] || PALETAS.cobalto;
      url = null;
      cacheFotos.set(clave, `linear-gradient(135deg, ${p[3]}, ${p[2]} 40%, ${p[1]} 70%, ${p[0]})`);
      return cacheFotos.get(clave);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const [rw, rh] = pintar(w, h, o, o.t ?? 3);
    volcar(c.getContext("2d"), rw, rh, w, h);
    url = `url(${c.toDataURL("image/jpeg", 0.88)})`;
    cacheFotos.set(clave, url);
    return url;
  }

  /* Lienzos vivos: <canvas data-vertido="paleta" data-semilla data-celdas data-escala data-raton> */
  const vivos = [];
  function registrar(canvas) {
    const d = canvas.dataset;
    const v = {
      canvas,
      ctx: canvas.getContext("2d"),
      o: {
        paleta: d.vertido || "cobalto",
        semilla: +(d.semilla || 1),
        celdas: +(d.celdas || 0),
        zoom: +(d.zoom || 1.6),
        brillo: +(d.brillo || 0.35),
        remolino: 0,
        mx: 0.5, my: 0.5,
      },
      escala: +(d.escala || 0.6),
      vel: +(d.velocidad || 1),
      raton: "raton" in d,
      visible: false,
      t0: Math.random() * 40,
      objetivo: { x: 0.5, y: 0.5, s: 0 },
    };
    vivos.push(v);
    canvas._vertido = v;
    medir(v);
    if (v.raton) {
      const zona = canvas.closest("[data-zona-raton]") || canvas;
      zona.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        v.objetivo.x = (e.clientX - r.left) / r.width;
        v.objetivo.y = 1 - (e.clientY - r.top) / r.height;
        v.objetivo.s = 1.6;
      });
      zona.addEventListener("pointerleave", () => (v.objetivo.s = 0));
    }
    return v;
  }
  function medir(v) {
    const r = v.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    v.canvas.width = Math.max(2, Math.round(r.width * dpr * v.escala));
    v.canvas.height = Math.max(2, Math.round(r.height * dpr * v.escala));
  }
  function dibujar(v, t) {
    if (!gl) return;
    const [rw, rh] = pintar(v.canvas.width, v.canvas.height, v.o, t);
    volcar(v.ctx, rw, rh, v.canvas.width, v.canvas.height);
  }
  const io = new IntersectionObserver(
    (ents) => ents.forEach((e) => (e.target._vertido.visible = e.isIntersecting)),
    { rootMargin: "120px" },
  );
  $$("canvas[data-vertido]").forEach((c) => {
    const v = registrar(c);
    io.observe(c);
    if (!gl) c.parentElement.classList.add("sin-webgl");
  });
  addEventListener("resize", () => vivos.forEach((v) => { medir(v); dibujar(v, v.t0); }));

  let inicio = performance.now();
  function bucle(ahora) {
    const s = (ahora - inicio) / 1000;
    for (const v of vivos) {
      if (!v.visible) continue;
      const o = v.o;
      o.mx += (v.objetivo.x - o.mx) * 0.06;
      o.my += (v.objetivo.y - o.my) * 0.06;
      o.remolino += (v.objetivo.s - o.remolino) * 0.05;
      dibujar(v, v.t0 + s * 0.35 * v.vel);
    }
    requestAnimationFrame(bucle);
  }
  if (gl) {
    vivos.forEach((v) => dibujar(v, v.t0));
    if (!reduce) requestAnimationFrame(bucle);
  }

  /* Fondos fijos: [data-foto="paleta:semilla:celdas"] */
  function aplicarFotos() {
    $$("[data-foto]").forEach((el) => {
      const [paleta, semilla = "1", celdas = "0", zoom = "1.4"] = el.dataset.foto.split(":");
      el.style.setProperty("--foto", foto({ paleta, semilla: +semilla, celdas: +celdas, zoom: +zoom, brillo: 0.4 }, 360, 360));
    });
  }
  aplicarFotos();

  /* ── 5. Laboratorio de vertido ─────────────────────────────────────── */
  const lab = $("#lab-lienzo");
  if (lab && lab._vertido) {
    const v = lab._vertido;
    $$("#lab-paletas button").forEach((b) =>
      b.addEventListener("click", () => {
        $$("#lab-paletas button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        v.o.paleta = b.dataset.paleta;
        $("#lab-nombre").textContent = b.textContent.trim();
        if (reduce) dibujar(v, v.t0);
      }),
    );
    $("#lab-semilla").addEventListener("click", () => {
      v.o.semilla = Math.round(Math.random() * 900) / 10;
      $("#lab-semilla-valor").textContent = v.o.semilla.toFixed(1).replace(".", ",");
      if (reduce) dibujar(v, v.t0);
    });
    $("#lab-celdas").addEventListener("change", (e) => { v.o.celdas = e.target.checked ? 1 : 0; if (reduce) dibujar(v, v.t0); });
    $("#lab-vel").addEventListener("input", (e) => {
      v.vel = +e.target.value;
      $("#lab-vel-valor").textContent = `${(+e.target.value).toFixed(1).replace(".", ",")}×`;
    });
    $("#lab-zoom").addEventListener("input", (e) => { v.o.zoom = +e.target.value; if (reduce) dibujar(v, v.t0); });
  }

  /* ── 6. Carga: repetir animaciones ─────────────────────────────────── */
  function repetir(el) {
    el.classList.remove("corre");
    void el.offsetWidth;
    el.classList.add("corre");
  }
  $$("[data-repetir]").forEach((b) =>
    b.addEventListener("click", () => {
      const el = document.getElementById(b.dataset.repetir);
      repetir(el);
      if (el.dataset.progreso !== undefined) progreso(el);
      if (el.dataset.altimetro !== undefined) altimetroCarga(el);
    }),
  );
  function progreso(el) {
    const num = $(".carga-num", el);
    const t0 = performance.now(), dur = 3600;
    (function paso(a) {
      const p = Math.min(1, (a - t0) / dur);
      // progreso realista: avanza a saltos, frena cerca del final
      const e = p < 1 ? Math.min(0.99, p + Math.sin(p * 14) * 0.02) : 1;
      el.style.setProperty("--p", e.toFixed(3));
      num.textContent = String(Math.round(e * 100)).padStart(3, "0");
      if (p < 1) requestAnimationFrame(paso);
    })(t0);
  }
  function altimetroCarga(el) {
    const num = $(".carga-num", el);
    const t0 = performance.now();
    (function paso(a) {
      const s = (a - t0) / 1000;
      const alt = 4200 + Math.sin(s * 1.3) * 120 + Math.sin(s * 3.1) * 18;
      num.textContent = Math.round(alt).toLocaleString("es-CL");
      if (el.classList.contains("corre")) requestAnimationFrame(paso);
    })(t0);
  }
  $$(".carga[data-progreso]").forEach((el) => { el.classList.add("corre"); progreso(el); });
  $$(".carga[data-altimetro]").forEach((el) => { el.classList.add("corre"); altimetroCarga(el); });

  /* Portada: la carga "Despegue" corre al abrir */
  const portada = $("#despegue-portada");
  if (portada) requestAnimationFrame(() => portada.classList.add("corre"));

  /* ── 7. Altímetro de navegación ───────────────────────────────────── */
  const capitulos = $$("section[data-alt]");
  const altNum = $("#alt-num"), altNom = $("#alt-nombre");
  const enlaces = $$(".riel a");
  let altActual = 0, altObjetivo = 0;
  function actualizarAlt() {
    const y = innerHeight * 0.35;
    let actual = capitulos[0];
    for (const c of capitulos) if (c.getBoundingClientRect().top <= y) actual = c;
    altObjetivo = +actual.dataset.alt;
    altNom.textContent = actual.dataset.nombre;
    enlaces.forEach((a) => a.classList.toggle("activo", a.getAttribute("href") === `#${actual.id}`));
  }
  (function tick() {
    altActual += (altObjetivo - altActual) * 0.12;
    if (Math.abs(altObjetivo - altActual) < 0.5) altActual = altObjetivo;
    altNum.textContent = Math.round(altActual).toLocaleString("es-CL").padStart(5, "0");
    requestAnimationFrame(tick);
  })();
  addEventListener("scroll", actualizarAlt, { passive: true });
  actualizarAlt();

  /* ── 8. Motion: texto térmico (descifrado) ─────────────────────────── */
  const GLIFOS = "▲◢◣╱╲_/\\01·—";
  function descifrar(el) {
    const final = el.dataset.texto || el.textContent;
    el.dataset.texto = final;
    const t0 = performance.now(), dur = 900;
    (function paso(a) {
      const p = Math.min(1, (a - t0) / dur);
      el.textContent = final
        .split("")
        .map((ch, i) => {
          if (ch === " ") return " ";
          const umbral = i / final.length;
          return p > umbral * 0.8 + 0.2 ? ch : GLIFOS[(Math.random() * GLIFOS.length) | 0];
        })
        .join("");
      if (p < 1) requestAnimationFrame(paso);
    })(t0);
  }
  $$("[data-descifrar]").forEach((el) => {
    const zona = el.closest(".demo") || el;
    zona.addEventListener("pointerenter", () => descifrar(el));
    zona.addEventListener("focusin", () => descifrar(el));
  });
  if (!reduce) setInterval(() => $$("[data-descifrar]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) descifrar(el);
  }), 5200);

  /* ── 9. Motion: linterna ───────────────────────────────────────────── */
  $$(".linterna").forEach((el) => {
    let libre = true, t = 0;
    const mover = (x, y) => { el.style.setProperty("--lx", `${x}px`); el.style.setProperty("--ly", `${y}px`); };
    el.addEventListener("pointermove", (e) => {
      libre = false;
      const r = el.getBoundingClientRect();
      mover(e.clientX - r.left, e.clientY - r.top);
    });
    el.addEventListener("pointerleave", () => (libre = true));
    (function vagar() {
      if (libre && !reduce) {
        t += 0.012;
        const r = el.getBoundingClientRect();
        mover(r.width * (0.5 + Math.sin(t) * 0.32), r.height * (0.5 + Math.sin(t * 1.7) * 0.28));
      }
      requestAnimationFrame(vagar);
    })();
  });

  /* ── 10. Motion: el paso del cóndor ────────────────────────────────── */
  const paso = $("#paso-condor");
  function invocarPaso() {
    if (reduce) return;
    paso.classList.remove("vuela");
    void paso.offsetWidth;
    paso.classList.add("vuela");
  }
  $$("[data-paso]").forEach((b) => b.addEventListener("click", invocarPaso));
  const secMotion = $("#motion");
  if (secMotion) {
    let hecho = false;
    new IntersectionObserver((ents) => {
      if (!hecho && ents[0].isIntersecting) { hecho = true; setTimeout(invocarPaso, 600); }
    }, { threshold: 0.2 }).observe(secMotion);
  }

  /* ── 11. Láminas magnéticas (inclinación + brillo) ─────────────────── */
  $$("[data-magnetica]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
      el.style.setProperty("--bx", `${x * 100}%`);
      el.style.setProperty("--by", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--bx", "30%");
      el.style.setProperty("--by", "20%");
    });
  });

  /* ── 12. Cifras que ascienden ──────────────────────────────────────── */
  $$("[data-asciende]").forEach((el) => {
    const fin = +el.dataset.asciende;
    let hecho = false;
    new IntersectionObserver((ents) => {
      if (hecho || !ents[0].isIntersecting) return;
      hecho = true;
      if (reduce) return;
      const t0 = performance.now(), dur = 1600;
      (function paso(a) {
        const p = Math.min(1, (a - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(fin * e).toLocaleString("es-CL");
        if (p < 1) requestAnimationFrame(paso);
      })(t0);
    }).observe(el);
  });

  /* ── 13. Kit de interfaz: modo del bloque y controles ──────────────── */
  $$("[data-modo-bloque]").forEach((grupo) => {
    const destino = document.getElementById(grupo.dataset.modoBloque);
    $$("button", grupo).forEach((b) =>
      b.addEventListener("click", () => {
        $$("button", grupo).forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        destino.classList.toggle("cn-oscuro", b.dataset.modo === "oscuro");
        destino.classList.toggle("cn-claro", b.dataset.modo === "claro");
      }),
    );
  });
  $$(".ui-pestanas").forEach((g) =>
    $$("button", g).forEach((b) =>
      b.addEventListener("click", () => {
        $$("button", g).forEach((x) => x.setAttribute("aria-selected", "false"));
        b.setAttribute("aria-selected", "true");
      }),
    ),
  );
  $$("[data-cargando]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.classList.contains("cargando")) return;
      b.classList.add("cargando");
      setTimeout(() => b.classList.remove("cargando"), 2200);
    }),
  );
})();
