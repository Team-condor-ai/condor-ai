# Mercado Pago en producción

Proyecto Supabase: `ylsqvmggycfijzfvguzq`

Portal: `https://condorai.cl/acceso`
Última verificación: 22-ago-2026

## Estado actual

- La migración `20260822_mercadopago_v2.sql` está aplicada.
- Están activas las seis Edge Functions de pagos: `crear-pago`,
  `verificar-pago`, `gestionar-suscripcion`, `pago-lead`,
  `crear-plan-suscripcion` y `mp-webhook`.
- Supabase tiene configurados `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y
  `PORTAL_URL`.
- Las funciones privadas exigen JWT y el webhook rechaza notificaciones sin una
  firma HMAC válida.
- El portal muestra el motivo real cuando una Edge Function responde con error.

Los valores secretos nunca deben guardarse en el repositorio. La presencia de
los secretos se puede comprobar con `supabase secrets list`, pero Supabase solo
devuelve sus nombres y hashes.

## Configuración obligatoria en Mercado Pago

En **Tus integraciones → aplicación de Cóndor → Webhooks**, configurar:

```text
https://ylsqvmggycfijzfvguzq.supabase.co/functions/v1/mp-webhook
```

Activar estos eventos:

- `payment`: pagos únicos.
- `subscription_preapproval`: alta, pausa y baja de mensualidades.
- `subscription_authorized_payment`: cada cobro automático mensual.

La clave secreta de esa pantalla debe coincidir con `MP_WEBHOOK_SECRET` en
Supabase. El Access Token debe ser de las credenciales de **producción** de una
cuenta chilena (`site_id = MLC`). No configurar `MP_ENVIRONMENT=sandbox` en el
proyecto productivo.

## Redespliegue o rotación de credenciales

El script `scripts/desplegar-mercadopago.ps1` valida primero la cuenta de
Mercado Pago, carga los secretos y despliega las seis funciones.

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<personal access token de Supabase>"
$env:MP_ACCESS_TOKEN = "<access token de producción>"
$env:MP_WEBHOOK_SECRET = "<firma secreta del webhook>"
./scripts/desplegar-mercadopago.ps1
```

Las variables viven solo en la sesión de PowerShell. Cerrar la terminal al
terminar. Para un proyecto Supabase nuevo también deben aplicarse las
migraciones del repositorio.

## Prueba funcional segura

1. Crear un cobro único de `$1.000 CLP` para un cliente interno de prueba.
2. Generar el enlace y confirmar que abre el checkout normal de Mercado Pago,
   no un dominio `sandbox`.
3. Pagar con un medio real y comprobar el retorno a
   `/acceso/pago/resultado`.
4. Verificar que `pagos.estado` y `cobros.estado` queden en `pagado`, que exista
   un evento con `firma_valida = true` y `procesado = true`, y que se registren
   `mp_fee_amount` y `mp_net_received`.
5. Confirmar que llegaron los avisos al cliente y al equipo.

No se debe hacer una compra real solo para probar un despliegue automatizado:
esa prueba requiere un cliente interno autorizado y luego debe conciliarse como
una operación real.

Para mensualidades, crear un cobro `tipo = 'mensual'`, autorizarlo y comprobar
que `mp_preapproval_id` quede guardado. La autorización no es un pago; la fila
en `pagos` aparece cuando llega `subscription_authorized_payment`.

## Diagnóstico rápido

Las funciones privadas deben responder `401` cuando se invocan sin sesión. Un
`404` indica que falta el despliegue. El webhook debe responder `401` a un evento
con identificador pero sin firma válida.

| Mensaje | Acción |
|---|---|
| `Falta configurar MP_ACCESS_TOKEN` | Cargar el secreto en el proyecto correcto. |
| `La cuenta ... cobra en ...; este cobro está en CLP` | Usar una cuenta de Mercado Pago chilena. |
| `este enlace pertenece a la integración anterior` | Regenerar el enlace desde la ficha del cliente. |
| `column cobros.mp_cuenta_id does not exist` | Aplicar `20260822_mercadopago_v2.sql`. |
| `cancela la suscripción activa antes de crear otra` | Cancelar primero la mensualidad anterior para evitar doble cobro. |

No desplegar `mp-webhook` con verificación JWT: Mercado Pago no envía un JWT de
Supabase; la protección del endpoint es la firma HMAC. Tampoco deben pegarse
tokens o claves en commits, issues o chats.
