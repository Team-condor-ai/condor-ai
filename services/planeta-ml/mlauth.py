"""
mlauth.py — utilidades compartidas para OAuth2 y llamadas a la API de Mercado Libre.
Solo usa la librería estándar de Python (sin pip install).

Sitio: Chile (MLC). API base: https://api.mercadolibre.com
"""
import base64
import hashlib
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
import urllib.error

API = "https://api.mercadolibre.com"
AUTH_URL = "https://auth.mercadolibre.cl/authorization"   # Chile
TOKEN_URL = f"{API}/oauth/token"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")


# ----------------------------- config -----------------------------
def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise SystemExit(
            "No existe config.json. Copia config.example.json a config.json y "
            "completa client_id, client_secret y redirect_uri."
        )
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


# ----------------------------- PKCE -----------------------------
def gen_pkce():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


def build_auth_url(client_id, redirect_uri, challenge, state):
    q = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
    })
    return f"{AUTH_URL}?{q}"


# ----------------------------- HTTP core -----------------------------
def _do_request(method, url, headers=None, data=None, is_json=True):
    headers = headers or {}
    body = None
    if data is not None:
        if is_json:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            body = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw}
        return e.code, parsed


# ----------------------------- tokens -----------------------------
def exchange_code(cfg, code, verifier):
    status, body = _do_request("POST", TOKEN_URL, data={
        "grant_type": "authorization_code",
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": code,
        "redirect_uri": cfg["redirect_uri"],
        "code_verifier": verifier,
    }, is_json=False)
    if status != 200:
        raise SystemExit(f"Error al canjear el code ({status}): {json.dumps(body, ensure_ascii=False)}")
    return body


def refresh_token(cfg, account):
    acc = cfg["accounts"][account]
    status, body = _do_request("POST", TOKEN_URL, data={
        "grant_type": "refresh_token",
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "refresh_token": acc["refresh_token"],
    }, is_json=False)
    if status != 200:
        raise SystemExit(
            f"No se pudo refrescar el token de '{account}' ({status}): "
            f"{json.dumps(body, ensure_ascii=False)}. Vuelve a correr autorizar.py {account}."
        )
    _store_tokens(cfg, account, body)
    return body["access_token"]


def _store_tokens(cfg, account, token_body):
    cfg.setdefault("accounts", {})
    cfg["accounts"][account] = {
        "access_token": token_body["access_token"],
        "refresh_token": token_body.get("refresh_token", cfg["accounts"].get(account, {}).get("refresh_token")),
        "user_id": token_body.get("user_id"),
        "obtained_at": int(time.time()),
        "expires_in": token_body.get("expires_in"),
    }
    save_config(cfg)


def store_new_tokens(cfg, account, token_body):
    _store_tokens(cfg, account, token_body)


# ----------------------------- authenticated API -----------------------------
def api(cfg, account, method, path, params=None, body=None, _retried_auth=False):
    """Llamada autenticada con auto-refresh (401), backoff de 429 y reintento de 5xx."""
    acc = cfg["accounts"][account]
    token = acc["access_token"]
    url = f"{API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"Authorization": f"Bearer {token}"}

    for attempt in range(6):
        status, resp = _do_request(method, url, headers=headers, data=body, is_json=True)

        if status == 401 and not _retried_auth:
            # token vencido -> refrescar una vez y reintentar
            new_token = refresh_token(cfg, account)
            headers["Authorization"] = f"Bearer {new_token}"
            _retried_auth = True
            continue

        if status == 429:  # rate limit
            wait = 5 * (attempt + 1)
            print(f"   ⏳ 429 rate limit, esperando {wait}s...")
            time.sleep(wait)
            continue

        if status >= 500:  # error transitorio del servidor
            wait = 3 * (attempt + 1)
            print(f"   ⚠️  {status} del servidor, reintento en {wait}s...")
            time.sleep(wait)
            continue

        return status, resp

    return status, resp
