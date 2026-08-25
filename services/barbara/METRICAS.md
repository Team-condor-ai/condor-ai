# Métricas reales de Bárbara

Blotato publica y confirma estados, pero su API no entrega analítica social. Por eso la captura queda desacoplada: cualquier recolector autorizado (Meta Insights, TikTok Analytics, Metricool o un importador interno) manda sólo contadores agregados a `barbara-metricas`.

## Contrato de entrada

```json
{
  "programacion_id": "uuid-de-barbara_programaciones",
  "capturado_en": "2026-08-25T15:00:00Z",
  "metricas": {
    "likes": 121,
    "comments": 8,
    "shares": 4,
    "saves": 12,
    "reach": 1800,
    "views": 2100,
    "clicks": 9
  }
}
```

La firma es HMAC-SHA256 en hexadecimal sobre `<timestamp>.<body JSON exacto>`, usando `BARBARA_METRICAS_WEBHOOK_SECRET`. Se envía en `x-barbara-signature`; el timestamp Unix va en `x-barbara-timestamp` y caduca a los cinco minutos.

No se aceptan ni se guardan usuarios, comentarios, perfiles o datos de audiencia. La función normaliza aliases, la RPC exige una publicación realmente confirmada y la base hace idempotentes los hitos. El worker de Telegram reclama cada aviso con lock, reintenta con backoff y nunca llama éxito a una entrega fallida.

## Activación futura

1. Aplicar `20260825_barbara_metricas_reales.sql`.
2. Crear un secreto aleatorio de al menos 32 caracteres como `BARBARA_METRICAS_WEBHOOK_SECRET`.
3. Desplegar `barbara-metricas` con `--no-verify-jwt`; el HMAC reemplaza la sesión JWT para proveedores externos.
4. Habilitar el workflow `barbara-notificador-hitos.yml` con los secrets de Supabase y Telegram.
5. Conectar un recolector oficial de la red o Metricool. No intentar extraer métricas desde Blotato: su API no las ofrece.

