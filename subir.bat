@echo off
REM Doble clic aqui para subir los cambios a GitHub.
REM Tambien sirve desde la terminal:  subir "mensaje del cambio"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir.ps1" %*
echo.
pause
