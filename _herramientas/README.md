# Herramientas auxiliares

Esta carpeta reúne utilidades de mantenimiento compartidas por los simuladores.

## Limpiador de prefijos de respuestas

Retira las etiquetas iniciales de las opciones (A., B., C., D.) para preparar los bancos para el futuro barajado de respuestas.

**La herramienta no modifica los bancos al analizarlos.** Primero muestra una vista previa; los archivos solo se guardan cuando se pulsa «Limpiar archivos» y se confirma la operación.

### Archivo y ejecución

- Archivo: limpiar_prefijos_respuestas.py
- Requisito: Python 3 con Tkinter.
- Ejecución desde la raíz del repositorio:

    python _herramientas/limpiar_prefijos_respuestas.py

Selecciona un banco JSON o una carpeta. En modo carpeta, se buscan recursivamente archivos cuyo nombre coincida con preguntas*.json.

### Criterios de limpieza

- Elimina el prefijo de letra y separador al comienzo de cada opción. Por ejemplo, «A. Texto de respuesta» pasa a «Texto de respuesta».
- Solo modifica preguntas cuyas opciones estén etiquetadas consecutivamente y en el orden esperado (A., B., C., D., etc.).
- Conserva el orden de las opciones.
- No cambia el enunciado, el identificador ni el campo solucion.
- No modifica preguntas sin prefijos.
- Omite preguntas con etiquetas inconsistentes, opciones no textuales o estructuras no reconocidas.
- Admite una lista de preguntas o una lista envuelta en otra lista.

Antes de guardar cada banco, crea una copia de seguridad junto al original con un nombre similar a preguntas.json.bak-20261116-120000. El guardado utiliza un archivo temporal y sustitución atómica.

La herramienta utiliza únicamente módulos de la biblioteca estándar de Python.

## Rebalanceador universal de respuestas

El rebalanceador analiza y modifica bancos JSON para equilibrar la posición de las respuestas correctas.

### Archivos

| Archivo | Función |
|---|---|
| Ejecutar_Rebalanceador_Universal.bat | Lanzador para Windows. |
| rebalanceador_respuestas_gui.pyw | Interfaz y lógica de rebalanceo. |

### Requisitos

- Windows para utilizar el archivo BAT.
- Python 3 instalado.
- Tkinter disponible.

### Cómo utilizarlo

1. Ejecuta Ejecutar_Rebalanceador_Universal.bat.
2. Selecciona un archivo JSON o una carpeta.
3. Revisa el análisis y la distribución de respuestas.
4. Ejecuta el rebalanceo cuando el banco seleccionado sea el esperado.
5. Comprueba el resultado y conserva la copia de seguridad.

La herramienta busca archivos JSON cuyo nombre empiece por preguntas cuando se procesa una carpeta.

### Operaciones disponibles

**1. Reequilibrar las respuestas A/B/C/D**

- Cuenta la distribución de las soluciones.
- Reubica el texto de la opción correcta en la letra que corresponda.
- Mantiene el contenido de las opciones y actualiza el campo solucion.
- Omite preguntas que no tengan cuatro opciones válidas o una solución A/B/C/D reconocible.
- Omite preguntas con más de una letra de solución.

**2. Renumerar preguntas por tema**

Reconoce identificadores con una estructura similar a:

    CODIGO-TEMA-NUMERO-Pregunta: ...

Renumera las preguntas dentro de cada tema y conserva el resto del identificador.

**3. Copias de seguridad**

El rebalanceador crea una copia del archivo original antes de guardar los cambios. Conserva esa copia hasta validar el banco modificado y no incluyas backups en un commit salvo que exista una razón concreta.

## Recomendaciones

- Comprueba que has seleccionado la asignatura correcta.
- Revisa que las preguntas de respuesta múltiple no se estén tratando como preguntas de respuesta única.
- Verifica el resultado y que el JSON sigue siendo válido.
- Revisa algunos enunciados y opciones para confirmar que no ha cambiado su significado.
- Ejecuta npm test desde la raíz del repositorio.

El rebalanceador modifica directamente los archivos seleccionados después de crear su backup. Utilízalo sobre una rama de trabajo y revisa el diff antes de confirmar los cambios.
