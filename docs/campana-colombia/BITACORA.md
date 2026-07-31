# Bitácora — Landing de campaña `/colombia`

Registro de lo que se hizo sobre la landing, **por qué** y qué quedó pendiente.
Contexto del proyecto en [`PROYECTO.md`](PROYECTO.md) · tareas por persona en los `NOMBRE.md`.

> Se anota lo que **no** se deduce del código: la razón de cada decisión, lo que se
> midió y los bugs cuya causa no era la obvia. Lo que sí se deduce del diff, no.

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

### Decisión de negocio — precios

En la sección de precios hay **dos señales que se contradicen**: *"El más elegido"*
está en **Web Profesional ($1.250.000)**, pero todo el peso visual —tinte verde,
botón primario, badge destacado— está en **Landing Express ($400.000)**. La prueba
social apunta a un plan y el diseño empuja al otro, que factura 3 veces menos.

No se cambió porque **cuál plan empujar es decisión de negocio, no de diseño**. Se
resuelve moviendo `destacado: true` entre planes en `Colombia.tsx`.
