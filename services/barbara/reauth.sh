#!/usr/bin/env bash
# condor.ai · Barbara — cerrar el re-login de Higgsfield en 1 comando.
# Correr DESPUÉS de:  higgsfield auth login
#
# Toma las credenciales frescas de ~/.config/higgsfield/credentials.json, las
# re-cifra con una llave NUEVA, rota el secret HF_CREDS_KEY en GitHub y sube el
# hf-creds.enc actualizado. No necesita conocer la llave anterior.
set -euo pipefail

REPO="Team-condor-ai/condor-ai"
CRED="$HOME/.config/higgsfield/credentials.json"

cd "$(git rev-parse --show-toplevel)"

if [ ! -f "$CRED" ]; then
  echo "❌ No encuentro $CRED"
  echo "   Corre primero:  higgsfield auth login"
  exit 1
fi

# Aviso si el CLI local es de la serie 1.x (nuevo auth flow): CI está pineado a 0.2.3.
VER="$(higgsfield --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo '?')"
case "$VER" in
  0.2.*) : ;;
  *) echo "⚠️  Tu CLI local es $VER, pero CI usa 0.2.3. Si algo falla, instala 0.2.x:  npm i -g @higgsfield/cli@0.2.3" ;;
esac

KEY="$(openssl rand -hex 32)"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$CRED" -out services/barbara/hf-creds.enc -pass pass:"$KEY"

if command -v gh >/dev/null 2>&1; then
  printf '%s' "$KEY" | gh secret set HF_CREDS_KEY -R "$REPO"
  echo "🔑 Secret HF_CREDS_KEY rotado en GitHub."
else
  echo "⚠️  No hay 'gh' instalado. Setea manualmente el secret HF_CREDS_KEY con este valor:"
  echo "    $KEY"
fi

git add services/barbara/hf-creds.enc
git commit -m "barbara: rotar credenciales Higgsfield (re-auth)"
for n in 1 2 3; do git pull --rebase origin main && git push && break || sleep 5; done

echo "✅ Credenciales de Barbara actualizadas. Puedes disparar un run de prueba desde Actions."
