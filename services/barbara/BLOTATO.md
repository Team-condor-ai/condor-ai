# Blotato + Bárbara

Esta integración agrega el adaptador de publicación, pero **no publica automáticamente**. El flujo queda bloqueado hasta confirmar la cuenta compartida, conectar las redes de Cóndor y recibir las plantillas finales de Joaquín.

## Estado del flujo

1. Bárbara genera carruseles, guarda un artefacto privado durante 30 días y los envía a Telegram para revisión.
2. `blotato-cli.mjs` valida la cuenta y permite construir una publicación en seco.
3. `Aprobar barbara` dispara un workflow separado que descarga exactamente el artefacto revisado, reserva un bloqueo anti-duplicados, sube la media a Blotato y publica el carrusel.
4. La publicación real exige `BLOTATO_CONFIRMAR_PUBLICACION=PUBLICAR` y un `BLOTATO_INSTAGRAM_ACCOUNT_ID` válido.

## Configuración segura

Primero confirmar con Joaquín si ya existe una cuenta Blotato compartida con Rat.IA/Bárbara. Generar una API key puede iniciar la suscripción pagada, por lo que no debe hacerse por duplicado.

Cuando exista la cuenta:

1. Conectar Instagram de Cóndor y las demás redes acordadas desde Blotato.
2. Guardar la clave como secret de GitHub `BLOTATO_API_KEY`; nunca en `.env`, código, logs ni documentación.
3. Ejecutar manualmente el workflow `Blotato - diagnóstico` con la acción `cuentas`.
4. Copiar el `accountId` de Instagram a la GitHub variable `BLOTATO_INSTAGRAM_ACCOUNT_ID`.

Para Facebook también se necesita el identificador de página en `target.pageId`. `content.platform` y `target.targetType` deben coincidir.

## Uso local

PowerShell, sin guardar la clave en el repositorio:

```powershell
$env:BLOTATO_API_KEY = "..."
node services/barbara/blotato-cli.mjs me
node services/barbara/blotato-cli.mjs cuentas
```

Construir y revisar el payload sin llamar a Blotato:

```powershell
$env:BLOTATO_ACCOUNT_ID = "..."
$env:BLOTATO_PLATFORM = "instagram"
$env:BLOTATO_TEXT = "Caption aprobado"
$env:BLOTATO_MEDIA_URLS = '["https://cdn.example/slide-1.png","https://cdn.example/slide-2.png"]'
node services/barbara/blotato-cli.mjs dry-run
```

La publicación real está deliberadamente protegida:

```powershell
$env:BLOTATO_CONFIRMAR_PUBLICACION = "PUBLICAR"
node services/barbara/blotato-cli.mjs publicar
```

Opcionales:

- `BLOTATO_TARGET_JSON`: propiedades extra del destino, por ejemplo `{"pageId":"..."}` para Facebook.
- `BLOTATO_SCHEDULED_TIME`: fecha ISO 8601. Se envía en la raíz del payload.
- `BLOTATO_USE_NEXT_FREE_SLOT=1`: usa el próximo horario configurado en Blotato.
- `BLOTATO_ESPERAR_RESULTADO=1`: consulta el estado hasta `published` o `failed`.
- `BLOTATO_PAYLOAD_FILE`: archivo JSON ya aprobado, en vez de construirlo desde variables.

## Decisiones pendientes antes de automatizar

- Cuenta Blotato existente/compartida o una cuenta nueva.
- Plantillas definitivas para informativo, servicios/productos Cóndor y Bárbara.
- Redes iniciales y sus respectivos account IDs.
- Aprobación manual o publicación automática.
- Cadencia y horarios por red.
- Reglas del caption por tipo de contenido.
- Retención definitiva y bitácora comercial de publicaciones más allá de los 30 días del artefacto temporal.

Flujo implementado para la primera versión: generar → revisar en Telegram → aprobar explícitamente → publicar el mismo artefacto privado. Así la pieza publicada es exactamente la que se revisó.
