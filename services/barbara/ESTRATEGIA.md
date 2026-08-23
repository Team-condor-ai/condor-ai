# Estrategia y plan — contenido, memoria global y planes comerciales

> Ver [OBJETIVO.md](./OBJETIVO.md) para la visión y [STACK-TECNICO.md](./STACK-TECNICO.md)
> para cómo se construye cada pieza de acá.

## 1. Estado actual (lo que YA existe, para no reinventarlo)

Verificado en el código real al 23-ago-2026:

- **4 series/templates** en `barbara.mjs`: `noticias` (educativo,
  investiga en vivo), `servicios` (venta de Cóndor AI), `barbara_producto`
  y `barbara_datos` (venta/prueba de Bárbara misma).
- **Rotación determinística**: lunes = noticiero fijo, miércoles/viernes
  rotan las otras 3 series por semana ISO real — ciclo completo de 3
  semanas sin repetir combinación (`ROTATIVAS`, `semanaISO()`).
- **Anti-repetición YA existe**: `content-log.json` guarda hasta 100
  ángulos anteriores, le pasa los últimos 15 al modelo con la orden de
  innovar.
- **UGC en video YA existe** (para clientes, no para la cuenta propia
  de Cóndor todavía): 2-3 clips de 4-6s, "una persona mostrando el
  producto, hablándole a cámara, estilo casero", persona distinta cada
  vez (`clientes.mjs`).
- **Personaje Bárbara** (mascota) aparece en portada y alternado en
  ≥50% del carrusel, con logo real compuesto vía `sharp` (no dibujado
  por el modelo de imagen — un modelo de texto-a-imagen no puede
  reproducir un logo fijo pixel-exacto).

## 2. Sistema de pilares de contenido (nuevo)

Hoy las series de Cóndor están escritas fijas en código. Para escalar
a cualquier cliente sin tocar código cada vez, se define **en el
formulario de onboarding** qué proporción de contenido va a cada
pilar — los pilares son fijos y genéricos, las proporciones son por
cliente:

| Pilar | Qué es | Ejemplo Cóndor hoy |
|---|---|---|
| Educar | Enseña algo del rubro, sin vender | `noticias` |
| Mostrar/Vender | Producto, servicio, oferta concreta | `servicios`, `barbara_producto` |
| Autoridad/Prueba | Datos, estudios, resultados medibles | `barbara_datos` |
| Comunidad | Detrás de cámara, equipo, valores | *no existe todavía* |
| Social proof | Testimonios, casos de éxito reales | *no existe todavía* |

**Advertencia explícita**: la mezcla actual de Cóndor (3 de 4 series
hablan de Cóndor/Bárbara mismos) es válida porque es la cuenta propia.
Copiar esa proporción a un cliente sería demasiado auto-promocional y
lo ahuyentaría. El % por pilar tiene que definirse por cliente, nunca
heredarse de la cuenta de Cóndor por defecto.

## 3. Contenido UGC — sub-ángulos concretos

El UGC hoy es genérico ("una persona mostrando el producto"). Se
definen sub-ángulos dentro del pilar "Mostrar/Vender", rotados con el
mismo chequeo anti-repetición que el resto:

- **Unboxing/primera impresión** — reacción genuina al recibir el producto
- **Uso real en contexto** — la persona usándolo en su día a día
- **Antes/después o resultado** — cuando el producto tiene cambio visible
- **Reacción a un problema común del rubro** — el dolor antes de la solución

## 4. Memoria global: cómo se alimenta sin contaminarse

El riesgo de fondo: si se promueve cualquier corrección de un cliente
directo a memoria global, el capricho de un solo cliente contamina a
todos los demás. Por eso hay un **umbral de consenso**, no promoción
inmediata:

1. Cada corrección/sugerencia entra primero a una tabla de
   **candidatos** (staging), nunca directo a global.
2. Se clasifica (con Sonnet — ver nota de costo en STACK-TECNICO.md):
   ¿es un gusto personal del cliente (color, tono, estética) o un
   patrón general (estructura, timing, formato que aplicaría a
   cualquiera)? Solo lo segundo entra como candidato.
3. Se agrupan candidatos por similitud semántica. Un patrón se
   **promueve a memoria global real** solo cuando aparece de forma
   independiente en al menos 3-5 clientes distintos.
4. Lo que queda en memoria global está **anonimizado** — el patrón, no
   el dato ("carruseles con pregunta en la portada suben 30% el
   guardado en rubro gastronomía"), nunca el contenido ni el cliente
   de origen.

## 5. Por qué se descartó cargar transcripciones de expositores

La idea original era precargar el "cerebro" de cada Bárbara con
transcripciones de charlas/cursos de expositores de marketing famosos.
Se descartó por dos razones:

- **Riesgo legal real**: transcribir y redistribuir contenido de
  terceros dentro de un producto comercial por el que se cobra
  mensualidad es zona de riesgo de derechos de autor, no un detalle
  técnico menor.
- **Innecesario en la práctica**: Claude ya viene entrenado con una
  cantidad enorme de teoría de marketing, copywriting y frameworks de
  posicionamiento. Lo que falta no es teoría genérica — es contexto
  específico y verificado del propio negocio y del propio nicho.

**Alternativa adoptada**: biblioteca de playbooks propios, escritos
por Cóndor con sus propias palabras a partir de lo que se verificó que
funciona con datos reales de clientes propios. Es 100% propio,
legalmente limpio, y más valioso que un resumen genérico porque nadie
más lo tiene.

## 6. Planes comerciales (rediseñados desde cero)

Nombres pensados sobre la misma metáfora del cerebro que crece con el
cliente:

| | **Bárbara Semilla** | **Bárbara Memoria** | **Bárbara Cerebro** |
|---|---|---|---|
| Para quién | Recién arranca, quiere probar | Ya tiene ritmo, quiere que mejore solo | Marca que quiere el sistema completo |
| Memoria privada | Básica (solo onboarding) | Completa, aprende cada semana | Completa + ajuste fino de personalidad de marca |
| Memoria global (lectura) | ❌ | ✅ | ✅ + prioridad de promoción de sus propios patrones |
| Biblioteca fundacional propia | ❌ | Parcial | Completa |
| Publicaciones/mes | 12 (3/semana) | 24 (6/semana) | Ilimitado dentro de uso razonable |
| Series/pilares | 2 fijos | Los definidos + rotación completa | Los definidos + templates a medida |
| Consistencia de personaje/logo | ✅ | ✅ | ✅ + variantes de personaje a medida |
| Reporte | Mensual | Semanal a Telegram | Semanal + llamada de estrategia mensual |
| Setup inicial | $150.000 CLP | $200.000 CLP | $350.000 CLP |
| Mensualidad | $180.000 CLP | $320.000 CLP | $550.000 CLP |

Estos números asumen costo de motor 100% Sonnet (sin Haiku) — con el
costo real de Sonnet + Higgsfield + Blotato por cliente en las decenas
de miles de CLP al mes, cada plan deja margen sano incluso en Semilla.
Memoria y Cerebro cobran más no porque cuesten mucho más de correr,
sino porque el valor percibido — "aprende solo, cada vez mejor" — es
sustancialmente más alto.
