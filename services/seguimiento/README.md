# Seguimiento (anti no-show)

Worker que despacha la cola `mensajes_programados`: confirmación, recordatorio **24 h** y **1 h**
antes de la reunión, bienvenida al lead que pidió contacto y secuencia de recuperación si no asiste.
Manda por **email (Resend)** y **WhatsApp (Cloud API)**.

Corre cada 15 min con GitHub Actions (`.github/workflows/seguimiento.yml`).
Local: `node services/seguimiento/seguimiento.mjs` con las variables del workflow.

**Nadie lo llama a mano:** los triggers de `supabase/migrations/campana_colombia.sql` llenan la cola
cuando se inserta un lead o una reunión. Si se mueve la reunión, los recordatorios se mueven con ella.

Test sin tocar nada real (intercepta Supabase, Resend y Meta): `node services/seguimiento/test-seguimiento.mjs`.

Detalle de plantillas de WhatsApp, secrets y despliegue: [`docs/campana-colombia/ALEJANDRO-ENTREGA.md`](../../docs/campana-colombia/ALEJANDRO-ENTREGA.md).
