@echo off
cls
echo ========================================
echo   ACTUALIZAR PREGUNTAS EN EL SIMULADOR
echo ========================================
echo.
echo Este script actualizara TODAS las preguntas
echo del simulador con las del archivo preguntas_ISO_COMPLETAS.txt
echo.
echo Se creara un backup automaticamente.
echo.
pause
echo.
echo Ejecutando actualizacion...
echo.

python reemplazar_preguntas.py ..\preguntas_ISO_COMPLETAS.txt

echo.
if errorlevel 1 (
    echo ERROR: No se pudo completar la actualizacion.
    pause
) else (
    echo.
    echo ========================================
    echo   LISTO! Abriendo simulador...
    echo ========================================
    echo.
    start ..\index.html
    timeout /t 3 > nul
)
