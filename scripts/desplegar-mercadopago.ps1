<#
  condor.ai - Deja Mercado Pago v2 operativo en el proyecto Supabase nuevo.

  Estado verificado el 22-ago-2026 en ylsqvmggycfijzfvguzq:
    1. La migracion 20260822_mercadopago_v2.sql ya esta aplicada.
    2. Las seis Edge Functions de pagos estan desplegadas y activas.
    3. MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y PORTAL_URL existen en Supabase.

  Este script sirve para rotar credenciales o redesplegar las funciones. Para
  instalar en otro proyecto hay que aplicar tambien la migracion del repo.

  USO
    $env:SUPABASE_ACCESS_TOKEN = "<token de https://supabase.com/dashboard/account/tokens>"
    $env:MP_ACCESS_TOKEN       = "<access token de produccion de Mercado Pago>"
    $env:MP_WEBHOOK_SECRET     = "<clave secreta del webhook en MP>"
    .\scripts\desplegar-mercadopago.ps1

  Los tokens van por variable de entorno de la sesion: no quedan en el repo ni
  en el historial de comandos. Cierra la terminal al terminar.
#>

$ErrorActionPreference = "Stop"
$ref  = "ylsqvmggycfijzfvguzq"
$raiz = Split-Path -Parent $PSScriptRoot

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Falta SUPABASE_ACCESS_TOKEN. Sacalo de supabase.com/dashboard/account/tokens" -ForegroundColor Red
  exit 1
}
if (-not $env:MP_ACCESS_TOKEN) {
  Write-Host "Falta MP_ACCESS_TOKEN (Mercado Pago > Tus integraciones > Credenciales)" -ForegroundColor Red
  exit 1
}

Set-Location $raiz

# --- 1. Verificar que el token de Mercado Pago sea el de la cuenta correcta ---
# Sin esto se despliega a ciegas y el error recien aparece al primer cobro.
Write-Host "`n[1/4] Validando el token de Mercado Pago..." -ForegroundColor Cyan
$cuenta = Invoke-RestMethod -Uri "https://api.mercadopago.com/users/me" `
  -Headers @{ Authorization = "Bearer $($env:MP_ACCESS_TOKEN)" }
Write-Host ("      cuenta {0} - site {1} - {2}" -f $cuenta.id, $cuenta.site_id, $cuenta.email) -ForegroundColor Green
if ($cuenta.site_id -ne "MLC") {
  Write-Host ("      OJO: la cuenta es {0}, no MLC (Chile). Los cobros en CLP van a ser rechazados." -f $cuenta.site_id) -ForegroundColor Yellow
}

# --- 2. Secretos ---
Write-Host "`n[2/4] Cargando secretos en Supabase..." -ForegroundColor Cyan
$secretos = @(
  "MP_ACCESS_TOKEN=$($env:MP_ACCESS_TOKEN)",
  "PORTAL_URL=https://condorai.cl/acceso"
)
if ($env:MP_WEBHOOK_SECRET) {
  $secretos += "MP_WEBHOOK_SECRET=$($env:MP_WEBHOOK_SECRET)"
} else {
  Write-Host "      Sin MP_WEBHOOK_SECRET: el webhook va a rechazar las notificaciones." -ForegroundColor Yellow
}
npx.cmd --yes supabase@2.115.0 secrets set @secretos --project-ref $ref
if ($LASTEXITCODE -ne 0) { Write-Host "Fallo al cargar secretos" -ForegroundColor Red; exit 1 }

# --- 3. Funciones ---
# mp-webhook va con --no-verify-jwt: Mercado Pago no manda JWT de Supabase, y
# su seguridad es la firma (MP_WEBHOOK_SECRET), no el JWT.
Write-Host "`n[3/4] Desplegando Edge Functions..." -ForegroundColor Cyan
foreach ($f in @("crear-pago","verificar-pago","gestionar-suscripcion","pago-lead","crear-plan-suscripcion")) {
  Write-Host "      -> $f"
  npx.cmd --yes supabase@2.115.0 functions deploy $f --project-ref $ref
  if ($LASTEXITCODE -ne 0) { Write-Host "Fallo el deploy de $f" -ForegroundColor Red; exit 1 }
}
Write-Host "      -> mp-webhook (sin verificacion de JWT)"
npx.cmd --yes supabase@2.115.0 functions deploy mp-webhook --no-verify-jwt --project-ref $ref
if ($LASTEXITCODE -ne 0) { Write-Host "Fallo el deploy de mp-webhook" -ForegroundColor Red; exit 1 }

# --- 4. Comprobar que quedaron arriba ---
# Un 401 es EXITO aca: la funcion existe y esta pidiendo sesion. El 404 es el
# problema que veniamos arrastrando.
Write-Host "`n[4/4] Comprobando..." -ForegroundColor Cyan
foreach ($f in @("crear-pago","verificar-pago","gestionar-suscripcion","crear-plan-suscripcion")) {
  try {
    Invoke-WebRequest -Uri "https://$ref.supabase.co/functions/v1/$f" -Method POST `
      -Body "{}" -ContentType "application/json" -UseBasicParsing | Out-Null
    $codigo = 200
  } catch { $codigo = [int]$_.Exception.Response.StatusCode }
  $color = if ($codigo -eq 404) { "Red" } else { "Green" }
  $nota  = if ($codigo -eq 404) { "NO DESPLEGADA" } else { "desplegada (pide sesion, correcto)" }
  Write-Host ("      {0,-24} {1}  {2}" -f $f, $codigo, $nota) -ForegroundColor $color
}

Write-Host "`nListo. Confirma en Mercado Pago > Tus integraciones > Webhooks:" -ForegroundColor Cyan
Write-Host "  URL:"
Write-Host "     https://$ref.supabase.co/functions/v1/mp-webhook"
Write-Host "  Eventos: payment, subscription_preapproval, subscription_authorized_payment."
