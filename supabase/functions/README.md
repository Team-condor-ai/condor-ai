# Edge Functions (Supabase · Deno/TypeScript)

| Función | Qué hace |
|---------|----------|
| `diagnostico` | Diagnóstico con IA (Claude) + captura/categoriza leads. Anti-spam y anti prompt-injection. |
| `crear-pago` | Genera cobro en Mercado Pago (setup/mensual) + email al cliente. Monto leído de la base. |
| `mp-webhook` | Confirma pagos, actualiza estados, limpia alertas, avisa por correo. |
| `solicitar-acceso` | Login: envía código SOLO a correos registrados. Rate limit. Envía el código con Resend. |
| `telegram-barbara` | Webhook de Telegram: comando "Denuevo barbara" → re-dispara contenido. |
| `telegram-barbara-clientes` | Webhook de Telegram del módulo multi-cliente de Bárbara: correcciones de cada cliente (máx. 3) → re-dispara `barbara-clientes.yml`, o bloquea y deriva a soporte. |
| `sofia` | (En desarrollo) Agente de email marketing. |
| `contenido` | (En desarrollo) Generador de posts para la base. |

Desplegar: ver `docs/SETUP.md`.
