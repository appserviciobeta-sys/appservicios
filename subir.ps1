# Sube los cambios a GitHub.
#
#   .\subir.ps1                          -> mensaje automatico con la fecha
#   .\subir.ps1 "arregla el precio"      -> mensaje propio
#
# Reintenta el push: GitHub devuelve 500 de vez en cuando y el unico arreglo
# es volver a intentar. Tambien revisa que no se cuele ningun secreto.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Mensaje)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

# Solo opera sobre este proyecto, nunca sobre otro repositorio abierto.
$origen = git remote get-url origin 2>$null
if ($origen -notmatch "appservicios") {
    Write-Host "ABORTADO: el remoto no es appservicios, es '$origen'." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Proyecto : $(Split-Path -Leaf $raiz)" -ForegroundColor Cyan
Write-Host "  Remoto   : $origen" -ForegroundColor Cyan
Write-Host ""

# --- Cambios ---------------------------------------------------------------
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    $pendientes = git log "origin/main..HEAD" --oneline 2>$null
    if (-not $pendientes) {
        Write-Host "  No hay nada que subir." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "  Sin cambios nuevos, pero hay commits sin subir:" -ForegroundColor Yellow
    $pendientes | ForEach-Object { Write-Host "    $_" }
} else {
    # --- Red de seguridad: ningun secreto se sube ---------------------------
    $peligrosos = $staged | Where-Object { $_ -match "(^|/)\.env$|(^|/)\.env\.local$|\.pem$|\.key$" }
    if ($peligrosos) {
        Write-Host "  ABORTADO: estos archivos no pueden subirse:" -ForegroundColor Red
        $peligrosos | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        git reset | Out-Null
        exit 1
    }

    $texto = if ($Mensaje) { $Mensaje -join " " } else { "Cambios del $(Get-Date -Format 'dd/MM/yyyy HH:mm')" }

    Write-Host "  Archivos ($($staged.Count)):" -ForegroundColor Green
    $staged | Select-Object -First 12 | ForEach-Object { Write-Host "    $_" }
    if ($staged.Count -gt 12) { Write-Host "    ... y $($staged.Count - 12) mas" }
    Write-Host ""

    git commit -q -m $texto
    Write-Host "  Commit: $texto" -ForegroundColor Green
}

# --- Push con reintentos ---------------------------------------------------
Write-Host ""
$intentos = 4
for ($i = 1; $i -le $intentos; $i++) {
    Write-Host "  Subiendo (intento $i de $intentos)..." -ForegroundColor Cyan
    $salida = git push origin main 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  LISTO. Vercel ya esta desplegando." -ForegroundColor Green
        Write-Host "  https://github.com/appserviciobeta-sys/appservicios" -ForegroundColor DarkGray
        Write-Host ""
        exit 0
    }

    $texto = $salida -join " "
    $transitorio = $texto -match "Internal Server Error|500|timed out|Connection reset|early EOF|RPC failed"

    if (-not $transitorio) {
        Write-Host ""
        Write-Host "  FALLO (no es un error pasajero):" -ForegroundColor Red
        $salida | Select-Object -Last 6 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  Si pide usuario y contrasena, autenticate una vez con:" -ForegroundColor Yellow
        Write-Host "    git push origin main" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "  GitHub fallo por su lado. Reintentando en 5 segundos..." -ForegroundColor Yellow
    if ($i -lt $intentos) { Start-Sleep -Seconds 5 }
}

Write-Host ""
Write-Host "  GitHub sigue fallando despues de $intentos intentos." -ForegroundColor Red
Write-Host "  Tus cambios estan guardados en un commit local; vuelve a correr .\subir.ps1 mas tarde." -ForegroundColor Yellow
exit 1
