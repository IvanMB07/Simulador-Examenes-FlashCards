@echo off
echo ========================================
echo    REVISOR DE PREGUNTAS ISO
echo ========================================
echo.
echo Iniciando herramienta...
echo.

python revisor_preguntas.py

if errorlevel 1 (
    echo.
    echo ERROR: No se pudo ejecutar el programa.
    echo Asegurate de tener Python instalado.
    echo.
    pause
)
