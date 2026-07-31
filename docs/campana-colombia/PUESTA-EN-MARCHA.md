# Puesta en marcha — Campaña Colombia

Lo que falta para que `condorai.cl/colombia` esté lista antes de encender los
anuncios. Comprobado el 31-07-2026 contra los servicios reales.

## Estado actual

| Pieza | Estado |
|---|---|
| Landing `/colombia` | ✅ en vivo, HTTP 200, sin errores JS |
| Código del Pixel + CAPI en la landing | ✅ escrito, **inactivo** (falta el ID) |
| Backend de leads (Apps Script) | ⚠️ escrito, **sin instalar** |
| Sandra / Telegram | ⚠️ el bot existe, falta pegar sus valores |
| Edge Function `capi` | ⚠️ desplegada, responde *"Falta configurar META_PIXEL_ID / META_CAPI_TOKEN"* |
| Recordatorios por correo | ⚠️ dependen del Apps Script |

**Sin los pasos 1 y 2, la campaña gasta sin guardar un solo lead.** El
formulario falla a propósito cuando no hay backend: es preferible a un
"¡Listo!" falso que pierde el lead en silencio.

---

## Paso 1 · Backend de leads (Apps Script) — 5 min

1. `sheets.new` → nombra la hoja **Leads Colombia**.
2. **Extensiones → Apps Script**.
3. Borra todo y pega `docs/campana-colombia/Code.gs` completo.
4. Arriba, en `CONFIG`, completa:
   - `AVISAR_A`: tu correo.
   - `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`: los de Sandra (ver paso 2).
5. Guarda (Ctrl+S).
6. Elige la función **`instalar`** y dale a **Ejecutar**. Autoriza los permisos
   (son de tu propia cuenta). Esto crea las columnas y programa el trigger que
   manda los recordatorios cada hora.
7. Ejecuta **`probarCorreos`**: te llegan los cuatro correos a tu bandeja para
   revisarlos antes de que los reciba un cliente.
8. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
9. Copia la URL (termina en `/exec`).

> Cada vez que cambies el código: **Implementar → Gestionar implementaciones →
> lápiz → Nueva versión**. Guardar no basta.

---

## Paso 2 · Sandra (Telegram)

El bot ya existe y ya avisa desde el portal. Sus valores están como secrets en
GitHub (`SANDRA_TELEGRAM_BOT_TOKEN`, `SANDRA_TELEGRAM_CHAT_ID`), pero **GitHub
no permite volver a leerlos**. Para recuperarlos:

- **Token**: Telegram → chat con **@BotFather** → `/mybots` → el bot de Sandra →
  *API Token*.
- **Chat ID**: abre en el navegador
  `https://api.telegram.org/bot<TOKEN>/getUpdates`, manda cualquier mensaje al
  grupo y recarga. El `chat.id` del grupo aparece ahí (para grupos es negativo,
  por ejemplo `-1001234567890`).

Pega ambos en `CONFIG` del Apps Script (paso 1.4) y vuelve a implementar.

**Prueba:** ejecuta `probarCorreos` en el editor — también dispara el mensaje de
Telegram.

---

## Paso 3 · Secrets en GitHub — 2 min

`Settings → Secrets and variables → Actions → New repository secret`

| Secret | Valor |
|---|---|
| `VITE_LEADS_API` | la URL `/exec` del paso 1.9 |
| `VITE_META_PIXEL_ID` | el ID del Pixel de Meta |

Después: **Actions → Deploy Web (condorai.cl) → Run workflow**.

> Las `VITE_*` se leen al COMPILAR, no en el navegador. Sin redeploy no entran.
> El workflow avisa en el log si alguna falta.

**Comprobar que quedó:** abre `condorai.cl/colombia/`, consola del navegador,
escribe `typeof fbq`. Debe decir `"function"`.

---

## Paso 4 · CAPI (opcional, pero recomendado)

El Pixel del navegador pierde entre un 20% y un 40% de los eventos por
bloqueadores e iOS. La landing ya manda cada evento **también** por servidor a
la Edge Function `capi`, que hoy responde *"Falta configurar"*.

En **Supabase → Project Settings → Edge Functions → Secrets** agrega:

| Secret | De dónde sale |
|---|---|
| `META_PIXEL_ID` | el mismo del paso 3 |
| `META_CAPI_TOKEN` | Events Manager → tu pixel → Configuración → *Conversions API* → **Generar token de acceso** |

Los eventos van con `eventID`, así que Meta **deduplica** navegador + servidor:
no se cuentan dos veces.

---

## Paso 5 · Los 7 creativos

Para saber cuál de los siete trae reuniones, cada anuncio necesita su propia
etiqueta. En Meta Ads, en el campo **URL del sitio web** de cada anuncio:

```
https://condorai.cl/colombia/?utm_source=meta&utm_medium=paid&utm_campaign=co_web_ago&utm_content=creativo_01
```

Cambia solo `utm_content` en cada uno: `creativo_01` … `creativo_07`.

Tres detalles que importan:

1. **La barra final** (`/colombia/`) no es opcional. Sin ella hay un 301 y
   algunos rastreadores pierden los parámetros en el salto.
2. Esos parámetros llegan a la hoja en las columnas **Campaña** y **Creativo**,
   y también al mensaje de Telegram. Así ves qué creativo trajo cada reunión,
   no solo cuál tuvo más clics.
3. Usa el **mismo pixel** para todas las campañas (Chile, Perú, Colombia) y
   sepáralas por campaña. Un pixel por campaña reparte el aprendizaje y ninguna
   sale nunca de la fase de aprendizaje.

**Optimización:** una vez que entren los primeros eventos, configura el conjunto
de anuncios para optimizar por **Schedule** (agendó) y no por clic ni por
`Lead`. `Schedule` es la conversión que vale; `Lead` es "que me escriban", que
convierte bastante peor.

---

## Paso 6 · Verificación antes de encender

Con todo cargado, en este orden:

1. Abre `condorai.cl/colombia/` en el celular.
2. Agenda una reunión de prueba con tus datos reales.
3. Comprueba, uno por uno:
   - [ ] Llega el correo de confirmación (revisa spam la primera vez).
   - [ ] Llega el aviso a tu correo interno.
   - [ ] **Sandra avisa en el grupo de Telegram** con todos los datos.
   - [ ] Aparece la fila en la hoja, con Campaña y Creativo llenos.
   - [ ] En **Events Manager → Prueba de eventos** aparece `Schedule`.
4. Vuelve a abrir el formulario: **el horario que acabas de tomar tiene que
   verse tachado**.
5. Borra la fila de prueba de la hoja.

Recién ahí enciende los anuncios.

---

## Cosas que conviene saber

- **La agenda no está conectada a un calendario real.** Los horarios ocupados
  salen de la hoja. Si bloqueas tiempo en Google Calendar, la landing no se
  entera.
- **Gmail gratuito manda 100 correos al día**; Workspace, 1500. Con esta
  campaña sobra, pero si los correos dejan de salir, es por ahí.
- **El teléfono sigue siendo +56.** El FAQ ya dice de frente que la oficina está
  en Chile y que se atiende en horario colombiano, así que no contradice nada,
  pero un número +57 es la señal de confianza que más falta para este comprador.
- **Ley 1581**: la autorización que firma el visitante cubre coordinar ESA
  reunión. Mandarle promociones después necesita otra autorización.
