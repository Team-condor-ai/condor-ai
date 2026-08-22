# Aprobar o regenerar contenido de Bárbara desde Telegram

El webhook acepta dos comandos únicamente desde el grupo configurado:

- **`Denuevo barbara`**: vuelve a generar la última pieza.
- **`Aprobar barbara`**: descarga el artefacto privado de GitHub y publica exactamente las imágenes revisadas mediante Blotato.

## Configuración en Supabase

La Edge Function `telegram-barbara` necesita estos secrets:

- `GH_TOKEN`: fine-grained PAT con **Actions: Read and write** y **Contents: Read** para `Team-condor-ai/condor-ai`.
- `TELEGRAM_BOT_TOKEN`: token del bot que usa Bárbara.
- `TELEGRAM_CHAT_ID`: ID exacto del grupo autorizado.
- `GH_REPO=Team-condor-ai/condor-ai` es opcional; ese es el valor predeterminado.

Despliegue:

```powershell
supabase functions deploy telegram-barbara --no-verify-jwt
```

Registrar el webhook, sustituyendo los valores localmente:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-barbara
```

## Configuración en GitHub

- Secret `BLOTATO_API_KEY`.
- Variable `BLOTATO_INSTAGRAM_ACCOUNT_ID` con el ID obtenido de `GET /v2/users/me/accounts`.
- Workflow `Barbara - carruseles RRSS` habilitado cuando el equipo decida reanudar la generación.

Cada generación guarda durante 30 días un artefacto privado llamado `barbara-<run_id>`. La aprobación usa ese artefacto; nunca regenera la pieza en el momento de publicar.
