# Entrega infra — campaña Colombia (Alejandro)

Lo que cubre esta rama de las tareas de [`ALEJANDRO.md`](ALEJANDRO.md), cómo se despliega y qué
tiene que hacer cada uno para engancharse. **Léelo antes de desplegar: hay un orden obligatorio.**

## Stack definitivo (queda confirmado)

Seguimos con lo que ya corre en producción, sin piezas nuevas que mantener:

| Capa | Decisión |
|---|---|
| Landing / frontend | **Vercel** (`apps/web-v2`), igual que hoy |
| Base de datos | **Supabase Postgres** (proyecto actual) |
| Backend de leads | **Supabase Edge Functions** (Deno) |
| Automatización | **GitHub Actions** cada 15 min + cola en la BD |
| Email | **Resend** · WhatsApp: **Cloud API** (Meta) |
| Pago | **Mercado Pago** (link/preferencia) |
| Tracking | **Meta Pixel + CAPI** (server-side, con deduplicación) |

Nada de colas externas ni servidor propio: **la cola vive en la base** y el cron la despacha.
Si tu tarea depende de esto, ya puedes casarte con estas librerías.

---

## Qué se agregó

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/campana_colombia.sql` | Schema: campos de campaña en `leads`, contacto en `reuniones`, tabla `mensajes_programados` y **triggers que encolan solos** |
| `services/seguimiento/seguimiento.mjs` | Worker que despacha la cola por email y WhatsApp, detecta no-shows y encola la recuperación |
| `.github/workflows/seguimiento.yml` | Cron cada 15 min del worker |
| `supabase/functions/capi/index.ts` | Conversions API de Meta (server-side) con deduplicación por `event_id` |
| `apps/web-v2/public/assets/js/condor-tracking.js` | Pixel + CAPI + captura de UTMs para la landing |
| `supabase/functions/pago-lead/index.ts` | Link de Mercado Pago para un lead (post-reunión) |
| `supabase/functions/mp-webhook/index.ts` | *(editado)* ahora también registra pagos con referencia `lead:<id>` |
| `supabase/functions/seguimiento-baja/index.ts` | Link de "no quiero más correos" |
| `supabase/functions/agendar-publico/index.ts` | *(editado)* guarda email/whatsapp en columnas propias |

### Cómo funciona el seguimiento (anti no-show)

```
INSERT en leads/reuniones  →  TRIGGER encola en mensajes_programados
                                  ↓ (cada 15 min)
                        services/seguimiento  →  Resend + WhatsApp Cloud API
```

Nadie llama a nada: **Samuel solo hace el INSERT** y el seguimiento sale solo.

| Cuándo | Qué sale | Canales |
|---|---|---|
| Lead pide "que me contacten" | Bienvenida ("te contactamos en < 24 h") | email + WhatsApp |
| Reunión agendada | Confirmación con botón de calendario | email + WhatsApp |
| 24 h antes | Recordatorio | email + WhatsApp |
| 1 h antes | Recordatorio | email + WhatsApp |
| Reunión terminada sin marcar (2 h) | Aviso al equipo para marcar asistencia | email interno |
| Marcada como **no asistió** | Recuperación: al toque y a los 3 días | email + WhatsApp |

Detalles: si mueven la reunión, los recordatorios se mueven con ella; si el lead se da de baja,
se cancela todo lo pendiente; un mismo mensaje no se manda dos veces (índice único en la cola);
los envíos fallidos se reintentan hasta 5 pasadas y después quedan en `estado='error'`.

---

## Contrato `POST /leads` — para Samuel

El backend puede insertar directo en `public.leads` con la service role. **Campos que necesita mi capa:**

```jsonc
{
  "nombre":    "Ana Pérez",          // requerido
  "whatsapp":  "573001234567",       // E.164 SIN '+', solo dígitos. Requerido para el canal WhatsApp
  "email":     "ana@correo.com",     // requerido para el canal email
  "negocio":   "Panadería Ana",      // opcional
  "intencion": "contacto",           // "contacto" (que lo llamen) | "reunion" (agendó)  ← DISPARA el seguimiento
  "pais":      "CO",
  "campana":   "colombia-ads",
  "proyecto":  "pagina-web",

  // Atribución: viene tal cual de window.condorAtribucion() en la landing
  "utm_source": "facebook", "utm_medium": "paid", "utm_campaign": "co-landing-01",
  "utm_content": "creativo-3", "utm_term": null,
  "fbclid": "IwAR...", "fbp": "fb.1.1700000000.1234567890", "fbc": "fb.1.1700000000.IwAR..."
}
```

Reglas del contrato:

1. **`intencion` es obligatorio.** Con `"contacto"` sale la bienvenida automática. Con `"reunion"`
   NO se manda bienvenida: el flujo lo dispara la reunión (evita mandar dos mensajes seguidos).
2. **`whatsapp` en E.164 sin `+`** (Colombia: `57` + 10 dígitos). Si llega con `+`, espacios o guiones,
   límpialo antes: WhatsApp Cloud API rechaza el resto.
3. Si el lead **agenda**, crea la reunión en `public.reuniones` con
   `origen='campana'`, `email`, `whatsapp`, `cliente` (nombre), `fecha_hora` (timestamptz),
   `duracion_min`, `zona='America/Bogota'` y `lead_id` apuntando al lead. Con eso salen confirmación
   y los dos recordatorios. Si ya usas `agendar-publico`, no tienes que hacer nada: ya lo llena.
4. `creado_en` y `estado` tienen default; no los mandes.
5. **Nunca** expongas la service role en el navegador: el form pega a tu endpoint, no a la BD.

Para probar sin mandar mensajes de verdad: deja `RESEND_API_KEY`/`WHATSAPP_TOKEN` sin configurar
en el entorno de prueba — la cola se llena igual y los envíos quedan en `error` con el motivo.

---

## Contrato del tracking — para Joaquín y Max

En la landing, antes de `</head>`:

```html
<script>window.CONDOR_PIXEL_ID = "TU_PIXEL_ID";</script>
<script src="/assets/js/condor-tracking.js" defer></script>
```

Y en los eventos del formulario:

```js
condorTrack("ViewContent", {});                                   // abrió un formulario
condorTrack("Schedule", { email, telefono, nombre, pais: "CO" }); // agendó reunión
condorTrack("Lead",     { email, telefono, nombre, pais: "CO" }); // pidió que lo contacten
```

Al enviar el form, adjunta `condorAtribucion()` al body del `POST /leads`: trae los `utm_*`,
`fbclid`, `fbp` y `fbc` capturados en la primera visita (aunque el usuario ya haya navegado a otra vista).

El evento sale por el Pixel **y** por el servidor con el mismo `event_id`: Meta lo cuenta una sola vez
y sigue llegando aunque el navegador bloquee el Pixel (≈ la mitad de los móviles). El email y el
teléfono viajan **hasheados con SHA-256**, nunca en claro.

Joaquín: el `PIXEL_ID` y el token de CAPI se sacan del mismo Business Manager de la campaña
(Eventos → Conversions API → Generar token de acceso). Pásamelos y los cargo como secrets.

---

## Despliegue — en este orden

**1) Base de datos (primero, sin excepción).** Supabase → SQL Editor → pegar y ejecutar:

```
supabase/migrations/campana_colombia.sql
```

Es idempotente. Sin esto, el paso 2 rompe el agendamiento (`agendar-publico` escribe columnas nuevas).

> Aprovecha de aplicar también `supabase/migrations/reuniones_fix.sql`, que sigue pendiente de
> [la spec del 23-06](../superpowers/specs/2026-06-23-portal-reuniones-fix-design.md) (la migración de arriba
> lo cubre en parte: crea la columna `cliente`, pero **no** cambia las policies de visibilidad).

**2) Edge Functions:**

```bash
supabase functions deploy capi --no-verify-jwt
supabase functions deploy seguimiento-baja --no-verify-jwt
supabase functions deploy pago-lead
supabase functions deploy mp-webhook --no-verify-jwt
supabase functions deploy agendar-publico --no-verify-jwt
```

**3) Secrets de Supabase** (Project Settings → Edge Functions → Secrets), los que falten:

| Secret | Para qué |
|---|---|
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | CAPI. `META_TEST_EVENT_CODE` solo mientras se prueba |
| `MP_ACCESS_TOKEN` | cobro del lead (ya existe) |
| `RESEND_API_KEY`, `EMAIL_FROM` | correos (ya existen) |

**4) Secrets del repo** (GitHub → Settings → Secrets → Actions) para el worker:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` *(ya están)* +
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `ADMIN_NOTIFY`, `WA_TPL_LANG` y los `WA_TPL_*` de abajo.

**5) Plantillas de WhatsApp** (Meta Business → WhatsApp → Plantillas de mensaje). Fuera de la ventana
de 24 h **solo se pueden mandar plantillas aprobadas**, así que hay que crear estas cuatro y poner su
nombre en el secret correspondiente. Aprobación: horas o un par de días.

| Secret | Plantilla | Parámetros | Texto sugerido |
|---|---|---|---|
| `WA_TPL_BIENVENIDA` | `condor_bienvenida` | `{{1}}` nombre | "Hola {{1}} 👋 Somos condor.ai. Recibimos tu solicitud y te contactamos en menos de 24 h." |
| `WA_TPL_CONFIRMACION` | `condor_confirmacion` | `{{1}}` nombre, `{{2}}` fecha | "¡Listo {{1}}! 🎉 Tu reunión quedó agendada para el {{2}}. Te recordamos 24 h y 1 h antes." |
| `WA_TPL_RECORDATORIO_24H` | `condor_recordatorio_24h` | `{{1}}` nombre, `{{2}}` fecha | "Hola {{1}} 👋 Te recordamos tu reunión con condor.ai: {{2}}. Si necesitas moverla, respóndenos." |
| `WA_TPL_RECORDATORIO_1H` | `condor_recordatorio_1h` | `{{1}}` nombre, `{{2}}` hora | "{{1}}, nos vemos en 1 hora ⏰ ({{2}}). Te contactamos por acá." |
| `WA_TPL_NOSHOW` | `condor_reagendar` | `{{1}}` nombre | "Hola {{1}} 👋 No logramos conectarnos. ¿Buscamos otro momento esta semana?" |

Categoría **Utility** (más barata y de aprobación más simple) salvo la de no-show, que va en **Marketing**.
Idioma: `es` (si la creas como `es_CO`, pon `WA_TPL_LANG=es_CO`).
Si un `WA_TPL_*` queda vacío, el worker manda texto libre: solo llega si el lead escribió en las últimas 24 h.

**6) Vercel:** no requiere variables nuevas — `condor-tracking.js` es estático y la config va en el HTML.
Dominio de la landing: `condorai.cl/colombia` (Joaquín confirma la ruta final).

---

## Verificación

```bash
# el worker, contra la base real (no manda nada si no hay cola vencida)
node services/seguimiento/seguimiento.mjs
```

```sql
-- ¿se está llenando la cola?
select plantilla, canal, estado, count(*)
from mensajes_programados group by 1,2,3 order by 1;

-- ¿algo falló?
select id, plantilla, canal, destino, intentos, ultimo_error
from mensajes_programados where estado = 'error' order by id desc limit 20;
```

CAPI: Meta Events Manager → **Probar eventos** con `META_TEST_EVENT_CODE`. Tienen que aparecer los
eventos marcados como *Deduplicados* (navegador + servidor). Si sale "Procesado" dos veces, el
`event_id` no está viajando igual.

## Qué queda fuera de esta entrega

- **Panel/CRM de leads en el portal** (tarea E, es de apoyo): los datos ya están, falta la vista.
  Se puede montar sobre `leads` + `mensajes_programados` cuando existan los endpoints de Samuel.
- **Mensualidad recurrente del cliente de campaña**: cuando el lead paga, hay que crearle la ficha en
  `clientes` para que entre al flujo de cobros que ya existe. Hoy el aviso del pago lo recuerda por correo.
- Nada de esto está aplicado en producción todavía: la migración y los deploys de arriba **los tengo que correr yo**.
