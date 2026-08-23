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

**Hecho al 23-ago-2026**
- Memoria privada en tres tablas, todas leídas por el generador.
- Memoria global con umbral de muestra y anonimización en origen.
- Memoria fundacional (`barbara_playbooks`) + CLI para administrarla,
  sembrada con 5 lecciones verificadas en producción.
- Anti-repetición con juez semántico separado.
- Pilares de contenido por cliente, elegidos por deuda.
- 41 tests unitarios; las 8 queries PostgREST nuevas validadas contra
  la base real.

**Pendiente, en orden de valor**
1. **Exponer los pilares en el formulario del portal.** Hoy la columna
   `barbara_formulario.pilares` existe y el motor la respeta, pero no
   hay UI para que staff la complete — sin eso todos los clientes usan
   la mezcla por defecto.
2. **La cuenta propia de Cóndor (`barbara.mjs`) no usa nada de esto.**
   Sólo tiene el `content-log.json` local: ni reglas, ni playbooks, ni
   pilares. Es el caso "en casa de herrero, cuchillo de palo". Requiere
   agregarle los secrets de Supabase a su workflow.
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
