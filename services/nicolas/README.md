# Nicolás — Reportes de ingresos

Agente que corre semanalmente (viernes) y mensualmente (día 30) para generar reportes
de ingresos en Google Sheets y enviarlos a Telegram.

Escribe en Google Sheets vía un **Apps Script Web App** (no usa claves de cuenta de
servicio, así evita la política de seguridad `iam.disableServiceAccountKeyCreation`
de la organización).

## Setup previo (una sola vez)

1. Crea un Google Sheet nuevo (en la cuenta que quieras que sea la dueña).
2. En la hoja: **Extensiones → Apps Script**. Borra lo que haya y pega TODO el
   contenido de `AppsScript.gs`.
3. En la línea `const TOKEN = "..."` pon una clave secreta larga que inventes
   (ej. `nicolas_x9k2_2026`). Anótala.
4. **Implementar → Nueva implementación → Tipo: Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
   - Implementar → autoriza con tu cuenta.
5. Copia la **URL de la app web** (termina en `/exec`).

## Secrets en GitHub

`Settings → Secrets and variables → Actions → New repository secret`

- `NICOLAS_SHEETS_URL` — la URL del Apps Script (termina en `/exec`)
- `NICOLAS_SHEETS_TOKEN` — el TOKEN que pusiste en el Apps Script
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY` — ya existen

## IVA / F29 (8-ago-2026)

El reporte mensual ahora incluye una sección con el IVA débito del RUT de
Cóndor.ai, sumando los clientes de la agencia (`pagos`, solo en CLP) con lo
que cobra Rat.IA por Flow (tabla `ingresos_ratia` — ver
`supabase/migrations/ingresos_ratia.sql` y el Worker en
`vigia-precios/cobro/`). No necesita secrets nuevos: usa los mismos
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de siempre.

Se calcula por **mes calendario** (el que ya cerró), no por la ventana
rolling de 30 días que usa el resto del reporte — el F29 es así. **No
incluye el crédito fiscal** (compras/gastos): eso sigue siendo manual, con
el contador. Nicolás no declara ni paga nada — solo deja los números
calculados.

## Correr manualmente

En GitHub Actions → "Nicolás — Reportes de ingresos" → Run workflow → elegir modo
`semanal` o `mensual`.
