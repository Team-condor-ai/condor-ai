# Bitácora — Landing de campaña `/colombia`

Registro de lo que se hizo sobre la landing, **por qué** y qué quedó pendiente.
Contexto del proyecto en [`PROYECTO.md`](PROYECTO.md) · tareas por persona en los `NOMBRE.md`.

> Se anota lo que **no** se deduce del código: la razón de cada decisión, lo que se
> midió y los bugs cuya causa no era la obvia. Lo que sí se deduce del diff, no.

---

## 2026-07-31 · Reescritura "La página honesta" + material Apple/Howden

Cambio completo de la landing, por decisión de negocio. Referencia visual dada
por Joaquín (mockup claro, cálido, dos CTA grandes, sección de equipo).

### Qué se sacó y por qué

**De 9 secciones a 4. De 9,2 pantallas de scroll a 3,4.**
Fuera: precios y planes, FAQ, reseñas, proceso en 4 pasos, el descenso en video,
el cristal oscuro, las facetas, la barra fija.

Y tres cosas que la página **ya no dice, a propósito**:
- **Precios** — se hablan en la reunión, con el proyecto sobre la mesa.
- **Que usamos IA** — es *cómo* trabajamos, no lo que el cliente compra.
- **Plazos de entrega** — prometer días sin conocer el proyecto es mentir.

Ninguna de las tres sobrevive al primer "depende", y prometerlas en la landing
convierte peor y quema la reunión. Lo que queda: quiénes somos (fotos reales de
equipo y oficina), qué hicimos (sitios en vivo) y dos formas de hablarnos.
Estructura: hero → quiénes somos → trabajo → cierre.

### Dirección de arte

Claro y cálido, **contra el patrón del rubro**: toda agencia de tecnología en
LATAM usa oscuro con neón. La luz cálida hace que parezca un negocio con oficina
y no un SaaS — y es la luz de nuestras fotos, así que página y fotos leen como
una sola cosa. El color vive **solo** en el fondo y en el CTA verde; todo el
texto es tinta casi negra. Esa disciplina es lo que deja que el botón mande.

El portátil del hero es el **mockup real con fondo transparente** (PNG → WebP,
1.344 KB → 148 KB, alfa intacto), apoyado directo sobre el lavado de color. Sin
marco: el recuadro blanco alrededor es lo que delata a un mockup pegado.

### Material — port del sistema glass de Howden

Se trae la receta exacta de `plataforma-howden-main/frontend/app/globals.css`
(`.glass-card` / `.glass-panel` / `.liquid-glint`): doble capa (gradiente 135° +
base sólida), `saturate(1.8)`, borde blanco 0.6, inset highlight. **Re-tintada
para fondo cálido**: el blanco puro sobre durazno se ve azulado y sucio.

Tres niveles, porque el peso del material **es** jerarquía (apple-design §12):
`--co-mat-cta` (ligero → accionable) · `--co-mat` (tarjetas) · `--co-mat-panel`
(estructural, más blur y más sombra).

**Error corregido midiendo:** la primera calibración quedó demasiado densa
(0.62/0.46) y el cristal dejó de dejar pasar el lavado de color — se veía como
una tarjeta blanca, que es justo lo que este material no debe ser. Se bajó a los
valores de Howden (0.40/0.18 sobre base 0.30) con un punto de calidez.

Regla dura respetada: **nunca cristal sobre cristal**. Las fotos y las capturas
van en marcos opacos dentro de las tarjetas de vidrio; apilar translúcidos mata
la legibilidad.

**Glint:** mismo efecto de Howden, distinta duración. Allá es loop infinito de
5 s porque son pantallas de trabajo; acá cruza **una vez** al revelarse y se
calla — en una landing, un brillo cada 5 s para siempre es el cliché de
plantilla de venta y compite con el CTA. Escalonado 90 ms (verificado: delays
0.35 / 0.44 / 0.53 s).

### Tipografía y filosofía Apple

Texto en **sistema Apple** (`-apple-system` → SF Pro), igual que Howden: ya trae
optical sizing y tablas de tracking, y no cuesta un pedido de red. Única webfont:
la serif itálica del titular (Zodiak), que es la firma de la página.

Tracking **específico por tamaño** (§15): display `-0.035em`, h2 `-0.028em`,
cuerpo ~0, y **positivo** en los textos chicos (kicker `+0.04em`, legal
`+0.006em`). Un `letter-spacing` único está mal en algún tamaño por definición.

Otros puntos aplicados: respuesta en `:active` y no al soltar (§1); la flecha del
CTA adelanta el gesto en hover (§8); el modal **materializa** con blur + escala a
la vez en vez de subir opacidad (§12); scrim que atenúa para la tarea modal (§12).

### Medido, no supuesto

**Contraste real** (píxel renderizado detrás del texto, no el color declarado —
sobre cristal el fondo efectivo es la mezcla): cuerpo sobre panel **7,27**,
h2 **18,35**, pill de vidrio **18,38**, lead **6,9**, chip **6,72**. Todos AA
con holgura.

**Las tres señales de accesibilidad** (§14), que son independientes:
`prefers-reduced-transparency` → blur off y fondo sólido 0.97 ·
`prefers-contrast: more` → fondos sólidos y bordes definidos ·
`prefers-reduced-motion` → sin desplazamientos ni glint.

Verificado además: 4 secciones, cero desborde horizontal, formulario de lead
completo (mismo contrato con el Sheet, tracking intacto), modal por encima.

### El portátil, y por qué se monta sobre la tarjeta

Entró el mockup real con fondo transparente que pasó Joaquín (PNG → WebP,
1.344 KB → 148 KB, alfa intacto) en reemplazo del portátil dibujado en CSS.

**Se superpone al panel de "quiénes somos"** — 58 px en desktop, 18 px en móvil.
Es lo único que puede hacerse con un recorte y no con una captura rectangular:
las dos secciones dejan de ser bloques apilados y se leen como una escena.
Detalle que salió gratis: el panel tiene `backdrop-filter`, que difumina lo que
queda *detrás*; como el portátil se pinta por delante entra nítido sobre el
cristal esmerilado, y ese contraste nítido-sobre-difuso es lo que hace ver el
vidrio.

### El fondo, en tres pasos (cada uno por un problema real)

**1. El color no era un lugar, era un filtro.** `.co-luz` estaba en `fixed`, así
que se veía idéntico pasara lo que pasara con el scroll. Pasó a `absolute` sobre
toda la página: bajar es atravesar el color, y las tarjetas de cristal cruzan
zonas distintas — que es lo que el material necesita para no verse plano.

**2. Círculos → manchas irregulares.** Un `radial-gradient` solo sabe hacer
elipses concéntricas, y ese es exactamente el fondo que genera cualquier
plantilla. Ahora son seis elementos con silueta propia (`border-radius` de ocho
valores, que es la única forma en CSS de un contorno asimétrico real), cada uno
girado y estirado.

*Costo, y cómo se resolvió:* seis superficies de blur grandes costaban un frame
de **1.182 ms** al rasterizar. Se dibuja la capa a un tercio del tamaño y se
escala ×3 → el blur trabaja sobre nueve veces menos píxeles. Bajó a **24 ms**.
Se puede hacer porque el resultado ya es difuso: escalar algo borroso no se nota.

**3. El grano.** Tres intentos, y el que importa es *por qué* fallaron los dos
primeros. El fondo tiene luminancia media 249 (casi blanco):

| técnica | aporte de textura |
|---|---|
| opacidad simple sobre ruido gris | +0,28 — no hace grano, hace un velo gris |
| `mix-blend-mode: overlay` | +0,33 — sobre base tan clara actúa como `screen` y satura a blanco |
| `multiply` con ruido casi blanco | +4,11 — sobre fondo claro el grano tiene que ser oscuro |

Y después, por pedido explícito: **el grano solo donde hay color**. Eso obligó a
invertir la técnica — de *dibujar* ruido encima a *recortar* la capa de color
con una máscara de ruido. Donde hay mancha se la come y se ve el grano; donde
solo hay crema recorta crema sobre crema, o sea nada. El grano pasó a ser una
propiedad del color, que es lo que es en una foto: está en la emulsión, no en el
aire. Medido: crema **1,46** con máscara contra **1,52** sin ella (idéntico), y
sobre color **9,19** contra **2,55**.

*Detalle de robustez:* la máscara genera **blanco** con alfa ruidosa, no negro.
Si un navegador la interpretara por luminancia en vez de por alfa, con RGB negro
la luminancia sería 0 en todas partes y **desaparecería el fondo entero**.

### El diagnóstico del móvil que estaba equivocado

Reporte: "el gradiente no se ve en el celular, probablemente están fuera de la
pantalla". Medido con una rejilla de distancia al crema, **las manchas no estaban
fuera de pantalla**: móvil daba valores *iguales o mayores* que desktop (134
contra 126 en la fila superior).

El problema real eran **huecos verticales** — las filas 20 %, 50 % y 70 % daban
casi cero y la página se apagaba a tramos. Se solaparon las manchas para que el
recorrido sea continuo. Además, en 390 px de ancho lo que entraba era la *cola*
del degradado y no su núcleo: se redujo el desborde lateral y se ensancharon.

*Y eso tuvo un costo que hubo que pagar:* traer el color al centro en móvil bajó
el lead a 4,7:1 y el rubro a 4,55. En desktop el texto vive en la columna central
y las manchas entran por los costados, así que nunca coinciden; **en móvil el
texto ocupa todo el ancho y no hay zona segura**. Se bajó el pico (no la
cobertura) solo en móvil y volvieron a 4,83–6,81.

### Movimiento

**Firma:** el portátil deriva con el scroll (44 px), así el hero gana profundidad
y el momento en que se apoya sobre la tarjeta se siente como que *aterriza*. Es
la única animación compleja a propósito — varias compitiendo es lo que hace ver
una landing sobrecargada. Solo escribe `transform`, va limitada por `rAF`, se
apaga con `IntersectionObserver` fuera de pantalla y no reescribe si no cambió.

El resto es soporte: entrada escalonada en el hero (0,05 → 0,36 s, en el orden en
que hay que leer), sub-revelado encadenado dentro del panel de equipo, superficies
que *se materializan* (desplazamiento + escala, no solo fade) y botones que se
hunden más rápido de lo que vuelven — con una sola duración el botón se siente
gomoso al presionar.

Costo medido scrolleando en móvil con throttling 6×: mediana **6,1 ms**, idéntica
a la línea base.

### Prueba social — con un seguro puesto

Riel horizontal en bucle continuo, justo antes del CTA final (es el último
argumento antes de pedir los datos). La lista va duplicada y la pista se desplaza
exactamente −50 %, así el bucle no tiene costura; las copias llevan `aria-hidden`
para que un lector de pantalla no lea cada testimonio dos veces. Se detiene al
pasar el puntero.

**Las tarjetas del riel NO llevan cristal, deliberadamente.** Mover un elemento
con `backdrop-filter` obliga a re-muestrear el fondo cada frame y es lo más caro
de esta página. Son superficies sólidas: más baratas, y además evitan apilar
translúcido sobre translúcido.

**Los testimonios son de maqueta y NO PUEDEN publicarse por accidente:** la lista
sale vacía en producción (`import.meta.env.DEV`) y la sección no se renderiza sin
datos. Verificado en el bundle real: ninguno de los cinco nombres inventados
aparece en el JS de producción. El motivo es de fondo, no de forma — esta página
se juega entera a "somos reales, estas son nuestras caras"; testimonios
inventados destruyen esa propuesta más rápido que ninguna otra cosa, y engañarían
a alguien que está a punto de dejar sus datos.

Los rubros se eligieron para que peguen con cada frase (una clínica valora los
cambios rápidos, un restaurante que le lleguen pedidos, un estudio jurídico
hablar siempre con la misma persona). **Sin ciudad**, por decisión: nombre +
rubro + ubicación identifica un negocio concreto. Mantener así también cuando
sean reales, salvo que el cliente pida aparecer con la suya.

---

## 2026-07-30 · Tracking, fondo en movimiento y sistema de cristal

Cierre de la fase de frontend previa a producción. Tres frentes: **medición de la
campaña**, **dirección de arte del fondo** y **calidad de material de las tarjetas**.

### 1. Tracking de campaña conectado (bloqueaba el lanzamiento)

La landing no tenía Pixel. El script de Alejandro
(`apps/web-v2/public/assets/js/condor-tracking.js`) existía desde su entrega pero
nadie lo estaba cargando.

- Se carga **solo en `/colombia`** (el resto del sitio no es tráfico pagado).
- Eventos: `PageView`, `ViewContent` (abre un formulario), `Schedule` (agenda) y
  `Lead` (pide contacto). Navegador + servidor con el mismo `event_id`, así Meta
  deduplica y el evento llega aunque el móvil bloquee el Pixel (≈ la mitad).
- **Bug encontrado midiendo:** `PageView` se disparaba **dos veces**. El guard
  preguntaba por `window.condorTrack`, pero el script es `async`: entre inyectarlo
  y que ejecute hay una ventana en la que esa variable todavía no existe, y con
  StrictMode (doble montaje en dev) se inyectaba dos veces. O sea, **tráfico
  inflado al doble** en el reporte a los inversionistas. Ahora el guard pregunta
  por la etiqueta `<script>` en el DOM.

### 2. El formulario ya no finge éxito

Sin `VITE_LEADS_API`, el formulario mostraba *"¡Listo! Te enviamos el horario"* y
el lead se evaporaba. Como esa variable **todavía no está seteada en Vercel**, eso
es exactamente lo que pasaría hoy con tráfico pagado.

- En producción sin backend: **falla visible** y ofrece WhatsApp con el mensaje
  prellenado. El modo demo queda solo en desarrollo.
- La conversión se reporta a Meta **solo si el lead se guardó**. Si Meta optimiza
  sobre envíos fallidos, compra tráfico que nunca llega a la hoja.
- Atribución completa: `condorAtribucion()` persiste UTMs + `fbclid`/`fbp`/`fbc`
  desde la primera visita y viajan al Sheet (antes solo se leía la URL del momento).

### 3. El bug que explicaba por qué la página se veía plana

Buscando por qué no aparecía el fondo nuevo, se pintó `.co-bg` de **verde puro** y
la página no cambió un píxel. **La capa de fondo llevaba invisible desde siempre.**

`.co` es `position: relative` con `z-index: auto`, o sea **no** es un contexto de
apilamiento: sus hijos con z-index negativo se pintaban en la raíz del documento,
por debajo del `background` opaco de `.co`. Los focos de luz de marca y el grano
que el propio comentario del archivo describía nunca se renderizaron — la página
era un `#070b1f` plano.

Eso explica el síntoma real: **el glass no tenía nada que refractar**. Un
`backdrop-filter` sobre color plano da una tarjeta gris, que es la razón #1 por la
que el glassmorphism se ve barato.

Arreglo: `z-index: 0` en `.co`. Tiene que ser z-index y **no** `isolation: isolate`
— isolation crea además un *backdrop root* y mataría el `backdrop-filter` del visor.

### 4. Fondo: el descenso atado al scroll

Video de 8 s (Higgsfield): de sobre las nubes hasta las luces de una ciudad en un
valle. **El scroll es la cámara.** La marca es un cóndor: desciende.

- **No se usa como `<video>`.** El original pesa 39 MB y scrubbear un MP4 exige
  seek cuadro a cuadro: se traba en Android y en Safari iOS no arranca hasta tener
  el archivo entero en buffer. Se convirtió a secuencia WebP — cada cuadro es
  independiente y "buscar" es un `drawImage`.
- Dos sets, cada cliente baja solo el suyo:
  móvil **9:16 recortado, 540×960, 40 cuadros, 686 KB** · desktop 16:9, 48, 1.3 MB.
- **El vuelo dura 2,5 pantallas, no la página entera.** Era el plan original y
  estaba mal: se probó el plano final detrás del hero y el titular queda ilegible
  sobre la ciudad encendida. Ningún velo lo arregla sin apagar la toma. Ahora
  aterriza y se desvanece; el resto scrollea sobre el fondo de noche de siempre.
- El velo de contraste tenía un **agujero**: bajaba a 0.3 justo a la altura del
  párrafo del hero, porque se diseñó asumiendo cielo oscuro ahí. En el plano final
  ahí está la ciudad. Ya no baja de 0.5 en ninguna parte.
- Detrás, **facetas de cristal** descendiendo (tres capas de profundidad) que
  reemplazan los tres `radial-gradient` de colores — el "aurora mesh" que sale por
  defecto en cualquier plantilla generada por IA y que hacía ver la página a
  genérica. Bajaron a la mitad de opacidad cuando entró el video: dos animaciones
  de fondo compitiendo es lo que hace ver una página sobrecargada.

### 5. Sistema de cristal (las tarjetas se veían transparentes, no de vidrio)

La causa era un token: `--co-glass` estaba en **5 % de blanco**. Sobre un fondo
fotográfico eso no es cristal, es transparencia.

- Tres densidades (`--co-glass` 58 % / `--co-glass-alta` 66 % / `--co-glass-densa`
  74 %) **tintadas sobre el azul de marca**, no en blanco: un velo blanco sobre
  noche da el gris lechoso de plantilla. El blur no cuesta más por ser más opaco.
- `--co-realce`: el par de líneas internas de 1 px que hacen leer el canto como
  espesor y no como borde dibujado. Aplicado a las 6 superficies.
- **Canto de luz angular** en el visor: `conic-gradient` recortado a un anillo de
  1,4 px con dos máscaras que se restan. Un `border` no sabe tener degradado
  angular; el canto de un cristal real no refleja igual en todo su perímetro, y ese
  borde parejo es la razón #2 del glass barato.
  *Ojo:* la primera versión quedó **iluminada al revés** — en `conic-gradient` el
  ángulo del degradado y la posición en pantalla no coinciden. Se detectó recién
  comparando las esquinas a 4×. Los comentarios del CSS están en posición de
  pantalla, no en ángulo de gradiente.
- **Grano sobre el cristal**: el `.co-grain` global va detrás, así que el
  `backdrop-filter` se lo comía y la cara quedaba lisa (lee a plástico digital).
- **Cierre (`.co-cierre-in`)**: no tenía `backdrop-filter`, era solo un gradiente
  translúcido. Cae justo donde el descenso termina —sobre la ciudad encendida— y el
  copy competía con las luces de las calles. Ahora es cristal denso de verdad.

### 6. Glint animado

Una banda de luz cruza la tarjeta al entrar en pantalla. Tres reglas para que no se
lea a barato, que es el riesgo real del efecto:

- **No es loop.** Un brillo cada 3 s eternamente es el cliché de plantilla de
  venta. Cruza una vez y se calla. Se dispara con `.in`, la clase que ya pone
  `useReveal` — cero JS nuevo.
- **Escalonado 90 ms** por posición (`--i`): lee como una luz que barre, no como un
  efecto aplicado a N cajas.
- Solo `transform` sobre un pseudo-elemento: no toca el `backdrop-filter`.

### 7. Conversión: barra fija de acción (celular)

Entre el hero y el cierre había ~5 pantallas **sin ningún CTA visible**, y cada
pantalla sin acción es gente que se va. La barra mantiene la reunión a un toque.

Aparece pasado el hero, se retira en el cierre (para no pelearse con el CTA grande)
y el pie reserva su alto. Usa `IntersectionObserver` y no el evento de scroll,
porque durante el scroll el hilo ya está repintando el descenso. Oculta con
`visibility`, no solo `opacity`: si no, el primer Tab enfoca un botón invisible.

### 8. Vitrina de demos en celular

Ya era carrusel horizontal con scroll-snap. El problema era otro: la tarjeta medía
**79 %** del ancho, la siguiente casi no asomaba y no se leía que hubiera más.
Ahora **72 %** (siempre asoma la de al lado), captura 16/11.5 y copy a 2 líneas.
La sección bajó de **792 → 755 px** y el CTA subió al alcance del pulgar.

### Rendimiento — medido, no supuesto

Móvil 390×844, CPU throttling 6×, **scrolleando** (que es cuando se paga):

| | mediana | p95 |
|---|---|---|
| Primera versión del descenso | 12,0 ms | 24,3 ms |
| **Versión final** | **6,1 ms** | 18,2 ms |
| Sin descenso (línea base) | 6,1 ms | 6,2 ms |

La mitad del sobrecosto **no era el canvas**: era escribir la opacidad del velo en
cada frame aunque el valor no cambiara. Con ~15 superficies de `backdrop-filter`
encima, cada escritura las obliga a re-desenfocarse todas. Ahora los valores se
redondean a centésimas y solo se escriben si cambiaron. Lo otro fue bajar el techo
de DPR del canvas a 1.0 en móvil.

**Límite conocido:** el throttling de CPU no toca la GPU, y el re-desenfoque del
`backdrop-filter` es trabajo de GPU. Esto prueba que el hilo principal va sobrado;
no prueba que un Android de gama media vaya igual. Quedan picos de ~24 ms cuando
cambia el cuadro, unas pocas veces por segundo mientras se scrollea.

### Verificado

`prefers-reduced-motion` (facetas pausadas en composición repartida, descenso
congelado, glint apagado) · modal y header por encima · foco de teclado visible ·
cero desborde horizontal · formulario de lead completo (`Schedule` y `Lead` con
`event_id` deduplicado) · fallback `@supports not (backdrop-filter)`.

---

## Pendiente

### Bloquea producción — solo Joaquín puede

| Variable | De dónde sale | Sin ella |
|---|---|---|
| `VITE_LEADS_API` | Sheet + Apps Script (receta en [`Code.gs`](Code.gs)) | El formulario **muestra error** y ofrece WhatsApp |
| `VITE_META_PIXEL_ID` | Business Manager → Eventos | Campaña **sin optimización ni atribución** |

Ambas se hornean en el build: hay que **redesplegar** después de cargarlas
(ver [`apps/web-v2/.env.example`](../../apps/web-v2/.env.example)).
Para que el evento salga también por servidor, Ale necesita `META_CAPI_TOKEN` como
secret de Supabase y desplegar la función `capi` ([`ALEJANDRO-ENTREGA.md`](ALEJANDRO-ENTREGA.md) §3).

### Testimonios reales

La sección de prueba social **no aparece en producción** hasta que existan. Para
activarla: reemplazar el contenido de `RESENAS` en `Colombia.tsx` por testimonios
reales, con permiso del cliente. Formato: frase + nombre + rubro (sin ciudad).

### Ya no aplica

La contradicción de la sección de precios (*"El más elegido"* en un plan y todo el
peso visual en otro) **desapareció con la reescritura**: la página ya no muestra
precios ni planes. Si alguna vez vuelven, revisar que la prueba social y la
jerarquía visual apunten al mismo plan.
