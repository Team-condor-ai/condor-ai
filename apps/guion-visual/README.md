# Guion visual condor.ai · visión "Claro"

Marca, color, tipografía, acrílico, motion, productos e interfaz para **condorai.cl** y el **Portal Cóndor**.
Sitio estático, sin build. Contexto completo y decisiones: [CONTEXTO.md](CONTEXTO.md).

```bash
cd apps/guion-visual
npm install        # solo para regenerar la marca (sharp, potrace, opentype.js, fuentes)
npm run dev        # http://127.0.0.1:5320
npm run marca      # vuelve a forjar assets/marca/*.svg y assets/marca-datos.js
```

| Archivo | Qué es |
|---|---|
| `herramientas/generar-marca.mjs` | Cóndor original refinado (pulido/corte/ojo), letras construidas sin tipografía y marcas de producto con la gramática de Medula. |
| `assets/marca/` | Isotipo, wordmark, logo horizontal y vertical (azul, grafito, blanco, ionosfera, aurora, hielo) y las 6 marcas de producto. Los base usan `currentColor`. |
| `tokens/condor.css` | Tokens oficiales (color, tipo, forma, movimiento), claro y oscuro. |
| `guion.js` | Letras vivas, propuestas del isotipo, cargas, productos, kit. |
