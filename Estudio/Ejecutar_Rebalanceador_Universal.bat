@echo off
setlocal
set "BASE_DIR=%~dp0"
set "APP=%BASE_DIR%simulador-REQ\rebalanceador_respuestas_gui.pyw"

if not exist "%APP%" (
  echo No se encontro el rebalanceador en:
  echo %APP%
  pause
  exit /b 1
)

start "Rebalanceador Universal" "%APP%"
exit /b 0
