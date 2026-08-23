# Stack técnico — memoria en capas, anti-repetición y video

> Ver [OBJETIVO.md](./OBJETIVO.md) para la visión y [ESTRATEGIA.md](./ESTRATEGIA.md)
> para el contenido y los planes comerciales. Este documento es el
> "cómo se construye" — arquitectura, decisiones y fases.

## Decisión de modelo: Sonnet en todo

Sin Haiku en ningún paso — clasificación, embeddings-adyacente y
generación creativa, todo con Sonnet. Es más caro por llamada de
clasificación (10-20x vs. Haiku), pero esas llamadas son texto corto,
así que el impacto real en el costo total del sistema es marginal.
Decisión de calidad tomada a propósito, no un descuido de costo.

## Capa de datos — lo que REALMENTE existe

Supabase (proyecto `ylsqvmggycfijzfvguzq`), un proyecto compartido con
aislamiento por `barbara_cliente_id` + RLS. Al 23-ago-2026 las tablas
en uso son:

| Tabla | Capa | Quién escribe | Quién lee |
|---|---|---|---|
| `barbara_reglas` | privada | webhook de Telegram (correcciones) | `clientes.mjs` |
| `barbara_memoria_nodos` | privada | portal (grafo) + Edge Function del perfil | `clientes.mjs` *(desde 23-ago)* |
| `barbara_memoria` | privada | `clientes.mjs` al cerrar cada pieza | `clientes.mjs`, `patrones.mjs` |
| `barbara_patrones` | global | `patrones.mjs` (destila, nace apagado) | `clientes.mjs` |
| `barbara_playbooks` | fundacional | staff a mano (CLI `playbooks.mjs`) | `clientes.mjs` *(nueva)* |

Prioridad en el prompt, de más a menos peso: perfil y gustos/datos de
la marca → reglas que la marca corrigió → patrones globales →
playbooks de la casa. El encabezado de los playbooks se lo dice
explícito al modelo: *si choca con lo que pidió esta marca, manda la
marca*.

`pgvector` **no está en uso** — ver la sección de anti-repetición para
por qué (falta decidir proveedor de embeddings).

## Capa de escritura

Cada vez que Bárbara publica algo, recibe una corrección, o llegan
métricas de resultado de una pieza:

1. Una llamada a Sonnet escribe la nota de memoria estructurada (qué
   pasó, por qué importa, cómo aplicarlo — mismo formato que ya usa la
   memoria de este proyecto).
2. Otra llamada a Sonnet clasifica si es candidata a memoria global
   (patrón general) o queda solo privada (gusto personal).
3. Se genera el embedding del contenido y se guarda.

## Capa de recuperación

Al momento de generar contenido nuevo:

1. Se embeddea el input/tarea actual.
2. Búsqueda por similitud contra: memorias privadas del cliente (top
   8), patrones globales (top 4), biblioteca fundacional (top 3).
3. **Fuerza bruta al principio** — para el volumen de notas de un
   cliente individual (cientos, no millones), comparar contra todas es
   instantáneo. **HNSW** (índice nativo de `pgvector`) se activa recién
   cuando el volumen lo justifique — no antes. Es optimización para
   escala grande; usarla ahora sería complejidad prematura sin
   beneficio real.
4. **Prioridad explícita en el prompt del director**: privada > global
   > fundacional. Instrucción literal al modelo: si hay conflicto
   entre un patrón general y la preferencia específica del cliente,
   siempre gana el cliente.

## Anti-repetición: juez semántico separado

**Construido el 23-ago-2026** (`angulos.mjs`, conectado a `barbara.mjs`
y a `clientes.mjs`).

El problema con lo que había: la anti-repetición era una línea dentro
del prompt del director ("acá van las últimas 15, no repitas"). Dos
fallas concretas — el generador se auto-vigilaba (mismo modelo, misma
llamada, juzgando lo que acababa de inventar), y la ventana de 15
piezas se agota en cinco semanas a 3 carruseles semanales.

Cómo quedó, en dos llamadas con roles separados:

1. `proponer()` pide N ángulos candidatos, cortos y baratos — no el
   carrusel entero. Si hay que descartar, se descarta una línea de
   texto y no una generación de 8000 tokens.
2. `juzgar()` es una llamada cuyo **único** trabajo es comparar los
   candidatos contra el historial largo (80 piezas). Quien juzga no es
   quien propuso.

Recién con el ángulo elegido se gasta la generación completa. Si el
juez rechaza todo, se reintenta pasándole explícitamente qué se
descartó y por qué; si se agotan los intentos se publica igual el mejor
disponible y **se avisa por Telegram** — quedarse sin publicar es peor
que publicar algo parecido, pero el equipo tiene que enterarse de que
esa serie está quedándose sin terreno.

En un reintento de corrección NO se elige ángulo nuevo, a propósito: el
cliente pidió corregir algo puntual de esa pieza, y cambiarle el ángulo
sería el "rehacer en vez de corregir" que `correccion.mjs` vino a
arreglar.

**Por qué un juez y no embeddings** (decisión, no olvido): lo de manual
sería vectorizar cada ángulo y comparar por coseno. Anthropic no tiene
endpoint de embeddings, así que hacerlo implica contratar un proveedor
nuevo (Voyage, OpenAI…), y la orden explícita es que todo el motor sea
Sonnet. Un juez dedicado alcanza de sobra para cientos de ángulos, que
es el orden de magnitud real de un cliente. Si alguna marca acumula
miles, ahí conviene vectorizar — **esa sigue siendo la decisión
pendiente**, y requiere aprobar un proveedor de embeddings.

**Para que las ideas no se vuelvan genéricas con el tiempo**: extender
el patrón que ya usa la serie `noticias` (`investiga: true`, búsqueda
web real) a los demás pilares — antes de generar, una búsqueda rápida
de tendencias/novedades del rubro del cliente. *Pendiente.*

## Video: revisar Higgsfield antes de construir nada nuevo

Verificado por búsqueda (23-ago-2026): Higgsfield ya incluye, nativo,
subtítulos quemados en el video y música/efectos "trending"
sincronizados a imagen, dentro de su editor de video corto. **Primer
paso antes de escribir código**: confirmar si el CLI/API que Bárbara ya
usa para generar clips expone esos mismos endpoints — sería activar un
flag, no construir un pipeline nuevo.

**Si Higgsfield no lo cubre bien vía API/CLI**, la alternativa casera
es liviana porque `ffmpeg` ya es una dependencia real del proyecto
(`unirClips` en `motor.mjs` ya lo usa para unir clips con audio):

- **Subtítulos**: no hace falta transcribir el audio con IA — Bárbara
  ya sabe el guion que le pidió al video generar (el campo
  `escena`/`texto_en_pantalla` del plan). Se calcula el timing
  proporcional a la duración de cada clip y se queman los subtítulos
  con el filtro `drawtext` de `ffmpeg`, sin costo de transcripción.
- **Música**: biblioteca chica de pistas libres de regalías (5-10
  pistas por "mood": urgente/cálido/profesional), elegida por el
  director según el tono del video, mezclada bajo el audio original
  (volumen reducido para no tapar la voz).
- **Efectos**: transiciones/whooshes en los cortes entre clips, mismo
  filtro de audio mezclado con `ffmpeg`.

## Orquestación

Se sigue usando lo que ya existe (GitHub Actions, patrón de
`barbara.yml`) — la memoria es un paso más del pipeline: antes de
generar, "traer memorias relevantes"; después de publicar y tener
métricas, "escribir memoria nueva". No se suma un orquestador nuevo
tipo n8n.

## Estado y qué falta

### Verificación real del juez de ángulos (23-ago-2026)

Corrida `32621181121`, serie `barbara_producto`, contra el historial real
de la cuenta. El juez descartó dos ángulos y explicó por qué:

- Contra *"La IA como el primer empleado que trabaja 24/7 sin descanso,
  errores ni excusas"* → *"Ambos venden la misma idea de que la
  IA/herramienta nunca falla, no se enferma ni se va, a diferencia de un
  humano."*
- Contra *"El costo oculto de NO tener IA: cada día que esperas, tu
  competencia avanza"* → *"Misma idea central de que la inacción hace que
  el cliente se vaya con la competencia; sólo cambia el canal
  (Instagram) pero el mensaje de fondo es idéntico."*

Ninguno de los dos comparte palabras con el original — es exactamente el
parecido que la lista de 15 en texto plano dejaba pasar. El ángulo
finalmente elegido fue sobre la fricción con las agencias, sin
antecedente en el historial.

## Higgsfield: del CLI con OAuth a la API con key estática

**El problema de raíz.** El CLI (`higgsfield generate create …`) se
autentica con OAuth: un `access_token` que caduca y un `refresh_token`
que **rota en cada uso**. Cada vez que la cadena se corta, alguien tiene
que volver a loguearse por navegador. Pasó el 29-jun, el 22-ago y otra
vez el 23-ago, dejando a Bárbara muda días enteros. Con decenas de
clientes eso deja de ser un incidente y pasa a ser el trabajo fijo de
alguien.

**La solución.** Higgsfield tiene una **API oficial** en
`https://platform.higgsfield.ai` con credenciales **estáticas** —
`Authorization: Key {id}:{secret}` — que no caducan ni rotan. Verificado
el 23-ago-2026 contra su OpenAPI y contra el endpoint en vivo (devuelve
401 con clave falsa, o sea el formato es el correcto).

Tiene los dos modelos que Bárbara ya usa:

| Uso | CLI (antes) | API (ahora) |
|---|---|---|
| Carruseles | `nano_banana_2` | `POST /nano-banana` — acepta `4:5` y `png` |
| UGC en video | `seedance1_5` | `POST /bytedance/seedance/v1/lite/text-to-video` — `9:16`, 720p |

Es asíncrona: el POST devuelve un `request_id` y se consulta
`/requests/{id}/status` hasta `completed`. Hay webhooks, pero no se usan
— GitHub Actions no tiene dónde recibirlos y el job igual está esperando.

**Costo**: no hay tarifa aparte. La API consume los mismos créditos del
plan mensual (hoy Plus). No cambia lo que se paga.

**Migración segura**: `higgsfield-api.mjs` no reemplaza al CLI por su
cuenta. `genImagen`/`genVideo` prefieren la API **sólo si existen las
credenciales**; si no, siguen con el CLI igual que hasta hoy. Se puede
probar sin arriesgar lo que ya funciona.

### Qué falta para activarla (una sola vez, y nunca más)

1. Crear la key en https://cloud.higgsfield.ai (sección API).
2. Verificarla sin gastar créditos:
   ```
   export HIGGSFIELD_API_KEY_ID=...
   export HIGGSFIELD_API_KEY_SECRET=...
   node services/barbara/api-check.mjs            # sólo valida
   node services/barbara/api-check.mjs --generar  # genera 1 imagen real
   ```
3. Subirlas como secrets (los workflows ya las leen):
   ```
   gh secret set HIGGSFIELD_API_KEY_ID -R Team-condor-ai/condor-ai
   gh secret set HIGGSFIELD_API_KEY_SECRET -R Team-condor-ai/condor-ai
   ```

Una vez hecho, se puede borrar todo el andamiaje de OAuth: el paso de
autenticación del workflow, `hf-creds.enc`, `reauth.sh`, el secret
`HF_CREDS_KEY` y el paso que re-cifra el token rotado. **No se borró
todavía a propósito** — primero hay que ver la API funcionando en una
corrida real.

### ⚠️ Bloqueo activo (hasta que se haga lo de arriba): Higgsfield sin autenticación

Desde el 22-ago-2026 por la tarde, **Bárbara no puede generar imágenes**:
el token de Higgsfield murió ("Not authenticated"). No es un problema de
código y no se arregla reintentando — requiere un login OAuth por
navegador, que sólo puede hacer una persona:

```
higgsfield auth login          # abre el navegador
bash services/barbara/reauth.sh # re-cifra, rota el secret y pushea
```

El CLI local tiene que ser **0.2.x** (CI está pineado a 0.2.3); el que
está instalado hoy en el PC es 1.1.23, que usa otro flujo de auth. El
aviso de Telegram ya sale con estos pasos adentro.

**Hecho al 23-ago-2026**
- Memoria privada en tres tablas, todas leídas por el generador.
- Memoria global con umbral de muestra y anonimización en origen.
- Memoria fundacional (`barbara_playbooks`) + CLI para administrarla,
  sembrada con 5 lecciones verificadas en producción.
- Anti-repetición con juez semántico separado, **verificado en vivo**.
- Pilares de contenido por cliente, elegidos por deuda, con UI en el
  portal (cliente edita, staff ve el porcentaje resultante).
- La cuenta propia de Cóndor también lee los playbooks (opcional: si el
  workflow no trae los secrets de Supabase, corre igual).
- 45 tests unitarios; las 8 queries PostgREST nuevas validadas contra
  la base real; `tsc` y `vite build` limpios.

**Pendiente, en orden de valor**
1. **Crear la API key de Higgsfield** (ver arriba). Levanta a Bárbara y
   además elimina para siempre el re-login manual. Es lo único que
   bloquea todo lo demás.
2. **La cuenta propia de Cóndor sigue sin pilares ni memoria propia.**
   Ya lee playbooks, pero el reparto de series sigue fijo en código y no
   tiene `barbara_reglas` ni aprende de las correcciones del equipo.
3. **Investigación web para los demás pilares**, no sólo para
   `noticias`.
4. **Edición de video** con subtítulos/música — primero confirmar si el
   CLI de Higgsfield ya lo expone (ver sección de video).
5. **Embeddings/pgvector**, sólo si alguna marca acumula miles de
   ángulos y sólo tras aprobar un proveedor.

Referencia de diseño para el paso 2 cuando se haga: el split entre
núcleo fijo (tono de marca, reglas inmutables) y memoria dinámica
recuperada por relevancia es el mismo que usa la investigación de
agentes con memoria (Generative Agents, Stanford 2023: relevancia +
recencia + importancia).

## Referencias de investigación externa usadas para estas decisiones

- HNSW (Hierarchical Navigable Small World) — familia de algoritmos de
  grafo jerárquico con "greedy routing", mismo linaje conceptual que
  los algoritmos de ruteo de mapas (Contraction Hierarchies, A*/ALT)
  aplicado a búsqueda de vectores.
- Sistemas de memoria de agentes ya existentes en la industria (para
  no reinventar ni sobreestimar la novedad): Mem0 (capas por scope),
  Zep/Graphiti (grafo de conocimiento temporal), Letta/MemGPT (memoria
  tipo sistema operativo, el modelo pagina su propio contexto).
