# Bárbara — stack, precios reales y márgenes (27-ago-2026 noche)

> Decidido por Joaquín la noche del 27-ago-2026. Este documento es la
> referencia para el equipo — cualquier cambio de proveedor o de precio se
> anota acá, no solo en el código.

## 1) Stack de proveedores — decidido hoy

| Función | Proveedor HOY | Proveedor cuando se recargue OpenAI | Proveedor cuando se acabe el saldo de Anthropic |
|---|---|---|---|
| Texto (ángulo, director, revisión, corrección) | **Anthropic directo** (Sonnet 5 + Opus 5 mixto) | sin cambio | **Kie API, TODO en Opus 5** (ver por qué, sección 2) |
| Imagen (`gpt-image-2`) | **Kie API** (`chat image 2`) | **OpenAI directo** (para poder usar imágenes de referencia reales — logos, etc.) | Kie API (mientras no haya saldo OpenAI) |
| Video (`seedance-2-0`) | **Kie API** | sin cambio | sin cambio |

**Regla dura, para no repetir el error de los bancos**: mientras el proveedor
de imagen sea Kie (sin soporte de imagen-de-referencia en el cliente de
Bárbara), **ningún prompt referencia ni pide dibujar un logo**. Solo la
paleta de colores de la marca. El logo real se agrega recién cuando OpenAI
esté cargado y se pueda usar el endpoint de referencia real (`image edit`,
hasta 16 imágenes de referencia por llamada).

### Estado de cada cuenta hoy mismo

- **Cóndor AI**: **funcionando**, verificado con una corrida real hoy
  (`workflow_dispatch` exitoso, run `33141204043`). Sin trailers ni UGC —
  solo los 3 carruseles semanales (Lun/Mié/Vie). Sin logo pegado por ahora
  (ver arriba); solo paleta de colores.
- **Rat.IA** (como cliente de Bárbara — no el bot de alertas de precio, que
  es un sistema aparte): dado de alta con brand book real, pero
  **publicaciones pausadas a propósito** (`telegram_chat_id = NULL`) hasta
  tener el logo real vía OpenAI.

## 2) El hallazgo grande: Kie revende Claude 57-60% más barato que Anthropic

Verificado contra la tabla oficial de Anthropic (no solo lo que muestra el
dashboard de Kie):

| Modelo | Kie (in/out por MTok) | Anthropic oficial | Ahorro real |
|---|---|---|---|
| claude-opus-5 | $2 / $10 | $5 / $25 | **-60%** |
| claude-sonnet-5 | $0.85 / $4.275 | $2 / $10 | **-57%** |

**Opus 5 vía Kie cuesta casi lo mismo que Sonnet 5 directo de Anthropic.**
Por eso, al migrar a Kie, no tiene sentido seguir mezclando modelos — todo
pasa a Opus 5 (mejor calidad, mismo costo aproximado que Sonnet hoy).

### Ojo con la columna "Official/Fal Price" de Kie para IMAGEN

Para `gpt-image-2`, esa columna probablemente NO es el precio real de
OpenAI — investigado por separado: el precio oficial real de OpenAI es
**$0.03 (1K) / $0.05 (2K) / $0.08 (4K)**, que es básicamente **el mismo
precio que ya cobra Kie**. El "-80% de descuento" que muestra el dashboard
de Kie para imagen parece comparar contra Fal.ai (un revendedor caro), no
contra el precio real de OpenAI. Conclusión: **ir directo a OpenAI para
imagen no cuesta más, y da la función de referencia real que Kie no tiene
armada hoy en el cliente de Bárbara** (`kie-api.mjs` solo implementa
`gpt-image-2-text-to-image`, no existe la función de `image-to-image`).

## 3) Precio real por unidad (USD)

| Ítem | Precio |
|---|---|
| gpt-image-2, 1K (el que usa Bárbara) | $0.03/imagen |
| seedance-2-0, 720p, sin video de entrada (el que usa Bárbara) | $0.205/segundo |
| Claude Sonnet 5 vía Kie | $0.85 in / $4.275 out por MTok |
| Claude Opus 5 vía Kie | $2 in / $10 out por MTok |
| Claude Opus 5 directo Anthropic | $5 in / $25 out por MTok |

FX usado en todo este documento: **913 CLP/USD** (27-ago-2026).

## 4) Costo por pieza (USD) — arquitectura objetivo: OpenAI imagen · Kie Claude+video

| Pieza | Ángulo | Director | Imagen | Revisión | Video | Corrección* | **Total** |
|---|---|---|---|---|---|---|---|
| Carrusel cliente (sin imagen IA — ver nota abajo) | $0.012 | $0.026 | $0 | $0.011 | — | $0.011 | **$0.060** |
| Historia cliente | $0.012 | $0.013 | $0 | $0.002 | — | $0.007 | **$0.034** |
| UGC cliente (video) | $0.012 | $0.019 | $0 | — | $2.56 | $0.905 | **$3.499** |
| Carrusel Cóndor (imagen SÍ generada, 6 slides) | $0.012 | $0.030 | $0.18 | $0.011 | — | $0.013 | **$0.246** |

*Corrección modelada: 25% de piezas piden al menos 1 ajuste, promedio 1.4
rondas (tope 3, como dice el plan Lite). En UGC, corregir implica regenerar
el video completo — por eso es tan caro corregir un UGC.

> **Pendiente de decisión, no cerrado hoy**: los planes le prometen al
> cliente "tu logo real" en cada pieza — hoy eso se resuelve con HTML
> compuesto (`plantillas.mjs`), no con imagen generada por IA. Joaquín pidió
> "nada de HTML ni scripts, solo generación con IA" — migrar el carrusel de
> CLIENTES (no solo el de Cóndor) a generación real con IA es la tarea
> grande que sigue, bloqueada hasta tener OpenAI con referencia de imagen
> real para el logo. Mientras tanto Rat.IA sigue pausado.

## 5) Márgenes por plan (planes reales, imagen adjunta 27-ago)

| Plan | Precio/mes | Cuota | Costo real/mes | **Margen/mes** | **Margen %** |
|---|---|---|---|---|---|
| **Bárbara Lite** | $49.990 | 12 carrusel | ≈$653 | **≈$49.337** | 98.7% |
| **Bárbara Go** | $89.990 | 12 carrusel + 20 historia + 4 UGC | ≈$14.053 | **≈$75.937** | 84.4% |
| **Bárbara Plus** | $119.990 | mismo contenido que Go (+features de proceso, no de generación) | ≈$14.053 | **≈$105.937** | 88.3% |

El UGC es ~90% del costo variable por cliente Go/Plus — 4 videos cuestan más
que las otras 32 piezas juntas.

**Aviso**: Plus promete "Revisión con IA antes de cada entrega" como
exclusivo — el código hoy corre esa revisión para TODOS los planes por
igual. No cambia mucho el margen (es barato), pero si se quiere que sea
realmente exclusivo de Plus hay que agregar el gate en el código. "Edición
de video automática" y "Reporte mensual" (Plus) **no están construidos
todavía** — no se costearon acá.

## 6) Rentabilidad a escala de usuarios (CLP/mes, solo margen variable)

| Users | Lite | Go | Plus |
|---|---|---|---|
| 5 | $246.685 | $379.685 | $529.685 |
| 10 | $493.370 | $759.370 | $1.059.370 |
| 30 | $1.480.110 | $2.278.110 | $3.178.110 |
| 50 | $2.466.850 | $3.796.850 | $5.296.850 |
| 100 | $4.933.700 | $7.593.700 | $10.593.700 |

A 5-10 usuarios, el Blotato (~USD 29/mes flat, ≈CLP 26.480) y el hosting
(Railway/Supabase) son un mordisco proporcional real — a 100 usuarios es
ruido. No está restado de la tabla porque no cambia el margen unitario.

## 7) Desglose de costo por proveedor (CLP/mes)

| | OpenAI (imagen) | Kie-Claude | Kie-Seedance (video) | Total |
|---|---|---|---|---|
| Cliente Go/Plus (Rat.IA cuando se active) | $0 | ≈$1.419 | ≈$12.634 | $14.053 |
| Cliente Lite | $0 | $653 | $0 | $653 |
| Cóndor AI (13 carruseles/mes, imagen sí generada, sin trailers) | $2.136 | $787 | $0 | $2.923 |

## 8) Pendiente / próximos pasos

1. Recargar OpenAI para poder usar `gpt-image-2 image-to-image` con
   referencia real de logo (bloquea: logo de Cóndor, logo de Rat.IA,
   reactivación de Rat.IA).
2. Migrar el carrusel de CLIENTES de HTML compuesto a generación 100% IA
   (hoy solo el de Cóndor es 100% IA).
3. Cuando se acabe el saldo actual de Anthropic (~$9 USD cargados el
   27-ago), migrar TODO el texto a Kie, en Opus 5 (no mezcla de modelos).
4. Confirmar el chat de Telegram real de Cóndor y de Rat.IA (hoy Cóndor usa
   un placeholder de canario, Rat.IA está en NULL a propósito).
5. Decidir si la revisión con IA queda exclusiva de Plus o universal.
