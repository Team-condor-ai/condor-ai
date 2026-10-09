# Guion visual condor.ai

El cóndor, el logo, las letras, los productos (ecommerce, track, agents), el color, la forma,
el material acrílico y el movimiento de **condor.ai**, funcionando en una página estática.
Decisiones y cómo se llegó a cada una: [CONTEXTO.md](CONTEXTO.md).

```bash
cd apps/guion-visual
npm install        # una vez: sharp, opentype.js, Phosphor Icons
npm run dev        # http://127.0.0.1:5320  (el guion)  ·  /hojas/… (hojas de decisión)
npm run marca      # regenera assets/marca/*.svg y assets/marca-datos.js
npm run medir      # capturas escritorio/celular, errores, desbordes  → ./medicion
npm run probar     # interacción real por CDP (clics, hover, firmas, descargas)
npm run secciones  # una captura por sección + hojas de contacto → ./medicion/secciones
```

| Archivo | Qué es |
|---|---|
| `herramientas/condor.mjs` | El cóndor redibujado en vector sobre el original (`assets/antes/logo-v2.png`). Variante oficial: `oficial` (B7: cuello lleno, corte 3,4, plumas romas). |
| `herramientas/tipo.mjs` | Letras del nombre: Inter Display Semibold (OFL) pasada a vector propio, con esqueleto por letra. |
| `herramientas/iconos.mjs` | Íconos de producto (ecommerce, track, agents): baldosa con láminas de acrílico + glifo de Phosphor Icons (MIT). Oficial: estilo blanco. |
| `herramientas/generar-marca.mjs` | Arma todo: isotipo, nombre, logo horizontal y vertical en negro/blanco/azul, ícono de app e íconos de producto. |
| `tokens/condor.css` | Tokens oficiales: color, tipografía, radios, acrílico y movimiento (con un resorte real como `linear()`). |
| `index.html` | El guion: solo muestra. Ocho capítulos según `src/plan.js`. |
| `src/kit/` · `src/patrones/` | Las piezas (acrílico, resorte, marca, avisos, popups, controles, campos) y los patrones (navegación, stepper, scrollers, datos). |
| `estilos/` | base → acrilico → movimiento → kit → patrones → secciones. |
| `hojas/` | Las hojas con que se decidió cada pieza (P1 cóndor … P5 sistema). |
| `assets/fuentes/inter-display/` | Inter Display + su licencia OFL. |
