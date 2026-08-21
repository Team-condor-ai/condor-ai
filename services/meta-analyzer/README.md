# 📊 Analizador de campañas Meta

Lee la campaña de Meta Ads vía Marketing API, la analiza con Claude (de forma humana y simple)
y manda un reporte al grupo de Telegram **2 veces al día**.

- `meta-analyzer.mjs` — el script.
- Mide lo que importa en campañas de WhatsApp (CTWA): conversaciones iniciadas y su costo.
- Requiere `META_ACCESS_TOKEN` (System User, no expira) y `META_AD_ACCOUNT_ID`.

Corre con `.github/workflows/meta-analyzer.yml`.

## Egresos de publicidad

`sincronizar-egresos.mjs` lleva el gasto diario por campana al libro contable
mediante partida doble. Relee los ultimos 35 dias y actualiza el mismo asiento
si Meta corrige una cifra, sin duplicarla.

Requiere `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`, ademas de la migracion
`20260824_meta_ads_egresos.sql`. Corre diariamente mediante
`.github/workflows/meta-egresos.yml` y tambien se puede lanzar a mano.
