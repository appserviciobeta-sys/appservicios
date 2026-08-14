# Sube los cambios a GitHub.
#
#   .\subir.ps1                          -> mensaje automatico con la fecha
#   .\subir.ps1 "arregla el precio"      -> mensaje propio
#
# Reintenta el push: GitHub devuelve 500 de vez en cuando y el unico arreglo
# es volver a intentar. Tambien revisa que no se cuele ningun secreto.
#
# Nota: NO se usa $ErrorActionPreference = "Stop". PowerShell 5.1 convierte
# todo lo que git escribe en stderr en un error, y git escribe ahi hasta
# cuando el push sale bien. Con "Stop" el script se cortaba en mitad de un
# push exitoso. Aqui el exito se decide por el codigo de salida y nada mas.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Mensaje)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

function Correr-Git {
    param([string[]]$Argumentos)
    $salida = & git @Argumentos 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ Codigo = $LASTEXITCODE; Texto = ($salida -join "`n") }
}

# Solo opera sobre este proyecto, nunca sobre otro repositorio abierto.
$origen = (Correr-Git @("remote", "get-url", "origin")).Texto.Trim()
if ($origen -notmatch "appservicios") {
    Write-Host "  ABORTADO: el remoto no es appservicios, es '$origen'." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Proyecto : $(Split-Path -Leaf $raiz)" -ForegroundColor Cyan
Write-Host "  Remoto   : $origen" -ForegroundColor Cyan
Write-Host ""

# --- Cambios ---------------------------------------------------------------
Correr-Git @("add", "-A") | Out-Null

$staged = (Correr-Git @("diff", "--cached", "--name-only")).Texto.Split("`n") |
    Where-Object { $_.Trim() -ne "" }

if (-not $staged) {
    $pendientes = (Correr-Git @("log", "origin/main..HEAD", "--oneline")).Texto.Trim()
    if (-not $pendientes) {
        Write-Host "  No hay nada que subir. Todo esta en GitHub." -ForegroundColor Green
        Write-Host ""
        exit 0
    }
    Write-Host "  Sin cambios nuevos, pero hay commits sin subir:" -ForegroundColor Yellow
    $pendientes.Split("`n") | ForEach-Object { Write-Host "    $_" }
} else {
    # --- Red de seguridad: ningun secreto se sube ---------------------------
    $peligrosos = $staged | Where-Object { $_ -match "(^|/)\.env$|(^|/)\.env\.local$|\.pem$|\.key$" }
    if ($peligrosos) {
        Write-Host "  ABORTADO: estos archivos no pueden subirse:" -ForegroundColor Red
        $peligrosos | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Correr-Git @("reset") | Out-Null
        exit 1
    }

    $texto = if ($Mensaje) { $Mensaje -join " " } else { "Cambios del $(Get-Date -Format 'dd/MM/yyyy HH:mm')" }

    Write-Host "  Archivos ($($staged.Count)):" -ForegroundColor Green
    $staged | Select-Object -First 12 | ForEach-Object { Write-Host "    $_" }
    if ($staged.Count -gt 12) { Write-Host "    ... y $($staged.Count - 12) mas" }
    Write-Host ""

    $commit = Correr-Git @("commit", "-q", "-m", $texto)
    if ($commit.Codigo -ne 0) {
        Write-Host "  No se pudo hacer el commit:" -ForegroundColor Red
        Write-Host $commit.Texto -ForegroundColor Red
        exit 1
    }
    Write-Host "  Commit: $texto" -ForegroundColor Green
}

# --- Push con reintentos ---------------------------------------------------
Write-Host ""
$intentos = 4
for ($i = 1; $i -le $intentos; $i++) {
    Write-Host "  Subiendo (intento $i de $intentos)..." -ForegroundColor Cyan
    $push = Correr-Git @("push", "origin", "main")

    if ($push.Codigo -eq 0) {
        Write-Host ""
        Write-Host "  LISTO. Vercel ya esta desplegando." -ForegroundColor Green
        Write-Host "  https://github.com/appserviciobeta-sys/appservicios" -ForegroundColor DarkGray
        Write-Host ""
        exit 0
    }

    $transitorio = $push.Texto -match "Internal Server Error|HTTP 5\d\d|timed out|Connection reset|early EOF|RPC failed"

    if (-not $transitorio) {
        Write-Host ""
        Write-Host "  FALLO (no es un error pasajero):" -ForegroundColor Red
        $push.Texto.Split("`n") | Select-Object -Last 6 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host ""
        exit 1
    }

    Write-Host "  GitHub fallo por su lado. Reintentando en 5 segundos..." -ForegroundColor Yellow
    if ($i -lt $intentos) { Start-Sleep -Seconds 5 }
}

Write-Host ""
Write-Host "  GitHub sigue fallando despues de $intentos intentos." -ForegroundColor Red
Write-Host "  Tus cambios ya estan en un commit local. Vuelve a correr .\subir.ps1 mas tarde." -ForegroundColor Yellow
exit 1
