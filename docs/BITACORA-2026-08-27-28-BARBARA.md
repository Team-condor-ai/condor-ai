# Bitácora · 27/28-ago-2026 — Bárbara: por qué no publicaba, precios reales, y separación a repo propio

Sesión larga (noche del 27 hasta la madrugada del 28) que arrancó con "por
qué Bárbara no está subiendo contenido" y terminó con el primer paso real de
sacarla del monorepo, precios de proveedores verificados (no estimados), y
los márgenes exactos de los tres planes comerciales.

## 1. Por qué Bárbara no estaba publicando

Dos causas distintas, encontradas por separado:

- **Créditos de Anthropic agotados** desde el 24-ago. Cada corrida
  programada moría con `"Your credit balance is too low"`. Joaquín recargó
  $9 USD el 27-ago.
- **`barbara-publicar-automatico.yml` le faltaba el paso `npm ci`** — sin
  `node_modules`, moría con `ERR_MODULE_NOT_FOUND` (importa `sharp`) antes
  de decidir si tocaba publicar. Corregido.

De paso: el calendario de publicación había cambiado de Lun/Mié/Jue/Sáb a
Lun/Mié/Vie la noche del 26-ago sin que la memoria del equipo se hubiera
actualizado — quedó registrado.

## 2. Rat.IA dado de alta como segundo cliente de Bárbara

Con datos **reales** sacados del propio código del vigía de precios
(`ratia_templates_oferta.py`), no inventados: paleta lima `#AAD804` / tinta
`#111111` / Poppins. `telegram_chat_id` se dejó en `NULL` a propósito —
sin él, el motor ni genera, así que no gasta nada hasta activarlo.

Aparte se aclaró una confusión: el sistema de alertas de precio de Rat.IA
(`ratia-reenvio` en Railway, ofertas/errores/convenios bancarios) es **un
sistema completamente distinto**, ya en vivo, que no pasa por Bárbara.

## 3. Limpieza de gasto

- **Noticias IA eliminado** (workflow, generador en Haiku, 18 páginas
  publicadas) — sección muerta que seguía gastando cada lunes.
- **`meta-analyzer.yml` desactivado.**
- Regla nueva de Joaquín: **nunca Haiku** en ningún proyecto, solo Sonnet 5
  u Opus. Violaciones encontradas y anotadas (sin corregir todavía):
  `meta-analyzer.mjs`, la función de diagnóstico vieja de `condorweb-diagnostico`.

## 4. Precios reales de proveedores (no estimados)

Joaquín pasó capturas del dashboard de Kie.ai (27-ago). Hallazgo grande:
**Kie revende Claude Opus 5 y Sonnet 5 con 57-60% de descuento real sobre
el precio oficial de Anthropic** (verificado cruzando contra la tabla propia
de Anthropic, no solo el dashboard de Kie) — Opus 5 vía Kie sale casi al
precio de Sonnet 5 directo.

Para imagen (`gpt-image-2`) el hallazgo fue al revés: el precio "oficial"
que muestra Kie parece ser el de Fal.ai (un revendedor caro), no el de
OpenAI real. El precio oficial real de OpenAI (**$0.03/1K · $0.05/2K ·
$0.08/4K**) es básicamente igual al de Kie — ir directo a OpenAI no cuesta
más, y da la función de referencia de imagen real (logos) que el cliente
de Kie en Bárbara no tiene implementada (`kie-api.mjs` solo hace
text-to-image).

## 5. Márgenes exactos con los planes reales

Los planes vigentes son **Bárbara Lite ($49.990) / Go ($89.990) / Plus
($119.990)** — reemplazan cualquier número usado en sesiones anteriores.
Con el costo real por pieza (incluyendo el video, que se había subestimado
antes):

| Plan | Costo real/mes | Margen/mes | Margen % |
|---|---|---|---|
| Lite | ≈$653 CLP | ≈$49.337 CLP | 98.7% |
| Go | ≈$14.053 CLP | ≈$75.937 CLP | 84.4% |
| Plus | ≈$14.053 CLP | ≈$105.937 CLP | 88.3% |

El UGC (video) es ~90% del costo variable por cliente — 4 piezas de video
cuestan más que las otras 32 piezas del plan juntas. Detalle completo,
desglose por proveedor y rentabilidad a escala (5 a 100 usuarios) en
[`2026-08-27-stack-costos-barbara.md`](./2026-08-27-stack-costos-barbara.md).

## 6. Decisión de stack

| Función | Ahora | Cuando se recargue OpenAI | Cuando se acabe Anthropic |
|---|---|---|---|
| Texto | Anthropic directo | sin cambio | **Kie, todo en Opus 5** |
| Imagen | Kie | **OpenAI directo** | Kie |
| Video | Kie | sin cambio | sin cambio |

**Regla dura mientras el proveedor de imagen sea Kie**: ningún prompt
referencia ni pide dibujar un logo — solo la paleta de colores. El logo real
espera a tener referencia de imagen real vía OpenAI.

Cóndor deja de usar reels/trailers — solo los 3 carruseles semanales.

## 7. Cóndor: logo pausado, verificado funcionando, hora movida

- `pegarLogoCondor` pausado (una línea, reversible) hasta tener OpenAI.
- Al verificar con una corrida real se encontró y arregló un bug real:
  `barbara.yml` usaba `npm install` en vez de `npm ci`, dejando el árbol de
  git sucio antes del `git pull --rebase` final.
- **Verificado de punta a punta con una corrida real** (`workflow_dispatch`,
  éxito).
- Publicación movida de las 16:00 a las **17:00 Chile** (pedido de
  Joaquín) — cron, mensajes de Telegram y comentarios actualizados.

## 8. Separación de Bárbara a su propio repo — paso 1 hecho

Decidido el 24-ago, sin ejecutar hasta hoy:

- `git subtree split -P services/barbara` (**347 commits**, historia real
  preservada) mergeado a `Team-condor-ai/barbara`.
- Los **12** workflows (no 5 como se pensaba en agosto) copiados con las
  rutas reescritas — el código vive en la raíz del repo nuevo, no en un
  subdirectorio.
- Los 12 quedaron **desactivados a propósito** (sin secrets, fallarían
  solos por el cron y generarían ruido).

**Lo que falta, en orden:**

1. Migrar los secrets al repo nuevo (Joaquín, mañana) — `ANTHROPIC_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `KIE_API_KEY`, `HF_CREDS_KEY`,
   `HIGGSFIELD_ACCESS_TOKEN`, `HIGGSFIELD_REFRESH_TOKEN`,
   `HIGGSFIELD_WORKSPACE_ID`, `BARBARA_ALERTAS_CHAT_ID`.
2. Mover las **31 tablas** `barbara_*` (recontadas hoy, no las 7 de la nota
   de agosto) al schema `barbara` — **no se tocó a propósito**: rompe el
   portal en vivo (14 archivos que consultan `.from("barbara_x")` desde el
   navegador de clientes reales) si no se hace junto con el punto 3.
3. Actualizar esos 14 archivos del portal a `.schema("barbara").from("x")`.
4. Activar los workflows del repo nuevo y recién ahí apagar los del
   monorepo.

`condor-ai` sigue siendo la fuente que realmente corre — nada de esto
interrumpió a Cóndor.

## Pendientes que quedan abiertos

- Recargar OpenAI (bloquea: logo real de Cóndor y de Rat.IA, reactivar
  Rat.IA, migrar el carrusel de clientes de HTML a IA pura).
- Logo real de Rat.IA (no se encontró uno propio en el repo).
- Chat de Telegram real de Cóndor (hoy usa un placeholder de canario) y de
  Rat.IA si se quiere separado.
- Filtro de "productos virales/tecnológicos/alta demanda" para las ofertas
  de Rat.IA (definido el criterio, no construido).
- Edición automática de video estilo CapCut (subtítulos, cortes) para el
  UGC de clientes — en investigación, sin decidir entre autohospedado
  (ffmpeg + alineación forzada) o API de terceros (VEED).
- Rotar 3 keys pegadas en chat en sesiones anteriores (Kie, Anthropic,
  Blotato) — tema de seguridad, no de saldo.
- Decidir si "Edición de video automática" y "Reporte mensual" (Plus) se
  construyen — no están costeados porque no existen todavía.
