# Mercado Pago v2 · Condor

Proyecto Supabase objetivo: `ylsqvmggycfijzfvguzq`  
Webhook: `https://ylsqvmggycfijzfvguzq.supabase.co/functions/v1/mp-webhook`  
Portal de retorno: `https://condorai.cl/acceso/pago/resultado`

## Qué cubre

- Checkout Pro para cobros únicos, siempre creado desde backend.
- Saldo real después de abonos parciales.
- Mensualidades automáticas con alta, pausa, reanudación y cancelación real.
- Retorno al portal verificado contra la API; la URL nunca confirma dinero sola.
- Webhook firmado, conciliación idempotente y bitácora técnica.
- Estados pendiente, aprobado, rechazado, reembolso parcial/total y contracargo.
- Comisión y neto recibido disponibles en Cobros y en el CSV.
- Validación automática de país/moneda de la cuenta de Mercado Pago.

## Aplicación en Supabase

1. Aplicar las migraciones hasta `20260822_mercadopago_v2.sql`.
2. Configurar secretos sin pegarlos en documentación ni commits:

   ```powershell
   npx supabase secrets set `
     MP_ACCESS_TOKEN=<token> `
     MP_WEBHOOK_SECRET=<firma> `
     PORTAL_URL=https://condorai.cl/acceso `
     --project-ref ylsqvmggycfijzfvguzq
   ```

3. Desplegar:

   ```powershell
   npx supabase functions deploy crear-pago --project-ref ylsqvmggycfijzfvguzq
   npx supabase functions deploy verificar-pago --project-ref ylsqvmggycfijzfvguzq
   npx supabase functions deploy gestionar-suscripcion --project-ref ylsqvmggycfijzfvguzq
   npx supabase functions deploy pago-lead --project-ref ylsqvmggycfijzfvguzq
   npx supabase functions deploy crear-plan-suscripcion --project-ref ylsqvmggycfijzfvguzq
   npx supabase functions deploy mp-webhook --no-verify-jwt --project-ref ylsqvmggycfijzfvguzq
   ```

4. En Mercado Pago > Tus integraciones > Webhooks, usar la URL indicada arriba
   tanto para pruebas como para producción y activar:

   - Pagos (`payment`).
   - Vinculación de suscripción (`subscription_preapproval`).
   - Pago recurrente (`subscription_authorized_payment`).

5. Confirmar que la firma visible en Mercado Pago sea la misma cargada como
   `MP_WEBHOOK_SECRET`. El webhook falla cerrado si falta o no coincide.

## Prueba segura

### Portal local

```powershell
cd D:\Proyectos\condor-ai\apps\web-v2
npm run dev
```

Abrir `http://localhost:5173/acceso` y entrar con:

- Correo: `cliente@demo.cl`
- Clave: cualquiera

El cobro “Campaña de lanzamiento” permite recorrer generación, retorno y
confirmación sin Mercado Pago ni dinero real. Este bypass solo existe en el
servidor de desarrollo; no entra al build de producción.

### Cuenta de cliente de prueba

Crea (o repone la clave de) `cliente.prueba@condorai.cl` en el Supabase real,
con su ficha y un cobro de $1.000 para recorrer. Es idempotente: correrlo dos
veces no duplica nada.

```powershell
cd D:\Proyectos\condor-ai\apps\web-v2
$env:SUPABASE_URL       = "https://ylsqvmggycfijzfvguzq.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role del proyecto>"
$env:TEST_CLIENT_PASSWORD      = "<clave de 12+ caracteres>"
$env:TEST_CLIENT_MENSUAL       = "1"   # agrega tambien una mensualidad
node scripts/crear-cliente-prueba.mjs
```

La service role key salta RLS entera: va por variable de entorno de la sesión,
nunca a un archivo ni a un commit. Cierra la terminal al terminar.

`TEST_CLIENT_MENSUAL=1` agrega un cobro mensual **pendiente**, que es el único
estado en que el portal ofrece "Activar con Mercado Pago". Sin él solo se puede
probar Checkout Pro, no el alta de suscripción.

### Sandbox de Mercado Pago

1. Crear comprador de prueba en Mercado Pago del mismo país que la cuenta
   vendedora.
2. Crear un cliente y un cobro CLP pequeño en el Supabase nuevo.
3. Generar el link desde la ficha del cliente.
4. Abrir una sesión incógnita con el comprador de prueba y usar una tarjeta de
   prueba oficial.
5. Verificar:
   - retorno a `/acceso/pago/resultado`;
   - `pagos.estado = pagado`;
   - `cobros.estado = pagado`;
   - una fila procesada en `mercadopago_eventos`;
   - monto, comisión y neto conciliados;
   - una sola notificación por pago aunque el webhook se reintente.

## Corte desde la cuenta antigua

No se borran enlaces o suscripciones masivamente. Un link pendiente antiguo se
reemplaza desde “Ver link > Regenerar en cuenta actual”. Una suscripción viva
se cancela primero en la cuenta antigua y luego se crea la nueva; dos
suscripciones activas producirían doble cobro.
