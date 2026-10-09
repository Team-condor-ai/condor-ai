# Guion visual condor.ai · plan v3 (9-oct-2026)

Pedido de Max: más acrílico/vidrio, más motion graphics suaves, más innovación; **nada de fondos de
color** (el azul es solo acento); **fuera condor sites** (deja de existir); una sección de **marca en
movimiento**; y que el guion tenga un kit completo: migas, popups, scrollers, steppers, formularios
y más. Seguir el cerebro de guiones visuales (proceso, kit, patrones, materiales, movimiento).

## Decisiones
- **Fondo siempre blanco/neutro.** El vidrio refracta contenido real neutro: tipografía, el cóndor,
  la grilla y la foto del equipo (grises). Color de producto solo dentro de sus íconos.
- **Vidrio líquido real** (motor portado de Medula): mapa de desplazamiento por forma +
  `backdrop-filter: url(#filtro)`; brillo que sigue al puntero; canto iluminado; prisma solo en
  lentes protagonistas; fallback esmerilado fuera de Chromium.
- **Una sola firma compleja por pantalla**; fondos quietos; `prefers-reduced-motion` sin loops.
- **Arquitectura sin build, en módulos ES**: `src/plan.js` (capítulos y secciones = fuente del dock
  y el índice), `src/kit/*` define las piezas, `index.html` solo muestra. Estilos por capa:
  `estilos/base → vidrio → movimiento → kit → patrones → secciones`.

## Capítulos
| # | Capítulo | Secciones |
|---|---|---|
| I | Identidad | Inicio · Cóndor · Logo · Letras · Productos |
| II | Material | Vidrio líquido (banco interactivo) · Superficies · Profundidad |
| III | Marca en movimiento | Firmas · La carga (el cóndor) · Ícono que se abre · La barra que se pliega · Trazo con scroll · Sello |
| IV | Fundamentos | Color · Tipografía · Forma · Curvas |
| V | Kit | Botones · Controles · Carga y estados · Avisos · Menús y popups |
| VI | Formularios | Campos · Stepper (Agenda una reunión) |
| VII | Patrones | Navegación (migas, ⌘K, pestañas) · Scrollers · Datos · Preguntas · Hoja (celular) |
| VIII | Aplicaciones | Sitio · Redes · Papelería · Archivos |

## Fases (una = un commit + push, medida)
1. Base: plan, dock de vidrio, barra con migas y ⌘K, fuera sites, fuera manchas de color.
2. Material: motor de vidrio + banco (lente arrastrable, parámetros en vivo, superficies).
3. Marca en movimiento.
4. Kit (botones con estados en capas, controles, carga, avisos con cola y Deshacer, alerta con
   foco atrapado, menú que nace del botón, popover, tooltip, modal).
5. Formularios + stepper.
6. Patrones (migas con hermanas, ⌘K, pestañas, carrusel, marquee, tabla, acordeón, hoja).
7. Aplicaciones + archivos + limpieza.
8. Calidad: 1440/390, interacción real, movimiento reducido, contraste, teclado; docs y memoria.
