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

## Capa de datos

**Supabase (Postgres + extensión `pgvector`)** — ya es la base de
datos usada en el resto del stack de Cóndor, no se suma una
dependencia nueva.

- **Un proyecto compartido**, no uno por cliente — más barato y simple
  de operar. Aislamiento con `client_id` + Row Level Security (patrón
  estándar de SaaS multi-tenant), no separación física de bases.
- `memories`: id, `client_id` (null si es global/fundacional), `tier`
  (`privada` / `global` / `fundacional`), contenido, `embedding`
  (vector), tags, confianza/veces-repetido, fecha.
- `candidatos_globales`: staging antes de promoción a memoria global,
  con contador de clientes distintos donde apareció el patrón.
- `memory_links`: opcional, relaciones explícitas entre notas (igual
  que los `[[enlaces]]` de la memoria de Obsidian).

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

## Anti-repetición: de lista de texto a memoria semántica

Estado actual: `content-log.json` pasa las últimas 15 entradas como
texto plano y confía en que el modelo "note" el parecido — funciona al
principio, pero falla con el tiempo (a las 50-60 piezas, dos ángulos
semánticamente parecidos con palabras distintas pasan sin que el
modelo lo note).

**Mejora**: antes de aceptar un ángulo nuevo, generar su embedding y
compararlo contra los embeddings de los últimos ~6 meses de ángulos de
ESE cliente. Si la similitud supera un umbral (ej. 85%), se rechaza
automáticamente y se le pide al modelo un ángulo distinto — no depende
de que el modelo "se dé cuenta" solo.

**Para que las ideas no se vuelvan genéricas con el tiempo**: extender
el patrón que ya usa la serie `noticias` (`investiga: true`, búsqueda
web real) a los demás pilares — antes de generar, una búsqueda rápida
de tendencias/novedades del rubro del cliente.

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

## Fases de construcción

**Fase 1 (semanas, sobre lo que ya hay en Supabase)**
- Memoria semilla desde el formulario de onboarding.
- Cada publicación + su resultado se guarda como memoria nueva.
- Retrieval por fuerza bruta (sin HNSW todavía).
- Piloto en un solo cliente (Cóndor mismo, ya que Bárbara ya publica
  ahí) antes de justificar invertir en fases siguientes.

**Fase 2 (un par de meses)**
- Separar memoria en núcleo fijo (tono de marca, reglas que nunca
  cambian) + memoria dinámica recuperada por relevancia — el mismo
  split que usa la investigación real de agentes con memoria
  (Generative Agents, Stanford 2023: relevancia + recencia +
  importancia para decidir qué recordar).
- Loop de refuerzo: patrones que funcionaron (más engagement) pesan
  más en decisiones futuras; los que fallaron se guardan también, para
  no repetir el error.
- Sistema de pilares configurable por cliente (ver ESTRATEGIA.md).
- Anti-repetición semántica (embeddings, no lista de texto).

**Fase 3 (cuando algún cliente acumule volumen real)**
- Migrar de fuerza bruta a índice HNSW real en `pgvector` — cambio de
  índice, no reescritura.
- Edición de video con subtítulos/música, vía Higgsfield si lo cubre,
  o `ffmpeg` casero si no.

## Referencias de investigación externa usadas para estas decisiones

- HNSW (Hierarchical Navigable Small World) — familia de algoritmos de
  grafo jerárquico con "greedy routing", mismo linaje conceptual que
  los algoritmos de ruteo de mapas (Contraction Hierarchies, A*/ALT)
  aplicado a búsqueda de vectores.
- Sistemas de memoria de agentes ya existentes en la industria (para
  no reinventar ni sobreestimar la novedad): Mem0 (capas por scope),
  Zep/Graphiti (grafo de conocimiento temporal), Letta/MemGPT (memoria
  tipo sistema operativo, el modelo pagina su propio contexto).
