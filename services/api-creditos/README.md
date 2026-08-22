# Créditos y tokens API

El workflow `api-creditos.yml` sincroniza cada seis horas una vista normalizada
en `public.api_creditos`. Las llaves viven en GitHub Secrets y nunca llegan al
navegador.

## Configuración

1. Aplicar las migraciones `20260826_eliminar_productos.sql` y
   `20260826_api_creditos.sql` en Supabase.
2. Mantener los secrets existentes de Higgsfield, Blotato y Supabase.
3. Crear en Anthropic Console una **Admin API key** y guardarla como secret
   `ANTHROPIC_ADMIN_KEY`. La `ANTHROPIC_API_KEY` normal no sirve para los
   reportes organizacionales.
4. Ejecutar manualmente el workflow **Sistema - créditos API** una vez.

Higgsfield informa saldo y consumo. Anthropic informa tokens y costo, pero no
el saldo prepago. Blotato permite verificar la conexión, pero su API pública no
expone el saldo; el portal lo dice explícitamente en vez de mostrar cero.
