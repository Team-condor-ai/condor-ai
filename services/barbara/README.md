# 🎨 Bárbara — motor de contenido para redes

Genera carruseles y reels para Instagram/TikTok con IA y los manda al grupo de Telegram para revisar antes de subir.

## Qué hace

- **Lun / Mié / Vie** → carrusel (`barbara.mjs`): Noticiero IA · IA por industria · Filosofía IA.
- **Mar / Jue** → reel (`reels.mjs`): Trailer de servicios · UGC sobre IA.
- **Memoria anti-repetición** (`content-log.json`): el director lee lo último creado y tiene orden de innovar, nunca repetir ángulo, protagonista o diálogo.

## Cómo funciona

1. Los lunes y viernes Claude investiga en la web.
2. Claude actúa como director creativo, lee la memoria y genera los prompts.
3. **Higgsfield** genera las imágenes (`nano_banana_2`) o el video (`seedance1_5`).
4. El resultado se envía a Telegram con el caption listo.

## Comando «Denuevo barbara»

Si el equipo escribe **«Denuevo barbara»** en el grupo, la Edge Function `telegram-barbara` vuelve a disparar el último contenido mejorado. El setup está en `PASOS_DENUEVO_BARBARA.md`.

## Blotato

El diagnóstico, dry-run y adaptador de publicación protegida están documentados en [BLOTATO.md](./BLOTATO.md). La integración no publica automáticamente y exige una confirmación explícita para cada ejecución real.

## Ejecución

GitHub Actions (`.github/workflows/barbara.yml` y `reels.yml`). Requiere secrets de Higgsfield, Anthropic y Telegram; ver `docs/SETUP.md`.
