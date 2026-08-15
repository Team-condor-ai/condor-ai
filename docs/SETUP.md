# ⚙️ Setup — condor.ai

Guía para dejar el proyecto corriendo desde cero. Pensada para un desarrollador nuevo en el equipo.

## 1. Requisitos

- [Node.js](https://nodejs.org) 22+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- Cuenta en: Supabase, Mercado Pago, Anthropic (Claude), Higgsfield, Telegram (bot), Meta (ads).

## 2. Proyecto Supabase

- **Ref del proyecto:** `ogmvdthxwcmvqjlxhpsr`
- **URL:** `https://ogmvdthxwcmvqjlxhpsr.supabase.co`

### Aplicar el esquema (orden importante)
En **Supabase → SQL Editor**, ejecuta los archivos de `supabase/migrations/` en este orden:

1. `schema.sql` — tablas base (leads, contenido)
2. `portal_schema.sql` — clientes y pagos
3. `portal_admin.sql` — roles admin/cliente + RLS
4. `clientes_archivado.sql`
5. `cobros_automaticos.sql`
6. `leads_ip_antispam.sql`
7. `seguridad_login.sql` — rate_limits + correo_autorizado
8. `seguridad_v1345.sql` — RLS reforzado + acceso_log
9. `sheets_sync.sql` — (opcional) triggers a Google Sheets

### Desplegar Edge Functions
```bash
supabase functions deploy diagnostico --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
supabase functions deploy crear-pago --project-ref ogmvdthxwcmvqjlxhpsr
supabase functions deploy mp-webhook --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
supabase functions deploy solicitar-acceso --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
supabase functions deploy telegram-barbara --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
supabase functions deploy telegram-barbara-clientes --project-ref ogmvdthxwcmvqjlxhpsr --no-verify-jwt
```

## 3. Secretos

> 🔑 **Nunca** subas claves al repo. Van en dos lugares según dónde corren.

### Supabase → Edge Functions → Secrets
| Secret | Para qué |
|--------|----------|
| `ANTHROPIC_API_KEY` | Claude (diagnóstico, IA) |
| `MP_ACCESS_TOKEN` | Mercado Pago (producción, empieza con `APP_USR-`) |
| `RESEND_API_KEY` | Correos (cobros, códigos) |
| `EMAIL_FROM` | Remitente, ej. `condor AI <contacto@teamcondorcl.com>` |
| `GH_TOKEN` | (telegram-barbara) PAT con permiso Actions:write |
| `TELEGRAM_WEBHOOK_SECRET` | (telegram-barbara-clientes) valida que el webhook venga de Telegram |
| `GITHUB_DISPATCH_TOKEN` | (telegram-barbara-clientes) PAT con permiso Actions:write, para re-disparar `barbara-clientes.yml` |
| `TELEGRAM_BOT_TOKEN` | (telegram-barbara-clientes) responder al cliente en su chat |

### GitHub → repo → Settings → Secrets → Actions
| Secret | Para qué |
|--------|----------|
| `ANTHROPIC_API_KEY` | Claude en los workflows |
| `HIGGSFIELD_ACCESS_TOKEN` / `HIGGSFIELD_REFRESH_TOKEN` | Generar imágenes/video |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Enviar contenido al grupo |
| `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` | Analizador de campañas |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Cobros diarios / Sheets |
| `RESEND_API_KEY` / `EMAIL_FROM` | Correos desde los crons |

## 4. Frontend

El sitio es estático (`apps/web/`). Para verlo local: abre `index.html` o usa Live Server.
La config (URL de Supabase, anon key pública) está embebida en los HTML del portal/quiz.

## 5. Mercado Pago

- Usar credenciales de **producción** (`APP_USR-`).
- Registrar el webhook: `https://ogmvdthxwcmvqjlxhpsr.supabase.co/functions/v1/mp-webhook` (eventos Pagos + Suscripciones).
