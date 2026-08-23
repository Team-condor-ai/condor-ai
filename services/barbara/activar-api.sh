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

# `read -s` no hace eco, así que las credenciales no quedan en pantalla ni en
# el historial del shell. Se aceptan pegadas por separado o como "id:secret",
# que es como las muestra el dashboard.
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

if [ -z "${KEY_ID:-}" ] || [ -z "${KEY_SECRET:-}" ]; then
  echo "❌ Faltó alguno de los dos valores."
  exit 1
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
