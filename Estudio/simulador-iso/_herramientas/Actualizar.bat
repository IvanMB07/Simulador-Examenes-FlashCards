@echo off
REM Script para actualizar las preguntas del simulador de forma automatica
REM Uso: Edita preguntas_ISO.txt y luego ejecuta este archivo

cls
echo ========================================
echo     SIMULADOR DE EXAMENES - ACTUALIZADOR
echo ========================================
echo.

REM Verificar que exista Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH
    echo Por favor, instala Python desde https://www.python.org
    echo.
    pause
    exit /b 1
)

echo 1. Verificando formato de preguntas...
python _herramientas/test_parser.py >nul 2>&1
if errorlevel 1 (
    echo ERROR: Hay problemas en el formato de preguntas_ISO.txt
    echo.
    python _herramientas/test_parser.py
    echo.
    pause
    exit /b 1
)
echo    ✓ Formato correcto
echo.

echo 2. Buscando duplicados...
python _herramientas/analisis_rapido.py preguntas_ISO.txt >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se pudo analizar las preguntas
    pause
    exit /b 1
)
echo    ✓ Analisis completado (revisa _herramientas/reporte_analisis.txt si hay problemas)
echo.

echo 3. Actualizando simulador...
python reemplazar_preguntas.py preguntas_ISO.txt
if errorlevel 1 (
    echo ERROR: No se pudo actualizar el simulador
    pause
    exit /b 1
)
echo.

echo ========================================
echo     ACTUALIZACION COMPLETADA!
echo ========================================
echo.
echo El simulador ha sido actualizado exitosamente.
echo Abriendo simulador en el navegador...
echo.

start index.html
timeout /t 3 >nul
