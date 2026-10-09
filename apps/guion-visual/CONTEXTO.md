# Guion visual condor.ai — contexto de trabajo

Bitácora para retomar el guion otro día o en otro PC.
Última sesión: **9 de octubre de 2026** · Persona: Max · Agente: Claude.

- **Rama:** `max/guion-visual-v1` (sin PR; no integrar a `main` sin el OK de Max).
- **Carpeta:** `apps/guion-visual/` · **Local:** `npm run dev` → http://127.0.0.1:5320
- **Plan y avance por puertas:** [PLAN-V2.md](PLAN-V2.md). Las hojas de decisión están en `hojas/`.

## 1. El encargo
Remodelar por completo el guion visual de condor.ai: **blanco**, negro y blanco corporativo con el azul de la
página pública solo para destacar; forma **tipo Apple** (redondeado generoso); estilo **acrílico/líquido** con
movimiento suave y satisfactorio. Productos: solo **condor ecommerce, track y agents**. Sin Portal.

## 2. Qué se probó y qué se descartó
| Pieza | Descartado | Elegido |
|---|---|---|
| Cóndor | Trazar el PNG; "una línea por el medio"; sólido (cabeza pegada al ala); muesca (cuello débil) | **B7**: el original redibujado punto a punto, cuello lleno, un corte fino de 3,4 que sigue la curva del ala de punta a punta, **plumas romas** |
| Letras | Cuadradas "mandantes"; geométricas redondeadas; neo-grotesca dibujada a mano ("ni parecida a Apple") | **Inter Display Semibold** en vector propio (OFL). SF Pro no se puede usar en un logo |
| Íconos | Bandas al ángulo del ala; escenas dibujadas a mano (clip-art) | Fondo del ícono de **sites** (baldosa + 2 láminas de acrílico + resplandor) + glifo de **Phosphor Icons** en **blanco** |
| Colores de producto | Verdes y cafés embarrados | ecommerce violeta/rosa, track turquesa/menta, agents naranja/magenta |
| Animaciones | Escritura trazo a trazo, subida, vuelo (P2) | Cuatro firmas en P5 (abajo) — **Max aún no elige** |

## 3. Decisiones vigentes
- **Color:** tinta `#151517`, blanco, Azul Cóndor `#014CFD` (de `public/rediseno/editorial.css`), grises del sistema de
  Apple. Texto 2 `#636368` (5,97:1), texto 3 `#737378` (4,7:1); `#8E8E93` solo íconos y texto grande.
  Estados ajustados a ≥ 4,8:1 sobre su fondo suave.
- **Logo:** cóndor = 1,8 alto de x; separación 0,34 alto de x; respeto = alto de x por lado; mínimos 110 px
  horizontal / 20 px isotipo. Siempre una tinta (negro, azul o blanco).
- **Tipografía de interfaz:** Inter Display (titulares) + Inter (texto) + Geist Mono (rótulos).
- **Forma:** radios 8 / 12 / 16 / 22 / 28; íconos en squircle continuo (superelipse n = 5).
- **Material:** acrílico claro (blanco 58 %, blur 24, saturación 1,8, canto de luz que sigue al cursor).
- **Movimiento:** llegada `cubic-bezier(.16,1,.3,1)`, suave `cubic-bezier(.25,.1,.25,1)`, resorte = muelle real ζ 0,62
  como `linear()`. Firmas: **Aleteo** (el ala, que es una pieza aparte, da un aletazo), **Enfoque**, **Destello**,
  **Despegue**. Propuesta provisoria: Aleteo en la carga, Enfoque en video, Destello en esperas/hover.

## 4. Pendientes
1. Que Max elija la(s) firma(s) de movimiento.
2. Aplicar al sitio (`apps/web-v2`): logo, tokens, íconos de producto (reemplazar `public/assets/productos/*.png`
   por los SVG nuevos), barra con acrílico.
3. Ícono de condor sites con el mismo sistema (hoy se usa el PNG original como referencia).
4. Favicon y PNG de íconos (512/180/32) desde los SVG.

## 5. Medición (9-oct)
- `npm run medir`: escritorio 1440 y celular 390 sin errores de consola, sin imágenes rotas, sin scroll horizontal.
- `npm run probar`: 9/9 (calco, segmento, interruptor, hover real, firmas, cámara lenta, luz del acrílico,
  barra activa, 19 descargas sin rotas).

## 6. Trampas conocidas
- En `sharp`, desenfoque y umbral encadenados no respetan el orden: cada operación en su propio paso.
- Las animaciones CSS no se capturan bien con `--virtual-time-budget`: usar `herramientas/captura.mjs` (espera real).
- Chrome headless en Windows deja procesos hijos: las herramientas los cierran filtrando por su perfil temporal.
- Las clases de estado (`.corre`) y de firma (`.m-aleteo`) van en el MISMO elemento: el selector es `.corre.m-aleteo`.
- En las pruebas por CDP hay que apagar `scroll-behavior: smooth` o los clics caen fuera.
