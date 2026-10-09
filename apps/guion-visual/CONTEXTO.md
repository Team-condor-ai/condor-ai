# Guion visual condor.ai — contexto de trabajo

Bitácora para retomar el guion otro día o en otro PC.
Última sesión: **9 de octubre de 2026** · Persona: Max · Agente: Claude.

- **Rama:** `max/guion-visual-v1` (sin PR; no integrar a `main` sin el OK de Max).
- **Carpeta:** `apps/guion-visual/` · **Local:** `npm run dev` → http://127.0.0.1:5320
- **Plan y avance por puertas:** [PLAN-V2.md](PLAN-V2.md) (marca) y [PLAN-V3.md](PLAN-V3.md) (guion completo). Las hojas de decisión están en `hojas/`.

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
  Apple. Texto 2 `#636368` (5,97:1), texto 3 `#6B6B70` (5,3:1 sobre blanco, 4,7:1 sobre gris-5); `#8E8E93` solo íconos y texto grande.
  Estados ajustados a ≥ 4,8:1 sobre su fondo suave.
- **Logo:** cóndor = 1,8 alto de x; separación 0,34 alto de x; respeto = alto de x por lado; mínimos 110 px
  horizontal / 20 px isotipo. Siempre una tinta (negro, azul o blanco).
- **Tipografía de interfaz:** Inter Display (titulares) + Inter (texto) + Geist Mono (rótulos).
- **Forma:** radios 8 / 12 / 16 / 22 / 28; íconos en squircle continuo (superelipse n = 5).
- **Material:** acrílico claro (blanco 58 %, blur 24, saturación 1,8, canto de luz que sigue al cursor).
- **Movimiento:** llegada `cubic-bezier(.16,1,.3,1)`, suave `cubic-bezier(.25,.1,.25,1)`, resorte = muelle real ζ 0,62
  como `linear()`. Firmas: **Aleteo** (el ala, que es una pieza aparte, da un aletazo), **Enfoque**, **Destello**,
  **Despegue**. Propuesta provisoria: Aleteo en la carga, Enfoque en video, Destello en esperas/hover.

## 3b. Guion v3 (9-oct, tarde)
Max pidió más vidrio, más motion, más innovación, **nada de fondos de color** (azul solo acento),
**fuera condor sites** (deja de existir) y un kit completo. Se rehízo el guion como módulos ES sin build:
- `src/plan.js` — capítulos y secciones: fuente del dock, las migas, el índice y ⌘K.
- `src/kit/` — `vidrio.js` (refracción real portada de Medula), `resorte.js` (muelle en pasos de 8 ms),
  `marca.js` (logo por piezas + **el cóndor como carga**), `avisos.js` (toast, alerta, banner),
  `popups.js` (menú, popover, tooltip, modal, hoja), `controles.js`, `campos.js` (RUT, correo, OTP, archivos).
- `src/patrones/` — `navegacion.js` (barra que se pliega, migas con hermanas, dock, ⌘K, pestañas),
  `stepper.js` (Agenda una reunión), `scrollers.js` (carrusel, marquee, vuelo con scroll), `datos.js`.
- `estilos/` — base → vidrio → movimiento → kit → patrones → secciones.
- Ocho capítulos: Identidad · Material · Marca en movimiento · Fundamentos · Kit · Formularios · Patrones · Aplicaciones.

## 4. Pendientes
1. Que Max elija la(s) firma(s) de movimiento (propuesta: Aleteo carga, Enfoque video, Destello esperas).
2. Aplicar al sitio (`apps/web-v2`): logo, tokens, íconos de producto (reemplazar `public/assets/productos/*.png`
   por los SVG nuevos), barra con acrílico.
3. ~~Ícono de condor sites~~ — condor sites deja de existir (9-oct).
4. Favicon y PNG de íconos (512/180/32) desde los SVG.

## 5. Medición (9-oct, v3)
- `npm run probar` (con `npm run dev` arriba): kit 86/86 · patrones escritorio 69/70 · celular 71/71 ·
  reducido 65/68 · navegación 39/39. **Las 4 fallas son por diseño:** (1) el carrusel a sangre hace que
  `#scrollers` mida 90 px más que su caja en escritorio (lo recorta `overflow-x: clip`, la página no tiene
  scroll lateral); con movimiento reducido (2) la marquee queda quieta con la copia oculta, (3) el nombre
  del vuelo se ve desde el inicio y (4) el mismo desborde del carrusel.
- `npm run medir`: 1440 y 390 sin errores de consola, sin imágenes rotas, sin scroll horizontal.
- Auditoría (herramientas/pruebas/navegacion/auditoria.mjs): Tab 147 paradas sin trampas fuera de modales,
  roles sin fallas, 0 animaciones infinitas con movimiento reducido. El contraste se midió sobre el render;
  los textos reales que fallaban se corrigieron (token texto 3 → `#6B6B70`, muestras, pasos del vuelo,
  enlaces sobre foto). Ojo: la medición de contraste se contamina si corre mientras las secciones aparecen
  (`.revelar`) — repetirla con la página quieta.

## 6. Trampas conocidas
- En `sharp`, desenfoque y umbral encadenados no respetan el orden: cada operación en su propio paso.
- Las animaciones CSS no se capturan bien con `--virtual-time-budget`: usar `herramientas/captura.mjs` (espera real).
- Chrome headless en Windows deja procesos hijos: las herramientas los cierran filtrando por su perfil temporal.
- Las clases de estado (`.corre`) y de firma (`.m-aleteo`) van en el MISMO elemento: el selector es `.corre.m-aleteo`.
- En las pruebas por CDP hay que apagar `scroll-behavior: smooth` o los clics caen fuera.
- `.vidrio { position: relative }` le gana a `position: fixed` de piezas como el dock: subir la especificidad (`.dock.vidrio`).
- Un `innerHTML` sobre una pieza de vidrio borra su `.vidrio__lente`: cambiar solo los hijos de contenido.
- Un `backdrop-filter` en un ancestro (la barra) rompe el vidrio de lo que va adentro: los menús van a `body`.
