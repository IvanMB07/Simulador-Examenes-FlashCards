# Herramientas centrales (Estudio)

Esta carpeta agrupa herramientas compartidas para evitar duplicados por simulador.

## Rebalanceador universal

- Lanzador: Ejecutar_Rebalanceador_Universal.bat
- App: rebalanceador_respuestas_gui.pyw

Funciones incluidas en la app:

- Reequilibrar soluciones A/B/C/D en los JSON de preguntas.
- Renumerar preguntas por tema (T1, T2, ...) empezando desde 01 sin alterar el resto del texto.
- Procesar un archivo o una carpeta completa.
- Crear backups automáticos (.bak-YYYYMMDD-HHMMSS.json).

## Compatibilidad

- simulador-REQ/Ejecutar_Rebalanceador_REQ.bat delega a este lanzador central.
- Si no encuentra el lanzador universal, usa directamente la app central.
