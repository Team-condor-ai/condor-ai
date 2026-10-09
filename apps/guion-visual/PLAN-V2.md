# Guion visual condor.ai · plan v2 (replanteado 9-oct-2026)

## Lo que Max decidió
| Tema | Decisión |
|---|---|
| Look | **Blanco** de base. Negro y blanco corporativo. **Un azul** solo para highlights: el del sitio público, `#014CFD` (`public/rediseno/editorial.css`). Tinta `#151517`, línea `#DDDDDF`, gris `#636368`. Sin rojo, sin bandas de colores. |
| Forma | **Apple**: redondeado generoso (squircles, radios 12–24 px). Se descarta "cuadrado/mandante". |
| Cóndor | El **original redibujado a mano**, refinado. Sin cortes pegados encima. |
| Letras | Las del guion anterior (círculos + astas), **más bold**, la n y la r sin esquinas duras. Únicas, sin sci-fi ni neón. |
| Logo | Versiones **negro, blanco y azul**. |
| Productos | Solo **condor ecommerce, track y agents**, con el lenguaje del ícono de condor sites. |
| Fuera | Portal, "Fundido", tema oscuro. |
| Material | Acrílico/líquido, sutil; motion suave y satisfactorio. |

## Cómo se trabaja (cambio de método)
1. **Por puertas.** Nada de página hasta que la marca esté aprobada. Cada pieza se muestra en una
   **hoja comparativa** (2–3 opciones, a tamaño grande, chico y en contexto) y Max elige.
2. **Vector construido, no trazado.** El PNG original mide 248 px: trazarlo hereda sus bultos.
   El cóndor se redibuja con geometría (plumas paralelas, curva del ala como arco real, puntas con
   el mismo radio) usando el original solo como calco. Booleanas limpias con `paper` (no raster + potrace).
3. **Correcciones ópticas en las letras**: sobrepaso de redondas, adelgazar uniones, ink traps
   suaves, espaciado por pares medido. Las letras se dibujan como contornos, no como trazo engordado.
4. **Medir**: capturas por CDP a 1440 y 390 px, contraste, tamaños mínimos (16 px), antes de mostrar.

## Puertas
| # | Pieza | Entrega para elegir |
|---|---|---|
| P1 | Cóndor | Hoja: original · A "fiel refinado" · B "fiel + cuello iluminado como hueco" · C "plumas con ritmo". En 512/64/16 px y en negro/blanco/azul. |
| P2 | Letras | Hoja: anterior · A "bold geométrica" · B "bold con un rasgo propio" (p. ej. la a o la r). Junto al cóndor elegido. |
| P3 | Logo | Lockups horizontal/vertical, área de respeto, mínimos, tres tintas. |
| P4 | Íconos | Hoja de 3 productos junto al ícono de sites real: grilla, keyline, misma luz. 2 direcciones. |
| P5 | Sistema | Tokens (color, radios, sombras, acrílico), motion (curvas + 3 animaciones de firma). |
| P6 | Guion | Recién aquí: página nueva, blanca, secciones limpias, sin restos del guion viejo. |
| P7 | Cierre | Medición, `CONTEXTO.md`, commit en `max/guion-visual-v1`. |

## Estado del worktree (`D:\Proyectos\condor-guion`)
Hay cambios sin commit de la v2 rechazada (index/css/js/tokens y `herramientas/*`).
`npm run marca` está roto (generar-marca usa la API vieja de letras.mjs). Se rehace en P1–P3;
el commit `f3c0d1e` sigue intacto como referencia.

## Avance (9-oct)
- **P1 cóndor ✔** `oficial` en `herramientas/condor.mjs`: B7 cuello lleno, corte 3,4, plumas romas (hojas p1–p1d).
- **P2 letras ✔** Inter Display **Semibold** en vector propio (`herramientas/tipo.mjs`, hoja p2c). Descartadas: geométricas redondeadas y la neo-grotesca dibujada a mano (`tipo-mano.mjs`).
  Animaciones de p2c NO convencieron → se rehacen en P5 (estudio de motion primero).
- **P3 logo ✔** `npm run marca` → horizontal (cóndor 1,8 alto de x), vertical, isotipo, nombre, íconos de app; tintas negro #151517, blanco, azul #014CFD (hoja p3).
- Siguiente: P4 íconos de producto (ecommerce, track, agents).
- Ojo: `index.html` del guion usa el formato viejo de `marca-datos.js` → se rehace en P6.
