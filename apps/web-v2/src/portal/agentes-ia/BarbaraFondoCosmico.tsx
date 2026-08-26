import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_posicion;
  uniform vec4 u_rect;
  varying vec2 v_uv;

  void main() {
    vec2 posicion = u_rect.xy + a_posicion * u_rect.zw;
    gl_Position = vec4(posicion.x * 2.0 - 1.0, 1.0 - posicion.y * 2.0, 0.0, 1.0);
    v_uv = a_posicion;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_textura;
  uniform float u_opacidad;
  varying vec2 v_uv;

  void main() {
    gl_FragColor = texture2D(u_textura, v_uv) * u_opacidad;
  }
`;

type CapaWebGL = {
  id: "particulas" | "planeta-chico" | "planeta-grande" | "cinta";
  src: string;
  x: number;
  y: number;
  ancho: number;
  amplitudX: number;
  amplitudY: number;
  periodo: number;
  opacidadMinima: number;
  opacidadMaxima: number;
  bloom?: number;
  fase?: number;
};

type RecursoWebGL = {
  capa: CapaWebGL;
  imagen: HTMLImageElement;
  textura: WebGLTexture;
};

const CAPAS_WEBGL: CapaWebGL[] = [
  { id: "particulas", src: "/assets/barbara/fondo/particulas.webp", x: 0, y: 0, ancho: .992, amplitudX: -2.75, amplitudY: 3.5, periodo: 14.4, opacidadMinima: .82, opacidadMaxima: .94 },
  { id: "planeta-chico", src: "/assets/barbara/fondo/planeta-chico.webp", x: .464, y: .0634, ancho: .10229, amplitudX: -10.5, amplitudY: -15.5, periodo: 10.4, opacidadMinima: .78, opacidadMaxima: .96, bloom: .22, fase: 1.1 },
  { id: "planeta-grande", src: "/assets/barbara/fondo/planeta-grande.webp", x: .572, y: .021, ancho: .428, amplitudX: 3.75, amplitudY: -13.5, periodo: 8.8, opacidadMinima: .88, opacidadMaxima: 1, bloom: .24, fase: .25 },
  { id: "cinta", src: "/assets/barbara/fondo/cinta-vidrio.webp", x: 0, y: 0, ancho: 1, amplitudX: 18, amplitudY: -17, periodo: 10.8, opacidadMinima: .76, opacidadMaxima: .98, bloom: .19, fase: 2.4 },
];

function compilarShader(gl: WebGLRenderingContext, tipo: number, fuente: string) {
  const shader = gl.createShader(tipo);
  if (!shader) throw new Error("No se pudo crear el shader de Bárbara.");
  gl.shaderSource(shader, fuente);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detalle = gl.getShaderInfoLog(shader) || "Error de compilación WebGL";
    gl.deleteShader(shader);
    throw new Error(detalle);
  }
  return shader;
}

function crearPrograma(gl: WebGLRenderingContext) {
  const vertice = compilarShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmento = compilarShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const programa = gl.createProgram();
  if (!programa) throw new Error("No se pudo crear el programa WebGL de Bárbara.");
  gl.attachShader(programa, vertice);
  gl.attachShader(programa, fragmento);
  gl.linkProgram(programa);
  gl.deleteShader(vertice);
  gl.deleteShader(fragmento);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    const detalle = gl.getProgramInfoLog(programa) || "Error de enlace WebGL";
    gl.deleteProgram(programa);
    throw new Error(detalle);
  }
  return programa;
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((resolver, rechazar) => {
    const imagen = new Image();
    imagen.decoding = "async";
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error(`No se pudo cargar ${src}`));
    imagen.src = src;
  });
}

/**
 * Escena cósmica de Bárbara.
 *
 * WebGL dibuja cada asset como textura con filtrado lineal y coordenadas
 * flotantes. El movimiento se calcula contra el reloj de cada frame. El DOM
 * raster se conserva debajo como fallback mientras carga y si WebGL falla.
 */
export function BarbaraFondoCosmico() {
  const raiz = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const nodo = raiz.current;
    const canvas = canvasRef.current;
    if (!nodo || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let activo = true;
    let raf = 0;
    let programa: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let recursos: RecursoWebGL[] = [];
    let observador: ResizeObserver | null = null;
    let limpiarVisibilidad: (() => void) | null = null;
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const alPerderContexto = () => {
      window.cancelAnimationFrame(raf);
      raf = 0;
      nodo.classList.remove("barbara-webgl-listo");
    };
    canvas.addEventListener("webglcontextlost", alPerderContexto);

    void (async () => {
      try {
        programa = crearPrograma(gl);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error("No se pudo crear el buffer WebGL de Bárbara.");

        const imagenes = await Promise.all(CAPAS_WEBGL.map((capa) => cargarImagen(capa.src)));
        if (!activo || !programa || !buffer) return;

        gl.useProgram(programa);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          0, 0,
          1, 0,
          0, 1,
          1, 1,
        ]), gl.STATIC_DRAW);

        const posicion = gl.getAttribLocation(programa, "a_posicion");
        const rect = gl.getUniformLocation(programa, "u_rect");
        const opacidad = gl.getUniformLocation(programa, "u_opacidad");
        const texturaUniforme = gl.getUniformLocation(programa, "u_textura");
        if (posicion < 0 || !rect || !opacidad || !texturaUniforme)
          throw new Error("El programa WebGL de Bárbara está incompleto.");

        gl.enableVertexAttribArray(posicion);
        gl.vertexAttribPointer(posicion, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(texturaUniforme, 0);
        // El quad ya convierte el eje Y de coordenadas DOM a clip-space en
        // el vertex shader. Volver a invertir la textura acá la dejaba cabeza
        // abajo respecto del fallback y de la composición original.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

        recursos = CAPAS_WEBGL.map((capa, indice) => {
          const textura = gl.createTexture();
          if (!textura) throw new Error("No se pudo crear una textura de Bárbara.");
          gl.bindTexture(gl.TEXTURE_2D, textura);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagenes[indice]);
          return { capa, imagen: imagenes[indice], textura };
        });

        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 0);

        const ajustarResolucion = () => {
          const anchoCss = Math.max(1, canvas.clientWidth);
          const altoCss = Math.max(1, canvas.clientHeight);
          const densidad = Math.min(window.devicePixelRatio || 1, 2);
          const ancho = Math.round(anchoCss * densidad);
          const alto = Math.round(altoCss * densidad);
          if (canvas.width !== ancho || canvas.height !== alto) {
            canvas.width = ancho;
            canvas.height = alto;
          }
          gl.viewport(0, 0, ancho, alto);
          return { anchoCss, altoCss };
        };

        const dibujarRecurso = (
          recurso: RecursoWebGL,
          segundos: number,
          anchoCss: number,
          altoCss: number,
          alpha: number,
        ) => {
          const { capa, imagen, textura } = recurso;
          const onda = (1 - Math.cos((segundos / capa.periodo) * Math.PI * 2)) / 2;
          const x = capa.x + (capa.amplitudX * onda) / anchoCss;
          const y = capa.y + (capa.amplitudY * onda) / altoCss;
          const alto = (capa.ancho * anchoCss * (imagen.naturalHeight / imagen.naturalWidth)) / altoCss;
          gl.uniform4f(rect, x, y, capa.ancho, alto);
          gl.uniform1f(opacidad, alpha);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, textura);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };

        const dibujar = (tiempo: number) => {
          raf = 0;
          if (!activo || !programa) return;
          const { anchoCss, altoCss } = ajustarResolucion();
          const segundos = tiempo / 1000;
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          for (const recurso of recursos) {
            const { capa } = recurso;
            const respiracion = .5 + .5 * Math.sin((segundos / (capa.periodo * .73)) * Math.PI * 2 + (capa.fase || 0));
            const alpha = capa.opacidadMinima + (capa.opacidadMaxima - capa.opacidadMinima) * respiracion;
            dibujarRecurso(recurso, segundos, anchoCss, altoCss, alpha);
          }

          gl.blendFunc(gl.ONE, gl.ONE);
          for (const recurso of recursos) {
            if (!recurso.capa.bloom) continue;
            const pulso = .5 + .5 * Math.sin((segundos / (recurso.capa.periodo * .61)) * Math.PI * 2 + (recurso.capa.fase || 0));
            dibujarRecurso(recurso, segundos, anchoCss, altoCss, .015 + recurso.capa.bloom * pulso);
          }

          if (!nodo.classList.contains("barbara-webgl-listo"))
            nodo.classList.add("barbara-webgl-listo");
          if (!reducirMovimiento && !document.hidden)
            raf = window.requestAnimationFrame(dibujar);
        };

        const alCambiarVisibilidad = () => {
          if (document.hidden) {
            window.cancelAnimationFrame(raf);
            raf = 0;
          } else if (!reducirMovimiento && !raf) {
            raf = window.requestAnimationFrame(dibujar);
          }
        };

        observador = new ResizeObserver(() => {
          if (reducirMovimiento) dibujar(0);
        });
        observador.observe(canvas);
        document.addEventListener("visibilitychange", alCambiarVisibilidad);
        limpiarVisibilidad = () => document.removeEventListener("visibilitychange", alCambiarVisibilidad);
        raf = window.requestAnimationFrame(dibujar);
      } catch {
        nodo.classList.remove("barbara-webgl-listo");
      }
    })();

    return () => {
      activo = false;
      window.cancelAnimationFrame(raf);
      observador?.disconnect();
      limpiarVisibilidad?.();
      canvas.removeEventListener("webglcontextlost", alPerderContexto);
      nodo.classList.remove("barbara-webgl-listo");
      for (const recurso of recursos) gl.deleteTexture(recurso.textura);
      if (buffer) gl.deleteBuffer(buffer);
      if (programa) gl.deleteProgram(programa);
    };
  }, []);

  return (
    <div ref={raiz} className="barbara-fondo-cosmico" aria-hidden="true">
      <div className="barbara-fondo-lienzo">
        <canvas ref={canvasRef} className="barbara-fondo-webgl" />
        <div className="barbara-fondo-raster">
          <img className="barbara-fondo-particulas" src="/assets/barbara/fondo/particulas.webp" alt="" />
          <img className="barbara-fondo-planeta-chico" src="/assets/barbara/fondo/planeta-chico.webp" alt="" />
          <img className="barbara-fondo-planeta-grande" src="/assets/barbara/fondo/planeta-grande.webp" alt="" />
          <img className="barbara-fondo-cinta" src="/assets/barbara/fondo/cinta-vidrio.webp" alt="" />
          <img className="barbara-fondo-bloom barbara-fondo-planeta-chico" src="/assets/barbara/fondo/planeta-chico.webp" alt="" />
          <img className="barbara-fondo-bloom barbara-fondo-planeta-grande" src="/assets/barbara/fondo/planeta-grande.webp" alt="" />
          <img className="barbara-fondo-bloom barbara-fondo-cinta" src="/assets/barbara/fondo/cinta-vidrio.webp" alt="" />
        </div>
      </div>
    </div>
  );
}
