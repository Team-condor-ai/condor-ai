# Bitácora · 24-ago-2026 — Bárbara

Día largo de Bárbara: se migró el motor de generación de Higgsfield a Kie.ai,
se rediseñaron los planes comerciales desde cero, y se construyó el módulo
completo de Bárbara dentro del portal Cóndor como una app aparte.

> La bitácora general del día (que incluye el diagnóstico de las fallas de la
> mañana y la investigación de proveedores) está en
> [BITACORA-2026-08-24.md](./BITACORA-2026-08-24.md). Este archivo es el
> detalle de lo que se construyó de Bárbara.

---

## 1. Migración de Higgsfield a Kie.ai — hecha y verificada en vivo

Higgsfield tumbó a Bárbara cuatro veces (29-jun, 22-ago, 23-ago, 24-ago),
siempre por lo mismo: OAuth que caduca o confusión de cuenta. El 24-ago la
sesión del CI resultó estar en una cuenta **free con 0 créditos**, no la Plus
que se había migrado el 22.

**Lo que se construyó:** `services/barbara/kie-api.mjs` — key estática
(`Authorization: Bearer`), patrón asíncrono `createTask` → `recordInfo`.
12 tests propios; los 125 tests de Bárbara siguen pasando.

**Modelos nuevos, decisión de Joaquín:**
- Imagen: **`gpt-image-2`** (OpenAI) — nunca más Nano Banana. Guardado como
  memoria importante.
- Video: **`seedance-2-0`** (ByteDance), subiendo desde `seedance1_5`.

**Verificado de verdad**, no asumido: se cargó la key real, se llamó a
`verificarCredenciales` (ok), y se generó una imagen de prueba real que
volvió con URL válida. El formato de respuesta que se había documentado sin
confirmar resultó correcto.

**Se descartó Seedance 2.5**: ~2x más caro que 2.0 por mejoras incrementales
que no se notan en un clip de 5s. Tampoco valió la promo de -28% en 1080p de
Kie (vigente hasta 17-sep): incluso con descuento sale ~4x más caro por
segundo, y 2.5 genera nativo en 480p/720p — el 1080p ahí es upscale.

**Por qué Kie y no ir directo a OpenAI + BytePlus:** el precio es
prácticamente idéntico yendo directo. La ventaja de Kie es una sola cuenta y
una sola key para los dos modelos, y BytePlus pide verificación regional al
registrarse.

## 2. Planes comerciales — rediseñados, tres veces

Pasó por tres posicionamientos antes de asentarse:

1. Pyme chica (precios bajos, máxima accesibilidad).
2. Pyme mediana con "márgenes brutales" (precios altos, media buyer en Plus).
3. **Final: pyme chica-mediana que evaluó y descartó contratar** — ni tan
   barato que se sienta app de emprendedor, ni tan caro que compita con una
   agencia.

**Decisiones de alcance:** se sacó la gestión de campañas pagadas del plan
Plus (Bárbara hoy es solo contenido orgánico), se sacaron onboarding y
soporte continuo del modelo de costos, pago por MercadoPago, y se agregó un
chatbot con Sonnet — con volumen derivado de la arquitectura real (hasta 3
rondas de corrección + 2 llamadas de memoria por pieza), no de una
suposición.

**Precios finales:** Bárbara $49.990 · Go $89.990 · Plus $119.990/mes.
Márgenes 74% / 63% / 71% con todo adentro. Detalle en
`services/barbara/ESTRATEGIA.md` § 6.

**Nota abierta:** sin la gestión de campañas, Plus cuesta casi lo mismo que
Go — el salto de precio se justifica hoy por features de servicio, no por más
contenido.

## 3. Módulo de Bárbara en el portal Cóndor

Pedido: que Bárbara se sienta como **entrar a otra app** dentro del portal, no
una página más. Referencia: 5 capturas de un mockup oscuro con acento lima.

**Estructura:** `Portal.tsx` resuelve las rutas de Bárbara **antes** de
`Marco` — bypass completo del menú lateral y el chrome de Cóndor. El módulo
trae su propio riel de navegación (Inicio / Contenido / Ajustes) y su propio
botón de volver.

**Un solo componente (`BarbaraModulo`) para las dos audiencias**: un cliente
externo viendo su Bárbara y staff viendo la de Cóndor. Nada de dos
experiencias paralelas que puedan divergir.

**Cómo se re-viste todo lo reutilizado sin tocarlo:** el módulo redefine las
MISMAS variables CSS que ya usa el portal (`--panel`, `--texto`, `--azul`…),
así que `BrandBookEditor`, las tablas, `.pill`, `.campo` y el grafo de
memoria heredan el look oscuro+lima automáticamente.

**Acceso directo:** clic en "Bárbara" del menú → cae directo en el portal
completo, sin lista intermedia ni botón "Ver portal". La administración de
todos los clientes sigue en `/acceso/agentes-ia`, alcanzable desde Ajustes.

**Transición de "cambio de mundo":** View Transitions API nativa, con curva
`cubic-bezier(.16,1,.3,1)` (aproximación de resorte critically damped) y
opacidad + escala leve para que la pantalla nueva se sienta materializar en
vez de solo desvanecerse. Respeta `prefers-reduced-motion`.

**Qué es real y qué se dijo honestamente que no lo es:**
- El chat **funciona de verdad**: dispara el mismo mecanismo que Telegram
  (registra el mensaje, destila la regla, cuenta el intento contra las 3
  correcciones, dispara el reintento en GitHub Actions).
- Calendario, Análisis y Biblioteca usan datos reales de `barbara_memoria`.
- **No se inventaron métricas de Instagram/TikTok** — esa integración no
  existe, y la pantalla lo dice explícitamente en vez de mostrar números
  falsos.
- Biblioteca es honesta sobre que no hay almacenamiento persistente de
  imágenes (viven en Telegram): muestra el registro buscable, no una galería
  falsa.

**Verificación visual real** (Playwright + cuenta de staff temporal,
eliminada al terminar): se recorrieron las 6 secciones con capturas
comparadas contra el mockup. Se encontraron y corrigieron dos bugs reales que
no aparecían al compilar:
1. El riel salía con fondo gris claro — `.portal-app aside{background:
   rgba(var(--vidrio),.72)}` le ganaba en especificidad.
2. "Agosto **De** 2026" — `text-transform:capitalize` titlecasea cada palabra
   en español.

## 4. Log de prompts + créditos de Kie en el portal

- **`barbara_prompts`**: una fila por cada llamada real de generación (la
  inicial y cada reintento), enlazada a la pieza que produjo. Pedido de
  Joaquín: poder examinar el prompt exacto detrás de una pieza corregida para
  buscar patrones.
- **Créditos de Kie.ai** en la pantalla de Créditos API, con saldo real
  sincronizado cada 6h y botón "Revelar" (Edge Function gateada por
  `es_admin()`, auto-ocultado a los 25s, sin policy de select directo).

---

## Estado al cierre

| Pieza | Estado |
|---|---|
| Cliente Kie.ai (`kie-api.mjs`) | ✅ en repo, key cargada, generación real probada |
| Módulo del portal | ✅ desplegado y verificado visualmente |
| Transición de entrada | ✅ desplegada, confirmada en vivo |
| Chat real (Edge Function) | ✅ desplegada |
| Log de prompts + credenciales | ⚠️ código listo, **falta correr la migración SQL** |
| Cliente "Cóndor.AI" en Bárbara | ✅ creado, `activo: false` a propósito |

---

## Hacia dónde seguimos

### Bloqueante inmediato
1. **Correr `20260824_barbara_prompts_y_credenciales.sql`** en el SQL Editor
   de Supabase (copiado a Descargas). Sin eso, el log de prompts y el botón
   "Revelar" de Kie no funcionan.

### Rat.IA como cliente de Bárbara (lo próximo grande)
2. Rat.IA pasa a usar el sistema de Bárbara para publicar: ofertas y errores
   de precio generados con **`gpt-image-2` vía Kie** en vez de las plantillas
   compuestas en Python (las del 23-ago quedaron feas al renderizar el texto),
   y subida automática con **Blotato**. Construir todo y avisar a Joaquín
   ANTES del paso final de testear en Instagram real.

### Para activar la Bárbara de Cóndor de verdad
3. Crear el chat de Telegram, cargar su `telegram_chat_id`, y recién ahí poner
   `activo: true` — hoy está apagada a propósito para que el cron no empiece a
   generar y gastar créditos sin que nadie lo sepa.

### Decisiones de producto pendientes
4. Definir si Plus necesita más contenido tangible para justificar el salto de
   precio sobre Go (hoy cuestan casi lo mismo de generar).
5. Actualizar la landing pública (`productos/barbara/index.html`) — sigue con
   los precios de lanzamiento viejos ($36.990/$46.990/$54.990).

### Deuda técnica anotada
6. El contenido **propio de Cóndor** (`barbara.mjs`) corre por un pipeline
   separado (`content-log.json`, sin fila en `barbara_clientes`). Para que la
   Bárbara de Cóndor muestre su contenido real en el portal falta un puente
   entre los dos mundos.
7. `reels.mjs` sigue en Higgsfield (`veo3_1` con avatar fijo) — no se migró a
   Kie porque quedaba fuera del alcance de la conversación de costos.
