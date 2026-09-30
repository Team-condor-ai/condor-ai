# Guion visual condor.ai · V1 "Acrílico Andino"

Marca, color, textura acrílica, motion, productos e interfaz para **condorai.cl** y el **Portal Cóndor**.
Sitio estático, sin build.

```bash
cd apps/guion-visual
npm install        # solo para regenerar la marca (opentype.js)
npm run dev        # http://127.0.0.1:5320
npm run marca      # regenera assets/marca/*.svg y assets/marca-datos.js
```

| Archivo | Qué es |
|---|---|
| `tokens/condor.css` | Tokens oficiales (color, tipo, forma, curvas de vuelo), claro/oscuro. Lo importan el sitio y el portal. |
| `assets/marca/` | 40 SVG: isotipo, isotipo corte, wordmark, logo horizontal y vertical × cobalto, tinta, blanco, gradiente azul, rosa puna, aurora, cromo. Los base usan `currentColor`. |
| `herramientas/generar-marca.mjs` | Fuente del isotipo redibujado (30 vértices, grilla 275×248) y del wordmark en contornos (Clash Display). |
| `guion.js` | Motor del vertido acrílico (WebGL2, un solo contexto), cargas de marca, altímetro y demos de motion. |
| `assets/antes/` | Logo e íconos anteriores, solo para la comparación. |
