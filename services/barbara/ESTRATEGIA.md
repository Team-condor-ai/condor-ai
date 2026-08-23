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

## 2. Sistema de pilares de contenido

**Construido el 23-ago-2026** (`pilares.mjs` + columnas
`barbara_formulario.pilares` y `barbara_memoria.pilar`). Las series de
Cóndor siguen fijas en código para la cuenta propia; para clientes, la
mezcla se define **en el formulario de onboarding** — los pilares son
fijos y genéricos, las proporciones son por cliente:

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
heredarse de la cuenta de Cóndor por defecto. Hay un test que protege
esto (`pilares.test.mjs`: "la mezcla por defecto NO es la de Cóndor").

**Cómo se elige el pilar de cada día: por deuda, no por turno.** Se
compara lo que la cuenta publicó de verdad (últimas 20 piezas) contra
la mezcla que la marca pidió, y gana el pilar más atrasado. Dos
ventajas sobre rotar en orden: converge a la mezcla pedida aunque se
salten días o se generen piezas sueltas fuera de calendario, y se
autocorrige solo (si una semana salieron tres piezas de venta, la
siguiente ese pilar queda saldado). Un pilar en 0% nunca sale — importa
sobre todo para `prueba_social`: sin testimonios reales cargados, la
única forma de llenar ese pilar sería inventarlos.

## 3. Contenido UGC — sub-ángulos concretos

El UGC hoy es genérico ("una persona mostrando el producto"). Se
definen sub-ángulos dentro del pilar "Mostrar/Vender", rotados con el
mismo chequeo anti-repetición que el resto:

- **Unboxing/primera impresión** — reacción genuina al recibir el producto
- **Uso real en contexto** — la persona usándolo en su día a día
- **Antes/después o resultado** — cuando el producto tiene cambio visible
- **Reacción a un problema común del rubro** — el dolor antes de la solución

## 4. Memoria global: cómo se alimenta sin contaminarse

**Corrección al 23-ago-2026**: esto ya estaba construido antes de esta
sesión (`patrones.mjs` + tabla `barbara_patrones`). Se documenta acá lo
que el código realmente hace, no lo que había que hacer:

1. Sólo se miran piezas **cerradas** (con veredicto: aprobada sin
   cambios, o corregida). Una pieza recién generada no dice nada
   todavía.
2. Umbral de muestra antes de destilar nada: mínimo **12 piezas de 3
   marcas distintas** (`MINIMO_PIEZAS` / `MINIMO_MARCAS`). Por debajo
   de eso no se llama al modelo siquiera — 20 piezas de un solo cliente
   describen a ese cliente, no un patrón global.
3. **Anonimización en origen**: al modelo le llega el tipo de pieza y
   el ángulo creativo, nunca la marca ni el rubro, y el
   `barbara_cliente_id` se descarta antes de armar el material (con un
   id opaco se pueden agrupar piezas y reconstruir a un cliente). No se
   le pide al modelo "no menciones marcas": se le manda un material
   donde las marcas no están. Una instrucción se puede desobedecer; un
   dato que no viajó, no.
4. Los patrones de confianza baja se descartan, y **todos nacen
   apagados** (`activo = false`): los enciende una persona a mano
   cuando la muestra lo sostiene. Mientras estén apagados no tocan la
   generación.

Lo que sí se agregó en esta sesión, porque faltaba: el generador ahora
lee `barbara_memoria_nodos` (gustos, datos y perfil sintetizado del
cliente). Esa tabla existía desde el 19-ago, el portal la escribe desde
el grafo de memoria y una Edge Function le guarda el perfil — pero
`clientes.mjs` nunca la leía, así que nada de lo que staff anotaba de
un cliente llegaba a la pieza.

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
