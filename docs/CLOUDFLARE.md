# Despliegue de Cóndor AI en Cloudflare Workers

El frontend vive en `apps/web-v2` y se publica como **Workers Static Assets**.
Supabase sigue siendo un servicio separado y no se despliega con Wrangler.

## Arquitectura

- `dist/index.html`: sitio corporativo estático.
- `dist/404.html`: cáscara React usada por el portal.
- `/acceso` y `/acceso/*`: el Worker entrega `404.html` con estado 200.
- El resto de los HTML, imágenes y videos se sirve directamente desde Assets.
- Las rutas inexistentes conservan el 404 visual de React.

No se usa el modo SPA global de Cloudflare porque reemplazaría las rutas del
portal con `dist/index.html`, que en este proyecto es la portada estática.

## Primer despliegue de prueba

```powershell
cd apps/web-v2
npm ci
npx wrangler login
npm run cf:deploy
```

El primer deploy crea `condor-ai-web` y entrega una URL `*.workers.dev`. Probar
esa URL antes de asociar el dominio real.

## Variables de compilación

Al conectar Workers Builds con GitHub, configurar en el entorno de build:

- `VITE_META_PIXEL_ID`
- `VITE_LEADS_API`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON`

Las dos últimas se reemplazan cuando Joaquín termine la migración de Supabase.
Nunca guardar valores reales en el repositorio.

## Workers Builds

Conectar el repositorio `Team-condor-ai/condor-ai` y usar:

- Production branch: `main`
- Root directory: `/apps/web-v2`
- Deploy command: `npm run cf:deploy`
- Watch paths: `apps/web-v2/**`

El nombre del proyecto en Cloudflare debe ser exactamente `condor-ai-web`, igual
que el campo `name` de `wrangler.jsonc`.

## Corte del dominio

Solo después de validar el dominio temporal:

1. Agregar `condorai.cl` como Custom Domain del Worker.
2. Agregar `www.condorai.cl` y redirigirlo al dominio principal.
3. Verificar `/`, `/colombia/`, `/acceso`, una ruta interna del portal, demos,
   videos, formularios, Pixel y Supabase.
4. Mantener GitHub Pages disponible durante el corte.
5. Desactivar `deploy-web.yml` y retirar los registros DNS de GitHub únicamente
   después de comprobar Cloudflare en producción.

## Validación local

```powershell
npm run build
npm run cf:check
npx wrangler dev
```

`cf:check` impide desplegar archivos mayores a 25 MiB y confirma que la portada
y la cáscara del portal no se hayan intercambiado.
