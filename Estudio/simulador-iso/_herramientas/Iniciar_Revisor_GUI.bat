@echo off
cls
echo ========================================
echo    REVISOR DE PREGUNTAS ISO
echo ========================================
echo.
echo Se han detectado:
echo   - 0 codigos malformados
echo   - 10 grupos de preguntas duplicadas
echo.
echo Abriendo interfaz grafica...
echo.

start "" pythonw revisor_preguntas.py

echo.
echo La herramienta se ha abierto en una ventana separada.
echo Puedes cerrar esta ventana.
echo.
timeout /t 3 > nul
