#!/usr/bin/env bash
# condor.ai · Bárbara — activar la API oficial de Higgsfield en UN comando.
#
# Lo único que hay que hacer antes, y a mano, es crear la key en
# https://cloud.higgsfield.ai (está detrás de login con Clerk, no hay API
# para crearla). Este script hace todo lo demás:
#
#   1. pide el KEY_ID y el KEY_SECRET (no se muestran ni quedan en el historial)
#   2. los valida contra la API real, sin gastar créditos
#   3. genera UNA imagen de prueba de verdad (esto sí gasta ~1 crédito)
#   4. los sube como secrets del repo
#   5. dispara una corrida real de Bárbara para confirmar de punta a punta
#
#   bash services/barbara/activar-api.sh
set -euo pipefail

REPO="Team-condor-ai/condor-ai"
cd "$(git rev-parse --show-toplevel)"

echo "🔑 Activar la API oficial de Higgsfield"
echo
echo "Si todavía no creaste la key: https://cloud.higgsfield.ai → sección API."
echo

# De dónde salen las credenciales, en orden de preferencia:
#   1. un archivo pasado como argumento (con "id:secret" o dos líneas)
#   2. las variables de entorno, si ya venían exportadas
#   3. preguntando a mano — sólo si hay una terminal de verdad
#
# El caso 3 NO funciona cuando el script se lanza desde Claude Code con `!`:
# ahí stdin no es una terminal, `read` recibe EOF y con `set -e` el script se
# cerraba en silencio sin decir por qué. De ahí el chequeo explícito.
ARCHIVO="${1:-}"

if [ -n "$ARCHIVO" ]; then
  [ -f "$ARCHIVO" ] || { echo "❌ No encuentro el archivo: $ARCHIVO"; exit 1; }
  # Acepta "id:secret" en una línea, o el id y el secret en dos líneas.
  CRUDO="$(tr -d '\r' < "$ARCHIVO" | grep -v '^[[:space:]]*$' | head -2)"
  if [ "$(printf '%s\n' "$CRUDO" | wc -l)" -ge 2 ]; then
    KEY_ID="$(printf '%s\n' "$CRUDO" | sed -n 1p | tr -d '[:space:]')"
    KEY_SECRET="$(printf '%s\n' "$CRUDO" | sed -n 2p | tr -d '[:space:]')"
  else
    KEY_ID="${CRUDO%%:*}"
    KEY_SECRET="${CRUDO#*:}"
  fi
  echo "   Credenciales leídas de $ARCHIVO"

elif [ -n "${HIGGSFIELD_API_KEY_ID:-}" ] && [ -n "${HIGGSFIELD_API_KEY_SECRET:-}" ]; then
  KEY_ID="$HIGGSFIELD_API_KEY_ID"
  KEY_SECRET="$HIGGSFIELD_API_KEY_SECRET"
  echo "   Usando las credenciales que ya estaban en el entorno."

elif [ -t 0 ]; then
  # `read -s` no hace eco: no quedan en pantalla ni en el historial.
  read -r -s -p "KEY_ID (o pegá 'id:secret' junto): " ENTRADA
  echo
  if [[ "$ENTRADA" == *:* ]]; then
    KEY_ID="${ENTRADA%%:*}"
    KEY_SECRET="${ENTRADA#*:}"
    echo "   (detecté el formato id:secret, separado)"
  else
    KEY_ID="$ENTRADA"
    read -r -s -p "KEY_SECRET: " KEY_SECRET
    echo
  fi

else
  cat <<'AYUDA'
❌ No hay una terminal interactiva, así que no puedo pedirte la key acá.
   (Pasa siempre que se lanza con `!` desde Claude Code.)

Dos formas de seguir, elegí la que te acomode:

A) En una terminal de verdad (Git Bash o la de VS Code), parada en el repo:
     bash services/barbara/activar-api.sh
   Ahí sí te la pide sin mostrarla en pantalla.

B) Sin salir de acá: guardá la key en un archivo temporal y pasáselo.
   Creá un .txt con UNA línea así:   TU_KEY_ID:TU_KEY_SECRET
   (o dos líneas: el id en la primera, el secret en la segunda)
   y después:
     bash services/barbara/activar-api.sh /ruta/al/archivo.txt
   El script lo borra solo al terminar.
AYUDA
  exit 1
fi

if [ -z "${KEY_ID:-}" ] || [ -z "${KEY_SECRET:-}" ]; then
  echo "❌ Faltó alguno de los dos valores."
  exit 1
fi

# Si vinieron de un archivo, se borra pase lo que pase — incluso si el script
# falla a mitad de camino. Un .txt con la key viva olvidado en Descargas es
# justo el tipo de cosa que después aparece en un backup o en un repo.
if [ -n "$ARCHIVO" ]; then
  trap 'rm -f "$ARCHIVO" && echo "   🧹 Borré $ARCHIVO"' EXIT
fi

export HIGGSFIELD_API_KEY_ID="$KEY_ID"
export HIGGSFIELD_API_KEY_SECRET="$KEY_SECRET"

echo
echo "── 1/4 · Validando las credenciales (no gasta créditos)…"
node services/barbara/api-check.mjs

echo
echo "── 2/4 · Generando una imagen de prueba real (~1 crédito)…"
node services/barbara/api-check.mjs --generar

echo
echo "── 3/4 · Subiendo los secrets al repo…"
# Por stdin, nunca como argumento: los argumentos son visibles en la lista de
# procesos de la máquina.
printf '%s' "$KEY_ID"     | gh secret set HIGGSFIELD_API_KEY_ID     -R "$REPO"
printf '%s' "$KEY_SECRET" | gh secret set HIGGSFIELD_API_KEY_SECRET -R "$REPO"
echo "   ✅ HIGGSFIELD_API_KEY_ID y HIGGSFIELD_API_KEY_SECRET guardados."

echo
echo "── 4/4 · Disparando una corrida real de Bárbara…"
gh workflow run barbara.yml -R "$REPO" -f dia=miercoles -f retry=1
echo "   ✅ Lanzada. Mirá el carrusel en el grupo de Telegram en unos minutos."
echo
echo "Seguimiento:  gh run watch -R $REPO"
echo
echo "Si el carrusel llega bien, ya no hace falta volver a loguearse NUNCA más."
echo "Ahí se puede borrar el andamiaje viejo de OAuth (reauth.sh, hf-creds.enc,"
echo "el secret HF_CREDS_KEY y el paso de autenticación del workflow)."
