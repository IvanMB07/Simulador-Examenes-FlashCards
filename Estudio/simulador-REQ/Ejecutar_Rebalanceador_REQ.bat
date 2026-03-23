@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "APP=%SCRIPT_DIR%rebalanceador_respuestas_gui.pyw"

if not exist "%APP%" (
  echo No se encontro el archivo: %APP%
  pause
  exit /b 1
)

start "" "%APP%"
exit /b 0
